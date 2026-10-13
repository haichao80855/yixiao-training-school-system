import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  account: string;
  campusId: string;
}

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

  async validate(payload: JwtPayload) {
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
