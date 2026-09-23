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

    return {
      id: user.id,
      account: user.account,
      realName: user.realName,
      campusId: user.campusId,
      campusName: user.campus.name,
      roles: user.userRoles.map((ur) => ({ id: ur.role.id, code: ur.role.code, name: ur.role.name, dataScope: ur.role.dataScope })),
      permissions: Array.from(permissions),
    };
  }
}
