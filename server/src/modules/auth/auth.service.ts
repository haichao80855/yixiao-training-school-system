import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, pass: string): Promise<any> {
    const trimmed = identifier ? identifier.trim() : '';
    if (!trimmed) {
      throw new UnauthorizedException('请输入账号或手机号码');
    }

    // 双轨匹配：支持工号/用户名 (account) 或 手机号码 (phone) 登录
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ account: trimmed }, { phone: trimmed }],
      },
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

    if (!user) {
      throw new UnauthorizedException('账号不存在');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('账号已被锁定停用');
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('密码错误');
    }

    return user;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      account: user.account,
      campusId: user.campusId,
    };

    const token = this.jwtService.sign(payload);

    const permissions = new Set<string>();
    for (const ur of user.userRoles) {
      if (ur.role.code === 'super_admin' || ur.role.code === 'admin') {
        permissions.add('*');
        permissions.add('admin:all');
      }
      if (ur.role.permissions) {
        for (const rp of ur.role.permissions) {
          if (rp.permission?.code) {
            permissions.add(rp.permission.code);
          }
        }
      }
    }

    let effectiveDataScope = user.dataScope || 'self';
    if (!user.dataScope) {
      const scopes = user.userRoles.map((ur: any) => ur.role.dataScope || 'campus');
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
      accessToken: token,
      user: {
        id: user.id,
        account: user.account,
        realName: user.realName,
        phone: user.phone || undefined,
        campusId: user.campusId,
        campusName: user.campus.name,
        departmentId: user.orgNodeId || undefined,
        dataScope: effectiveDataScope,
        roles: user.userRoles.map((ur: any) => ({
          code: ur.role.code,
          name: ur.role.name,
          dataScope: ur.role.dataScope,
        })),
        permissions: Array.from(permissions),
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

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

    // 计算有效数据范围
    let effectiveDataScope = user.dataScope || 'self';
    if (!user.dataScope) {
      const scopes = user.userRoles.map((ur: any) => ur.role.dataScope || 'campus');
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

    // 查询该操作员有权限管辖的校区列表 (如果是超管则返回全量校区)
    const isSuper = user.userRoles.some((ur) => ur.role.code === 'super_admin');
    const allCampuses = await this.prisma.campus.findMany({
      where: { status: 'active' },
      select: { id: true, code: true, name: true, isHeadquarter: true },
    });

    const authorizedCampuses = isSuper
      ? allCampuses
      : allCampuses.filter((c) => c.id === user.campusId);

    return {
      id: user.id,
      account: user.account,
      realName: user.realName,
      phone: user.phone,
      campusId: user.campusId,
      campusName: user.campus.name,
      dataScope: effectiveDataScope,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        code: ur.role.code,
        name: ur.role.name,
        dataScope: ur.role.dataScope,
      })),
      permissions: Array.from(permissions),
      authorizedCampuses,
    };
  }
}
