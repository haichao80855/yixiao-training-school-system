// =======================================================
// 拓视未来教育「一校教培系统」4 级 RBAC 权限树装配引擎 (PermissionTreeEngine)
// 将平铺持久化记录组装为权威 4 级嵌套契约树 (System -> Module -> Page -> Button)
// 统一输出 label, code, level, children 字段，终结渲染断裂与 label 丢失
// =======================================================

export interface RawPermissionItem {
  id: string;
  code: string;
  name: string;
  level: string;
  parentId?: string | null;
  sort?: number;
}

export interface PermissionTreeNode {
  id: string;
  code: string;
  name: string;
  label: string;
  level: 'system' | 'module' | 'page' | 'button';
  parentId?: string | null;
  description?: string;
  children: PermissionTreeNode[];
}

export class PermissionTreeEngine {
  /**
   * 页面与细粒度按钮归属映射字典
   * 建立从 button.code 到 page.code 的父子挂载关联
   */
  private static readonly BUTTON_PARENT_MAP: Record<string, string> = {
    // 系统模块按钮 -> 页面
    'system:company:edit': 'system:org:view',
    'system:org:add': 'system:org:view',
    'system:org:edit': 'system:org:view',
    'system:org:delete': 'system:org:view',
    'system:user:add': 'system:user:view',
    'system:user:edit': 'system:user:view',
    'system:user:delete': 'system:user:view',
    'system:user:resetPwd': 'system:user:view',
    'system:user:status': 'system:user:view',
    'system:role:add': 'system:role:view',
    'system:role:edit': 'system:role:view',
    'system:role:delete': 'system:role:view',
    'system:dict:add': 'system:dict:view',
    'system:dict:edit': 'system:dict:view',
    'system:dict:delete': 'system:dict:view',

    // 教研模块按钮 -> 页面
    'curriculum:course:add': 'curriculum:courseManage',
    'curriculum:course:edit': 'curriculum:courseManage',
    'curriculum:course:delete': 'curriculum:courseManage',
    'curriculum:course:auth': 'curriculum:courseManage',
    'curriculum:course:status': 'curriculum:courseManage',
    'curriculum:lessonPlan:add': 'curriculum:lessonPlan',
    'curriculum:lessonPlan:preview': 'curriculum:lessonPlan',

    // 学员中心按钮 -> 页面
    'student:add': 'student:allStudent',
    'student:edit': 'student:allStudent',
    'student:enroll': 'student:allStudent',
    'student:profile': 'student:allStudent',
    'student:movement': 'student:allStudent',
    'student:face': 'student:allStudent',
    'student:wallet:recharge': 'student:allStudent',
    'student:wallet:withdraw': 'student:allStudent',

    // 教务中心按钮 -> 页面
    'educational:class:add': 'educational:classManagement',
    'educational:class:edit': 'educational:classManagement',
    'educational:class:assign': 'educational:classManagement',
    'educational:schedule:add': 'educational:timeSchedule',
    'educational:schedule:collision': 'educational:timeSchedule',
    'educational:schedule:delete': 'educational:timeSchedule',
    'educational:workbench:attend': 'educational:workbench',
    'educational:attendance:reverse': 'educational:attendance',

    // 财务中心按钮 -> 页面
    'financial:order:voucher': 'financial:orderManagement',
    'financial:order:lock': 'financial:orderManagement',
    'financial:order:void': 'financial:orderManagement',
    'financial:order:refund': 'financial:orderManagement',
    'financial:approval:agree': 'financial:approvalFlow',
    'financial:approval:reject': 'financial:approvalFlow',
    'financial:ledger:export': 'financial:ledger',
  };

  /**
   * 将平铺的权限列表聚合构建为权威 4 级嵌套树形契约
   * @param rawItems 数据库中的扁平权限记录
   * @param options 配置参数，是否包含顶层 1 级系统根节点（默认包含）
   */
  static buildHierarchy(
    rawItems: RawPermissionItem[],
    options?: { includeSystemRoot?: boolean },
  ): PermissionTreeNode[] {
    const includeRoot = options?.includeSystemRoot !== false;

    // 1. 标准化节点数据，保证 label 与 name 100% 对齐
    const itemMap = new Map<string, PermissionTreeNode>();
    for (const item of rawItems) {
      itemMap.set(item.code, {
        id: item.id,
        code: item.code,
        name: item.name,
        label: item.name,
        level: item.level as any,
        parentId: item.parentId || null,
        children: [],
      });
    }

    // 2. 区分 模块 (module)、页面 (page)、按钮 (button) 节点
    const moduleNodes: PermissionTreeNode[] = [];
    const pageNodes: PermissionTreeNode[] = [];
    const buttonNodes: PermissionTreeNode[] = [];

    for (const node of itemMap.values()) {
      if (node.level === 'module') {
        moduleNodes.push(node);
      } else if (node.level === 'page') {
        pageNodes.push(node);
      } else if (node.level === 'button') {
        buttonNodes.push(node);
      }
    }

    // 3. 将按钮节点挂载至对应的页面节点
    const pageMap = new Map<string, PermissionTreeNode>();
    for (const p of pageNodes) {
      pageMap.set(p.code, p);
    }

    for (const btn of buttonNodes) {
      const parentPageCode = this.BUTTON_PARENT_MAP[btn.code];
      const parentPage = parentPageCode ? pageMap.get(parentPageCode) : null;
      if (parentPage) {
        parentPage.children.push(btn);
        btn.parentId = parentPage.id;
      } else {
        // 自适应推导：若未在映射表中，按 namespace 前缀挂载至模块
        const prefix = btn.code.split(':')[0];
        const targetModule = moduleNodes.find((m) => m.code.startsWith(prefix));
        if (targetModule) {
          targetModule.children.push(btn);
          btn.parentId = targetModule.id;
        }
      }
    }

    // 4. 将页面节点挂载至所属的业务模块
    const modulePrefixMap: Record<string, string> = {
      system: 'system:view',
      curriculum: 'curriculum:view',
      student: 'student:view',
      educational: 'educational:view',
      financial: 'financial:view',
    };

    const moduleCodeMap = new Map<string, PermissionTreeNode>();
    for (const m of moduleNodes) {
      moduleCodeMap.set(m.code, m);
    }

    for (const page of pageNodes) {
      const prefix = page.code.split(':')[0];
      const targetModuleCode = modulePrefixMap[prefix] || `${prefix}:view`;
      const targetModule = moduleCodeMap.get(targetModuleCode) || moduleNodes[0];
      if (targetModule) {
        targetModule.children.push(page);
        page.parentId = targetModule.id;
      }
    }

    // 5. 若配置包含 1 级系统全域根节点，构造包裹根节点
    if (includeRoot) {
      const rootNode: PermissionTreeNode = {
        id: 'perm-system-root',
        code: '*',
        name: '一校教培系统全域',
        label: '一校教培系统全域业务系统',
        level: 'system',
        description: '涵盖 5 大核心业务中心所有细粒度功能权限',
        children: moduleNodes,
      };
      return [rootNode];
    }

    return moduleNodes;
  }

  /**
   * 递归收集树形结构下的所有细粒度叶子权限码 (包含通配符处理)
   */
  static collectLeafCodes(nodes: PermissionTreeNode[]): string[] {
    const codes: string[] = [];
    const traverse = (list: PermissionTreeNode[]) => {
      for (const node of list) {
        if (!node.children || node.children.length === 0) {
          codes.push(node.code);
        } else {
          traverse(node.children);
        }
      }
    };
    traverse(nodes);
    return codes;
  }
}
