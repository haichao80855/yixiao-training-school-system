// ==========================================
// 系统设置与 RBAC 中台 Mock 数据基石与业务引擎
// 对应 PROJECT.md § Feature 24, 25 及 MODULE_ANALYSIS_DESIGN.md § 六
// ==========================================

import type {
  OrgNode,
  OrgTreeValidationResult,
  PermissionNode,
  RoleItem,
  SystemUser,
  DictItem,
  DataScope,
  CheckState
} from '@/types/system'

// --- 1. RBACEngine 核心业务引擎契约实现 ---
export class RBACEngine {
  // 5 级组织树管理与删除校验
  static validateNodeDeletion(tree: OrgNode[] | OrgNode, nodeIdToDelete: string): OrgTreeValidationResult {
    let targetNode: OrgNode | null = null

    function findNode(nodes: OrgNode[] | OrgNode) {
      const list = Array.isArray(nodes) ? nodes : [nodes]
      for (const node of list) {
        if (node.id === nodeIdToDelete) {
          targetNode = node
          return
        }
        if (node.children && node.children.length > 0) {
          findNode(node.children)
        }
      }
    }

    findNode(tree)

    if (!targetNode) {
      throw new Error(`Node ${nodeIdToDelete} not found in organizational tree`)
    }

    const tNode = targetNode as OrgNode

    if (tNode.level === 1 && tNode.type === 'group') {
      throw new Error('Root organization group node cannot be deleted')
    }

    if (tNode.children && tNode.children.length > 0) {
      throw new Error(
        `Cannot delete node [${tNode.name}] because it contains ${tNode.children.length} child nodes (HasChildNodesException)`
      )
    }

    if (tNode.boundUserCount && tNode.boundUserCount > 0) {
      throw new Error(
        `Cannot delete node [${tNode.name}] because it is currently bound to ${tNode.boundUserCount} active employees`
      )
    }

    return { canDelete: true, node: tNode }
  }

  // 4 级权限树半选联动算法 (Indeterminate)
  static updateTreeCheckState(node: any): CheckState {
    if (!node.children || node.children.length === 0) {
      return { checked: !!node.checked, indeterminate: false }
    }

    let allChecked = true
    let anyChecked = false
    let anyIndeterminate = false

    for (const child of node.children) {
      const childState = this.updateTreeCheckState(child)
      if (childState.checked) {
        anyChecked = true
      } else {
        allChecked = false
      }
      if (childState.indeterminate) {
        anyIndeterminate = true
      }
    }

    if (allChecked) {
      node.checked = true
      node.indeterminate = false
    } else if (anyChecked || anyIndeterminate) {
      node.checked = false
      node.indeterminate = true
    } else {
      node.checked = false
      node.indeterminate = false
    }

    return { checked: node.checked, indeterminate: node.indeterminate }
  }

  // 批量勾选/取消勾选子树
  static setSubtreeChecked(node: any, checked: boolean) {
    node.checked = checked
    node.indeterminate = false
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.setSubtreeChecked(child, checked)
      }
    }
  }

  // 权限检查 (支持 '*' 与 'admin:all' 通配放行)
  static hasPermission(userPermissions: string[] = [], requiredPermission: string): boolean {
    if (userPermissions.includes('*') || userPermissions.includes('admin:all')) {
      return true
    }
    return userPermissions.includes(requiredPermission)
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
      return dataItems
    }
    if (user.dataScope === 'campus') {
      return dataItems.filter((item: any) => item[itemCampusIdField] === user.campusId)
    }
    if (user.dataScope === 'department') {
      return dataItems.filter((item: any) => item[itemDeptIdField] === user.departmentId)
    }
    if (user.dataScope === 'self') {
      return dataItems.filter((item: any) => item[itemOwnerField] === user.id)
    }
    return []
  }
}

// --- 2. 标准 5 级组织架构树 (集团 -> 大区 -> 5大校区 -> 部门 -> 岗位) ---
export const MOCK_ORG_TREE_DATA: OrgNode[] = [
  {
    id: 'org-root',
    name: '北京拓视未来教育科技集团 (002599)',
    code: 'QD2023111500002',
    type: 'group',
    level: 1,
    boundUserCount: 128,
    leader: '冬海潮',
    phone: '010-88880000',
    status: 'active',
    children: [
      {
        id: 'region-bj',
        name: '华北北京大区',
        code: 'REG-BJ',
        type: 'region',
        level: 2,
        boundUserCount: 86,
        leader: '张大区',
        phone: '010-88880001',
        status: 'active',
        children: [
          // 1. 总部校区 (HQ001)
          {
            id: 'campus-bj-hq',
            name: '总部校区 (世纪金源旗舰店)',
            code: 'HQ001',
            type: 'campus',
            level: 3,
            boundUserCount: 42,
            leader: '张建华',
            phone: '010-88886666',
            status: 'active',
            children: [
              {
                id: 'dept-hq-edu',
                name: '教务教学部',
                code: 'HQ-EDU',
                type: 'department',
                level: 4,
                boundUserCount: 22,
                leader: '李教务',
                phone: '010-88886667',
                status: 'active',
                children: [
                  {
                    id: 'post-hq-teacher',
                    name: '少儿编程金牌讲师',
                    code: 'POST-HQ-01',
                    type: 'post',
                    level: 5,
                    boundUserCount: 14,
                    status: 'active'
                  },
                  {
                    id: 'post-hq-edu-mgr',
                    name: '教务学管主管',
                    code: 'POST-HQ-02',
                    type: 'post',
                    level: 5,
                    boundUserCount: 5,
                    status: 'active'
                  },
                  {
                    id: 'post-hq-edu-asst',
                    name: '课件教研助理',
                    code: 'POST-HQ-03',
                    type: 'post',
                    level: 5,
                    boundUserCount: 3,
                    status: 'active'
                  },
                  // 零员工绑定的体验岗位叶子节点，用于演练合规删除
                  {
                    id: 'post-test-leaf',
                    name: '体验课助教兼职(待定岗)',
                    code: 'POST-HQ-LEAF',
                    type: 'post',
                    level: 5,
                    boundUserCount: 0,
                    children: [],
                    status: 'active'
                  }
                ]
              },
              {
                id: 'dept-hq-mkt',
                name: '市场招生部',
                code: 'HQ-MKT',
                type: 'department',
                level: 4,
                boundUserCount: 12,
                leader: '朱市场',
                phone: '010-88886668',
                status: 'active',
                children: [
                  {
                    id: 'post-hq-mkt-mgr',
                    name: '课程顾问主管',
                    code: 'POST-HQ-04',
                    type: 'post',
                    level: 5,
                    boundUserCount: 4,
                    status: 'active'
                  },
                  {
                    id: 'post-hq-mkt-consult',
                    name: '高级招生顾问',
                    code: 'POST-HQ-05',
                    type: 'post',
                    level: 5,
                    boundUserCount: 8,
                    status: 'active'
                  }
                ]
              },
              {
                id: 'dept-hq-fin',
                name: '校区财务处',
                code: 'HQ-FIN',
                type: 'department',
                level: 4,
                boundUserCount: 8,
                leader: '王财务',
                phone: '010-88886669',
                status: 'active',
                children: [
                  {
                    id: 'post-hq-fin-cashier',
                    name: '校区总出纳',
                    code: 'POST-HQ-06',
                    type: 'post',
                    level: 5,
                    boundUserCount: 4,
                    status: 'active'
                  },
                  {
                    id: 'post-hq-fin-mgr',
                    name: '财务核算主管',
                    code: 'POST-HQ-07',
                    type: 'post',
                    level: 5,
                    boundUserCount: 4,
                    status: 'active'
                  }
                ]
              }
            ]
          },
          // 2. 远洋校区 (YY002)
          {
            id: 'campus-bj-yy',
            name: '远洋校区',
            code: 'YY002',
            type: 'campus',
            level: 3,
            boundUserCount: 24,
            leader: '李远洋',
            phone: '010-66668888',
            status: 'active',
            children: [
              {
                id: 'dept-yy-edu',
                name: '远洋教学部',
                code: 'YY-EDU',
                type: 'department',
                level: 4,
                boundUserCount: 16,
                leader: '孙晨',
                phone: '010-66668889',
                status: 'active',
                children: [
                  {
                    id: 'post-yy-teacher',
                    name: '机器人创客讲师',
                    code: 'POST-YY-01',
                    type: 'post',
                    level: 5,
                    boundUserCount: 10,
                    status: 'active'
                  },
                  {
                    id: 'post-yy-edu-mgr',
                    name: '远洋教学主管',
                    code: 'POST-YY-02',
                    type: 'post',
                    level: 5,
                    boundUserCount: 6,
                    status: 'active'
                  }
                ]
              },
              {
                id: 'dept-yy-mkt',
                name: '远洋市场部',
                code: 'YY-MKT',
                type: 'department',
                level: 4,
                boundUserCount: 8,
                leader: '李晓雯',
                phone: '010-66668880',
                status: 'active',
                children: [
                  {
                    id: 'post-yy-mkt-consult',
                    name: '招生咨询师',
                    code: 'POST-YY-03',
                    type: 'post',
                    level: 5,
                    boundUserCount: 8,
                    status: 'active'
                  }
                ]
              }
            ]
          },
          // 3. 朝阳校区 (CY003)
          {
            id: 'campus-bj-cy',
            name: '朝阳校区',
            code: 'CY003',
            type: 'campus',
            level: 3,
            boundUserCount: 18,
            leader: '郑丽',
            phone: '010-65559999',
            status: 'active',
            children: [
              {
                id: 'dept-cy-edu',
                name: '朝阳教学组',
                code: 'CY-EDU',
                type: 'department',
                level: 4,
                boundUserCount: 12,
                leader: '吴昊',
                phone: '010-65559998',
                status: 'active',
                children: [
                  {
                    id: 'post-cy-teacher',
                    name: '少儿信息学奥赛讲师',
                    code: 'POST-CY-01',
                    type: 'post',
                    level: 5,
                    boundUserCount: 8,
                    status: 'active'
                  },
                  {
                    id: 'post-cy-edu-asst',
                    name: '学管班主任',
                    code: 'POST-CY-02',
                    type: 'post',
                    level: 5,
                    boundUserCount: 4,
                    status: 'active'
                  }
                ]
              },
              {
                id: 'dept-cy-ops',
                name: '朝阳运营组',
                code: 'CY-OPS',
                type: 'department',
                level: 4,
                boundUserCount: 6,
                leader: '郑丽',
                phone: '010-65559997',
                status: 'active',
                children: [
                  {
                    id: 'post-cy-reception',
                    name: '校区前台接待',
                    code: 'POST-CY-03',
                    type: 'post',
                    level: 5,
                    boundUserCount: 6,
                    status: 'active'
                  }
                ]
              }
            ]
          },
          // 4. 海淀分校 (HD004)
          {
            id: 'campus-bj-hd',
            name: '海淀分校 (万泉河校区)',
            code: 'HD004',
            type: 'campus',
            level: 3,
            boundUserCount: 26,
            leader: '陈明',
            phone: '010-82223333',
            status: 'active',
            children: [
              {
                id: 'dept-hd-edu',
                name: '海淀综合教学部',
                code: 'HD-EDU',
                type: 'department',
                level: 4,
                boundUserCount: 18,
                leader: '刘洋',
                phone: '010-82223334',
                status: 'active',
                children: [
                  {
                    id: 'post-hd-teacher',
                    name: 'C++算法金牌主讲',
                    code: 'POST-HD-01',
                    type: 'post',
                    level: 5,
                    boundUserCount: 12,
                    status: 'active'
                  },
                  {
                    id: 'post-hd-researcher',
                    name: '教研骨干带头人',
                    code: 'POST-HD-02',
                    type: 'post',
                    level: 5,
                    boundUserCount: 6,
                    status: 'active'
                  }
                ]
              },
              {
                id: 'dept-hd-adm',
                name: '海淀行政综合办',
                code: 'HD-ADM',
                type: 'department',
                level: 4,
                boundUserCount: 8,
                leader: '陈明',
                phone: '010-82223335',
                status: 'active',
                children: [
                  {
                    id: 'post-hd-adm-mgr',
                    name: '行政与出纳主管',
                    code: 'POST-HD-03',
                    type: 'post',
                    level: 5,
                    boundUserCount: 8,
                    status: 'active'
                  }
                ]
              }
            ]
          },
          // 5. 望京校区 (WJ005)
          {
            id: 'campus-bj-wj',
            name: '望京校区 (望京SOHO校区)',
            code: 'WJ005',
            type: 'campus',
            level: 3,
            boundUserCount: 18,
            leader: '郭静',
            phone: '010-64771122',
            status: 'active',
            children: [
              {
                id: 'dept-wj-edu',
                name: '望京教学教务部',
                code: 'WJ-EDU',
                type: 'department',
                level: 4,
                boundUserCount: 12,
                leader: '何浩',
                phone: '010-64771123',
                status: 'active',
                children: [
                  {
                    id: 'post-wj-teacher',
                    name: 'Python编程讲师',
                    code: 'POST-WJ-01',
                    type: 'post',
                    level: 5,
                    boundUserCount: 8,
                    status: 'active'
                  },
                  {
                    id: 'post-wj-asst',
                    name: '班主任助理',
                    code: 'POST-WJ-02',
                    type: 'post',
                    level: 5,
                    boundUserCount: 4,
                    status: 'active'
                  }
                ]
              },
              {
                id: 'dept-wj-mkt',
                name: '望京咨询部',
                code: 'WJ-MKT',
                type: 'department',
                level: 4,
                boundUserCount: 6,
                leader: '郭静',
                phone: '010-64771124',
                status: 'active',
                children: [
                  {
                    id: 'post-wj-consult',
                    name: '高端课程顾问',
                    code: 'POST-WJ-03',
                    type: 'post',
                    level: 5,
                    boundUserCount: 6,
                    status: 'active'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]

// --- 3. 覆盖全校区的系统员工/人员数据集 (22+ 真实员工) ---
export const MOCK_SYSTEM_USERS: SystemUser[] = [
  {
    id: 'u-01',
    name: '冬海潮',
    account: 'donghaichao',
    phone: '13800138000',
    email: 'donghaichao@shengtong.com',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    departmentId: 'dept-hq-edu',
    departmentName: '教务教学部',
    postId: 'post-hq-teacher',
    postName: '少儿编程金牌讲师',
    roleId: 'r1',
    roleName: '超级管理员 (集团总部)',
    dataScope: 'all',
    status: 'active',
    permissions: ['*'],
    createdAt: '2023-01-01 09:00:00'
  },
  {
    id: 'u-02',
    name: '张建华',
    account: 'zhangjh',
    phone: '13800138001',
    email: 'zhangjh@shengtong.com',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    departmentId: 'dept-hq-edu',
    departmentName: '教务教学部',
    postId: 'post-hq-edu-mgr',
    postName: '教务学管主管',
    roleId: 'r2',
    roleName: '分校区执行校长',
    dataScope: 'campus',
    status: 'active',
    permissions: [
      'curriculum:view',
      'curriculum:course:manage',
      'student:view',
      'student:profile:view',
      'student:enroll',
      'student:status:transition',
      'educational:schedule:view',
      'educational:schedule:edit',
      'educational:class:manage',
      'educational:workbench:attend',
      'financial:order:view',
      'financial:approval:view',
      'financial:approval:process',
      'system:view'
    ],
    createdAt: '2023-01-15 10:00:00'
  },
  {
    id: 'u-03',
    name: '李晓雯',
    account: 'lixw',
    phone: '13800138002',
    email: 'lixw@shengtong.com',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    departmentId: 'dept-yy-mkt',
    departmentName: '远洋市场部',
    postId: 'post-yy-mkt-consult',
    postName: '招生咨询师',
    roleId: 'r3',
    roleName: '教务学管主管',
    dataScope: 'department',
    status: 'active',
    permissions: [
      'student:view',
      'student:profile:view',
      'student:enroll',
      'student:status:transition',
      'educational:schedule:view',
      'educational:schedule:edit',
      'educational:class:manage',
      'educational:workbench:attend'
    ],
    createdAt: '2023-02-01 11:00:00'
  },
  {
    id: 'u-04',
    name: '王财务',
    account: 'wangcw',
    phone: '13800138003',
    email: 'wangcw@shengtong.com',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    departmentId: 'dept-hq-fin',
    departmentName: '校区财务处',
    postId: 'post-hq-fin-cashier',
    postName: '校区总出纳',
    roleId: 'r5',
    roleName: '校区出纳与财务',
    dataScope: 'campus',
    status: 'active',
    permissions: [
      'financial:order:view',
      'financial:order:export',
      'financial:order:edit',
      'financial:ledger:view',
      'financial:approval:view',
      'financial:approval:process'
    ],
    createdAt: '2023-02-10 14:00:00'
  },
  {
    id: 'u-05',
    name: '赵立鹏',
    account: 'zhaolp',
    phone: '13800138004',
    email: 'zhaolp@shengtong.com',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    departmentId: 'dept-hq-edu',
    departmentName: '教务教学部',
    postId: 'post-hq-teacher',
    postName: '少儿编程金牌讲师',
    roleId: 'r4',
    roleName: '少儿编程专职主讲教师',
    dataScope: 'self',
    status: 'active',
    permissions: ['curriculum:view', 'educational:schedule:view', 'educational:workbench:attend'],
    createdAt: '2023-03-01 09:30:00'
  },
  {
    id: 'u-06',
    name: '孙晨',
    account: 'sunchen',
    phone: '13800138005',
    email: 'sunchen@shengtong.com',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    departmentId: 'dept-yy-edu',
    departmentName: '远洋教学部',
    postId: 'post-yy-teacher',
    postName: '机器人创客讲师',
    roleId: 'r4',
    roleName: '少儿编程专职主讲教师',
    dataScope: 'campus',
    status: 'active',
    permissions: ['curriculum:view', 'educational:schedule:view', 'educational:workbench:attend'],
    createdAt: '2023-03-15 10:00:00'
  },
  {
    id: 'u-07',
    name: '周敏',
    account: 'zhoumin',
    phone: '13800138006',
    email: 'zhoumin@shengtong.com',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    departmentId: 'dept-yy-mkt',
    departmentName: '远洋市场部',
    postId: 'post-yy-mkt-consult',
    postName: '招生咨询师',
    roleId: 'r3',
    roleName: '教务学管主管',
    dataScope: 'department',
    status: 'active',
    permissions: [
      'student:view',
      'student:profile:view',
      'student:enroll',
      'student:status:transition',
      'educational:schedule:view',
      'educational:schedule:edit'
    ],
    createdAt: '2023-04-01 11:30:00'
  },
  {
    id: 'u-08',
    name: '吴昊',
    account: 'wuhao',
    phone: '13800138007',
    email: 'wuhao@shengtong.com',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    departmentId: 'dept-cy-edu',
    departmentName: '朝阳教学组',
    postId: 'post-cy-teacher',
    postName: '少儿信息学奥赛讲师',
    roleId: 'r4',
    roleName: '少儿编程专职主讲教师',
    dataScope: 'self',
    status: 'active',
    permissions: ['curriculum:view', 'educational:schedule:view', 'educational:workbench:attend'],
    createdAt: '2023-04-12 14:10:00'
  },
  {
    id: 'u-09',
    name: '郑丽',
    account: 'zhengli',
    phone: '13800138008',
    email: 'zhengli@shengtong.com',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    departmentId: 'dept-cy-ops',
    departmentName: '朝阳运营组',
    postId: 'post-cy-reception',
    postName: '校区前台接待',
    roleId: 'r2',
    roleName: '分校区执行校长',
    dataScope: 'campus',
    status: 'active',
    permissions: [
      'curriculum:view',
      'student:view',
      'student:enroll',
      'educational:schedule:view',
      'financial:order:view',
      'system:view'
    ],
    createdAt: '2023-04-20 15:30:00'
  },
  {
    id: 'u-10',
    name: '陈明',
    account: 'chenming',
    phone: '13800138009',
    email: 'chenming@shengtong.com',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    departmentId: 'dept-hd-adm',
    departmentName: '海淀行政综合办',
    postId: 'post-hd-adm-mgr',
    postName: '行政与出纳主管',
    roleId: 'r2',
    roleName: '分校区执行校长',
    dataScope: 'campus',
    status: 'active',
    permissions: [
      'curriculum:view',
      'student:view',
      'educational:schedule:view',
      'financial:order:view',
      'financial:approval:view',
      'financial:approval:process',
      'system:view'
    ],
    createdAt: '2023-05-01 09:00:00'
  },
  {
    id: 'u-11',
    name: '刘洋',
    account: 'liuyang',
    phone: '13800138010',
    email: 'liuyang@shengtong.com',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    departmentId: 'dept-hd-edu',
    departmentName: '海淀综合教学部',
    postId: 'post-hd-teacher',
    postName: 'C++算法金牌主讲',
    roleId: 'r4',
    roleName: '少儿编程专职主讲教师',
    dataScope: 'self',
    status: 'active',
    permissions: ['curriculum:view', 'educational:schedule:view', 'educational:workbench:attend'],
    createdAt: '2023-05-10 10:20:00'
  },
  {
    id: 'u-12',
    name: '黄伟',
    account: 'huangwei',
    phone: '13800138011',
    email: 'huangwei@shengtong.com',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    departmentId: 'dept-hd-edu',
    departmentName: '海淀综合教学部',
    postId: 'post-hd-researcher',
    postName: '教研骨干带头人',
    roleId: 'r4',
    roleName: '少儿编程专职主讲教师',
    dataScope: 'department',
    status: 'active',
    permissions: ['curriculum:view', 'educational:schedule:view', 'educational:workbench:attend'],
    createdAt: '2023-05-18 16:00:00'
  },
  {
    id: 'u-13',
    name: '郭静',
    account: 'guojing',
    phone: '13800138012',
    email: 'guojing@shengtong.com',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    departmentId: 'dept-wj-mkt',
    departmentName: '望京咨询部',
    postId: 'post-wj-consult',
    postName: '高端课程顾问',
    roleId: 'r2',
    roleName: '分校区执行校长',
    dataScope: 'campus',
    status: 'active',
    permissions: [
      'curriculum:view',
      'student:view',
      'educational:schedule:view',
      'financial:order:view',
      'system:view'
    ],
    createdAt: '2023-06-01 09:15:00'
  },
  {
    id: 'u-14',
    name: '何浩',
    account: 'hehao',
    phone: '13800138013',
    email: 'hehao@shengtong.com',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    departmentId: 'dept-wj-edu',
    departmentName: '望京教学教务部',
    postId: 'post-wj-teacher',
    postName: 'Python编程讲师',
    roleId: 'r4',
    roleName: '少儿编程专职主讲教师',
    dataScope: 'self',
    status: 'active',
    permissions: ['curriculum:view', 'educational:schedule:view', 'educational:workbench:attend'],
    createdAt: '2023-06-15 13:40:00'
  },
  {
    id: 'u-15',
    name: '罗芳',
    account: 'luofang',
    phone: '13800138014',
    email: 'luofang@shengtong.com',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    departmentId: 'dept-wj-edu',
    departmentName: '望京教学教务部',
    postId: 'post-wj-asst',
    postName: '班主任助理',
    roleId: 'r3',
    roleName: '教务学管主管',
    dataScope: 'department',
    status: 'active',
    permissions: [
      'student:view',
      'student:profile:view',
      'student:enroll',
      'student:status:transition',
      'educational:schedule:view'
    ],
    createdAt: '2023-07-01 10:00:00'
  },
  {
    id: 'u-16',
    name: '马腾',
    account: 'mateng',
    phone: '13800138015',
    email: 'mateng@shengtong.com',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    departmentId: 'dept-yy-edu',
    departmentName: '远洋教学部',
    postId: 'post-yy-edu-mgr',
    postName: '远洋教学主管',
    roleId: 'r5',
    roleName: '校区出纳与财务',
    dataScope: 'campus',
    status: 'active',
    permissions: ['financial:order:view', 'financial:order:export', 'financial:ledger:view'],
    createdAt: '2023-07-15 11:20:00'
  },
  {
    id: 'u-17',
    name: '朱玲',
    account: 'zhuling',
    phone: '13800138016',
    email: 'zhuling@shengtong.com',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    departmentId: 'dept-hq-mkt',
    departmentName: '市场招生部',
    postId: 'post-hq-mkt-mgr',
    postName: '课程顾问主管',
    roleId: 'r3',
    roleName: '教务学管主管',
    dataScope: 'department',
    status: 'active',
    permissions: ['student:view', 'student:enroll', 'student:status:transition'],
    createdAt: '2023-08-01 09:00:00'
  },
  {
    id: 'u-18',
    name: '高峰',
    account: 'gaofeng',
    phone: '13800138017',
    email: 'gaofeng@shengtong.com',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    departmentId: 'dept-hq-mkt',
    departmentName: '市场招生部',
    postId: 'post-hq-mkt-consult',
    postName: '高级招生顾问',
    roleId: 'r3',
    roleName: '教务学管主管',
    dataScope: 'self',
    status: 'active',
    permissions: ['student:view', 'student:enroll'],
    createdAt: '2023-08-10 14:15:00'
  },
  {
    id: 'u-19',
    name: '彭雪',
    account: 'pengxue',
    phone: '13800138018',
    email: 'pengxue@shengtong.com',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    departmentId: 'dept-hd-adm',
    departmentName: '海淀行政综合办',
    postId: 'post-hd-adm-mgr',
    postName: '行政与出纳主管',
    roleId: 'r5',
    roleName: '校区出纳与财务',
    dataScope: 'campus',
    status: 'active',
    permissions: ['financial:order:view', 'financial:ledger:view'],
    createdAt: '2023-09-01 10:00:00'
  },
  {
    id: 'u-20',
    name: '冯凯',
    account: 'fengkai',
    phone: '13800138019',
    email: 'fengkai@shengtong.com',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    departmentId: 'dept-cy-edu',
    departmentName: '朝阳教学组',
    postId: 'post-cy-edu-asst',
    postName: '学管班主任',
    roleId: 'r3',
    roleName: '教务学管主管',
    dataScope: 'department',
    status: 'locked',
    permissions: ['student:view', 'educational:schedule:view'],
    createdAt: '2023-09-15 15:40:00'
  },
  {
    id: 'u-21',
    name: '蒋婷',
    account: 'jiangting',
    phone: '13800138020',
    email: 'jiangting@shengtong.com',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    departmentId: 'dept-hq-edu',
    departmentName: '教务教学部',
    postId: 'post-hq-edu-asst',
    postName: '课件教研助理',
    roleId: 'r4',
    roleName: '少儿编程专职主讲教师',
    dataScope: 'department',
    status: 'active',
    permissions: ['curriculum:view', 'educational:schedule:view'],
    createdAt: '2023-10-01 09:30:00'
  },
  {
    id: 'u-22',
    name: '钱坤',
    account: 'qiankun',
    phone: '13800138021',
    email: 'qiankun@shengtong.com',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    departmentId: 'dept-wj-mkt',
    departmentName: '望京咨询部',
    postId: 'post-wj-consult',
    postName: '高端课程顾问',
    roleId: 'r3',
    roleName: '教务学管主管',
    dataScope: 'self',
    status: 'active',
    permissions: ['student:view', 'student:enroll'],
    createdAt: '2023-10-15 16:20:00'
  },
  {
    id: 'u-zhangls',
    name: '张老师',
    account: 'zhangls',
    phone: '13811112222',
    email: 'zhangls@shengtong.com',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    departmentId: 'dept-hq-edu',
    departmentName: '教务教学部',
    postId: 'post-hq-teacher',
    postName: '少儿编程金牌讲师',
    roleId: 'r4',
    roleName: '少儿编程专职主讲教师',
    dataScope: 'self',
    status: 'active',
    permissions: ['curriculum:view', 'educational:schedule:view', 'educational:workbench:attend'],
    createdAt: '2023-01-15 09:00:00'
  }
]


// --- 4. 角色组列表 ---
export const MOCK_ROLES_DATA: RoleItem[] = [
  {
    id: 'r1',
    name: '超级管理员 (集团总部)',
    code: 'admin',
    description: '拥有全系统所有业务模块与底层配置的最高控制权，穿透全部实体校区数据',
    userCount: 1,
    dataScope: 'all',
    permissions: ['*'],
    isSystem: true,
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'r2',
    name: '分校区执行校长',
    code: 'principal',
    description: '负责单所分校的日常全面综合运营，具备本校区学员、教务、排课与营收流水查看权限',
    userCount: 4,
    dataScope: 'campus',
    permissions: [
      'curriculum:view',
      'curriculum:course:manage',
      'student:view',
      'student:profile:view',
      'student:enroll',
      'student:status:transition',
      'educational:schedule:view',
      'educational:schedule:edit',
      'educational:class:manage',
      'educational:workbench:attend',
      'financial:order:view',
      'financial:approval:view',
      'financial:approval:process',
      'system:view'
    ],
    isSystem: true,
    createdAt: '2023-01-05 10:00:00'
  },
  {
    id: 'r3',
    name: '教务学管主管',
    code: 'edu_manager',
    description: '统筹校区各教学班级运作、学员分班入班调度、7 分支异动状态流转与考勤督导',
    userCount: 8,
    dataScope: 'department',
    permissions: [
      'student:view',
      'student:profile:view',
      'student:enroll',
      'student:status:transition',
      'educational:schedule:view',
      'educational:schedule:edit',
      'educational:class:manage',
      'educational:workbench:attend'
    ],
    isSystem: true,
    createdAt: '2023-01-10 10:00:00'
  },
  {
    id: 'r4',
    name: '少儿编程专职主讲教师',
    code: 'teacher',
    description: '专职授课教师，拥有课表日程查看、点名消课与反结课冲正权限，仅透视本人名下学员',
    userCount: 6,
    dataScope: 'self',
    permissions: [
      'curriculum:view',
      'educational:schedule:view',
      'educational:workbench:attend'
    ],
    isSystem: true,
    createdAt: '2023-01-15 10:00:00'
  },
  {
    id: 'r5',
    name: '校区出纳与财务',
    code: 'cashier',
    description: '负责前台收款核销、上传纸质支付凭证、资金流水汇总对账与退费初审',
    userCount: 3,
    dataScope: 'campus',
    permissions: [
      'financial:order:view',
      'financial:order:export',
      'financial:order:edit',
      'financial:ledger:view',
      'financial:approval:view',
      'financial:approval:process'
    ],
    isSystem: true,
    createdAt: '2023-02-01 10:00:00'
  }
]

// --- 5. 完整的 4 级细粒度权限勾选树 (系统 -> 模块 -> 页面 -> 按钮) ---
export const MOCK_PERMISSION_TREE_DATA: PermissionNode[] = [
  // 1. 教研中心
  {
    id: 'sys_curriculum',
    label: '教研中心 (Curriculum)',
    code: 'curriculum',
    level: 'system',
    children: [
      {
        id: 'mod_curriculum_course',
        label: '课程研发模块',
        code: 'curriculum:course',
        level: 'module',
        children: [
          {
            id: 'page_curriculum_list',
            label: '课程研发管理页面',
            code: 'curriculum:course:page',
            level: 'page',
            children: [
              { id: 'btn_curriculum_view', label: '按钮：查看课程详情', code: 'curriculum:view', level: 'button' },
              { id: 'btn_curriculum_add', label: '按钮：新增标准化课程', code: 'curriculum:course:add', level: 'button' },
              { id: 'btn_curriculum_auth', label: '按钮：跨校区穿梭授权', code: 'curriculum:course:auth', level: 'button' },
              { id: 'btn_curriculum_status', label: '按钮：课程启禁用开关', code: 'curriculum:course:status', level: 'button' },
              { id: 'btn_curriculum_edit', label: '按钮：编辑大纲与课时', code: 'curriculum:course:edit', level: 'button' }
            ]
          },
          {
            id: 'page_curriculum_subject',
            label: '科目体系设置页面',
            code: 'curriculum:subject:page',
            level: 'page',
            children: [
              { id: 'btn_subject_add', label: '按钮：新增科目类别', code: 'curriculum:subject:add', level: 'button' },
              { id: 'btn_subject_sort', label: '按钮：调整科目排序', code: 'curriculum:subject:sort', level: 'button' }
            ]
          }
        ]
      }
    ]
  },
  // 2. 学员中心
  {
    id: 'sys_student',
    label: '学员中心 (StudentCenter)',
    code: 'student',
    level: 'system',
    children: [
      {
        id: 'mod_student_manage',
        label: '学员全生命周期模块',
        code: 'student:manage',
        level: 'module',
        children: [
          {
            id: 'page_student_list',
            label: '全部学员全景页面',
            code: 'student:all:page',
            level: 'page',
            children: [
              { id: 'btn_student_view', label: '按钮：查看学员列表', code: 'student:view', level: 'button' },
              { id: 'btn_student_profile', label: '按钮：360° 画像抽屉', code: 'student:profile:view', level: 'button' },
              { id: 'btn_student_enroll', label: '按钮：新生报名选课向导', code: 'student:enroll', level: 'button' },
              { id: 'btn_student_transition', label: '按钮：发起 7 分支异动', code: 'student:status:transition', level: 'button' },
              { id: 'btn_student_export', label: '按钮：学员花名册导出', code: 'student:export', level: 'button' }
            ]
          },
          {
            id: 'page_student_unassigned',
            label: '待分班学员池页面',
            code: 'student:unassigned:page',
            level: 'page',
            children: [
              { id: 'btn_student_assign', label: '按钮：一键调度分班入班', code: 'student:assign:do', level: 'button' }
            ]
          }
        ]
      }
    ]
  },
  // 3. 教务中心
  {
    id: 'sys_educational',
    label: '教务中心 (Educational)',
    code: 'educational',
    level: 'system',
    children: [
      {
        id: 'mod_educational_schedule',
        label: '排课与班级调度模块',
        code: 'educational:schedule',
        level: 'module',
        children: [
          {
            id: 'page_edu_schedule',
            label: '7×15 动态排课看板',
            code: 'educational:schedule:page',
            level: 'page',
            children: [
              { id: 'btn_schedule_view', label: '按钮：查看排课看板', code: 'educational:schedule:view', level: 'button' },
              { id: 'btn_schedule_edit', label: '按钮：新建与调整排课', code: 'educational:schedule:edit', level: 'button' },
              { id: 'btn_schedule_conflict', label: '按钮：三维冲突覆盖提交', code: 'educational:conflict:override', level: 'button' },
              { id: 'btn_schedule_export', label: '按钮：导出周课表', code: 'educational:schedule:export', level: 'button' }
            ]
          },
          {
            id: 'page_edu_class',
            label: '班级与班容管理页面',
            code: 'educational:class:page',
            level: 'page',
            children: [
              { id: 'btn_class_manage', label: '按钮：设立班级与调整班容', code: 'educational:class:manage', level: 'button' }
            ]
          },
          {
            id: 'page_edu_attendance',
            label: '授课点名消课页面',
            code: 'educational:attendance:page',
            level: 'page',
            children: [
              { id: 'btn_attend_submit', label: '按钮：点名考勤消课提交', code: 'educational:workbench:attend', level: 'button' },
              { id: 'btn_attend_rollback', label: '按钮：反结课冲正撤销', code: 'educational:workbench:rollback', level: 'button' }
            ]
          }
        ]
      }
    ]
  },
  // 4. 财务中心
  {
    id: 'sys_financial',
    label: '财务中心 (Financial)',
    code: 'financial',
    level: 'system',
    children: [
      {
        id: 'mod_financial_funds',
        label: '资金流水与对账模块',
        code: 'financial:funds',
        level: 'module',
        children: [
          {
            id: 'page_fin_order',
            label: '订单营收流水页面',
            code: 'financial:order:page',
            level: 'page',
            children: [
              { id: 'btn_order_view', label: '按钮：查看订单流水', code: 'financial:order:view', level: 'button' },
              { id: 'btn_order_export', label: '按钮：订单数据导出', code: 'financial:order:export', level: 'button' },
              { id: 'btn_order_void', label: '按钮：作废订单撤回', code: 'financial:order:void', level: 'button' },
              { id: 'btn_order_voucher', label: '按钮：上传支付凭证', code: 'financial:order:voucher', level: 'button' }
            ]
          },
          {
            id: 'page_fin_approval',
            label: '业务审批工作台页面',
            code: 'financial:approval:page',
            level: 'page',
            children: [
              { id: 'btn_approval_view', label: '按钮：查看待审列表', code: 'financial:approval:view', level: 'button' },
              { id: 'btn_approval_order', label: '按钮：收款通过/驳回', code: 'financial:order:approve', level: 'button' },
              { id: 'btn_approval_refund', label: '按钮：退费多级终审', code: 'financial:refund:approve', level: 'button' }
            ]
          }
        ]
      }
    ]
  },
  // 5. 系统设置
  {
    id: 'sys_setting',
    label: '系统设置 (SystemSetting)',
    code: 'system',
    level: 'system',
    children: [
      {
        id: 'mod_system_manage',
        label: '底座组织与权限管理',
        code: 'system:manage',
        level: 'module',
        children: [
          {
            id: 'page_sys_org',
            label: '组织架构与机构页面',
            code: 'system:org:page',
            level: 'page',
            children: [
              { id: 'btn_org_view', label: '按钮：查看组织架构', code: 'system:view', level: 'button' },
              { id: 'btn_org_add', label: '按钮：新建组织节点', code: 'system:org:add', level: 'button' },
              { id: 'btn_org_delete', label: '按钮：删除组织节点', code: 'system:org:delete', level: 'button' },
              { id: 'btn_user_add', label: '按钮：新增系统员工', code: 'system:user:add', level: 'button' },
              { id: 'btn_user_edit', label: '按钮：员工改密/状态切换', code: 'system:user:edit', level: 'button' }
            ]
          },
          {
            id: 'page_sys_role',
            label: '4级RBAC角色管理页面',
            code: 'system:role:page',
            level: 'page',
            children: [
              { id: 'btn_role_add', label: '按钮：新建角色组', code: 'system:role:add', level: 'button' },
              { id: 'btn_role_save', label: '按钮：保存角色授权矩阵', code: 'system:role:save', level: 'button' }
            ]
          },
          {
            id: 'page_sys_dict',
            label: '业务参数字典页面',
            code: 'system:dict:page',
            level: 'page',
            children: [
              { id: 'btn_dict_add', label: '按钮：新增字典项', code: 'system:dict:add', level: 'button' },
              { id: 'btn_dict_edit', label: '按钮：启停与删除字典', code: 'system:dict:edit', level: 'button' }
            ]
          }
        ]
      }
    ]
  }
]

// --- 6. 业务参数与异动原因数据字典 ---
export const MOCK_DICTS_DATA: DictItem[] = [
  // 学员异动原因字典
  {
    id: 'dict-01',
    category: 'trans_reason',
    dictKey: 'TRANS_REASON_DISTANCE',
    label: '家庭搬迁/校区距离过远',
    order: 1,
    enabled: true,
    remark: '转校或退费常见原因',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-02',
    category: 'trans_reason',
    dictKey: 'TRANS_REASON_TIME_CLASH',
    label: '公立校学科课业冲突',
    order: 2,
    enabled: true,
    remark: '转班或换课时段调整',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-03',
    category: 'trans_reason',
    dictKey: 'TRANS_REASON_TEACHER',
    label: '申请更换讲师或调整班型',
    order: 3,
    enabled: true,
    remark: '教学风格适应性调整',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-04',
    category: 'trans_reason',
    dictKey: 'TRANS_REASON_PROGRESS',
    label: '学习进度脱节/降级复训',
    order: 4,
    enabled: true,
    remark: '教学进度个性化重修',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-05',
    category: 'trans_reason',
    dictKey: 'TRANS_REASON_HEALTH',
    label: '健康或个人原因短期休学',
    order: 5,
    enabled: true,
    remark: '休学与冻结课时',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-06',
    category: 'trans_reason',
    dictKey: 'TRANS_REASON_TRANSFER',
    label: '随父母工作异地跨校区转学',
    order: 6,
    enabled: true,
    remark: '跨校区结转课时与钱包本金',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-07',
    category: 'trans_reason',
    dictKey: 'TRANS_REASON_REFUND',
    label: '课程协议到期按规清算退费',
    order: 7,
    enabled: true,
    remark: '财务多级审批流发起',
    createdAt: '2023-01-01 00:00:00'
  },
  // 学员预警规则字典
  {
    id: 'dict-08',
    category: 'warning_rule',
    dictKey: 'WARN_ABSENT_THRESHOLD',
    label: '连续缺勤达 3 次触发学管预警',
    order: 1,
    enabled: true,
    remark: '提示班主任立即电话家访',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-09',
    category: 'warning_rule',
    dictKey: 'WARN_REMAIN_LESSONS',
    label: '剩余课时少于 4 次提示续费促单',
    order: 2,
    enabled: true,
    remark: '高亮显示续费预警角标',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-10',
    category: 'warning_rule',
    dictKey: 'WARN_DORMANT_DAYS',
    label: '超过 30 天无任何消课标记沉睡',
    order: 3,
    enabled: true,
    remark: '自动归入待激活流失池',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-11',
    category: 'warning_rule',
    dictKey: 'WARN_UNASSIGNED_TIMEOUT',
    label: '新报学员超 7 天未进班预警',
    order: 4,
    enabled: true,
    remark: '待分班学员池排队超时提示',
    createdAt: '2023-01-01 00:00:00'
  },
  // 常用上课时长字典
  {
    id: 'dict-12',
    category: 'lesson_duration',
    dictKey: 'DURATION_45MIN',
    label: '启蒙幼儿标准课时 (45 分钟)',
    order: 1,
    enabled: true,
    remark: '4-6岁少儿创客课程',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-13',
    category: 'lesson_duration',
    dictKey: 'DURATION_60MIN',
    label: '常规少儿进阶课时 (60 分钟)',
    order: 2,
    enabled: true,
    remark: '7-12岁少儿编程常规班',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-14',
    category: 'lesson_duration',
    dictKey: 'DURATION_90MIN',
    label: '高阶奥赛与集训课时 (90 分钟)',
    order: 3,
    enabled: true,
    remark: 'NOIP/CSP-J 进阶集训',
    createdAt: '2023-01-01 00:00:00'
  },
  {
    id: 'dict-15',
    category: 'lesson_duration',
    dictKey: 'DURATION_120MIN',
    label: '寒暑假专项集训双课时 (120 分钟)',
    order: 4,
    enabled: true,
    remark: '连上2课次，课间休息15分钟',
    createdAt: '2023-01-01 00:00:00'
  }
]

// --- 7. 响应式内存数据 Store 与增删改查中台服务 ---

// 组织架构树状态
export const MOCK_ORG_NODES = JSON.parse(JSON.stringify(MOCK_ORG_TREE_DATA)) as OrgNode[]
// 系统员工列表状态
export const USERS_STORAGE_KEY = 'yixiao_mock_system_users_v1'

export function saveSystemUsersToStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(MOCK_SYSTEM_USER_LIST))
    } catch (e) {
      console.warn('[Mock Users] Failed to save users to localStorage:', e)
    }
  }
}

export function restoreSystemUsersFromStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(USERS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          MOCK_SYSTEM_USER_LIST.splice(0, MOCK_SYSTEM_USER_LIST.length, ...parsed)
        }
      }
    } catch (e) {
      console.warn('[Mock Users] Failed to restore users from localStorage:', e)
    }
  }
}

export const MOCK_SYSTEM_USER_LIST = JSON.parse(JSON.stringify(MOCK_SYSTEM_USERS)) as SystemUser[]

// 立即恢复持久化员工列表
restoreSystemUsersFromStorage()
// 角色组列表状态
export const MOCK_ROLES_LIST = JSON.parse(JSON.stringify(MOCK_ROLES_DATA)) as RoleItem[]
// 权限树状态
export const MOCK_PERMISSION_TREE = JSON.parse(JSON.stringify(MOCK_PERMISSION_TREE_DATA)) as PermissionNode[]
// 业务字典状态
export const MOCK_DICTS_LIST = JSON.parse(JSON.stringify(MOCK_DICTS_DATA)) as DictItem[]

// --- 组织架构服务 ---
export function getOrgTree(): OrgNode[] {
  return MOCK_ORG_NODES
}

export function addOrgNode(parentNodeId: string, nodeData: Partial<OrgNode>): OrgNode {
  let targetParent: OrgNode | null = null

  function findParent(nodes: OrgNode[]) {
    for (const node of nodes) {
      if (node.id === parentNodeId) {
        targetParent = node
        return
      }
      if (node.children && node.children.length > 0) {
        findParent(node.children)
      }
    }
  }

  findParent(MOCK_ORG_NODES)

  const parent = targetParent || MOCK_ORG_NODES[0]
  const newLevel = parent ? parent.level + 1 : 2
  const defaultTypes: Record<number, any> = { 2: 'region', 3: 'campus', 4: 'department', 5: 'post' }

  const newNode: OrgNode = {
    id: nodeData.id || `org-${Date.now()}`,
    name: nodeData.name || '新建组织单元',
    code: nodeData.code || `CODE-${Math.floor(Math.random() * 9000 + 1000)}`,
    type: nodeData.type || defaultTypes[newLevel] || 'post',
    level: newLevel,
    parentId: parent ? parent.id : null,
    boundUserCount: 0,
    leader: nodeData.leader || '',
    phone: nodeData.phone || '',
    status: 'active',
    children: []
  }

  if (!parent.children) {
    parent.children = []
  }
  parent.children.push(newNode)
  return newNode
}

export function updateOrgNode(nodeId: string, patch: Partial<OrgNode>): OrgNode | null {
  let target: OrgNode | null = null

  function find(nodes: OrgNode[]) {
    for (const node of nodes) {
      if (node.id === nodeId) {
        Object.assign(node, patch)
        target = node
        return
      }
      if (node.children && node.children.length > 0) {
        find(node.children)
      }
    }
  }

  find(MOCK_ORG_NODES)
  return target
}

export function deleteOrgNode(nodeId: string): OrgTreeValidationResult {
  // 先触发严密的 RBACEngine 契约校验！
  const validation = RBACEngine.validateNodeDeletion(MOCK_ORG_NODES, nodeId)

  function remove(nodes: OrgNode[]): boolean {
    const idx = nodes.findIndex(n => n.id === nodeId)
    if (idx !== -1) {
      nodes.splice(idx, 1)
      return true
    }
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        if (remove(n.children)) return true
      }
    }
    return false
  }

  remove(MOCK_ORG_NODES)
  return validation
}

// --- 系统员工服务 ---
export function getSystemUsers(filter?: { campusId?: string; keyword?: string; roleId?: string; status?: string }): SystemUser[] {
  restoreSystemUsersFromStorage()
  let result = [...MOCK_SYSTEM_USER_LIST]

  if (filter?.campusId && filter.campusId !== 'all') {
    result = result.filter(u => u.campusId === filter.campusId)
  }
  if (filter?.keyword) {
    const kw = filter.keyword.toLowerCase().trim()
    result = result.filter(u => u.name.toLowerCase().includes(kw) || u.account.toLowerCase().includes(kw) || u.phone.includes(kw))
  }
  if (filter?.roleId) {
    result = result.filter(u => u.roleId === filter.roleId)
  }
  if (filter?.status) {
    result = result.filter(u => u.status === filter.status)
  }

  return result
}

export function addSystemUser(user: Partial<SystemUser>): SystemUser {
  const newUser: SystemUser = {
    id: user.id || `u-${Date.now()}`,
    name: user.name || '新员工',
    account: user.account || `emp_${Math.floor(Math.random() * 9000 + 1000)}`,
    phone: user.phone || '13800000000',
    email: user.email || '',
    campusId: user.campusId || 'campus-bj-hq',
    campusName: user.campusName || '总部校区',
    departmentId: user.departmentId || 'dept-hq-edu',
    departmentName: user.departmentName || '教务教学部',
    postId: user.postId || 'post-hq-teacher',
    postName: user.postName || '少儿编程金牌讲师',
    roleId: user.roleId || 'r4',
    roleName: user.roleName || '少儿编程专职主讲教师',
    dataScope: user.dataScope || 'self',
    status: user.status || 'active',
    permissions: user.permissions || ['curriculum:view', 'educational:schedule:view'],
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
  }

  MOCK_SYSTEM_USER_LIST.unshift(newUser)
  saveSystemUsersToStorage()
  return newUser
}

export function updateSystemUser(userId: string, patch: Partial<SystemUser>): SystemUser | null {
  const user = MOCK_SYSTEM_USER_LIST.find(u => u.id === userId)
  if (user) {
    Object.assign(user, patch)
    saveSystemUsersToStorage()
    return user
  }
  return null
}

export function deleteSystemUser(userId: string): boolean {
  const index = MOCK_SYSTEM_USER_LIST.findIndex(u => u.id === userId)
  if (index !== -1) {
    MOCK_SYSTEM_USER_LIST.splice(index, 1)
    saveSystemUsersToStorage()
    return true
  }
  return false
}

export function resetUserPassword(userId: string, _newPass = '123456'): boolean {
  const user = MOCK_SYSTEM_USER_LIST.find(u => u.id === userId)
  return !!user
}

export function toggleUserStatus(userId: string): SystemUser | null {
  const user = MOCK_SYSTEM_USER_LIST.find(u => u.id === userId)
  if (user) {
    user.status = user.status === 'active' ? 'locked' : 'active'
    saveSystemUsersToStorage()
    return user
  }
  return null
}

// --- 角色与权限服务 ---
export function getRoles(): RoleItem[] {
  return MOCK_ROLES_LIST
}

export function addRole(roleData: Partial<RoleItem>): RoleItem {
  const newRole: RoleItem = {
    id: roleData.id || `r-${Date.now()}`,
    name: roleData.name || '新建角色组',
    code: roleData.code || `role_${Date.now()}`,
    description: roleData.description || '',
    userCount: 0,
    dataScope: roleData.dataScope || 'self',
    permissions: roleData.permissions || ['curriculum:view'],
    isSystem: false,
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
  }
  MOCK_ROLES_LIST.push(newRole)
  return newRole
}

export function updateRole(roleId: string, patch: Partial<RoleItem>): RoleItem | null {
  const role = MOCK_ROLES_LIST.find(r => r.id === roleId)
  if (role) {
    Object.assign(role, patch)
    return role
  }
  return null
}

export function deleteRole(roleId: string): boolean {
  const index = MOCK_ROLES_LIST.findIndex(r => r.id === roleId)
  if (index !== -1) {
    if (MOCK_ROLES_LIST[index].isSystem) {
      throw new Error('系统内置核心角色禁止删除')
    }
    MOCK_ROLES_LIST.splice(index, 1)
    return true
  }
  return false
}

export function saveRolePermissions(roleId: string, permissions: string[], dataScope: DataScope): RoleItem | null {
  const role = MOCK_ROLES_LIST.find(r => r.id === roleId)
  if (role) {
    role.permissions = permissions
    role.dataScope = dataScope
    return role
  }
  return null
}

export function getPermissionTree(): PermissionNode[] {
  return MOCK_PERMISSION_TREE
}

// --- 业务字典服务 ---
export function getDicts(category?: string): DictItem[] {
  if (category && category !== 'all') {
    return MOCK_DICTS_LIST.filter(d => d.category === category)
  }
  return MOCK_DICTS_LIST
}

export function addDict(dictData: Partial<DictItem>): DictItem {
  const newDict: DictItem = {
    id: dictData.id || `dict-${Date.now()}`,
    category: dictData.category || 'trans_reason',
    dictKey: dictData.dictKey || `DICT_KEY_${Date.now()}`,
    label: dictData.label || '新字典项',
    order: dictData.order || MOCK_DICTS_LIST.length + 1,
    enabled: dictData.enabled !== undefined ? dictData.enabled : true,
    remark: dictData.remark || '',
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
  }
  MOCK_DICTS_LIST.push(newDict)
  return newDict
}

export function updateDict(dictId: string, patch: Partial<DictItem>): DictItem | null {
  const dict = MOCK_DICTS_LIST.find(d => d.id === dictId)
  if (dict) {
    Object.assign(dict, patch)
    return dict
  }
  return null
}

export function deleteDict(dictId: string): boolean {
  const index = MOCK_DICTS_LIST.findIndex(d => d.id === dictId)
  if (index !== -1) {
    MOCK_DICTS_LIST.splice(index, 1)
    return true
  }
  return false
}

export function toggleDictStatus(dictId: string): DictItem | null {
  const dict = MOCK_DICTS_LIST.find(d => d.id === dictId)
  if (dict) {
    dict.enabled = !dict.enabled
    return dict
  }
  return null
}
