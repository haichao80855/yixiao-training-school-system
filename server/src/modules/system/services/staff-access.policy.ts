import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { isSuperAdminUser } from "../../../common/campus-scope.policy";

/**
 * 员工账号管理的越权边界。
 *
 * 超级管理员不受限制。其他操作者：
 * - 只能管理本校区员工（全校区数据范围除外），且对方的权限和数据范围都不能超过自己；
 * - 只能分配权限和数据范围不超过自己的角色，超管角色一律不可分配；
 * - 不能修改自己的角色和数据范围。
 * 同校区同级别的账号（如另一位校长）可以互相管理。
 */

/** JwtStrategy 写入 request.user 的操作者信息 */
export interface StaffActor {
  id: string;
  campusId: string;
  dataScope?: string;
  roles?: { id: string; code: string; dataScope?: string }[];
  permissions: string[];
}

export interface RoleWithPermissions {
  id: string;
  code: string;
  dataScope: string;
  permissions: { permission: { code: string } }[];
}

export interface ManagedUser {
  id: string;
  campusId: string;
  dataScope: string | null;
  status: string;
  userRoles: { role: RoleWithPermissions }[];
}

export interface UserChange {
  role?: RoleWithPermissions | null;
  /** undefined 表示不修改，null 表示清除个人覆写并继承角色默认范围 */
  dataScope?: string | null;
  campusId?: string;
  status?: string;
}

const DATA_SCOPE_RANK: Record<string, number> = {
  self: 0,
  department: 1,
  campus: 2,
  all: 3,
};
const WILDCARD_PERMISSIONS = ["*", "admin:all"];

/** 校验数据范围取值：空值表示继承角色默认范围，未知取值直接拒绝 */
export function parseDataScope(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  if (typeof raw !== "string" || !(raw in DATA_SCOPE_RANK)) {
    throw new BadRequestException(`数据范围 [${String(raw)}] 不合法`);
  }
  return raw;
}

/** 真正的超级管理员：持有通配权限。仅 dataScope=all 的账号不算，只能跨校区 */
export function isFullAdmin(actor: StaffActor): boolean {
  return actor.permissions.some((code) => WILDCARD_PERMISSIONS.includes(code));
}

function isSuperRole(role: RoleWithPermissions): boolean {
  return (
    role.code === "super_admin" ||
    role.code === "admin" ||
    role.id === "r1" ||
    role.permissions.some((rp) =>
      WILDCARD_PERMISSIONS.includes(rp.permission.code),
    )
  );
}

function actorScope(actor: StaffActor): string {
  return isSuperAdminUser(actor) ? "all" : actor.dataScope || "self";
}

/**
 * 账号实际生效的数据范围，与 JwtStrategy 的计算保持一致。
 * 角色默认范围为 all 时，isSuperAdminUser 会放行跨校区，即使个人覆写更低也按 all 计。
 */
function effectiveScope(
  personal: string | null,
  roles: RoleWithPermissions[],
): string {
  const roleScopes = roles.map((role) => role.dataScope || "campus");
  if (roleScopes.includes("all")) {
    return "all";
  }
  if (personal) {
    return personal;
  }
  if (roleScopes.includes("campus")) {
    return "campus";
  }
  return roleScopes.includes("department") ? "department" : "self";
}

function exceedsScope(scope: string, limit: string): boolean {
  return (
    (DATA_SCOPE_RANK[scope] ?? DATA_SCOPE_RANK.all) >
    (DATA_SCOPE_RANK[limit] ?? 0)
  );
}

function exceedsPermissions(
  actor: StaffActor,
  role: RoleWithPermissions,
): boolean {
  return role.permissions.some(
    (rp) => !actor.permissions.includes(rp.permission.code),
  );
}

export function canAccessAllCampuses(actor: StaffActor): boolean {
  return isFullAdmin(actor) || actorScope(actor) === "all";
}

function assertCampusAllowed(actor: StaffActor, campusId: string): void {
  if (!canAccessAllCampuses(actor) && campusId !== actor.campusId) {
    throw new ForbiddenException("无权操作其他校区的员工");
  }
}

/** 删除、重置密码、启停、编辑前都必须通过：防止接管权限更高的账号 */
export function assertCanManageUser(
  actor: StaffActor,
  target: ManagedUser,
): void {
  if (isFullAdmin(actor)) {
    return;
  }
  assertCampusAllowed(actor, target.campusId);

  const roles = target.userRoles.map((ur) => ur.role);
  if (roles.some(isSuperRole)) {
    throw new ForbiddenException("无权操作超级管理员账号");
  }
  if (
    exceedsScope(effectiveScope(target.dataScope, roles), actorScope(actor)) ||
    roles.some((role) => exceedsPermissions(actor, role))
  ) {
    throw new ForbiddenException("无权操作权限或数据范围高于自己的员工");
  }
}

/** 新建员工或变更角色、数据范围时校验：最终结果不能超过操作者自身 */
function assertCanGrantAccess(
  actor: StaffActor,
  role: RoleWithPermissions | null | undefined,
  finalScope: string,
): void {
  if (isFullAdmin(actor)) {
    return;
  }
  if (role && isSuperRole(role)) {
    throw new ForbiddenException("只有超级管理员才能授予超级管理员角色");
  }
  if (role && exceedsPermissions(actor, role)) {
    throw new ForbiddenException("不能分配权限超出自己的角色");
  }
  if (exceedsScope(finalScope, actorScope(actor))) {
    throw new ForbiddenException("不能把数据范围设置为超出自己的范围");
  }
}

export function assertCanCreateUser(
  actor: StaffActor,
  campusId: string,
  role: RoleWithPermissions | null,
  dataScope: string | null,
): void {
  assertCampusAllowed(actor, campusId);
  assertCanGrantAccess(
    actor,
    role,
    effectiveScope(dataScope, role ? [role] : []),
  );
}

export function assertCanUpdateUser(
  actor: StaffActor,
  target: ManagedUser,
  change: UserChange,
): void {
  if (isFullAdmin(actor)) {
    return;
  }
  const currentRoles = target.userRoles.map((ur) => ur.role);
  const finalRoles = change.role ? [change.role] : currentRoles;
  const finalPersonal =
    change.dataScope !== undefined ? change.dataScope : target.dataScope;
  const finalScope = effectiveScope(finalPersonal, finalRoles);

  assertCanGrantAccess(actor, change.role, finalScope);
  if (change.campusId) {
    assertCampusAllowed(actor, change.campusId);
  }

  if (actor.id === target.id) {
    const roleChanged =
      !!change.role &&
      !(currentRoles.length === 1 && currentRoles[0].id === change.role.id);
    if (
      roleChanged ||
      finalScope !== effectiveScope(target.dataScope, currentRoles)
    ) {
      throw new ForbiddenException(
        "不能修改自己的角色和数据范围，请联系超级管理员",
      );
    }
  }

  // PUT 也能改状态，不能让它绕过启停接口要求的权限
  if (
    change.status &&
    change.status !== target.status &&
    !actor.permissions.includes("system:user:status")
  ) {
    throw new ForbiddenException(
      "权限不足，缺少必要权限码: [system:user:status]",
    );
  }
}
