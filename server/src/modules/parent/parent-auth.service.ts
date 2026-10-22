import { HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { maskCnMobile, normalizeCnMobile } from '../../common/phone.util';
import { ParentChildrenService } from './parent-children.service';
import { WechatMiniProgramClient } from './wechat-mini-program.client';
import { ParentJwtPayload, ParentPrincipal } from './parent.types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX_ATTEMPTS = 30;
const TOKEN_TTL = '7d';
const GENERIC_LOGIN_ERROR = '手机号或密码不正确';

export interface ParentLoginInput {
  phone: string;
  password: string;
  wxCode?: string;
  deviceLabel?: string;
}

/**
 * 家长登录：账号 = 学员档案中的家长手机号，密码 = 手机号后 6 位 (不存储，登录时推导)
 * 同一手机号允许多位家长同时登录 (每次登录新建一个会话，互不挤占)。
 */
@Injectable()
export class ParentAuthService {
  /** 单实例内存限流；多实例部署时应迁移到 Redis */
  private readonly ipAttempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly children: ParentChildrenService,
    private readonly wechat: WechatMiniProgramClient,
  ) {}

  async login(input: ParentLoginInput, ip: string) {
    this.checkIpRate(ip);

    const phone = normalizeCnMobile(input?.phone);
    if (!phone || typeof input?.password !== 'string') {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const children = await this.children.listChildren(phone);
    if (children.length === 0) {
      // 与密码错误同一提示，不暴露手机号是否登记
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const account = await this.prisma.parentAccount.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });

    if (account.lockedUntil && account.lockedUntil > new Date()) {
      const hhmm = account.lockedUntil.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Shanghai',
      });
      throw new HttpException(
        `密码错误次数过多，该手机号已暂时锁定，请于 ${hhmm} 后重试（同一手机号的家长会同时被锁定）`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!this.passwordMatches(phone, input.password)) {
      const failed = account.failedAttempts + 1;
      const lock = failed >= MAX_FAILED_ATTEMPTS;
      await this.prisma.parentAccount.update({
        where: { id: account.id },
        data: lock
          ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) }
          : { failedAttempts: failed },
      });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    if (account.failedAttempts > 0 || account.lockedUntil) {
      await this.prisma.parentAccount.update({
        where: { id: account.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }

    const openId = await this.wechat.resolveOpenId(input.wxCode);
    // 同一微信再次登录时沿用上次查看的孩子
    const previous = openId
      ? await this.prisma.parentSession.findFirst({
          where: { parentAccountId: account.id, wechatOpenId: openId },
          orderBy: { lastSeenAt: 'desc' },
        })
      : null;
    const lastStudentId =
      previous?.lastStudentId && children.some((c) => c.studentId === previous.lastStudentId)
        ? previous.lastStudentId
        : children[0].studentId;

    const session = await this.prisma.parentSession.create({
      data: {
        parentAccountId: account.id,
        wechatOpenId: openId,
        deviceLabel: input.deviceLabel?.slice(0, 64) || null,
        lastStudentId,
      },
    });

    const payload: ParentJwtPayload = { typ: 'parent', sub: account.id, sid: session.id, ver: account.tokenVersion };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: TOKEN_TTL });

    return {
      accessToken,
      expiresIn: 7 * 24 * 3600,
      account: { phoneMasked: maskCnMobile(phone) },
      currentStudentId: lastStudentId,
      children,
    };
  }

  async logout(parent: ParentPrincipal) {
    await this.prisma.parentSession.update({
      where: { id: parent.sessionId },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async listSessions(parent: ParentPrincipal) {
    const sessions = await this.prisma.parentSession.findMany({
      where: { parentAccountId: parent.parentAccountId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel || '微信小程序',
      isCurrent: s.id === parent.sessionId,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
    }));
  }

  async revokeSession(parent: ParentPrincipal, sessionId: string) {
    const result = await this.prisma.parentSession.updateMany({
      where: { id: sessionId, parentAccountId: parent.parentAccountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('会话不存在或已退出');
    return { success: true };
  }

  async setCurrentChild(parent: ParentPrincipal, studentId: string) {
    await this.children.resolveChild(parent, studentId);
    await this.prisma.parentSession.update({
      where: { id: parent.sessionId },
      data: { lastStudentId: studentId },
    });
    return { currentStudentId: studentId };
  }

  /** 教职工操作：使该手机号的全部家长会话失效 */
  async revokeAllForPhone(rawPhone: string) {
    const phone = normalizeCnMobile(rawPhone);
    if (!phone) return { revoked: 0 };
    const account = await this.prisma.parentAccount.findUnique({ where: { phone } });
    if (!account) return { revoked: 0 };
    await this.prisma.parentAccount.update({
      where: { id: account.id },
      data: { tokenVersion: { increment: 1 } },
    });
    const result = await this.prisma.parentSession.updateMany({
      where: { parentAccountId: account.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  private passwordMatches(phone: string, password: string): boolean {
    const expected = Buffer.from(phone.slice(-6));
    const given = Buffer.from(password.trim());
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  }

  private checkIpRate(ip: string) {
    const now = Date.now();
    const recent = (this.ipAttempts.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
    if (recent.length >= IP_MAX_ATTEMPTS) {
      throw new HttpException('登录尝试过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.ipAttempts.set(ip, recent);
    if (this.ipAttempts.size > 10000) this.ipAttempts.clear();
  }
}
