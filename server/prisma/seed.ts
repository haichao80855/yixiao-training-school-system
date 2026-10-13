import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始导入拓视未来教育「一校教培系统」初始业务种子数据...')

  // 1. 初始化机构 (Company)
  const company = await prisma.company.upsert({
    where: { code: 'QD2023111500002' },
    update: {
      legalPerson: '贾洪波',
      phone: '010-88880000',
      validUntil: '2028-12-31',
      adminName: '冬海潮',
    },
    create: {
      id: 'comp-shengtong-01',
      code: 'QD2023111500002',
      name: '北京拓视未来教育科技集团股份有限公司',
      stockCode: '002599',
      legalPerson: '贾洪波',
      phone: '010-88880000',
      validUntil: '2028-12-31',
      adminName: '冬海潮',
      status: 'active',
    },
  })
  console.log('✅ 集团机构信息初始化成功:', company.name)

  // 2. 5 级实体组织架构树基础节点 (24 个标准节点)
  const orgTreeRaw = [
    // 1 级 集团总部
    { id: 'org-root', code: 'org-root', name: '盛通股份集团总部', type: 'group', level: 1, parentId: null, leader: '冬海潮', phone: '13800000000' },
    // 2 级 大区
    { id: 'region-bj', code: 'REG-BJ', name: '华北北京大区', type: 'region', level: 2, parentId: 'org-root', leader: '冬海潮', phone: '13800000001' },
    // 兼顾原有总部教研学管中心节点 (level 2 直属)
    { id: 'org-hq-dept', code: 'org-hq-dept', name: '总部教研与学管中心', type: 'department', level: 2, parentId: 'org-root', leader: '冬海潮', phone: '13800000001' },

    // 3 级 实体校区对应节点 (5 所)
    { id: 'campus-node-hq', code: 'NODE-HQ001', name: '总部乐博旗舰校区', type: 'campus', level: 3, parentId: 'region-bj', leader: '张建华', phone: '010-88886666' },
    { id: 'campus-node-yy', code: 'NODE-YY002', name: '远洋学习中心', type: 'campus', level: 3, parentId: 'region-bj', leader: '李晓雯', phone: '010-88887777' },
    { id: 'campus-node-cy', code: 'NODE-CY003', name: '朝阳大悦城校区', type: 'campus', level: 3, parentId: 'region-bj', leader: '郑丽', phone: '010-88888888' },
    { id: 'campus-node-hd', code: 'NODE-HD004', name: '海淀黄庄校区', type: 'campus', level: 3, parentId: 'region-bj', leader: '陈明', phone: '010-88889999' },
    { id: 'campus-node-wj', code: 'NODE-WJ005', name: '望京科技园校区', type: 'campus', level: 3, parentId: 'region-bj', leader: '郭静', phone: '010-88885555' },

    // 4 级 业务部门 (7 个)
    { id: 'dept-hq-edu', code: 'HQ-EDU', name: '教务教学部', type: 'department', level: 4, parentId: 'campus-node-hq', leader: '张建华', phone: '010-88886666' },
    { id: 'dept-hq-mkt', code: 'HQ-MKT', name: '市场招生部', type: 'department', level: 4, parentId: 'campus-node-hq', leader: '高顾问', phone: '010-88886667' },
    { id: 'dept-hq-fin', code: 'HQ-FIN', name: '校区财务处', type: 'department', level: 4, parentId: 'campus-node-hq', leader: '王财务', phone: '010-88886668' },
    { id: 'dept-yy-edu', code: 'YY-EDU', name: '远洋教学部', type: 'department', level: 4, parentId: 'campus-node-yy', leader: '李晓雯', phone: '010-88887777' },
    { id: 'dept-cy-edu', code: 'CY-EDU', name: '朝阳教学组', type: 'department', level: 4, parentId: 'campus-node-cy', leader: '郑丽', phone: '010-88888888' },
    { id: 'dept-hd-edu', code: 'HD-EDU', name: '海淀综合教学部', type: 'department', level: 4, parentId: 'campus-node-hd', leader: '陈明', phone: '010-88889999' },
    { id: 'dept-wj-edu', code: 'WJ-EDU', name: '望京教学教务部', type: 'department', level: 4, parentId: 'campus-node-wj', leader: '郭静', phone: '010-88885555' },

    // 5 级 专职岗位 (9 个)
    { id: 'post-hq-teacher', code: 'POST-HQ-01', name: '少儿编程金牌讲师', type: 'post', level: 5, parentId: 'dept-hq-edu', leader: '赵立鹏', phone: '13800138004' },
    { id: 'post-hq-edu-mgr', code: 'POST-HQ-02', name: '教务学管主管', type: 'post', level: 5, parentId: 'dept-hq-edu', leader: '朱玲', phone: '13800138016' },
    { id: 'post-hq-edu-asst', code: 'POST-HQ-03', name: '课件教研助理', type: 'post', level: 5, parentId: 'dept-hq-edu', leader: '蒋婷', phone: '13800138020' },
    { id: 'post-hq-mkt-consult', code: 'POST-HQ-05', name: '高级招生顾问', type: 'post', level: 5, parentId: 'dept-hq-mkt', leader: '高峰', phone: '13800138017' },
    { id: 'post-hq-fin-cashier', code: 'POST-HQ-06', name: '校区总出纳', type: 'post', level: 5, parentId: 'dept-hq-fin', leader: '王财务', phone: '13800138003' },
    { id: 'post-yy-teacher', code: 'POST-YY-01', name: '机器人创客讲师', type: 'post', level: 5, parentId: 'dept-yy-edu', leader: '孙晨', phone: '13800138005' },
    { id: 'post-cy-teacher', code: 'POST-CY-01', name: '少儿信息学奥赛讲师', type: 'post', level: 5, parentId: 'dept-cy-edu', leader: '吴昊', phone: '13800138007' },
    { id: 'post-hd-teacher', code: 'POST-HD-01', name: 'C++算法金牌主讲', type: 'post', level: 5, parentId: 'dept-hd-edu', leader: '刘洋', phone: '13800138010' },
    { id: 'post-wj-teacher', code: 'POST-WJ-01', name: 'Python编程讲师', type: 'post', level: 5, parentId: 'dept-wj-edu', leader: '何浩', phone: '13800138013' },
  ]

  for (const n of orgTreeRaw) {
    await prisma.orgNode.upsert({
      where: { code: n.code },
      update: {
        name: n.name,
        type: n.type,
        level: n.level,
        parentId: n.parentId,
        leader: n.leader,
        phone: n.phone,
      },
      create: {
        id: n.id,
        companyId: company.id,
        code: n.code,
        name: n.name,
        type: n.type,
        level: n.level,
        parentId: n.parentId,
        leader: n.leader,
        phone: n.phone,
      },
    })
  }
  console.log(`✅ 5 级实体组织架构树初始化成功 (共 ${orgTreeRaw.length} 个标准节点)`)

  // 3. 初始化 5 大物理校区 (Campuses) 并 1:1 双向锚定对应组织树节点
  const campusesData = [
    { id: 'campus-bj-hq', code: 'campus-bj-hq', name: '总部乐博旗舰校区', orgNodeId: 'campus-node-hq', isHeadquarter: true, address: '北京市海淀区中关村南大街1号', phone: '010-88886666' },
    { id: 'campus-bj-yy', code: 'campus-bj-yy', name: '远洋学习中心', orgNodeId: 'campus-node-yy', isHeadquarter: false, address: '北京市朝阳区远洋国际中心A座3层', phone: '010-88887777' },
    { id: 'campus-bj-cy', code: 'campus-bj-cy', name: '朝阳大悦城校区', orgNodeId: 'campus-node-cy', isHeadquarter: false, address: '北京市朝阳区青年路大悦城北区5层', phone: '010-88888888' },
    { id: 'campus-bj-hd', code: 'campus-bj-hd', name: '海淀黄庄校区', orgNodeId: 'campus-node-hd', isHeadquarter: false, address: '北京市海淀区知春路黄庄银网中心4层', phone: '010-88889999' },
    { id: 'campus-bj-wj', code: 'campus-bj-wj', name: '望京科技园校区', orgNodeId: 'campus-node-wj', isHeadquarter: false, address: '北京市朝阳区望京SOHO T2南侧商铺', phone: '010-88885555' },
  ]

  for (const c of campusesData) {
    await prisma.campus.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        orgNodeId: c.orgNodeId,
        address: c.address,
        phone: c.phone,
        isHeadquarter: c.isHeadquarter,
      },
      create: {
        ...c,
        companyId: company.id,
      },
    })
  }
  console.log(`✅ 5 大物理校区与组织架构树 1:1 双向锚定成功 (总部, 远洋, 朝阳, 海淀, 望京)`)

  const rootNode = await prisma.orgNode.findUnique({ where: { code: 'org-root' } })
  const hqDept = await prisma.orgNode.findUnique({ where: { code: 'org-hq-dept' } })

  // 4. 角色与权限初始化 (Roles & SuperAdmin User)
  const superRole = await prisma.role.upsert({
    where: { code: 'super_admin' },
    update: {},
    create: {
      code: 'super_admin',
      name: '超级管理员 (集团总部)',
      description: '拥有全系统全部模块与全部校区数据管理权限',
      dataScope: 'all',
      isSystem: true,
    },
  })

  const principalRole = await prisma.role.upsert({
    where: { code: 'principal' },
    update: {},
    create: {
      code: 'principal',
      name: '分校区执行校长',
      description: '负责单校区教学教务与日常行政',
      dataScope: 'campus',
      isSystem: true,
    },
  })

  const teacherRole = await prisma.role.upsert({
    where: { code: 'teacher' },
    update: {},
    create: {
      code: 'teacher',
      name: '少儿编程专职主讲教师',
      description: '负责排课查看、点名消课与随堂评价',
      dataScope: 'self',
      isSystem: true,
    },
  })

  const advisorRole = await prisma.role.upsert({
    where: { code: 'advisor' },
    update: {},
    create: {
      code: 'advisor',
      name: '教务学管主管',
      description: '负责排课调度、学员跟进与考勤监查',
      dataScope: 'campus',
      isSystem: true,
    },
  })

  const financeRole = await prisma.role.upsert({
    where: { code: 'finance' },
    update: {},
    create: {
      code: 'finance',
      name: '校区出纳与财务',
      description: '负责订单审核、收款开票与资金对账',
      dataScope: 'campus',
      isSystem: true,
    },
  })

  // 4.1 权限点与角色权限矩阵初始化
  const permissionsData = [
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
    { code: 'curriculum:course:delete', name: '删除研发课程', level: 'button' },
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
    { code: 'financial:order:refund', name: '发起退费核销', level: 'button' },
    { code: 'financial:approvalFlow', name: '多级风控审批流', level: 'page' },
    { code: 'financial:approval:audit', name: '审批通过或驳回', level: 'button' },
    { code: 'financial:approval:reject', name: '审批驳回', level: 'button' },
    { code: 'financial:chargingLedger', name: '校区资金流水总账', level: 'page' },
  ]

  const createdPerms: any[] = []
  for (let i = 0; i < permissionsData.length; i++) {
    const p = permissionsData[i]
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, level: p.level, sort: i + 1 },
      create: { code: p.code, name: p.name, level: p.level, sort: i + 1 },
    })
    createdPerms.push(perm)
  }

  const roleMap = [
    { role: superRole, perms: createdPerms },
    { role: principalRole, perms: createdPerms.filter((p) => !p.code.includes('system:org') && !p.code.includes('system:role')) },
    { role: teacherRole, perms: createdPerms.filter((p) => p.code.includes('curriculum:') || p.code.includes('educational:workbench') || p.code.includes('educational:timeSchedule')) },
    { role: advisorRole, perms: createdPerms.filter((p) => p.code.includes('student:') || p.code.includes('educational:')) },
    { role: financeRole, perms: createdPerms.filter((p) => p.code.includes('financial:')) },
  ]

  for (const rm of roleMap) {
    for (const tp of rm.perms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: rm.role.id,
            permissionId: tp.id,
          },
        },
        update: {},
        create: {
          roleId: rm.role.id,
          permissionId: tp.id,
        },
      })
    }
  }
  console.log(`✅ 61 项系统权限与 5 大角色权限矩阵初始化成功`)


  // 超级管理员账号：冬海潮 (默认密码: 123456)
  const passwordHash = await bcrypt.hash('123456', 10)
  const superUser = await prisma.user.upsert({
    where: { account: 'donghaichao' },
    update: {
      orgNodeId: rootNode?.id || 'org-root',
    },
    create: {
      id: 'user-donghaichao',
      account: 'donghaichao',
      password: passwordHash,
      realName: '冬海潮',
      phone: '15600000125',
      campusId: 'campus-bj-hq',
      orgNodeId: rootNode?.id || 'org-root',
      status: 'active',
    },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superUser.id, roleId: superRole.id } },
    update: {},
    create: { userId: superUser.id, roleId: superRole.id },
  })

  await prisma.company.update({
    where: { code: 'QD2023111500002' },
    data: { adminUserId: superUser.id, adminName: superUser.realName },
  })

  // 教师员工账号：张老师
  const teacherUser = await prisma.user.upsert({
    where: { account: 'teacher_zhang' },
    update: {
      orgNodeId: 'post-hq-teacher',
    },
    create: {
      id: 'user-teacher-zhang',
      account: 'teacher_zhang',
      password: passwordHash,
      realName: '张建华老师',
      phone: '13900000002',
      campusId: 'campus-bj-hq',
      orgNodeId: 'post-hq-teacher',
      status: 'active',
    },
  })
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: teacherUser.id, roleId: teacherRole.id } },
    update: {},
    create: { userId: teacherUser.id, roleId: teacherRole.id },
  })

  // 批量初始化系统预设的 23 位实体教职工账号 (精准绑定所属岗位/部门)
  const presetUsersList = [
    { id: 'u-01', account: 'donghaichao_lead', realName: '冬海潮 (总经办)', phone: '13800138000', campusId: 'campus-bj-hq', roleId: superRole.id, orgNodeId: 'org-root' },
    { id: 'u-02', account: 'zhangjh', realName: '张建华', phone: '13800138001', campusId: 'campus-bj-hq', roleId: principalRole.id, orgNodeId: 'campus-node-hq' },
    { id: 'u-03', account: 'lixw', realName: '李晓雯', phone: '13800138002', campusId: 'campus-bj-yy', roleId: advisorRole.id, orgNodeId: 'dept-yy-edu' },
    { id: 'u-04', account: 'wangcw', realName: '王财务', phone: '13800138003', campusId: 'campus-bj-hq', roleId: financeRole.id, orgNodeId: 'post-hq-fin-cashier' },
    { id: 'u-05', account: 'zhaolp', realName: '赵立鹏', phone: '13800138004', campusId: 'campus-bj-hq', roleId: teacherRole.id, orgNodeId: 'post-hq-teacher' },
    { id: 'u-06', account: 'sunchen', realName: '孙晨', phone: '13800138005', campusId: 'campus-bj-yy', roleId: teacherRole.id, orgNodeId: 'post-yy-teacher' },
    { id: 'u-07', account: 'zhoumin', realName: '周敏', phone: '13800138006', campusId: 'campus-bj-yy', roleId: advisorRole.id, orgNodeId: 'dept-yy-edu' },
    { id: 'u-08', account: 'wuhao', realName: '吴昊', phone: '13800138007', campusId: 'campus-bj-cy', roleId: teacherRole.id, orgNodeId: 'post-cy-teacher' },
    { id: 'u-09', account: 'zhengli', realName: '郑丽', phone: '13800138008', campusId: 'campus-bj-cy', roleId: principalRole.id, orgNodeId: 'campus-node-cy' },
    { id: 'u-10', account: 'chenming', realName: '陈明', phone: '13800138009', campusId: 'campus-bj-hd', roleId: principalRole.id, orgNodeId: 'campus-node-hd' },
    { id: 'u-11', account: 'liuyang', realName: '刘洋', phone: '13800138010', campusId: 'campus-bj-hd', roleId: teacherRole.id, orgNodeId: 'post-hd-teacher' },
    { id: 'u-12', account: 'huangwei', realName: '黄伟', phone: '13800138011', campusId: 'campus-bj-hd', roleId: teacherRole.id, orgNodeId: 'dept-hd-edu' },
    { id: 'u-13', account: 'guojing', realName: '郭静', phone: '13800138012', campusId: 'campus-bj-wj', roleId: principalRole.id, orgNodeId: 'campus-node-wj' },
    { id: 'u-14', account: 'hehao', realName: '何浩', phone: '13800138013', campusId: 'campus-bj-wj', roleId: teacherRole.id, orgNodeId: 'post-wj-teacher' },
    { id: 'u-15', account: 'luofang', realName: '罗芳', phone: '13800138014', campusId: 'campus-bj-wj', roleId: advisorRole.id, orgNodeId: 'dept-wj-edu' },
    { id: 'u-16', account: 'mateng', realName: '马腾', phone: '13800138015', campusId: 'campus-bj-yy', roleId: financeRole.id, orgNodeId: 'dept-yy-edu' },
    { id: 'u-17', account: 'zhuling', realName: '朱玲', phone: '13800138016', campusId: 'campus-bj-hq', roleId: advisorRole.id, orgNodeId: 'post-hq-edu-mgr' },
    { id: 'u-18', account: 'gaofeng', realName: '高峰', phone: '13800138017', campusId: 'campus-bj-hq', roleId: advisorRole.id, orgNodeId: 'post-hq-mkt-consult' },
    { id: 'u-19', account: 'pengxue', realName: '彭雪', phone: '13800138018', campusId: 'campus-bj-hd', roleId: financeRole.id, orgNodeId: 'dept-hd-edu' },
    { id: 'u-20', account: 'fengkai', realName: '冯凯', phone: '13800138019', campusId: 'campus-bj-cy', roleId: advisorRole.id, orgNodeId: 'dept-cy-edu' },
    { id: 'u-21', account: 'jiangting', realName: '蒋婷', phone: '13800138020', campusId: 'campus-bj-hq', roleId: teacherRole.id, orgNodeId: 'post-hq-edu-asst' },
    { id: 'u-22', account: 'qiankun', realName: '钱坤', phone: '13800138021', campusId: 'campus-bj-wj', roleId: advisorRole.id, orgNodeId: 'dept-wj-edu' },
    { id: 'u-zhangls', account: 'zhangls', realName: '张老师', phone: '13900000003', campusId: 'campus-bj-hq', roleId: teacherRole.id, orgNodeId: 'post-hq-teacher' },
  ]

  for (const pu of presetUsersList) {
    const u = await prisma.user.upsert({
      where: { account: pu.account },
      update: {
        realName: pu.realName,
        phone: pu.phone,
        campusId: pu.campusId,
        orgNodeId: pu.orgNodeId,
      },
      create: {
        id: pu.id,
        account: pu.account,
        password: passwordHash,
        realName: pu.realName,
        phone: pu.phone,
        campusId: pu.campusId,
        orgNodeId: pu.orgNodeId,
        status: 'active',
      },
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: u.id, roleId: pu.roleId } },
      update: {},
      create: { userId: u.id, roleId: pu.roleId },
    })
  }

  // 初始化常见业务字典 (规范英文命名空间，补齐业务说明 remark)
  const dictItemsList = [
    // 1. 学员异动原因字典
    { category: 'trans_reason', dictKey: 'TRANS_REASON_DISTANCE', label: '家庭搬迁/距离过远', order: 1, remark: '学员因家庭住址搬迁或通勤距离过长申请转校或休学' },
    { category: 'trans_reason', dictKey: 'TRANS_REASON_TIME', label: '上课时间冲突', order: 2, remark: '与公立校校内课程或周末其他兴趣班时间严重冲突' },
    { category: 'trans_reason', dictKey: 'TRANS_REASON_STUDY_PRESSURE', label: '校内学业压力过大', order: 3, remark: '中高考升学冲刺或期中期末备考阶段暂时停课' },
    { category: 'trans_reason', dictKey: 'TRANS_REASON_HEALTH', label: '身体健康原因', order: 4, remark: '因病假、手术或遵医嘱需要长期静养' },
    { category: 'trans_reason', dictKey: 'TRANS_REASON_TEACHER', label: '更换讲师或班型', order: 5, remark: '学员对当前主讲教师授课节奏不适应申请调整班级' },
    { category: 'trans_reason', dictKey: 'TRANS_REASON_OTHER', label: '其他原因', order: 6, remark: '其他未穷尽的个性化异动原因' },

    // 2. 学员教务预警规则
    { category: 'warning_rule', dictKey: 'WARN_ABSENT_3_TIMES', label: '连续旷课达 3 次预警', order: 1, remark: '系统自动将学员标记为高风险流失预警，通知学管跟进' },
    { category: 'warning_rule', dictKey: 'WARN_LESSON_LESS_4', label: '剩余课时不足 4 节预警', order: 2, remark: '课时即将耗尽提醒，自动生成顾问续费跟进待办' },
    { category: 'warning_rule', dictKey: 'WARN_NO_CONSUME_30D', label: '超过 30 天未消课预警', order: 3, remark: '休眠学员预警，防范资金池长期沉淀与客户流失' },

    // 3. 常用上课标准时长 (min)
    { category: 'lesson_duration', dictKey: 'DURATION_45', label: '45 分钟标准单课时', order: 1, remark: '少儿启蒙类与低龄乐高积木常规课时' },
    { category: 'lesson_duration', dictKey: 'DURATION_90', label: '90 分钟连堂双课时', order: 2, remark: 'Python/C++ 算法进阶班标准双课时连上' },
    { category: 'lesson_duration', dictKey: 'DURATION_120', label: '120 分钟集训强化课', order: 3, remark: '寒暑假集训营或 CSP-J/S 竞赛冲刺课时' },

    // 4. 收款支付渠道
    { category: 'payment_method', dictKey: 'PAY_WECHAT', label: '微信支付', order: 1, remark: '微信原生扫码与移动支付结算' },
    { category: 'payment_method', dictKey: 'PAY_ALIPAY', label: '支付宝', order: 2, remark: '支付宝花呗或当面付结算' },
    { category: 'payment_method', dictKey: 'PAY_POS', label: 'POS机刷卡', order: 3, remark: '校区前台银联信用卡与借记卡终端' },
    { category: 'payment_method', dictKey: 'PAY_BANK', label: '对公转账', order: 4, remark: '盛通股份银行大额对公账户汇款' },
  ]
  for (const di of dictItemsList) {
    const existing = await prisma.dictItem.findFirst({
      where: { category: di.category, dictKey: di.dictKey },
    })
    if (!existing) {
      await prisma.dictItem.create({ data: di })
    } else {
      await prisma.dictItem.update({
        where: { id: existing.id },
        data: { label: di.label, order: di.order, remark: di.remark },
      })
    }
  }

  console.log('✅ 超管账号 [donghaichao / 123456] 及全部 23 位预设教职工与业务字典初始化成功')

  // 5. 物理教室初始化 (Classrooms)
  const classroomsData = [
    { id: 'cr-hq-101', code: 'CR-HQ-101', name: '乐博创客实验室1 (机器人)', capacity: 12, type: 'maker', campusId: 'campus-bj-hq' },
    { id: 'cr-hq-102', code: 'CR-HQ-102', name: '信息学编程机房 (C++/Python)', capacity: 16, type: 'computer', campusId: 'campus-bj-hq' },
    { id: 'cr-yy-101', code: 'CR-YY-101', name: '远洋创客教室', capacity: 10, type: 'maker', campusId: 'campus-bj-yy' },
    { id: 'cr-cy-101', code: 'CR-CY-101', name: '朝阳编程工坊', capacity: 14, type: 'computer', campusId: 'campus-bj-cy' },
  ]
  for (const cr of classroomsData) {
    await prisma.classroom.upsert({
      where: { code: cr.code },
      update: {},
      create: cr,
    })
  }
  console.log('✅ 物理教学场地与创客机房初始化成功')

  // 6. 教研课程初始化 (Curriculum Courses)
  const coursesData = [
    {
      id: 'crs-scratch-001',
      code: '012-软编Scratch创意图形编程',
      name: '012-软编Scratch创意图形编程',
      cover: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop',
      pricePerLesson: 300.0,
      totalLessons: 48,
      subject: 'scratch',
      grade: 'junior',
      attribute: 'regular',
      status: 'enabled',
      description: '面向 6-8 岁儿童的图形化创意少儿编程标准课程体系',
    },
    {
      id: 'crs-python-002',
      code: '008-Python人工智能趣味算法',
      name: '008-Python人工智能趣味算法',
      cover: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop',
      pricePerLesson: 350.0,
      totalLessons: 64,
      subject: 'python',
      grade: 'middle',
      attribute: 'extended',
      status: 'enabled',
      description: '代码实战与人工智能基础进阶课程',
    },
    {
      id: 'crs-cpp-003',
      code: '001-信息学奥赛C++高阶培优班',
      name: '001-信息学奥赛C++高阶培优班',
      cover: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop',
      pricePerLesson: 450.0,
      totalLessons: 80,
      subject: 'cpp',
      grade: 'senior',
      attribute: 'regular',
      status: 'enabled',
      description: '针对 CSP-J/S 与全国青少信息学奥林匹克竞赛金牌冲刺',
    },
  ]

  for (const c of coursesData) {
    await prisma.course.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    })

    // 默认向总部校区及远洋校区授权
    for (const campusId of ['campus-bj-hq', 'campus-bj-yy']) {
      await prisma.courseCampusAuth.upsert({
        where: { courseId_campusId: { courseId: c.id, campusId } },
        update: {},
        create: { courseId: c.id, campusId },
      })
    }
  }
  console.log('✅ 标准化教研课程与跨校区穿梭授权初始化成功')

  // 7. 实体班级初始化 (Classes)
  const classItem = await prisma.class.upsert({
    where: { code: 'CLS-2026-01' },
    update: {},
    create: {
      id: 'cls-scratch-sat-0900',
      campusId: 'campus-bj-hq',
      courseId: 'crs-scratch-001',
      code: 'CLS-2026-01',
      name: 'Scratch-周六09:00精品班',
      capacity: 8,
      currentStudentCount: 3,
      teacherId: teacherUser.id,
      advisorId: superUser.id,
      classroomId: 'cr-hq-101',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-01-31'),
      status: 'in_progress',
    },
  })
  console.log('✅ 实体教学班级初始化成功:', classItem.name)

  // 8. 真实学员全景档案初始化 (Students)
  const studentsData = [
    {
      id: 'stu-001',
      studentNo: 'S948918',
      name: '张子豪',
      gender: 'male',
      phone: '156****0125',
      parentName: '张建国',
      campusId: 'campus-bj-hq',
      status: 'normal',
      school: '中关村第一小学',
    },
    {
      id: 'stu-002',
      studentNo: 'S948919',
      name: '李欣怡',
      gender: 'female',
      phone: '138****6688',
      parentName: '李晓东',
      campusId: 'campus-bj-hq',
      status: 'normal',
      school: '人大附小',
    },
    {
      id: 'stu-003',
      studentNo: 'S948920',
      name: '王梓涵',
      gender: 'male',
      phone: '186****9922',
      parentName: '王丽华',
      campusId: 'campus-bj-yy',
      status: 'normal',
      school: '朝阳实验小学',
    },
  ]

  for (const s of studentsData) {
    const student = await prisma.student.upsert({
      where: { studentNo: s.studentNo },
      update: {},
      create: s,
    })

    // 初始化课包
    await prisma.studentCoursePackage.upsert({
      where: { id: `pkg-${s.id}` },
      update: {},
      create: {
        id: `pkg-${s.id}`,
        studentId: student.id,
        courseId: 'crs-scratch-001',
        classId: classItem.id,
        totalLessons: 48,
        remainingLessons: 44,
        consumedLessons: 4,
        bonusLessons: 4, // 赠送课时
        pricePerLesson: 300.0,
        status: 'active',
      },
    })

    // 初始化电子钱包本金与赠送金独立分账
    await prisma.studentWallet.upsert({
      where: { studentId: student.id },
      update: {},
      create: {
        studentId: student.id,
        principalBalance: 1200.0,
        bonusBalance: 300.0,
        goldPoints: 50,
      },
    })
  }
  console.log('✅ 真实学员档案、课包资产与电子钱包分账账本初始化成功')

  // 9. 7x15 动态甘特排课日程初始化 (Schedule Events)
  const scheduleData = [
    {
      id: 'evt-20260921-01',
      campusId: 'campus-bj-hq',
      classId: classItem.id,
      teacherId: teacherUser.id,
      classroomId: 'cr-hq-101',
      date: '2026-09-26',
      startTime: '09:00',
      endTime: '10:30',
      semanticType: 'regular',
      classType: 'formal',
      status: 'scheduled',
      laneIndex: 0,
    },
    {
      id: 'evt-20260921-02',
      campusId: 'campus-bj-hq',
      classId: classItem.id,
      teacherId: teacherUser.id,
      classroomId: 'cr-hq-101',
      date: '2026-09-21',
      startTime: '16:00',
      endTime: '17:30',
      semanticType: 'completed',
      classType: 'formal',
      status: 'completed',
      laneIndex: 0,
    },
  ]

  for (const ev of scheduleData) {
    await prisma.scheduleEvent.upsert({
      where: { id: ev.id },
      update: {},
      create: ev,
    })
  }
  console.log('✅ 7x15 排课甘特日程与语义化状态卡片初始化成功')

  // 10. 财务订单与审批流初始化 (Orders & Approvals)
  const order = await prisma.order.upsert({
    where: { orderNo: 'ORD-20260921-001' },
    update: {},
    create: {
      id: 'ord-001',
      campusId: 'campus-bj-hq',
      studentId: 'stu-001',
      orderNo: 'ORD-20260921-001',
      orderType: 'regular',
      status: 'paid',
      originalPrice: 14400.0,
      discountAmount: 400.0,
      couponAmount: 0.0,
      receivableAmount: 14000.0,
      actualAmount: 14000.0,
      paymentMethod: 'wechat',
      creatorId: superUser.id,
      ownerId: superUser.id,
      channel: 'ground',
      deliveryStatus: 'delivered',
      invoiceStatus: 'unissued',
      isLocked: false,
      remark: '秋季Scratch新学员报读',
      payTime: new Date('2026-09-21T10:00:00Z'),
    },
  })

  // 挂载三级审批流 (教学 -> 校长 -> 财务)
  const approvalFlow = await prisma.approvalFlow.upsert({
    where: { orderId: order.id },
    update: {},
    create: {
      id: 'appr-flow-001',
      orderId: order.id,
      businessType: 'payment',
      currentStep: 3,
      totalSteps: 3,
      status: 'approved',
      applicantName: '冬海潮',
    },
  })

  await prisma.approvalNode.createMany({
    data: [
      { approvalFlowId: approvalFlow.id, step: 1, stepName: '教学端开单核验', reviewerId: superUser.id, action: 'pass', comment: '课时配置无误' },
      { approvalFlowId: approvalFlow.id, step: 2, stepName: '校区校长复核', reviewerId: superUser.id, action: 'pass', comment: '准予报读' },
      { approvalFlowId: approvalFlow.id, step: 3, stepName: '财务资金到账终审', reviewerId: superUser.id, action: 'pass', comment: '微信商户入账确认' },
    ],
  })

  console.log('✅ 财务流水订单与三级风控审批单初始化成功')

  // 11. 清理历史遗留的重复中文分类字典项，保证分类命名空间纯洁
  await prisma.dictItem.deleteMany({
    where: { category: { in: ['学员异动原因', '学员预警规则'] } },
  })
  console.log('✅ 业务参数与异动原因数据字典清洗对齐完毕 (零冗余矛盾分类)')

  console.log('\n🎉 所有初始种子数据全部成功入库落盘！')
}

main()
  .catch((e) => {
    console.error('❌ 数据种子导入失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
