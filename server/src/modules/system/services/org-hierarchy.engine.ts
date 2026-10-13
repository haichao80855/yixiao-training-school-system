/**
 * ============================================================================
 * 组织架构层级图解析深模块引擎 (Organization Hierarchy Engine)
 * 职责：
 * 1. 沿树向上追溯祖先链路，精准解析集团/大区/校区/部门/岗位全景层级，彻底解耦部门与岗位
 * 2. 沿树向下收集子树全部子孙节点 ID，支撑大区/校区/部门级联穿透检索
 * 3. 统计各节点自身及全子树累计在职员工数 (subtreeUserCount)
 * ============================================================================
 */

export interface OrgNodeEntity {
  id: string;
  code: string;
  name: string;
  type: string; // group | region | campus | department | post
  level: number;
  parentId: string | null;
  leader?: string | null;
  phone?: string | null;
  status?: string;
  campus?: {
    id: string;
    code: string;
    name: string;
    address?: string | null;
    phone?: string | null;
  } | null;
}

export interface ResolvedOrgPath {
  group?: { id: string; name: string; code: string };
  region?: { id: string; name: string; code: string };
  campus?: { id: string; name: string; code: string; physicalCampusId?: string };
  department?: { id: string; name: string; code: string };
  post?: { id: string; name: string; code: string };
  fullPath: string;
  inferredCampusId?: string;
  inferredCampusName?: string;
  inferredDepartmentId?: string;
  inferredDepartmentName?: string;
  inferredPostId?: string;
  inferredPostName?: string;
}

export class OrgHierarchyEngine {
  /**
   * 给定一个组织节点 ID，沿 parentId 向上解析完整的祖先链路
   */
  static resolveAncestry(
    nodeId: string | null | undefined,
    nodeMap: Map<string, OrgNodeEntity>,
  ): ResolvedOrgPath {
    const result: ResolvedOrgPath = {
      fullPath: '',
    };

    if (!nodeId || !nodeMap.has(nodeId)) {
      return result;
    }

    const pathNodes: OrgNodeEntity[] = [];
    let curr: OrgNodeEntity | undefined = nodeMap.get(nodeId);
    const visited = new Set<string>();

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      pathNodes.unshift(curr); // 根节点排在前面

      if (curr.parentId && nodeMap.has(curr.parentId)) {
        curr = nodeMap.get(curr.parentId);
      } else {
        break;
      }
    }

    result.fullPath = pathNodes.map((n) => n.name).join(' / ');

    // 按节点层级或类型分类
    for (const n of pathNodes) {
      if (n.type === 'group' || n.level === 1) {
        result.group = { id: n.id, name: n.name, code: n.code };
      } else if (n.type === 'region' || n.level === 2) {
        result.region = { id: n.id, name: n.name, code: n.code };
      } else if (n.type === 'campus' || n.level === 3) {
        result.campus = {
          id: n.id,
          name: n.name,
          code: n.code,
          physicalCampusId: n.campus?.id,
        };
        result.inferredCampusId = n.campus?.id || n.id;
        result.inferredCampusName = n.campus?.name || n.name;
      } else if (n.type === 'department' || n.level === 4) {
        result.department = { id: n.id, name: n.name, code: n.code };
        result.inferredDepartmentId = n.id;
        result.inferredDepartmentName = n.name;
      } else if (n.type === 'post' || n.level === 5) {
        result.post = { id: n.id, name: n.name, code: n.code };
        result.inferredPostId = n.id;
        result.inferredPostName = n.name;
      }
    }

    // 如果最底层节点本身是部门，岗位标记为“未定岗”
    const targetNode = nodeMap.get(nodeId);
    if (targetNode && (targetNode.type === 'department' || targetNode.level === 4)) {
      result.inferredPostId = '';
      result.inferredPostName = '通用职能岗';
    } else if (targetNode && (targetNode.type === 'campus' || targetNode.level === 3)) {
      result.inferredDepartmentId = '';
      result.inferredDepartmentName = '校区管理部';
      result.inferredPostId = '';
      result.inferredPostName = '执行校长/负责人';
    }

    return result;
  }

  /**
   * 收集目标节点下辖的所有子孙节点 ID (包括自身)
   */
  static collectSubtreeIds(
    nodeId: string,
    childrenMap: Map<string, string[]>,
  ): string[] {
    const result: string[] = [nodeId];
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = childrenMap.get(currentId) || [];
      for (const childId of children) {
        result.push(childId);
        queue.push(childId);
      }
    }

    return result;
  }

  /**
   * 构建组织节点全量 children 映射与 nodeMap
   */
  static buildTreeIndices(nodes: OrgNodeEntity[]) {
    const nodeMap = new Map<string, OrgNodeEntity>();
    const childrenMap = new Map<string, string[]>();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
      if (node.parentId) {
        const list = childrenMap.get(node.parentId) || [];
        list.push(node.id);
        childrenMap.set(node.parentId, list);
      }
    }

    return { nodeMap, childrenMap };
  }
}
