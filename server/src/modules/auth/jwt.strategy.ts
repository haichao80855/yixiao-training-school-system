import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ParentJwtPayload, ParentPrincipal } from '../parent/parent.types';

export interface JwtPayload {
  sub: string;
  account: string;
  campusId: string;
}

type AnyJwtPayload = JwtPayload | ParentJwtPayload;

/** 家长会话 lastSeenAt 写回节流 (毫秒) */
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'shengtong_edu_secret_key_2026_antigravity',
    });
  }

  async validate(payload: AnyJwtPayload) {
    if ((payload as ParentJwtPayload).typ === 'parent') {
      return this.validateParent(payload as ParentJwtPayload);
    }
    return this.validateStaff(payload as JwtPayload);
  }

  /**
   * 家长令牌：校验会话未被注销、账号令牌版本一致；不加载任何教职工角色与权限
   */
  private async validateParent(payload: ParentJwtPayload): Promise<ParentPrincipal> {
    const session = await this.prisma.parentSession.findUnique({
      where: { id: payload.sid },
      include: { account: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.parentAccountId !== payload.sub ||
      session.account.tokenVersion !== payload.ver
    ) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    if (Date.now() - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
      await this.prisma.parentSession
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }
    return {
      principal: 'parent',
      parentAccountId: session.parentAccountId,
      sessionId: session.id,
      phone: session.account.phone,
      roles: [],
      permissions: [],
    };
  }

  private async validateStaff(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        campus: true,
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    // 汇总权限码列表
    const permissions = new Set<string>();
    for (const ur of user.userRoles) {
      if (ur.role.code === 'super_admin') {
        permissions.add('*');
        permissions.add('admin:all');
      }
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.code);
      }
    }

    // 计算最高有效数据权限范围 (优先使用个人独立配置 user.dataScope，若无则从角色范围计算)
    let effectiveDataScope = user.dataScope || 'self';
    if (!user.dataScope) {
      const scopes = user.userRoles.map((ur) => ur.role.dataScope || 'campus');
      if (permissions.has('*') || permissions.has('admin:all') || scopes.includes('all')) {
        effectiveDataScope = 'all';
      } else if (scopes.includes('campus')) {
        effectiveDataScope = 'campus';
      } else if (scopes.includes('department')) {
        effectiveDataScope = 'department';
      }
    } else {
      if (permissions.has('*') || permissions.has('admin:all')) {
        effectiveDataScope = 'all';
      }
    }

    return {
      principal: 'staff' as const,
      id: user.id,
      account: user.account,
      realName: user.realName,
      campusId: user.campusId,
      campusName: user.campus.name,
      departmentId: user.orgNodeId || undefined,
      teacherId: user.id,
      dataScope: effectiveDataScope,
      roles: user.userRoles.map((ur) => ({ id: ur.role.id, code: ur.role.code, name: ur.role.name, dataScope: ur.role.dataScope })),
      permissions: Array.from(permissions),
    };
  }
}
