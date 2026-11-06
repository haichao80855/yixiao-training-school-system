import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrgNodeDto, UpdateOrgNodeDto, CreateCampusDto, UpdateCampusDto } from './dto/create-org-node.dto';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto/update-role.dto';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './dto/create-user.dto';
import { CreateDictItemDto, UpdateDictItemDto } from './dto/create-dict.dto';
import { UpdateCompanyDto, TransferAdminDto } from './dto/update-company.dto';
import { OrgHierarchyEngine, OrgNodeEntity } from './services/org-hierarchy.engine';
import { PermissionTreeEngine } from './permission-tree.engine';
import { DictCacheManager } from './services/dict-cache.manager';
import { normalizeCnMobile } from '../../common/phone.util';
import { isSuperAdminUser } from '../../common/campus-scope.policy';

/** 发起员工管理操作的当前登录员工，字段来自 JwtStrategy 每次请求从数据库解析的结果 */
export interface StaffOperator {
  id: string;
  campusId: string;
  dataScope: string;
  roles: { id: string; code: string; dataScope?: string | null }[];
  permissions: string[];
}

type ScopedRole = { id: string; code: string; dataScope?: string | null };

const DATA_SCOPE_RANK = new Map<string, number>([
  ['self', 0],
  ['department', 1],
  ['campus', 2],
  ['all', 3],
]);
const CAMPUS_SCOPE_RANK = 2;
const ALL_SCOPE_RANK = 3;

/** 判定口径与 PermissionsGuard 的超管放行保持一致 */
function isSuperAdminRole(role: ScopedRole): boolean {
  return role.code === 'super_admin' || role.code === 'admin' || role.id === 'r1';
}

function isSuperAdminOperator(operator: StaffOperator): boolean {
  return (
    operator.roles.some(isSuperAdminRole) ||
    operator.permissions.includes('*') ||
    operator.permissions.includes('admin:all')
  );
}

function operatorScopeRank(operator: StaffOperator): number {
  if (isSuperAdminUser(operator)) return ALL_SCOPE_RANK;
  return DATA_SCOPE_RANK.get(operator.dataScope) ?? CAMPUS_SCOPE_RANK;
}

/**
 * 账号的有效数据范围，与 JwtStrategy 的计算一致：个人覆写优先，未覆写时取角色中的最高范围。
 * 持有全校区角色时 isSuperAdminUser 视其为全校区，个人覆写无法压低。
 */
function effectiveScopeRank(dataScope: string | null | undefined, roles: ScopedRole[]): number {
  if (dataScope === 'all' || roles.some((role) => role.dataScope === 'all')) return ALL_SCOPE_RANK;
  if (dataScope) return DATA_SCOPE_RANK.get(dataScope) ?? CAMPUS_SCOPE_RANK;
  return Math.max(0, ...roles.map((role) => DATA_SCOPE_RANK.get(role.dataScope || 'campus') ?? CAMPUS_SCOPE_RANK));
}

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

  // 1.1 更新机构基本信息与品牌配置
  async updateCompanyInfo(dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new NotFoundException('机构信息尚未初始化');
    }
    const updated = await this.prisma.company.update({
      where: { id: company.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.stockCode !== undefined && { stockCode: dto.stockCode }),
        ...(dto.legalPerson !== undefined && { legalPerson: dto.legalPerson }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.validUntil !== undefined && { validUntil: dto.validUntil }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.faviconUrl !== undefined && { faviconUrl: dto.faviconUrl }),
        ...(dto.reportLogoUrl !== undefined && { reportLogoUrl: dto.reportLogoUrl }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
    return updated;
  }

  // 1.2 转让超级管理员最高权限 (密码校验 + 角色原子移交)
  async transferSuperAdmin(currentUserId: string, dto: TransferAdminDto) {
    if (!dto.targetUserId) {
      throw new BadRequestException('必须指定接收超级管理员权限的目标员工');
    }
    if (!dto.password) {
      throw new BadRequestException('请输入当前超级管理员密码以进行安全验证');
    }

    // 1. 获取当前操作者（当前超管）
    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });
    if (!currentUser) {
      throw new NotFoundException('当前操作用户不存在');
    }

    // 2. 验证当前超管登录密码
    const isPasswordValid = await bcrypt.compare(dto.password, currentUser.password);
    if (!isPasswordValid) {
      throw new BadRequestException('安全校验失败：超级管理员密码不正确');
    }

    // 3. 目标员工校验
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException('目标转让员工档案不存在');
    }
    if (targetUser.status !== 'active') {
      throw new BadRequestException('目标员工账号处于非正常状态，不可交接超级管理员权限');
    }
    if (targetUser.id === currentUser.id) {
      throw new BadRequestException('目标员工不可为当前超级管理员本人');
    }

    // 4. 角色查找：super_admin 与 principal
    const superRole = await this.prisma.role.findUnique({ where: { code: 'super_admin' } });
    const principalRole = await this.prisma.role.findUnique({ where: { code: 'principal' } });
    if (!superRole || !principalRole) {
      throw new BadRequestException('系统内置角色 (super_admin / principal) 缺失');
    }

    // 5. 原子事务执行权限移交
    await this.prisma.$transaction(async (tx) => {
      // 5.1 移除当前超管的 super_admin 角色，赋予 principal 角色
      await tx.userRole.deleteMany({
        where: { userId: currentUser.id, roleId: superRole.id },
      });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: currentUser.id, roleId: principalRole.id } },
        update: {},
        create: { userId: currentUser.id, roleId: principalRole.id },
      });

      // 5.2 赋予目标员工 super_admin 角色，并将数据范围调整为 all
      await tx.userRole.deleteMany({
        where: { userId: targetUser.id },
      });
      await tx.userRole.create({
        data: { userId: targetUser.id, roleId: superRole.id },
      });
      await tx.user.update({
        where: { id: targetUser.id },
        data: { dataScope: 'all' },
      });

      // 5.3 更新机构 Company 的超管姓名与 ID
      const company = await tx.company.findFirst();
      if (company) {
        await tx.company.update({
          where: { id: company.id },
          data: {
            adminUserId: targetUser.id,
            adminName: targetUser.realName,
          },
        });
      }
    });

    return {
      success: true,
      message: `超级管理员最高权限已成功交接给 [${targetUser.realName}] (${targetUser.account})`,
      newAdmin: {
        id: targetUser.id,
        account: targetUser.account,
        realName: targetUser.realName,
      },
    };
  }

  // 2. 校区清单 (包含 1:1 锚定的组织架构节点)
  async getCampuses() {
    return this.prisma.campus.findMany({
      where: { status: 'active' },
      include: {
        orgNode: true,
      },
      orderBy: [{ isHeadquarter: 'desc' }, { createdAt: 'asc' }],
    });
  }

  // 3. 5 级组织架构树查询 (带子树员工累计统计、物理校区内联详情与 descendantIds)
  async getOrgTree() {
    const nodes = await this.prisma.orgNode.findMany({
      include: {
        campus: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: [{ level: 'asc' }, { createdAt: 'asc' }],
    });

    const { nodeMap, childrenMap } = OrgHierarchyEngine.buildTreeIndices(nodes as any);

    const formattedMap = new Map<string, any>();
    nodes.forEach((n) => {
      const subtreeIds = OrgHierarchyEngine.collectSubtreeIds(n.id, childrenMap);
      formattedMap.set(n.id, {
        id: n.id,
        code: n.code,
        name: n.name,
        type: n.type,
        level: n.level,
        parentId: n.parentId,
        leader: n.leader,
        phone: n.phone,
        status: n.status,
        boundUserCount: n._count.users,
        subtreeUserCount: n._count.users, // 先预填自身，后续递归汇总
        descendantIds: subtreeIds,
        campusId: n.campus?.id || (n.type === 'campus' ? n.id : null),
        campus: n.campus
          ? {
              id: n.campus.id,
              code: n.campus.code,
              name: n.campus.name,
              address: n.campus.address,
              phone: n.campus.phone,
              isHeadquarter: n.campus.isHeadquarter,
            }
          : null,
        children: [],
      });
    });

    // 递归累加全子树员工数 (subtreeUserCount)
    formattedMap.forEach((node) => {
      let total = 0;
      for (const dId of node.descendantIds) {
        total += formattedMap.get(dId)?.boundUserCount || 0;
      }
      node.subtreeUserCount = total;
    });

    const tree: any[] = [];
    nodes.forEach((n) => {
      const current = formattedMap.get(n.id);
      if (n.parentId && formattedMap.has(n.parentId)) {
        formattedMap.get(n.parentId).children.push(current);
      } else {
        tree.push(current);
      }
    });

    return tree;
  }

  // 4. 新增组织节点 (若为校区节点，自动联动落盘物理 Campus 表)
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

    const isCampusNode = dto.type === 'campus' || dto.level === 3;

    if (isCampusNode) {
      // 检查物理校区编码是否冲突
      const campusExist = await this.prisma.campus.findUnique({
        where: { code: dto.code },
      });
      if (campusExist) {
        throw new BadRequestException(`物理校区编码 [${dto.code}] 已存在，请更换`);
      }

      // 事务内原子创建组织节点与物理校区实体
      return this.prisma.$transaction(async (tx) => {
        const orgNode = await tx.orgNode.create({
          data: {
            companyId: company.id,
            code: dto.code,
            name: dto.name,
            type: 'campus',
            level: 3,
            parentId: dto.parentId || null,
            leader: dto.leader,
            phone: dto.phone,
          },
        });

        const campus = await tx.campus.create({
          data: {
            companyId: company.id,
            code: dto.code,
            name: dto.name,
            address: dto.address || null,
            phone: dto.phone || null,
            isHeadquarter: false,
            orgNodeId: orgNode.id,
          },
        });

        return {
          ...orgNode,
          campusId: campus.id,
          campus,
        };
      });
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

  // 5. 修改组织节点 (若为校区节点，同步联动更新物理 Campus 表)
  async updateOrgNode(id: string, dto: UpdateOrgNodeDto) {
    const node = await this.prisma.orgNode.findUnique({
      where: { id },
      include: { campus: true },
    });
    if (!node) {
      throw new NotFoundException('组织节点不存在');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedNode = await tx.orgNode.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.leader !== undefined ? { leader: dto.leader } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
      });

      // 若有关联的物理校区，同步更新校区名称、电话与地址
      if (node.campus) {
        await tx.campus.update({
          where: { id: node.campus.id },
          data: {
            ...(dto.name ? { name: dto.name } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
            ...(dto.address !== undefined ? { address: dto.address } : {}),
            ...(dto.status ? { status: dto.status } : {}),
          },
        });
      }

      return updatedNode;
    });
  }

  // 6. 安全删除组织节点 (组织层级 + 物理校区业务依赖强风控拦截)
  async deleteOrgNode(id: string) {
    const node = await this.prisma.orgNode.findUnique({
      where: { id },
      include: {
        children: true,
        users: true,
        campus: {
          include: {
            classes: true,
            students: true,
            orders: true,
            schedules: true,
          },
        },
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

    // 规则 4: 物理校区强风控拦截 (班级/学员/排课/订单业务依赖屏障)
    if (node.campus) {
      if (node.campus.classes && node.campus.classes.length > 0) {
        throw new BadRequestException(
          `无法删除校区节点 [${node.name}]：该校区仍包含 ${node.campus.classes.length} 个在读或未归档班级，请先办理结课或转班`,
        );
      }
      if (node.campus.students && node.campus.students.length > 0) {
        throw new BadRequestException(
          `无法删除校区节点 [${node.name}]：该校区仍有 ${node.campus.students.length} 名在册学员档案，请先办理学员转校`,
        );
      }
      if (node.campus.orders && node.campus.orders.length > 0) {
        throw new BadRequestException(
          `无法删除校区节点 [${node.name}]：该校区存在 ${node.campus.orders.length} 笔历史财务订单与资金流水，禁止物理删除`,
        );
      }
      if (node.campus.schedules && node.campus.schedules.length > 0) {
        throw new BadRequestException(
          `无法删除校区节点 [${node.name}]：该校区存在 ${node.campus.schedules.length} 条排课日程，请先清理日程`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (node.campus) {
        await tx.campus.delete({ where: { id: node.campus.id } });
      }
      await tx.orgNode.delete({ where: { id } });
    });

    return { success: true, deletedNodeId: id };
  }

  // 6.1 物理校区专有创建 (支持挂载到指定组织树大区节点)
  async createCampus(dto: CreateCampusDto) {
    const company = await this.prisma.company.findFirst();
    if (!company) {
      throw new BadRequestException('请先初始化企业信息');
    }

    const exist = await this.prisma.campus.findUnique({
      where: { code: dto.code },
    });
    if (exist) {
      throw new BadRequestException(`校区编码 [${dto.code}] 已存在`);
    }

    // 查找父级大区节点 (若未传则默认挂载在首个大区或根节点)
    let parentId = dto.parentOrgNodeId;
    if (!parentId) {
      const regionNode = await this.prisma.orgNode.findFirst({
        where: { type: 'region' },
      });
      parentId = regionNode ? regionNode.id : (await this.prisma.orgNode.findFirst({ where: { level: 1 } }))?.id;
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. 同步创建组织树中的校区节点
      const orgNode = await tx.orgNode.create({
        data: {
          companyId: company.id,
          code: `NODE-${dto.code.toUpperCase()}`,
          name: dto.name,
          type: 'campus',
          level: 3,
          parentId: parentId || null,
          phone: dto.phone || null,
        },
      });

      // 2. 创建物理校区
      const campus = await tx.campus.create({
        data: {
          companyId: company.id,
          code: dto.code,
          name: dto.name,
          address: dto.address || null,
          phone: dto.phone || null,
          isHeadquarter: dto.isHeadquarter || false,
          orgNodeId: orgNode.id,
        },
      });

      return {
        ...campus,
        orgNode,
      };
    });
  }

  // 6.2 物理校区专有更新
  async updateCampus(id: string, dto: UpdateCampusDto) {
    const campus = await this.prisma.campus.findUnique({
      where: { id },
      include: { orgNode: true },
    });
    if (!campus) {
      throw new NotFoundException('校区不存在');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.campus.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.status ? { status: dto.status } : {}),
        },
      });

      if (campus.orgNodeId) {
        await tx.orgNode.update({
          where: { id: campus.orgNodeId },
          data: {
            ...(dto.name ? { name: dto.name } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
            ...(dto.status ? { status: dto.status } : {}),
          },
        });
      }

      return updated;
    });
  }

  // 6.3 物理校区安全删除
  async deleteCampus(id: string) {
    const campus = await this.prisma.campus.findUnique({
      where: { id },
      include: {
        classes: true,
        students: true,
        orders: true,
        schedules: true,
        users: true,
      },
    });

    if (!campus) {
      throw new NotFoundException('校区不存在');
    }

    if (campus.isHeadquarter) {
      throw new BadRequestException('集团总部校区严禁删除');
    }

    if (campus.classes.length > 0) {
      throw new BadRequestException(`该校区仍有 ${campus.classes.length} 个班级，禁止删除`);
    }
    if (campus.students.length > 0) {
      throw new BadRequestException(`该校区仍有 ${campus.students.length} 名学员，禁止删除`);
    }
    if (campus.orders.length > 0) {
      throw new BadRequestException(`该校区仍有 ${campus.orders.length} 笔订单，禁止删除`);
    }
    if (campus.users.length > 0) {
      throw new BadRequestException(`该校区仍有 ${campus.users.length} 位在职员工，禁止删除`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (campus.orgNodeId) {
        await tx.orgNode.delete({ where: { id: campus.orgNodeId } });
      }
      await tx.campus.delete({ where: { id } });
    });

    return { success: true, message: `校区 [${campus.name}] 已安全删除` };
  }

  // 7. 4 级权限清单与权威树形结构查询 (默认输出结构化 4 级树，支持 flat=true 扁平查询)
  async getPermissions(options?: { flat?: boolean }) {
    const rawPermissions = await this.prisma.permission.findMany({
      orderBy: [{ level: 'asc' }, { sort: 'asc' }],
    });

    if (options?.flat) {
      return rawPermissions.map((p) => ({
        ...p,
        label: p.name,
      }));
    }

    return PermissionTreeEngine.buildHierarchy(rawPermissions);
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

    // 查询传入权限码对应的有效实体 (支持通配符 * 一键全选所有权限)
    const isAll = dto.permissionCodes.includes('*') || dto.permissionCodes.includes('admin:all');
    const validPerms = await this.prisma.permission.findMany({
      where: isAll ? {} : { code: { in: dto.permissionCodes } },
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

  // 11. 业务字典列表 (接入高性能 DictCacheManager 内存缓存与 TTL 机制)
  async getDictItems(category?: string) {
    const cacheManager = DictCacheManager.getInstance();
    return cacheManager.get(category, async () => {
      return this.prisma.dictItem.findMany({
        where: category ? { category } : {},
        orderBy: [{ category: 'asc' }, { order: 'asc' }],
      });
    });
  }

  // 11.1 业务字典缓存指标可观测查询
  getDictCacheStats() {
    return DictCacheManager.getInstance().getStats();
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

  // 14. 员工账号列表 (支持校区、组织节点子树穿透、搜索词、角色、状态多维过滤)
  async getUsers(filter?: {
    campusId?: string;
    keyword?: string;
    roleId?: string;
    status?: string;
    orgNodeId?: string;
  }) {
    const where: any = {};

    // 预加载所有组织节点用于祖先链路回溯推导与子树收集
    const allOrgNodes = await this.prisma.orgNode.findMany({
      include: { campus: true },
    });
    const { nodeMap, childrenMap } = OrgHierarchyEngine.buildTreeIndices(allOrgNodes as any);

    // 组织节点过滤 (支持子树级联穿透)
    if (filter?.orgNodeId && filter.orgNodeId !== 'all') {
      const subtreeIds = OrgHierarchyEngine.collectSubtreeIds(filter.orgNodeId, childrenMap);
      const targetNode = nodeMap.get(filter.orgNodeId);
      const targetCampusId = targetNode?.campus?.id;

      if (targetCampusId) {
        where.OR = [
          { orgNodeId: { in: subtreeIds } },
          { campusId: targetCampusId },
        ];
      } else {
        where.orgNodeId = { in: subtreeIds };
      }
    }

    if (filter?.campusId && filter.campusId !== 'all') {
      where.campusId = filter.campusId;
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.keyword) {
      const kw = filter.keyword.trim();
      const kwCondition = [
        { account: { contains: kw } },
        { realName: { contains: kw } },
        { phone: { contains: kw } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: kwCondition }];
        delete where.OR;
      } else {
        where.OR = kwCondition;
      }
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
      const ancestry = OrgHierarchyEngine.resolveAncestry(u.orgNodeId, nodeMap);

      const realCampusId = u.campusId || ancestry.inferredCampusId || '';
      const realCampusName = u.campus?.name || ancestry.inferredCampusName || '';
      const realDepartmentId =
        ancestry.inferredDepartmentId || (u.orgNode?.level === 4 ? u.orgNode.id : '');
      const realDepartmentName =
        ancestry.inferredDepartmentName ||
        (u.orgNode?.level === 4 ? u.orgNode.name : u.orgNode?.name || '');
      const realPostId =
        ancestry.inferredPostId || (u.orgNode?.level === 5 ? u.orgNode.id : '');
      const realPostName =
        ancestry.inferredPostName ||
        (u.orgNode?.level === 5 ? u.orgNode.name : primaryRole?.name || '员工');

      return {
        id: u.id,
        account: u.account,
        name: u.realName,
        realName: u.realName,
        phone: u.phone || '',
        email: u.email || '',
        campusId: realCampusId,
        campusName: realCampusName,
        orgNodeId: u.orgNodeId || '',
        departmentId: realDepartmentId,
        departmentName: realDepartmentName,
        postId: realPostId,
        postName: realPostName,
        orgPath:
          ancestry.fullPath ||
          (u.campus?.name ? `${u.campus.name} / ${u.orgNode?.name || ''}` : ''),
        roleId: primaryRole?.id || '',
        roleName: primaryRole?.name || '普通员工',
        dataScope: u.dataScope || primaryRole?.dataScope || 'campus',
        status: u.status,
        createdAt: u.createdAt,
      };
    });
  }

  // 15. 创建员工账号 (统一默认初始密码 123456)
  async createUser(dto: CreateUserDto, operator: StaffOperator) {
    const targetRole = dto.roleId ? await this.findRoleByIdOrCode(dto.roleId) : null;
    await this.assertCanAssignAccess(operator, {
      campusId: dto.campusId,
      orgNodeId: dto.orgNodeId,
      dataScope: dto.dataScope,
      roles: targetRole ? [targetRole] : [],
    });

    const trimmedAccount = dto.account ? dto.account.trim() : '';
    if (!trimmedAccount) {
      throw new BadRequestException('员工登录工号/账号不能为空');
    }

    const exist = await this.prisma.user.findUnique({
      where: { account: trimmedAccount },
    });
    if (exist) {
      throw new BadRequestException(`员工登录账号 [${trimmedAccount}] 已存在，请更换`);
    }

    const trimmedPhone = dto.phone?.trim() ? this.parseEmployeePhone(dto.phone) : null;
    if (trimmedPhone) {
      const phoneExist = await this.prisma.user.findFirst({
        where: { phone: trimmedPhone },
      });
      if (phoneExist) {
        throw new BadRequestException(
          `手机号码 [${trimmedPhone}] 已被员工 [${phoneExist.realName || phoneExist.account}] 绑定，不可重复使用`,
        );
      }
    }

    if (!dto.campusId) {
      throw new BadRequestException('请选择员工管辖校区');
    }
    await this.assertUserPlacement(dto.campusId, dto.orgNodeId);

    const plainPassword = dto.password?.trim() || '123456';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        account: trimmedAccount,
        password: hashedPassword,
        realName: dto.realName?.trim() || trimmedAccount,
        phone: trimmedPhone,
        email: dto.email ? dto.email.trim() : null,
        campusId: dto.campusId,
        orgNodeId: dto.orgNodeId || null,
        status: dto.status || 'active',
        dataScope: dto.dataScope || null,
      },
    });

    if (targetRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: targetRole.id,
        },
      });
    }

    return {
      id: user.id,
      account: user.account,
      realName: user.realName,
      phone: user.phone,
      message: '员工账号创建成功，默认初始密码为 123456',
    };
  }

  private findRoleByIdOrCode(roleIdOrCode: string) {
    return this.prisma.role.findFirst({
      where: {
        OR: [{ id: roleIdOrCode }, { code: roleIdOrCode }],
      },
    });
  }

  /**
   * 目标账号是否在操作者的管辖范围内。重置密码等于接管账号，因此超管账号和
   * 数据范围高于操作者的账号一律不可操作，否则可绕过授予环节的限制。
   */
  private async assertCanManageUser(
    operator: StaffOperator,
    target: { id: string; campusId: string; dataScope: string | null },
  ): Promise<ScopedRole[]> {
    const targetRoles = await this.prisma.userRole.findMany({
      where: { userId: target.id },
      select: { role: { select: { id: true, code: true, dataScope: true } } },
    });
    const roles = targetRoles.map((ur) => ur.role);
    if (isSuperAdminOperator(operator)) {
      return roles;
    }

    if (roles.some(isSuperAdminRole)) {
      throw new ForbiddenException('操作权限受限：仅超级管理员可操作超级管理员账号');
    }
    const operatorRank = operatorScopeRank(operator);
    if (effectiveScopeRank(target.dataScope, roles) > operatorRank) {
      throw new ForbiddenException('操作权限受限：不可操作数据范围高于自身的员工账号');
    }
    if (operatorRank < ALL_SCOPE_RANK && target.campusId !== operator.campusId) {
      throw new ForbiddenException('操作权限受限：不可操作其他校区的员工账号');
    }
    return roles;
  }

  /** 新的角色、数据范围、校区与组织节点是否在操作者的授权范围内，须在任何写库之前调用 */
  private async assertCanAssignAccess(
    operator: StaffOperator,
    next: {
      campusId?: string;
      orgNodeId?: string | null;
      dataScope?: string | null;
      roles: ScopedRole[];
    },
  ) {
    if (isSuperAdminOperator(operator)) {
      return;
    }

    if (next.roles.some(isSuperAdminRole)) {
      throw new ForbiddenException('操作权限受限：仅超级管理员可授予超级管理员角色');
    }
    if (next.dataScope && !DATA_SCOPE_RANK.has(next.dataScope)) {
      throw new BadRequestException(`数据范围 [${next.dataScope}] 不合法`);
    }
    const operatorRank = operatorScopeRank(operator);
    if (effectiveScopeRank(next.dataScope, next.roles) > operatorRank) {
      throw new ForbiddenException('操作权限受限：不可将员工的数据范围设置为超出自身的范围');
    }

    if (operatorRank === ALL_SCOPE_RANK) {
      return;
    }
    if (next.campusId && next.campusId !== operator.campusId) {
      throw new ForbiddenException('操作权限受限：不可将员工安排到其他校区');
    }
    if (next.orgNodeId) {
      const nodeCampusId = await this.findOrgNodeCampusId(next.orgNodeId);
      if (nodeCampusId && nodeCampusId !== operator.campusId) {
        throw new ForbiddenException('操作权限受限：不可将员工安排到其他校区的组织节点');
      }
    }
  }

  /** 沿组织树向上查找节点所属校区；集团、大区等校区以上的节点没有所属校区 */
  private async findOrgNodeCampusId(orgNodeId: string): Promise<string | undefined> {
    const visited = new Set<string>();
    let currentId: string | null = orgNodeId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node: { parentId: string | null; campus: { id: string } | null } | null =
        await this.prisma.orgNode.findUnique({
          where: { id: currentId },
          select: { parentId: true, campus: { select: { id: true } } },
        });
      if (!node) return undefined;
      if (node.campus) return node.campus.id;
      currentId = node.parentId;
    }
    return undefined;
  }

  /** 校验员工所属校区与组织节点真实存在，避免外键报错把数据库原始异常抛给前端 */
  private async assertUserPlacement(campusId?: string, orgNodeId?: string | null) {
    if (campusId) {
      const campus = await this.prisma.campus.findUnique({ where: { id: campusId }, select: { id: true } });
      if (!campus) {
        throw new BadRequestException('所选校区不存在或已被删除，请刷新页面后重新选择');
      }
    }
    if (orgNodeId) {
      const node = await this.prisma.orgNode.findUnique({ where: { id: orgNodeId }, select: { id: true } });
      if (!node) {
        throw new BadRequestException('所选归属部门/岗位不存在或已被删除，请刷新页面后重新选择');
      }
    }
  }

  /** 员工手机号同时是登录凭据，录错会导致登录提示“账号不存在”，因此入库前必须校验 */
  private parseEmployeePhone(raw: string): string {
    const phone = normalizeCnMobile(raw);
    if (!phone) {
      throw new BadRequestException(`手机号码 [${raw.trim()}] 格式不正确，请填写 11 位手机号码`);
    }
    return phone;
  }

  // 16. 编辑员工账号
  async updateUser(id: string, dto: UpdateUserDto, operator: StaffOperator) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('员工账号不存在');
    }

    const currentRoles = await this.assertCanManageUser(operator, user);
    const targetRole = dto.roleId ? await this.findRoleByIdOrCode(dto.roleId) : null;
    await this.assertCanAssignAccess(operator, {
      campusId: dto.campusId,
      // 未变更的组织节点不校验：历史数据的节点归属不应阻塞其他字段的保存
      orgNodeId: dto.orgNodeId !== user.orgNodeId ? dto.orgNodeId : undefined,
      dataScope: dto.dataScope !== undefined ? dto.dataScope : user.dataScope,
      roles: targetRole ? [targetRole] : currentRoles,
    });

    let trimmedPhone: string | null | undefined = undefined;
    if (dto.phone !== undefined) {
      const rawPhone = dto.phone ? dto.phone.trim() : '';
      // 号码未变化时不校验格式：历史不规范号码不应阻塞其他字段的保存
      trimmedPhone = !rawPhone ? null : rawPhone === user.phone ? rawPhone : this.parseEmployeePhone(rawPhone);
      if (trimmedPhone) {
        const phoneExist = await this.prisma.user.findFirst({
          where: {
            phone: trimmedPhone,
            NOT: { id },
          },
        });
        if (phoneExist) {
          throw new BadRequestException(
            `手机号码 [${trimmedPhone}] 已被其他员工 [${phoneExist.realName || phoneExist.account}] 绑定`,
          );
        }
      }
    }

    await this.assertUserPlacement(dto.campusId || undefined, dto.orgNodeId || undefined);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.realName ? { realName: dto.realName.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: trimmedPhone } : {}),
        ...(dto.email !== undefined ? { email: dto.email ? dto.email.trim() : null } : {}),
        ...(dto.campusId ? { campusId: dto.campusId } : {}),
        ...(dto.orgNodeId !== undefined ? { orgNodeId: dto.orgNodeId } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.dataScope !== undefined ? { dataScope: dto.dataScope } : {}),
      },
    });

    if (targetRole) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.create({
        data: {
          userId: id,
          roleId: targetRole.id,
        },
      });
    }

    return updatedUser;
  }

  // 17. 删除员工账号
  async deleteUser(id: string, operator: StaffOperator) {
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
    await this.assertCanManageUser(operator, user);
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
  async resetUserPassword(id: string, operator: StaffOperator, newPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('员工账号不存在');
    }
    await this.assertCanManageUser(operator, user);

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
  async toggleUserStatus(id: string, operator: StaffOperator, targetStatus?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('员工账号不存在');
    }
    await this.assertCanManageUser(operator, user);
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

  // 20. 业务字典项增删改 (支持 remark 持久化与自驱缓存失效)
  async createDictItem(dto: CreateDictItemDto) {
    const created = await this.prisma.dictItem.create({
      data: {
        category: dto.category,
        dictKey: dto.dictKey,
        label: dto.label,
        order: dto.order ?? 0,
        enabled: dto.enabled ?? true,
        remark: dto.remark || null,
      },
    });

    // 变更自驱触发缓存失效
    DictCacheManager.getInstance().invalidate(dto.category);
    return created;
  }

  async updateDictItem(id: string, dto: UpdateDictItemDto) {
    const existing = await this.prisma.dictItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('字典项不存在');
    }

    const updated = await this.prisma.dictItem.update({
      where: { id },
      data: {
        ...(dto.label ? { label: dto.label } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      },
    });

    // 变更自驱触发缓存失效
    DictCacheManager.getInstance().invalidate(existing.category);
    return updated;
  }

  async deleteDictItem(id: string) {
    const existing = await this.prisma.dictItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('字典项不存在');
    }

    const deleted = await this.prisma.dictItem.delete({ where: { id } });
    DictCacheManager.getInstance().invalidate(existing.category);
    return deleted;
  }

  async toggleDictItemStatus(id: string, enabled?: boolean) {
    const item = await this.prisma.dictItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('字典项不存在');
    }
    const nextEnabled = enabled !== undefined ? enabled : !item.enabled;
    const updated = await this.prisma.dictItem.update({
      where: { id },
      data: { enabled: nextEnabled },
    });

    DictCacheManager.getInstance().invalidate(item.category);
    return updated;
  }
}
