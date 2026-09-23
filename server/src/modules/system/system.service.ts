import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrgNodeDto, UpdateOrgNodeDto } from './dto/create-org-node.dto';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto/update-role.dto';

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
}
