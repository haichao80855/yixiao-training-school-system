/**
 * 系统设置 5 级组织架构树与 4 级细粒度 RBAC 权限引擎 (RBAC Engine)
 * 对应 PROJECT.md § Interface Contracts & Features 24, 25
 */

class RBACEngine {
  // 5 级组织树管理
  static validateNodeDeletion(tree, nodeIdToDelete) {
    let targetNode = null;

    function findNode(nodes) {
      for (const node of nodes) {
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

    if (targetNode.level === 1 && targetNode.type === 'group') {
      throw new Error('Root organization group node cannot be deleted');
    }

    if (targetNode.children && targetNode.children.length > 0) {
      throw new Error(`Cannot delete node [${targetNode.name}] because it contains ${targetNode.children.length} child nodes (HasChildNodesException)`);
    }

    if (targetNode.boundUserCount && targetNode.boundUserCount > 0) {
      throw new Error(`Cannot delete node [${targetNode.name}] because it is currently bound to ${targetNode.boundUserCount} active employees`);
    }

    return { canDelete: true, node: targetNode };
  }

  // 4 级权限树半选联动算法 (Indeterminate)
  static updateTreeCheckState(node) {
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
  static setSubtreeChecked(node, checked) {
    node.checked = checked;
    node.indeterminate = false;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.setSubtreeChecked(child, checked);
      }
    }
  }

  // 权限检查
  static hasPermission(userPermissions = [], requiredPermission) {
    if (userPermissions.includes('*') || userPermissions.includes('admin:all')) {
      return true;
    }
    return userPermissions.includes(requiredPermission);
  }

  // 数据范围过滤器
  static filterByDataScope(user, dataItems, itemCampusIdField = 'campusId', itemDeptIdField = 'departmentId', itemOwnerField = 'ownerId') {
    if (user.dataScope === 'all') {
      return dataItems;
    }
    if (user.dataScope === 'campus') {
      return dataItems.filter(item => item[itemCampusIdField] === user.campusId);
    }
    if (user.dataScope === 'department') {
      return dataItems.filter(item => item[itemDeptIdField] === user.departmentId);
    }
    if (user.dataScope === 'self') {
      return dataItems.filter(item => item[itemOwnerField] === user.id);
    }
    return [];
  }
}

module.exports = RBACEngine;
