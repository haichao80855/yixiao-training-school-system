import type {
  OrgNode,
  OrgTreeValidationResult,
  CheckState,
  DataScope
} from '@/types/system';

export class RBACEngine {
  // 5 级组织树管理与删除校验
  static validateNodeDeletion(tree: OrgNode[] | OrgNode, nodeIdToDelete: string): OrgTreeValidationResult {
    let targetNode: OrgNode | null = null;

    function findNode(nodes: OrgNode[] | OrgNode) {
      const list = Array.isArray(nodes) ? nodes : [nodes];
      for (const node of list) {
        if (node.id === nodeIdToDelete) {
          targetNode = node;
          return;
        }
        if (node.children && node.children.length > 0) {
          findNode(node.children);
        }
      }
    }

    findNode(tree);

    if (!targetNode) {
      throw new Error(`Node ${nodeIdToDelete} not found in organizational tree`);
    }

    const tNode = targetNode as OrgNode;

    if (tNode.level === 1 && tNode.type === 'group') {
      throw new Error('Root organization group node cannot be deleted');
    }

    if (tNode.children && tNode.children.length > 0) {
      throw new Error(
        `Cannot delete node [${tNode.name}] because it contains ${tNode.children.length} child nodes (HasChildNodesException)`
      );
    }

    if (tNode.boundUserCount && tNode.boundUserCount > 0) {
      throw new Error(
        `Cannot delete node [${tNode.name}] because it is currently bound to ${tNode.boundUserCount} active employees`
      );
    }

    return { canDelete: true, node: tNode };
  }

  // 4 级权限树半选联动算法 (Indeterminate)
  static updateTreeCheckState(node: any): CheckState {
    if (!node.children || node.children.length === 0) {
      return { checked: !!node.checked, indeterminate: false };
    }

    let allChecked = true;
    let anyChecked = false;
    let anyIndeterminate = false;

    for (const child of node.children) {
      const childState = this.updateTreeCheckState(child);
      if (childState.checked) {
        anyChecked = true;
      } else {
        allChecked = false;
      }
      if (childState.indeterminate) {
        anyIndeterminate = true;
      }
    }

    if (allChecked) {
      node.checked = true;
      node.indeterminate = false;
    } else if (anyChecked || anyIndeterminate) {
      node.checked = false;
      node.indeterminate = true;
    } else {
      node.checked = false;
      node.indeterminate = false;
    }

    return { checked: node.checked, indeterminate: node.indeterminate };
  }

  // 批量勾选/取消勾选子树
  static setSubtreeChecked(node: any, checked: boolean) {
    node.checked = checked;
    node.indeterminate = false;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.setSubtreeChecked(child, checked);
      }
    }
  }

  // 权限检查 (支持 '*' 与 'admin:all' 通配放行)
  static hasPermission(userPermissions: string[] = [], requiredPermission: string): boolean {
    if (userPermissions.includes('*') || userPermissions.includes('admin:all')) {
      return true;
    }
    return userPermissions.includes(requiredPermission);
  }

  // 数据范围过滤器
  static filterByDataScope<T = any>(
    user: { dataScope: DataScope; campusId?: string; departmentId?: string; id?: string },
    dataItems: T[],
    itemCampusIdField = 'campusId',
    itemDeptIdField = 'departmentId',
    itemOwnerField = 'ownerId'
  ): T[] {
    if (user.dataScope === 'all') {
      return dataItems;
    }
    if (user.dataScope === 'campus') {
      return dataItems.filter((item: any) => item[itemCampusIdField] === user.campusId);
    }
    if (user.dataScope === 'department') {
      return dataItems.filter((item: any) => item[itemDeptIdField] === user.departmentId);
    }
    if (user.dataScope === 'self') {
      return dataItems.filter((item: any) => item[itemOwnerField] === user.id);
    }
    return [];
  }
}
