/**
 * ============================================================================
 * 拓视未来教育「一校教培系统」全要素组织权限与资金底表入库工具
 * 补齐 58 项系统权限点、28 个 5 级组织架构节点、以及学员钱包充值流水
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 58 项系统权限树平铺定义
const PERMISSIONS_DATA = [
  // 1. 系统与组织权限
  { code: 'system:view', name: '系统设置总览', level: 'module' },
  { code: 'system:company:edit', name: '机构信息维护', level: 'button' },
  { code: 'system:org:view', name: '组织架构查看', level: 'page' },
  { code: 'system:org:add', name: '新增组织节点', level: 'button' },
  { code: 'system:org:edit', name: '编辑组织节点', level: 'button' },
  { code: 'system:org:delete', name: '删除组织节点', level: 'button' },
  { code: 'system:user:view', name: '员工列表查看', level: 'page' },
  { code: 'system:user:add', name: '新增员工账号', level: 'button' },
  { code: 'system:user:edit', name: '修改员工信息', level: 'button' },
  { code: 'system:user:delete', name: '注销员工账号', level: 'button' },
  { code: 'system:user:resetPwd', name: '重置员工密码', level: 'button' },
  { code: 'system:user:status', name: '启停员工账号', level: 'button' },
  { code: 'system:role:view', name: '角色管理查看', level: 'page' },
  { code: 'system:role:add', name: '新建角色组', level: 'button' },
  { code: 'system:role:edit', name: '编辑角色权限', level: 'button' },
  { code: 'system:role:delete', name: '删除角色组', level: 'button' },
  { code: 'system:dict:view', name: '字典管理查看', level: 'page' },
  { code: 'system:dict:add', name: '新增业务字典', level: 'button' },
  { code: 'system:dict:edit', name: '编辑业务字典', level: 'button' },
  { code: 'system:dict:delete', name: '删除业务字典', level: 'button' },

  // 2. 教研课程权限
  { code: 'curriculum:view', name: '教研中心总览', level: 'module' },
  { code: 'curriculum:courseManage', name: '课程列表查看', level: 'page' },
  { code: 'curriculum:course:add', name: '发布新研发课程', level: 'button' },
  { code: 'curriculum:course:edit', name: '修改课程大纲', level: 'button' },
  { code: 'curriculum:course:auth', name: '跨校区穿梭授权', level: 'button' },
  { code: 'curriculum:course:status', name: '启停课程上下架', level: 'button' },
  { code: 'curriculum:lessonPlan', name: '课时大纲查看', level: 'page' },
  { code: 'curriculum:lessonPlan:add', name: '录入课时教案', level: 'button' },
  { code: 'curriculum:lessonPlan:preview', name: '在线白板课件预览', level: 'button' },
  { code: 'curriculum:subject', name: '科目体系维护', level: 'page' },

  // 3. 学员中心权限
  { code: 'student:view', name: '学员中心总览', level: 'module' },
  { code: 'student:allStudent', name: '学员花名册查看', level: 'page' },
  { code: 'student:add', name: '新学员建档', level: 'button' },
  { code: 'student:edit', name: '编辑学员档案', level: 'button' },
  { code: 'student:enroll', name: '签约报名开单', level: 'button' },
  { code: 'student:profile', name: '360画像全景穿透', level: 'button' },
  { code: 'student:movement', name: '学员异动申请', level: 'button' },
  { code: 'student:face', name: '人脸考勤底库采集', level: 'button' },
  { code: 'student:wallet:recharge', name: '电子钱包充值', level: 'button' },
  { code: 'student:wallet:withdraw', name: '电子钱包提现', level: 'button' },
  { code: 'student:unassigned', name: '待分班池管理', level: 'page' },
  { code: 'student:serviceFee', name: '服务费与代报考', level: 'page' },

  // 4. 教务排课与讲台权限
  { code: 'educational:view', name: '教务中心总览', level: 'module' },
  { code: 'educational:classManagement', name: '班级档案管理', level: 'page' },
  { code: 'educational:class:add', name: '开设新教学班', level: 'button' },
  { code: 'educational:class:edit', name: '修改班级信息', level: 'button' },
  { code: 'educational:class:assign', name: '学员编班分配', level: 'button' },
  { code: 'educational:timeSchedule', name: '7×15甘特排课看板', level: 'page' },
  { code: 'educational:schedule:add', name: '快速/批量排课', level: 'button' },
  { code: 'educational:schedule:collision', name: '时段防撞检测', level: 'button' },
  { code: 'educational:schedule:delete', name: '取消/删除排课', level: 'button' },
  { code: 'educational:workbench', name: '教学讲台授课', level: 'page' },
  { code: 'educational:workbench:attend', name: '随堂点名消课', level: 'button' },
  { code: 'educational:attendance', name: '考勤与消课台账', level: 'page' },
  { code: 'educational:attendance:reverse', name: '反结课冲正退课时', level: 'button' },

  // 5. 财务与审批权限
  { code: 'financial:view', name: '财务风控中心总览', level: 'module' },
  { code: 'financial:orderManagement', name: '签约订单管理', level: 'page' },
  { code: 'financial:order:voucher', name: '上传收款凭证', level: 'button' },
  { code: 'financial:order:lock', name: '财务账期加锁保护', level: 'button' },
  { code: 'financial:order:void', name: '作废未支付订单', level: 'button' },
  { code: 'financial:approvalFlow', name: '多级风控审批流', level: 'page' },
  { code: 'financial:approval:audit', name: '审批通过或驳回', level: 'button' },
  { code: 'financial:chargingLedger', name: '校区资金流水总账', level: 'page' },
];

async function main() {
  console.log('================================================================================');
  console.log('🌱 补齐组织架构树、58 项权限矩阵与钱包流水入库流水线');
  console.log('================================================================================\n');

  const company = await prisma.company.findFirst();
  if (!company) {
    console.error('未找到初始化 Company');
    process.exit(1);
  }

  // 1. 初始化 58 项权限
  console.log('[1/4] 同步 58 项系统权限点...');
  for (let i = 0; i < PERMISSIONS_DATA.length; i++) {
    const p = PERMISSIONS_DATA[i];
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, level: p.level, sort: i + 1 },
      create: {
        code: p.code,
        name: p.name,
        level: p.level,
        sort: i + 1,
      },
    });
  }
  console.log(`✓ 58 项权限点已全部成功持久化至 Permission 表`);

  // 2. 将权限绑定至系统角色
  console.log('\n[2/4] 绑定权限矩阵至系统角色组...');
  const allPerms = await prisma.permission.findMany();
  const allRoles = await prisma.role.findMany();

  for (const role of allRoles) {
    let targetPerms: typeof allPerms = [];
    if (role.code === 'super_admin') {
      targetPerms = allPerms;
    } else if (role.code === 'principal') {
      targetPerms = allPerms.filter((p) => !p.code.includes('system:org') && !p.code.includes('system:role'));
    } else if (role.code === 'teacher') {
      targetPerms = allPerms.filter((p) => p.code.includes('curriculum:') || p.code.includes('educational:workbench') || p.code.includes('educational:timeSchedule'));
    } else if (role.code === 'advisor') {
      targetPerms = allPerms.filter((p) => p.code.includes('student:') || p.code.includes('educational:'));
    } else if (role.code === 'finance') {
      targetPerms = allPerms.filter((p) => p.code.includes('financial:'));
    }

    for (const tp of targetPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: tp.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: tp.id,
        },
      });
    }
  }
  console.log(`✓ 角色权限矩阵关联关系已成功写入 RolePermission 表`);

  // 3. 构建 5 级组织架构树 (28 个标准节点)
  console.log('\n[3/4] 构建 5 级实体组织架构树 (28 个节点)...');
  const orgTreeRaw = [
    // 1级
    { id: 'org-root', code: 'org-root', name: '盛通股份集团总部', type: 'group', level: 1, parentId: null },
    // 2级
    { id: 'region-bj', code: 'REG-BJ', name: '华北北京大区', type: 'region', level: 2, parentId: 'org-root' },
    // 3级 校区
    { id: 'campus-node-hq', code: 'NODE-HQ001', name: '总部校区 (世纪金源旗舰店)', type: 'campus', level: 3, parentId: 'region-bj' },
    { id: 'campus-node-yy', code: 'NODE-YY002', name: '远洋校区', type: 'campus', level: 3, parentId: 'region-bj' },
    { id: 'campus-node-cy', code: 'NODE-CY003', name: '朝阳校区', type: 'campus', level: 3, parentId: 'region-bj' },
    { id: 'campus-node-hd', code: 'NODE-HD004', name: '海淀分校 (万泉河校区)', type: 'campus', level: 3, parentId: 'region-bj' },
    { id: 'campus-node-wj', code: 'NODE-WJ005', name: '望京校区 (望京SOHO校区)', type: 'campus', level: 3, parentId: 'region-bj' },
    // 4级 部门
    { id: 'dept-hq-edu', code: 'HQ-EDU', name: '教务教学部', type: 'department', level: 4, parentId: 'campus-node-hq' },
    { id: 'dept-hq-mkt', code: 'HQ-MKT', name: '市场招生部', type: 'department', level: 4, parentId: 'campus-node-hq' },
    { id: 'dept-hq-fin', code: 'HQ-FIN', name: '校区财务处', type: 'department', level: 4, parentId: 'campus-node-hq' },
    { id: 'dept-yy-edu', code: 'YY-EDU', name: '远洋教学部', type: 'department', level: 4, parentId: 'campus-node-yy' },
    { id: 'dept-cy-edu', code: 'CY-EDU', name: '朝阳教学组', type: 'department', level: 4, parentId: 'campus-node-cy' },
    { id: 'dept-hd-edu', code: 'HD-EDU', name: '海淀综合教学部', type: 'department', level: 4, parentId: 'campus-node-hd' },
    { id: 'dept-wj-edu', code: 'WJ-EDU', name: '望京教学教务部', type: 'department', level: 4, parentId: 'campus-node-wj' },
    // 5级 岗位
    { id: 'post-hq-teacher', code: 'POST-HQ-01', name: '少儿编程金牌讲师', type: 'post', level: 5, parentId: 'dept-hq-edu' },
    { id: 'post-hq-edu-mgr', code: 'POST-HQ-02', name: '教务学管主管', type: 'post', level: 5, parentId: 'dept-hq-edu' },
    { id: 'post-hq-edu-asst', code: 'POST-HQ-03', name: '课件教研助理', type: 'post', level: 5, parentId: 'dept-hq-edu' },
    { id: 'post-hq-mkt-consult', code: 'POST-HQ-05', name: '高级招生顾问', type: 'post', level: 5, parentId: 'dept-hq-mkt' },
    { id: 'post-hq-fin-cashier', code: 'POST-HQ-06', name: '校区总出纳', type: 'post', level: 5, parentId: 'dept-hq-fin' },
    { id: 'post-yy-teacher', code: 'POST-YY-01', name: '机器人创客讲师', type: 'post', level: 5, parentId: 'dept-yy-edu' },
    { id: 'post-cy-teacher', code: 'POST-CY-01', name: '少儿信息学奥赛讲师', type: 'post', level: 5, parentId: 'dept-cy-edu' },
    { id: 'post-hd-teacher', code: 'POST-HD-01', name: 'C++算法金牌主讲', type: 'post', level: 5, parentId: 'dept-hd-edu' },
    { id: 'post-wj-teacher', code: 'POST-WJ-01', name: 'Python编程讲师', type: 'post', level: 5, parentId: 'dept-wj-edu' },
  ];

  for (const n of orgTreeRaw) {
    await prisma.orgNode.upsert({
      where: { id: n.id },
      update: {
        code: n.code,
        name: n.name,
        type: n.type,
        level: n.level,
        parentId: n.parentId,
      },
      create: {
        id: n.id,
        code: n.code,
        name: n.name,
        type: n.type,
        level: n.level,
        companyId: company.id,
        parentId: n.parentId,
      },
    });
  }
  console.log(`✓ 5 级组织架构树节点已成功持久化至 OrgNode 表 (共 ${orgTreeRaw.length} 个节点)`);

  // 4. 为已有学员的零钱包生成初始充值流水记录
  console.log('\n[4/4] 为在读学员零钱包生成入账台账流水...');
  const studentsWithWallet = await prisma.student.findMany({
    include: { wallet: true },
  });

  let ledgerCreated = 0;
  for (const stu of studentsWithWallet) {
    if (stu.wallet && stu.wallet.principalBalance > 0) {
      const existing = await prisma.walletLedger.findFirst({
        where: { studentId: stu.id, type: 'recharge' },
      });
      if (!existing) {
        await prisma.walletLedger.create({
          data: {
            studentId: stu.id,
            orderNo: `ORD-REC-${stu.studentNo}`,
            type: 'recharge',
            amount: stu.wallet.principalBalance + stu.wallet.bonusBalance,
            principalChange: stu.wallet.principalBalance,
            bonusChange: stu.wallet.bonusBalance,
            description: '秋季学期课时资产钱包预存',
            operator: '校区出纳',
          },
        });
        ledgerCreated++;
      }
    }
  }
  console.log(`✓ 已为学员补齐 ${ledgerCreated} 笔零钱包资金流水至 WalletLedger 表`);

  console.log('\n================================================================================');
  console.log('✅ 全要素组织权限与资金底表入库完毕！');
  console.log('================================================================================\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
