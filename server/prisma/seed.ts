import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始导入拓视未来教育「一校教培系统」初始业务种子数据...')

  // 1. 初始化机构 (Company)
  const company = await prisma.company.upsert({
    where: { code: 'QD2023111500002' },
    update: {},
    create: {
      id: 'comp-shengtong-01',
      code: 'QD2023111500002',
      name: '北京拓视未来教育科技集团股份有限公司',
      stockCode: '002599',
      status: 'active',
    },
  })
  console.log('✅ 集团机构信息初始化成功:', company.name)

  // 2. 初始化 5 大物理校区 (Campuses)
  const campusesData = [
    { id: 'campus-bj-hq', code: 'campus-bj-hq', name: '总部乐博旗舰校区', isHeadquarter: true, address: '北京市海淀区中关村南大街1号', phone: '010-88886666' },
    { id: 'campus-bj-yy', code: 'campus-bj-yy', name: '远洋学习中心', isHeadquarter: false, address: '北京市朝阳区远洋国际中心A座3层', phone: '010-88887777' },
    { id: 'campus-bj-cy', code: 'campus-bj-cy', name: '朝阳大悦城校区', isHeadquarter: false, address: '北京市朝阳区青年路大悦城北区5层', phone: '010-88888888' },
    { id: 'campus-bj-hd', code: 'campus-bj-hd', name: '海淀黄庄校区', isHeadquarter: false, address: '北京市海淀区知春路黄庄银网中心4层', phone: '010-88889999' },
    { id: 'campus-bj-wj', code: 'campus-bj-wj', name: '望京科技园校区', isHeadquarter: false, address: '北京市朝阳区望京SOHO T2南侧商铺', phone: '010-88885555' },
  ]

  for (const c of campusesData) {
    await prisma.campus.upsert({
      where: { code: c.code },
      update: {},
      create: {
        ...c,
        companyId: company.id,
      },
    })
  }
  console.log(`✅ 5 大物理校区初始化成功 (总部, 远洋, 朝阳, 海淀, 望京)`)

  // 3. 组织架构树基础节点
  const rootNode = await prisma.orgNode.upsert({
    where: { code: 'org-root' },
    update: {},
    create: {
      id: 'org-root',
      companyId: company.id,
      code: 'org-root',
      name: '盛通股份集团总部',
      type: 'group',
      level: 1,
      leader: '冬海潮',
      phone: '13800000000',
    },
  })

  const hqDept = await prisma.orgNode.upsert({
    where: { code: 'org-hq-dept' },
    update: {},
    create: {
      id: 'org-hq-dept',
      companyId: company.id,
      parentId: rootNode.id,
      code: 'org-hq-dept',
      name: '总部教研与学管中心',
      type: 'department',
      level: 2,
      leader: '冬海潮',
      phone: '13800000001',
    },
  })

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

  // 超级管理员账号：冬海潮 (默认密码: 123456)
  const passwordHash = await bcrypt.hash('123456', 10)
  const superUser = await prisma.user.upsert({
    where: { account: 'donghaichao' },
    update: {},
    create: {
      id: 'user-donghaichao',
      account: 'donghaichao',
      password: passwordHash,
      realName: '冬海潮',
      phone: '15600000125',
      campusId: 'campus-bj-hq',
      orgNodeId: hqDept.id,
      status: 'active',
    },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superUser.id, roleId: superRole.id } },
    update: {},
    create: { userId: superUser.id, roleId: superRole.id },
  })

  // 教师员工账号：张老师
  const teacherUser = await prisma.user.upsert({
    where: { account: 'teacher_zhang' },
    update: {},
    create: {
      id: 'user-teacher-zhang',
      account: 'teacher_zhang',
      password: passwordHash,
      realName: '张建华老师',
      phone: '13900000002',
      campusId: 'campus-bj-hq',
      orgNodeId: hqDept.id,
      status: 'active',
    },
  })
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: teacherUser.id, roleId: teacherRole.id } },
    update: {},
    create: { userId: teacherUser.id, roleId: teacherRole.id },
  })

  // 批量初始化系统预设的 23 位实体教职工账号
  const presetUsersList = [
    { id: 'u-01', account: 'donghaichao_lead', realName: '冬海潮 (总经办)', phone: '13800138000', campusId: 'campus-bj-hq', roleId: superRole.id },
    { id: 'u-02', account: 'zhangjh', realName: '张建华', phone: '13800138001', campusId: 'campus-bj-hq', roleId: principalRole.id },
    { id: 'u-03', account: 'lixw', realName: '李晓雯', phone: '13800138002', campusId: 'campus-bj-yy', roleId: advisorRole.id },
    { id: 'u-04', account: 'wangcw', realName: '王财务', phone: '13800138003', campusId: 'campus-bj-hq', roleId: financeRole.id },
    { id: 'u-05', account: 'zhaolp', realName: '赵立鹏', phone: '13800138004', campusId: 'campus-bj-hq', roleId: teacherRole.id },
    { id: 'u-06', account: 'sunchen', realName: '孙晨', phone: '13800138005', campusId: 'campus-bj-yy', roleId: teacherRole.id },
    { id: 'u-07', account: 'zhoumin', realName: '周敏', phone: '13800138006', campusId: 'campus-bj-yy', roleId: advisorRole.id },
    { id: 'u-08', account: 'wuhao', realName: '吴昊', phone: '13800138007', campusId: 'campus-bj-cy', roleId: teacherRole.id },
    { id: 'u-09', account: 'zhengli', realName: '郑丽', phone: '13800138008', campusId: 'campus-bj-cy', roleId: principalRole.id },
    { id: 'u-10', account: 'chenming', realName: '陈明', phone: '13800138009', campusId: 'campus-bj-hd', roleId: principalRole.id },
    { id: 'u-11', account: 'liuyang', realName: '刘洋', phone: '13800138010', campusId: 'campus-bj-hd', roleId: teacherRole.id },
    { id: 'u-12', account: 'huangwei', realName: '黄伟', phone: '13800138011', campusId: 'campus-bj-hd', roleId: teacherRole.id },
    { id: 'u-13', account: 'guojing', realName: '郭静', phone: '13800138012', campusId: 'campus-bj-wj', roleId: principalRole.id },
    { id: 'u-14', account: 'hehao', realName: '何浩', phone: '13800138013', campusId: 'campus-bj-wj', roleId: teacherRole.id },
    { id: 'u-15', account: 'luofang', realName: '罗芳', phone: '13800138014', campusId: 'campus-bj-wj', roleId: advisorRole.id },
    { id: 'u-16', account: 'mateng', realName: '马腾', phone: '13800138015', campusId: 'campus-bj-yy', roleId: financeRole.id },
    { id: 'u-17', account: 'zhuling', realName: '朱玲', phone: '13800138016', campusId: 'campus-bj-hq', roleId: advisorRole.id },
    { id: 'u-18', account: 'gaofeng', realName: '高峰', phone: '13800138017', campusId: 'campus-bj-hq', roleId: advisorRole.id },
    { id: 'u-19', account: 'pengxue', realName: '彭雪', phone: '13800138018', campusId: 'campus-bj-hd', roleId: financeRole.id },
    { id: 'u-20', account: 'fengkai', realName: '冯凯', phone: '13800138019', campusId: 'campus-bj-cy', roleId: advisorRole.id },
    { id: 'u-21', account: 'jiangting', realName: '蒋婷', phone: '13800138020', campusId: 'campus-bj-hq', roleId: teacherRole.id },
    { id: 'u-22', account: 'qiankun', realName: '钱坤', phone: '13800138021', campusId: 'campus-bj-wj', roleId: advisorRole.id },
    { id: 'u-zhangls', account: 'zhangls', realName: '张老师', phone: '13900000003', campusId: 'campus-bj-hq', roleId: teacherRole.id },
  ]

  for (const pu of presetUsersList) {
    const u = await prisma.user.upsert({
      where: { account: pu.account },
      update: {
        realName: pu.realName,
        phone: pu.phone,
        campusId: pu.campusId,
      },
      create: {
        id: pu.id,
        account: pu.account,
        password: passwordHash,
        realName: pu.realName,
        phone: pu.phone,
        campusId: pu.campusId,
        orgNodeId: hqDept.id,
        status: 'active',
      },
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: u.id, roleId: pu.roleId } },
      update: {},
      create: { userId: u.id, roleId: pu.roleId },
    })
  }

  // 初始化常见业务字典
  const dictItemsList = [
    { category: 'trans_reason', dictKey: 'TRANS_REASON_DISTANCE', label: '家庭搬迁/距离过远', order: 1 },
    { category: 'trans_reason', dictKey: 'TRANS_REASON_TIME', label: '上课时间冲突', order: 2 },
    { category: 'trans_reason', dictKey: 'TRANS_REASON_STUDY_PRESSURE', label: '校内学业压力过大', order: 3 },
    { category: 'trans_reason', dictKey: 'TRANS_REASON_HEALTH', label: '身体健康原因', order: 4 },
    { category: 'trans_reason', dictKey: 'TRANS_REASON_OTHER', label: '其他原因', order: 5 },
    { category: 'warning_rule', dictKey: 'WARN_ABSENT_3_TIMES', label: '连续旷课达 3 次预警', order: 1 },
    { category: 'warning_rule', dictKey: 'WARN_LESSON_LESS_4', label: '剩余课时不足 4 节预警', order: 2 },
    { category: 'warning_rule', dictKey: 'WARN_NO_CONSUME_30D', label: '超过 30 天未消课预警', order: 3 },
    { category: 'payment_method', dictKey: 'PAY_WECHAT', label: '微信支付', order: 1 },
    { category: 'payment_method', dictKey: 'PAY_ALIPAY', label: '支付宝', order: 2 },
    { category: 'payment_method', dictKey: 'PAY_POS', label: 'POS机刷卡', order: 3 },
    { category: 'payment_method', dictKey: 'PAY_BANK', label: '对公转账', order: 4 },
  ]
  for (const di of dictItemsList) {
    const existing = await prisma.dictItem.findFirst({
      where: { category: di.category, dictKey: di.dictKey },
    })
    if (!existing) {
      await prisma.dictItem.create({ data: di })
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

  // 11. 常用数据字典初始化 (DictItems)
  const dictsData = [
    { category: '学员异动原因', dictKey: 'TRANS_REASON_DISTANCE', label: '家庭搬迁/距离过远', order: 1 },
    { category: '学员异动原因', dictKey: 'TRANS_REASON_TIME_CLASH', label: '公立校学科冲突', order: 2 },
    { category: '学员异动原因', dictKey: 'TRANS_REASON_TEACHER', label: '更换讲师或班型', order: 3 },
    { category: '学员预警规则', dictKey: 'WARN_ABSENT_THRESHOLD', label: '连续缺勤达 3 次触发预警', order: 1 },
    { category: '学员预警规则', dictKey: 'WARN_REMAIN_LESSONS', label: '课时少于 4 次提示续费', order: 2 },
  ]

  for (const d of dictsData) {
    await prisma.dictItem.create({
      data: d,
    })
  }
  console.log('✅ 业务参数与异动原因数据字典初始化成功')

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
