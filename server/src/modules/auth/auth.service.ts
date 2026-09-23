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

  async validateUser(account: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { account },
      include: {
        campus: true,
        userRoles: {
          include: {
            role: true,
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

    return {
      accessToken: token,
      user: {
        id: user.id,
        account: user.account,
        realName: user.realName,
        campusId: user.campusId,
        campusName: user.campus.name,
        roles: user.userRoles.map((ur: any) => ({
          code: ur.role.code,
          name: ur.role.name,
          dataScope: ur.role.dataScope,
        })),
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
