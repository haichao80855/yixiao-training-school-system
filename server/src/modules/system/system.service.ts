import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrgNodeDto, UpdateOrgNodeDto } from './dto/create-org-node.dto';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto/update-role.dto';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './dto/create-user.dto';
import { CreateDictItemDto, UpdateDictItemDto } from './dto/create-dict.dto';

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. 获取机构基本信息
  async getCompanyInfo() {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new NotFoundException('机构信息尚未初始化');
    }
    const campusCount = await this.prisma.campus.count();
    const userCount = await this.prisma.user.count({ where: { status: 'active' } });
    const courseCount = await this.prisma.course.count();

    return {
      ...company,
      metrics: {
        campusCount,
        activeEmployeeCount: userCount,
        subjectCount: 4,
        operationalStatus: 'normal',
      },
    };
  }

  // 2. 校区清单
  async getCampuses() {
    return this.prisma.campus.findMany({
      where: { status: 'active' },
      orderBy: { isHeadquarter: 'desc' },
    });
  }

  // 3. 5 级组织架构树查询
  async getOrgTree() {
    const nodes = await this.prisma.orgNode.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
    });

    const nodeMap = new Map<string, any>();
    nodes.forEach((n) => {
      nodeMap.set(n.id, {
        id: n.id,
        code: n.code,
        name: n.name,
        type: n.type,
        level: n.level,
        parentId: n.parentId,
        leader: n.leader,
        phone: n.phone,
        boundUserCount: n._count.users,
        children: [],
      });
    });

    const tree: any[] = [];
    nodes.forEach((n) => {
      const current = nodeMap.get(n.id);
      if (n.parentId && nodeMap.has(n.parentId)) {
        nodeMap.get(n.parentId).children.push(current);
      } else {
        tree.push(current);
      }
    });

    return tree;
  }

  // 4. 新增组织节点
  async createOrgNode(dto: CreateOrgNodeDto) {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new BadRequestException('请先初始化企业信息');
    }

    const exist = await this.prisma.orgNode.findUnique({
      where: { code: dto.code },
    });
    if (exist) {
      throw new BadRequestException(`组织节点编码 [${dto.code}] 已存在`);
    }

    return this.prisma.orgNode.create({
      data: {
        companyId: company.id,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        level: dto.level,
        parentId: dto.parentId || null,
        leader: dto.leader,
        phone: dto.phone,
      },
    });
  }

  // 5. 修改组织节点
  async updateOrgNode(id: string, dto: UpdateOrgNodeDto) {
    const node = await this.prisma.orgNode.findUnique({ where: { id } });
    if (!node) {
      throw new NotFoundException('组织节点不存在');
    }

    return this.prisma.orgNode.update({
      where: { id },
      data: dto,
    });
  }

  // 6. 安全删除组织节点 (严格执行盛通教培中台风控规则)
  async deleteOrgNode(id: string) {
    const node = await this.prisma.orgNode.findUnique({
      where: { id },
      include: {
        children: true,
        users: true,
      },
    });

    if (!node) {
      throw new NotFoundException(`组织节点 [${id}] 不存在`);
    }

    // 规则 1: 根节点不可删
    if (node.level === 1 || node.type === 'group') {
      throw new BadRequestException('集团总部根节点严禁删除 (Root group node cannot be deleted)');
    }

    // 规则 2: 非空子树不可删
    if (node.children && node.children.length > 0) {
      throw new BadRequestException(
        `无法删除节点 [${node.name}]：该节点下仍包含 ${node.children.length} 个下级组织子节点 (HasChildNodesException)`,
      );
    }

    // 规则 3: 绑定在职员工不可删
    if (node.users && node.users.length > 0) {
      throw new BadRequestException(
        `无法删除节点 [${node.name}]：该节点仍绑定有 ${node.users.length} 位在职员工账号`,
      );
    }

    await this.prisma.orgNode.delete({ where: { id } });
    return { success: true, deletedNodeId: id };
  }

  // 7. 4 级权限清单查询
  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ level: 'asc' }, { sort: 'asc' }],
    });
  }

  // 8. 角色列表与细粒度权限查询
  async getRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        _count: {
          select: { userRoles: true },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      dataScope: r.dataScope,
      isSystem: r.isSystem,
      userCount: r._count.userRoles,
      permissions: r.permissions.map((p) => p.permission.code),
    }));
  }

  // 9. 角色新建
  async createRole(dto: CreateRoleDto) {
    const exist = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });
    if (exist) {
      throw new BadRequestException(`角色编码 [${dto.code}] 已存在`);
    }

    return this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        dataScope: dto.dataScope || 'campus',
      },
    });
  }

  // 10. 为角色分配权限 (全量覆盖式保存)
  async assignRolePermissions(roleId: string, dto: AssignPermissionsDto) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    // 查询传入权限码对应的有效实体
    const validPerms = await this.prisma.permission.findMany({
      where: { code: { in: dto.permissionCodes } },
    });

    // 开启事务：删除旧关联并重建新绑定
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (validPerms.length > 0) {
        await tx.rolePermission.createMany({
          data: validPerms.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        });
      }
    });

    return {
      roleId,
      assignedCount: validPerms.length,
      permissions: validPerms.map((p) => p.code),
    };
  }

  // 11. 业务字典列表
  async getDictItems(category?: string) {
    return this.prisma.dictItem.findMany({
      where: category ? { category } : {},
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  }

  // 12. 角色更新 (更新名称、描述、数据范围 dataScope)
  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.dataScope ? { dataScope: dto.dataScope } : {}),
      },
    });
  }

  // 13. 角色删除 (校验系统内置角色与绑定员工保护)
  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    if (role.isSystem || ['super_admin', 'principal', 'teacher', 'r1', 'r2', 'r3', 'r4'].includes(role.code)) {
      throw new BadRequestException(`系统内置核心角色 [${role.name}] 禁止删除`);
    }
    if (role._count.userRoles > 0) {
      throw new BadRequestException(`无法删除角色 [${role.name}]：当前仍有 ${role._count.userRoles} 位员工绑定该角色`);
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.role.delete({ where: { id } });
    return { success: true, message: `角色 [${role.name}] 已成功删除` };
  }

  // 14. 员工账号列表 (支持校区、搜索词、角色、状态多维过滤)
  async getUsers(filter?: { campusId?: string; keyword?: string; roleId?: string; status?: string }) {
    const where: any = {};

    if (filter?.campusId && filter.campusId !== 'all') {
      where.campusId = filter.campusId;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.keyword) {
      const kw = filter.keyword.trim();
      where.OR = [
        { account: { contains: kw } },
        { realName: { contains: kw } },
        { phone: { contains: kw } },
      ];
    }
    if (filter?.roleId) {
      where.userRoles = {
        some: { roleId: filter.roleId },
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        campus: true,
        orgNode: true,
        userRoles: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => {
      const primaryRole = u.userRoles[0]?.role;
      return {
        id: u.id,
        account: u.account,
        name: u.realName,
        realName: u.realName,
        phone: u.phone || '',
        email: u.email || '',
        campusId: u.campusId,
        campusName: u.campus?.name || '',
        orgNodeId: u.orgNodeId || '',
        departmentId: u.orgNodeId || '',
        departmentName: u.orgNode?.name || '',
        postId: u.orgNodeId || '',
        postName: u.orgNode?.name || '',
        roleId: primaryRole?.id || '',
        roleName: primaryRole?.name || '普通员工',
        dataScope: primaryRole?.dataScope || 'campus',
        status: u.status,
        createdAt: u.createdAt,
      };
    });
  }

  // 15. 创建员工账号 (统一默认初始密码 123456)
  async createUser(dto: CreateUserDto) {
    const exist = await this.prisma.user.findUnique({
      where: { account: dto.account },
    });
    if (exist) {
      throw new BadRequestException(`员工登录账号 [${dto.account}] 已存在，请更换`);
    }

    const plainPassword = dto.password?.trim() || '123456';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        account: dto.account,
        password: hashedPassword,
        realName: dto.realName,
        phone: dto.phone || null,
        email: dto.email || null,
        campusId: dto.campusId,
        orgNodeId: dto.orgNodeId || null,
        status: dto.status || 'active',
      },
    });

    if (dto.roleId) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: dto.roleId,
        },
      });
    }

    return {
      id: user.id,
      account: user.account,
      realName: user.realName,
      message: '员工账号创建成功，默认初始密码为 123456',
    };
  }

  // 16. 编辑员工账号
  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('员工账号不存在');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.realName ? { realName: dto.realName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.campusId ? { campusId: dto.campusId } : {}),
        ...(dto.orgNodeId !== undefined ? { orgNodeId: dto.orgNodeId } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });

    if (dto.roleId) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.create({
        data: {
          userId: id,
          roleId: dto.roleId,
        },
      });
    }

    return updatedUser;
  }

  // 17. 删除员工账号
  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        classesTaught: true,
        schedules: true,
      },
    });
    if (!user) {
      throw new NotFoundException('员工账号不存在');
    }
    if (user.account === 'donghaichao' || user.account === 'admin') {
      throw new BadRequestException('系统根超级管理员账号禁止删除');
    }
    if (user.classesTaught && user.classesTaught.length > 0) {
      throw new BadRequestException(`无法删除该员工：其仍担任 ${user.classesTaught.length} 个在读班级的主教老师，请先移交班级`);
    }

    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });

    return { success: true, message: `员工 [${user.realName}] 已成功删除` };
  }

  // 18. 重置员工密码为初始密码 123456
  async resetUserPassword(id: string, newPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('员工账号不存在');
    }

    const targetPassword = newPassword?.trim() || '123456';
    const hashedPassword = await bcrypt.hash(targetPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return {
      success: true,
      account: user.account,
      message: `员工 [${user.realName}] 的登录密码已重置为 [${targetPassword}]`,
    };
  }

  // 19. 启停员工账号
  async toggleUserStatus(id: string, targetStatus?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('员工账号不存在');
    }
    if (user.account === 'donghaichao' && (targetStatus === 'disabled' || user.status === 'active')) {
      throw new BadRequestException('超级管理员账号禁止停用');
    }

    const nextStatus = targetStatus || (user.status === 'active' ? 'disabled' : 'active');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: nextStatus },
    });

    return {
      id: updated.id,
      account: updated.account,
      status: updated.status,
      message: `员工状态已变更为: ${updated.status === 'active' ? '正常在职' : '已停用禁用'}`,
    };
  }

  // 20. 业务字典项增删改
  async createDictItem(dto: CreateDictItemDto) {
    return this.prisma.dictItem.create({
      data: {
        category: dto.category,
        dictKey: dto.dictKey,
        label: dto.label,
        order: dto.order ?? 0,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async updateDictItem(id: string, dto: UpdateDictItemDto) {
    return this.prisma.dictItem.update({
      where: { id },
      data: {
        ...(dto.label ? { label: dto.label } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      },
    });
  }

  async deleteDictItem(id: string) {
    return this.prisma.dictItem.delete({ where: { id } });
  }

  async toggleDictItemStatus(id: string, enabled?: boolean) {
    const item = await this.prisma.dictItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('字典项不存在');
    }
    const nextEnabled = enabled !== undefined ? enabled : !item.enabled;
    return this.prisma.dictItem.update({
      where: { id },
      data: { enabled: nextEnabled },
    });
  }
}
