import type {
  Student,
  StudentCoursePackage,
  StudentWallet,
  StudentRecord,
  CommunicationRecord,
  CompetitionRecord,
  ServiceFeeRecord,
  UnassignedStudentItem,
  AbnormalMovementPayload,
  MovementType
} from '@/types/student'
import type { CourseItem } from '@/types/curriculum'
import { MOCK_COURSES } from './curriculum'

// 5 大校区基础定义
export const CAMPUSES_MAP: Record<string, string> = {
  'campus-bj-hq': '总部校区',
  'campus-bj-yy': '远洋校区',
  'campus-bj-cy': '朝阳校区',
  'campus-bj-hd': '海淀分校',
  'campus-bj-wj': '望京校区'
}

import { getAvailableClasses, enrollStudentIntoClass, type AvailableClassOption } from './educational'
import { saveOrder } from './financial'

// 模拟班级资源库（供分班与转班使用，动态代理至教务中心实体班级库，实时同步新增班级）
export const MOCK_AVAILABLE_CLASSES: AvailableClassOption[] = new Proxy([] as any, {
  get(target, prop, receiver) {
    const list = getAvailableClasses()
    if (prop === 'length') return list.length
    if (typeof prop === 'string' && !isNaN(Number(prop))) {
      return list[Number(prop)]
    }
    const val = (list as any)[prop]
    if (typeof val === 'function') {
      return val.bind(list)
    }
    return Reflect.get(list, prop, receiver)
  }
})

// 22+ 位覆盖 5 大校区的学员完整数据
export const MOCK_STUDENTS: Student[] = [
  {
    id: 'std-001',
    name: '张小萌',
    studentNo: 'S948918',
    gender: 'female',
    age: 10,
    phone: '13812345678',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: 'normal',
    grade: '小学四年级',
    school: '中关村第一小学',
    publicSchool: '中关村第一小学',
    parentName: '张建国',
    parentPhone: '13812345678',
    parentWechat: 'wx_zhangjianguo',
    boundWechat: 'wx_zhangjianguo',
    wechatBound: true,
    faceEntered: true,
    faceImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    coursePackages: [
      {
        packageId: 'pkg-001',
        courseId: 'course-scratch-001',
        courseName: '012-软编Scratch创意图形编程',
        pricePerLesson: 280,
        totalLessons: 48,
        remainingLessons: 28,
        consumedLessons: 20,
        bonusLessons: 4,
        status: 'active',
        expireDate: '2027-06-30',
        expiryDate: '2027-06-30',
        classId: 'class-scratch-101',
        className: 'Scratch创意周末班 (周六 09:00)',
        orderNo: 'ORD2025091001'
      }
    ],
    wallet: {
      principalBalance: 3200,
      bonusBalance: 500,
      goldPoints: 160,
      ledger: [
        { id: 'w-001', type: 'recharge', amount: 3000, principalChange: 3000, bonusChange: 0, time: '2025-09-10 10:00:00', orderNo: 'ORD2025091001', description: '开学季微信充值预存', operator: '张学管' },
        { id: 'w-002', type: 'bonus_grant', amount: 500, principalChange: 0, bonusChange: 500, time: '2025-09-10 10:05:00', description: '充三千赠五百校区大促返现', operator: '系统自动' }
      ]
    },
    learningRecords: [
      { id: 'lr-001', date: '2026-09-13', lessonName: '第18讲：克隆体的应用与雪花飘落', courseName: '012-软编Scratch创意图形编程', teacher: '张老师', status: 'attended', score: 96, comment: '思维极其敏捷，对克隆体坐标计算掌握透彻，作品完成度高。', homeworkRating: 'A+', quizScore: 98 },
      { id: 'lr-002', date: '2026-09-06', lessonName: '第17讲：列表与数据存储进阶', courseName: '012-软编Scratch创意图形编程', teacher: '张老师', status: 'attended', score: 94, comment: '能够独立排查列表溢出错误，逻辑清晰。', homeworkRating: 'A', quizScore: 92 }
    ],
    communicationRecords: [
      { id: 'cr-001', time: '2026-09-14 15:30', counselor: '张学管', type: '课后反馈', method: 'phone', content: '与妈妈通话沟通第18讲克隆体学习表现，孩子在家里展示了飘雪小游戏，家长对教学非常满意。', duration: '04:12', parentSatisfaction: 5 },
      { id: 'cr-002', time: '2026-08-28 10:15', counselor: '张学管', type: '续费沟通', method: 'wechat', content: '沟通下季度Python衔接课意向，家长表示寒假将继续报读。', parentSatisfaction: 5 }
    ],
    competitionRecords: [
      { id: 'cp-001', competitionName: '全国青少年软件编程等级考试 (Scratch 三级)', session: '2026年春季', level: '三级', award: '优秀', awardDate: '2026-04-15', certificateNo: 'CIE20260415-SC03', status: 'passed' }
    ],
    createdAt: '2025-09-10'
  },
  {
    id: 'std-002',
    name: '李浩轩',
    studentNo: 'S765585',
    gender: 'male',
    age: 14,
    phone: '15611223344',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: 'normal',
    grade: '初中二年级',
    school: '人大附中海淀分校',
    publicSchool: '人大附中海淀分校',
    parentName: '李明',
    parentPhone: '15611223344',
    parentWechat: 'wx_liming_156',
    boundWechat: 'wx_liming_156',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-002',
        courseId: 'course-cpp-002',
        courseName: '001-信息学奥赛C++高阶培优班',
        pricePerLesson: 350,
        totalLessons: 64,
        remainingLessons: 42,
        consumedLessons: 22,
        bonusLessons: 4,
        status: 'active',
        expireDate: '2027-08-31',
        expiryDate: '2027-08-31',
        classId: 'class-cpp-201',
        className: 'C++金牌培优班 (周六 14:00)',
        orderNo: 'ORD2025101502'
      }
    ],
    wallet: {
      principalBalance: 12000,
      bonusBalance: 2000,
      goldPoints: 320,
      ledger: [
        { id: 'w-003', type: 'recharge', amount: 15000, principalChange: 15000, bonusChange: 0, time: '2025-10-15 14:20:00', orderNo: 'ORD2025101502', description: '奥赛集训预存大额缴费', operator: '李销售' },
        { id: 'w-004', type: 'bonus_grant', amount: 2000, principalChange: 0, bonusChange: 2000, time: '2025-10-15 14:25:00', description: '集团奥赛种子选手专项奖学金配赠', operator: '教研部' }
      ]
    },
    learningRecords: [
      { id: 'lr-003', date: '2026-09-12', lessonName: '第22讲：动态规划进阶之树形DP', courseName: '001-信息学奥赛C++高阶培优班', teacher: '李老师', status: 'attended', score: 99, comment: '完全攻克洛谷紫题，状态转移方程设计精巧，具备CSP-S冲一等奖实力。', homeworkRating: 'A+', quizScore: 100 }
    ],
    communicationRecords: [
      { id: 'cr-003', time: '2026-09-13 18:00', counselor: '李顾问', type: '满意度调查', method: 'phone', content: '李爸爸表示孩子在学校月考中信息学科目排名全校第一，特意致电感谢授课李老师。', duration: '05:30', parentSatisfaction: 5 }
    ],
    competitionRecords: [
      { id: 'cp-002', competitionName: '全国青少年信息学奥林匹克联赛 (CSP-J)', session: '2025年度', level: '普及组', award: '全国一等奖', awardDate: '2025-11-20', certificateNo: 'NOI-2025-J1023', status: 'passed' }
    ],
    createdAt: '2025-10-15'
  },
  {
    id: 'std-003',
    name: '王紫涵',
    studentNo: 'S889920',
    gender: 'female',
    age: 9,
    phone: '13988776655',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    status: 'suspended',
    grade: '小学三年级',
    school: '芳草地国际学校',
    publicSchool: '芳草地国际学校',
    parentName: '王海',
    parentPhone: '13988776655',
    parentWechat: 'wx_wanghai_bj',
    boundWechat: 'wx_wanghai_bj',
    wechatBound: false,
    faceEntered: false,
    coursePackages: [
      {
        packageId: 'pkg-003',
        courseId: 'course-python-003',
        courseName: '008-Python人工智能趣味算法',
        pricePerLesson: 300,
        totalLessons: 48,
        remainingLessons: 18,
        consumedLessons: 30,
        bonusLessons: 0,
        status: 'frozen',
        expireDate: '2027-01-20',
        expiryDate: '2027-01-20',
        classId: 'class-python-301',
        className: 'Python算法实战A班 (周六 16:00)',
        orderNo: 'ORD2025110203'
      }
    ],
    wallet: {
      principalBalance: 1800,
      bonusBalance: 0,
      goldPoints: 80,
      ledger: [
        { id: 'w-005', type: 'recharge', amount: 3600, principalChange: 3600, bonusChange: 0, time: '2025-11-02 11:00:00', orderNo: 'ORD2025110203', description: '支付宝充值', operator: '孙学管' },
        { id: 'w-006', type: 'consumption', amount: -1800, principalChange: -1800, bonusChange: 0, time: '2025-11-02 11:15:00', description: '扣减首期辅导教材费用', operator: '孙学管' }
      ]
    },
    learningRecords: [
      { id: 'lr-004', date: '2026-06-20', lessonName: '第30讲：Pygame游戏引擎碰撞与生命值', courseName: '008-Python人工智能趣味算法', teacher: '王老师', status: 'attended', score: 88, comment: '基本掌握游戏循环与Surface渲染，因暑期出国游学暂申请休学停课。', homeworkRating: 'B+', quizScore: 85 }
    ],
    communicationRecords: [
      { id: 'cr-004', time: '2026-07-01 10:00', counselor: '孙学管', type: '请假回访', method: 'phone', content: '家长办理为期两个月的休学停课，课时已冻结顺延，预计9月中旬复课。', duration: '03:40', parentSatisfaction: 4 }
    ],
    competitionRecords: [],
    createdAt: '2025-11-02'
  },
  {
    id: 'std-004',
    name: '赵子睿',
    studentNo: 'S652219',
    gender: 'male',
    age: 6,
    phone: '17700112233',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    status: 'transferred',
    grade: '幼儿园大班',
    school: '北京第一幼儿园',
    publicSchool: '北京第一幼儿园',
    parentName: '赵志强',
    parentPhone: '17700112233',
    parentWechat: 'wx_zhao_zq',
    boundWechat: 'wx_zhao_zq',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-004',
        courseId: 'course-kiro-005',
        courseName: '202-中鸣积木KIRO启蒙探索课',
        pricePerLesson: 220,
        totalLessons: 32,
        remainingLessons: 0,
        consumedLessons: 32,
        bonusLessons: 0,
        status: 'completed',
        expireDate: '2026-06-30',
        expiryDate: '2026-06-30',
        orderNo: 'ORD2026010804'
      }
    ],
    wallet: {
      principalBalance: 0,
      bonusBalance: 0,
      goldPoints: 40,
      ledger: []
    },
    learningRecords: [],
    communicationRecords: [
      { id: 'cr-005', time: '2026-07-10 14:00', counselor: '周顾问', type: '电话跟进', method: 'phone', content: '家庭搬迁至朝阳校区附近，已完成跨校区学籍关系交接。', duration: '02:50', parentSatisfaction: 5 }
    ],
    createdAt: '2026-01-08'
  },
  {
    id: 'std-005',
    name: '陈宇杰',
    studentNo: 'S948101',
    gender: 'male',
    age: 9,
    phone: '13811229988',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: 'normal',
    grade: '小学三年级',
    school: '海淀实验小学',
    publicSchool: '海淀实验小学',
    parentName: '陈立',
    parentPhone: '13811229988',
    parentWechat: 'wx_chenli_99',
    boundWechat: 'wx_chenli_99',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-005',
        courseId: 'course-scratch-001',
        courseName: '012-软编Scratch创意图形编程',
        pricePerLesson: 280,
        totalLessons: 48,
        remainingLessons: 48,
        consumedLessons: 0,
        bonusLessons: 4,
        status: 'active',
        expireDate: '2027-09-30',
        expiryDate: '2027-09-30',
        orderNo: 'ORD2026091801'
      }
    ],
    wallet: { principalBalance: 500, bonusBalance: 100, goldPoints: 50, ledger: [] },
    createdAt: '2026-09-18'
  },
  {
    id: 'std-006',
    name: '林若汐',
    studentNo: 'S948102',
    gender: 'female',
    age: 11,
    phone: '13661188223',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    status: 'normal',
    grade: '小学五年级',
    school: '呼家楼中心小学',
    publicSchool: '呼家楼中心小学',
    parentName: '林峰',
    parentPhone: '13661188223',
    parentWechat: 'wx_linfeng_yy',
    boundWechat: 'wx_linfeng_yy',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-006',
        courseId: 'course-python-003',
        courseName: '008-Python人工智能趣味算法',
        pricePerLesson: 300,
        totalLessons: 48,
        remainingLessons: 48,
        consumedLessons: 0,
        bonusLessons: 0,
        status: 'active',
        expireDate: '2027-09-30',
        expiryDate: '2027-09-30',
        orderNo: 'ORD2026091902'
      }
    ],
    wallet: { principalBalance: 800, bonusBalance: 200, goldPoints: 60, ledger: [] },
    createdAt: '2026-09-19'
  },
  {
    id: 'std-007',
    name: '周泽铭',
    studentNo: 'S948103',
    gender: 'male',
    age: 12,
    phone: '13522334455',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    status: 'normal',
    grade: '小学六年级',
    school: '白家庄小学望京分校',
    publicSchool: '白家庄小学望京分校',
    parentName: '周强',
    parentPhone: '13522334455',
    parentWechat: 'wx_zhouqiang',
    boundWechat: 'wx_zhouqiang',
    wechatBound: true,
    faceEntered: false,
    coursePackages: [
      {
        packageId: 'pkg-007',
        courseId: 'course-robot-004',
        courseName: '013-乐高EV3/单片机机器人工程',
        pricePerLesson: 320,
        totalLessons: 36,
        remainingLessons: 36,
        consumedLessons: 0,
        bonusLessons: 2,
        status: 'active',
        expireDate: '2027-08-31',
        expiryDate: '2027-08-31',
        orderNo: 'ORD2026092003'
      }
    ],
    wallet: { principalBalance: 1200, bonusBalance: 0, goldPoints: 20, ledger: [] },
    createdAt: '2026-09-20'
  },
  {
    id: 'std-008',
    name: '孙嘉怡',
    studentNo: 'S821105',
    gender: 'female',
    age: 8,
    phone: '13711998822',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    status: 'normal',
    grade: '小学二年级',
    school: '人大附小',
    publicSchool: '人大附小',
    parentName: '孙磊',
    parentPhone: '13711998822',
    wechatBound: false,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-008',
        courseId: 'course-scratch-001',
        courseName: '012-软编Scratch创意图形编程',
        pricePerLesson: 280,
        totalLessons: 36,
        remainingLessons: 24,
        consumedLessons: 12,
        bonusLessons: 0,
        status: 'active',
        expireDate: '2027-05-30',
        expiryDate: '2027-05-30'
      }
    ],
    wallet: { principalBalance: 2400, bonusBalance: 300, goldPoints: 95, ledger: [] },
    createdAt: '2026-02-14'
  },
  {
    id: 'std-009',
    name: '何天宇',
    studentNo: 'S948206',
    gender: 'male',
    age: 13,
    phone: '18810234567',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    status: 'normal',
    grade: '初中一年级',
    school: '清华附中海淀分校',
    publicSchool: '清华附中海淀分校',
    parentName: '何伟',
    parentPhone: '18810234567',
    boundWechat: 'wx_hewei_bj',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-009',
        courseId: 'course-cpp-002',
        courseName: '001-信息学奥赛C++高阶培优班',
        pricePerLesson: 350,
        totalLessons: 48,
        remainingLessons: 32,
        consumedLessons: 16,
        bonusLessons: 2,
        status: 'active',
        expireDate: '2027-07-31',
        expiryDate: '2027-07-31',
        classId: 'class-cpp-202',
        className: 'C++算法联赛1班 (周日 14:00)'
      }
    ],
    wallet: { principalBalance: 4500, bonusBalance: 600, goldPoints: 210, ledger: [] },
    competitionRecords: [
      { id: 'cp-003', competitionName: '蓝桥杯少儿创意编程组初赛', session: '第15届', level: '初中组', award: '省一等奖', awardDate: '2026-03-25', certificateNo: 'LQB-2026-HE102', status: 'passed' }
    ],
    createdAt: '2025-12-05'
  },
  {
    id: 'std-010',
    name: '韩依依',
    studentNo: 'S778819',
    gender: 'female',
    age: 7,
    phone: '13910345678',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    status: 'normal',
    grade: '小学一年级',
    school: '朝阳外国语学校小学部',
    publicSchool: '朝阳外国语学校小学部',
    parentName: '韩雪',
    parentPhone: '13910345678',
    boundWechat: 'wx_hanxue_cy',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-010',
        courseId: 'course-kiro-005',
        courseName: '202-中鸣积木KIRO启蒙探索课',
        pricePerLesson: 220,
        totalLessons: 32,
        remainingLessons: 20,
        consumedLessons: 12,
        status: 'active',
        expireDate: '2027-04-30',
        expiryDate: '2027-04-30',
        classId: 'class-kiro-401',
        className: 'KIRO大颗粒机械启蒙1班 (周六 10:00)'
      }
    ],
    wallet: { principalBalance: 900, bonusBalance: 150, goldPoints: 45, ledger: [] },
    createdAt: '2026-03-01'
  },
  {
    id: 'std-011',
    name: '陆子默',
    studentNo: 'S842211',
    gender: 'male',
    age: 10,
    phone: '13401122334',
    avatar: 'https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    status: 'suspended',
    grade: '小学四年级',
    school: '北京陈经纶中学望京分校',
    publicSchool: '北京陈经纶中学望京分校',
    parentName: '陆平',
    parentPhone: '13401122334',
    wechatBound: false,
    faceEntered: false,
    coursePackages: [
      {
        packageId: 'pkg-011',
        courseId: 'course-robot-004',
        courseName: '013-乐高EV3/单片机机器人工程',
        pricePerLesson: 320,
        totalLessons: 40,
        remainingLessons: 25,
        consumedLessons: 15,
        bonusLessons: 0,
        status: 'frozen',
        expireDate: '2027-03-31',
        expiryDate: '2027-03-31'
      }
    ],
    wallet: { principalBalance: 2100, bonusBalance: 0, goldPoints: 70, ledger: [] },
    createdAt: '2025-11-18'
  },
  {
    id: 'std-012',
    name: '顾诗婷',
    studentNo: 'S948332',
    gender: 'female',
    age: 11,
    phone: '13311223344',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    status: 'normal',
    grade: '小学五年级',
    school: '景山学校朝阳分校',
    publicSchool: '景山学校朝阳分校',
    parentName: '顾明',
    parentPhone: '13311223344',
    boundWechat: 'wx_guming_yy',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-012',
        courseId: 'course-python-003',
        courseName: '008-Python人工智能趣味算法',
        pricePerLesson: 300,
        totalLessons: 48,
        remainingLessons: 16,
        consumedLessons: 32,
        bonusLessons: 2,
        status: 'active',
        expireDate: '2027-02-28',
        expiryDate: '2027-02-28',
        classId: 'class-python-301',
        className: 'Python算法实战A班 (周六 16:00)'
      }
    ],
    wallet: { principalBalance: 3500, bonusBalance: 500, goldPoints: 180, ledger: [] },
    createdAt: '2025-08-20'
  },
  {
    id: 'std-013',
    name: '钱一诺',
    studentNo: 'S921008',
    gender: 'female',
    age: 8,
    phone: '13810088991',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: 'normal',
    grade: '小学二年级',
    school: '中关村第二小学',
    publicSchool: '中关村第二小学',
    parentName: '钱学良',
    parentPhone: '13810088991',
    boundWechat: 'wx_qianxl',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-013',
        courseId: 'course-scratch-001',
        courseName: '012-软编Scratch创意图形编程',
        pricePerLesson: 280,
        totalLessons: 40,
        remainingLessons: 30,
        consumedLessons: 10,
        bonusLessons: 0,
        status: 'active',
        expireDate: '2027-06-30',
        expiryDate: '2027-06-30',
        classId: 'class-scratch-102',
        className: 'Scratch进阶周日班 (周日 10:30)'
      }
    ],
    wallet: { principalBalance: 5800, bonusBalance: 800, goldPoints: 120, ledger: [] },
    createdAt: '2026-01-12'
  },
  {
    id: 'std-014',
    name: '冯晨熙',
    studentNo: 'S812345',
    gender: 'male',
    age: 12,
    phone: '13601239988',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    status: 'normal',
    grade: '小学六年级',
    school: '双榆树第一小学',
    publicSchool: '双榆树第一小学',
    parentName: '冯军',
    parentPhone: '13601239988',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-014',
        courseId: 'course-cpp-002',
        courseName: '001-信息学奥赛C++高阶培优班',
        pricePerLesson: 350,
        totalLessons: 50,
        remainingLessons: 20,
        consumedLessons: 30,
        bonusLessons: 4,
        status: 'active',
        expireDate: '2027-05-31',
        expiryDate: '2027-05-31'
      }
    ],
    wallet: { principalBalance: 1500, bonusBalance: 0, goldPoints: 110, ledger: [] },
    createdAt: '2025-10-28'
  },
  {
    id: 'std-015',
    name: '蒋宇航',
    studentNo: 'S948441',
    gender: 'male',
    age: 10,
    phone: '18511223399',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    status: 'dropped_out',
    grade: '小学四年级',
    school: '北京八十中管庄分校',
    publicSchool: '北京八十中管庄分校',
    parentName: '蒋国庆',
    parentPhone: '18511223399',
    wechatBound: false,
    faceEntered: false,
    coursePackages: [
      {
        packageId: 'pkg-015',
        courseId: 'course-robot-004',
        courseName: '013-乐高EV3/单片机机器人工程',
        pricePerLesson: 320,
        totalLessons: 32,
        remainingLessons: 0,
        consumedLessons: 32,
        bonusLessons: 0,
        status: 'refunded',
        expireDate: '2026-08-31',
        expiryDate: '2026-08-31'
      }
    ],
    wallet: { principalBalance: 0, bonusBalance: 0, goldPoints: 0, ledger: [] },
    createdAt: '2025-07-15'
  },
  {
    id: 'std-016',
    name: '杨安琪',
    studentNo: 'S891234',
    gender: 'female',
    age: 7,
    phone: '13701234567',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    status: 'normal',
    grade: '小学一年级',
    school: '日坛中学实验学校',
    publicSchool: '日坛中学实验学校',
    parentName: '杨波',
    parentPhone: '13701234567',
    boundWechat: 'wx_yangbo_cy',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-016',
        courseId: 'course-kiro-005',
        courseName: '202-中鸣积木KIRO启蒙探索课',
        pricePerLesson: 220,
        totalLessons: 32,
        remainingLessons: 18,
        consumedLessons: 14,
        bonusLessons: 2,
        status: 'active',
        expireDate: '2027-04-15',
        expiryDate: '2027-04-15'
      }
    ],
    wallet: { principalBalance: 1200, bonusBalance: 200, goldPoints: 50, ledger: [] },
    createdAt: '2026-02-20'
  },
  {
    id: 'std-017',
    name: '沈墨涵',
    studentNo: 'S948552',
    gender: 'male',
    age: 9,
    phone: '13911228833',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: 'normal',
    grade: '小学三年级',
    school: '万泉小学',
    publicSchool: '万泉小学',
    parentName: '沈斌',
    parentPhone: '13911228833',
    boundWechat: 'wx_shenbin',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-017',
        courseId: 'course-scratch-001',
        courseName: '012-软编Scratch创意图形编程',
        pricePerLesson: 280,
        totalLessons: 48,
        remainingLessons: 35,
        consumedLessons: 13,
        bonusLessons: 4,
        status: 'active',
        expireDate: '2027-07-20',
        expiryDate: '2027-07-20'
      }
    ],
    wallet: { principalBalance: 4200, bonusBalance: 600, goldPoints: 140, ledger: [] },
    createdAt: '2026-01-05'
  },
  {
    id: 'std-018',
    name: '薛锦程',
    studentNo: 'S862211',
    gender: 'male',
    age: 14,
    phone: '15810223344',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    status: 'normal',
    grade: '初中二年级',
    school: '北京一零一中学',
    publicSchool: '北京一零一中学',
    parentName: '薛强',
    parentPhone: '15810223344',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-018',
        courseId: 'course-cpp-002',
        courseName: '001-信息学奥赛C++高阶培优班',
        pricePerLesson: 350,
        totalLessons: 64,
        remainingLessons: 50,
        consumedLessons: 14,
        bonusLessons: 4,
        status: 'active',
        expireDate: '2027-10-31',
        expiryDate: '2027-10-31'
      }
    ],
    wallet: { principalBalance: 8000, bonusBalance: 1200, goldPoints: 240, ledger: [] },
    createdAt: '2025-11-10'
  },
  {
    id: 'std-019',
    name: '陶语嫣',
    studentNo: 'S948663',
    gender: 'female',
    age: 10,
    phone: '13511228877',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    status: 'normal',
    grade: '小学四年级',
    school: '朝阳实验小学',
    publicSchool: '朝阳实验小学',
    parentName: '陶明',
    parentPhone: '13511228877',
    boundWechat: 'wx_taoming_yy',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-019',
        courseId: 'course-python-003',
        courseName: '008-Python人工智能趣味算法',
        pricePerLesson: 300,
        totalLessons: 48,
        remainingLessons: 28,
        consumedLessons: 20,
        bonusLessons: 2,
        status: 'active',
        expireDate: '2027-06-30',
        expiryDate: '2027-06-30'
      }
    ],
    wallet: { principalBalance: 2600, bonusBalance: 400, goldPoints: 110, ledger: [] },
    createdAt: '2025-12-20'
  },
  {
    id: 'std-020',
    name: '高睿博',
    studentNo: 'S753399',
    gender: 'male',
    age: 11,
    phone: '13611334455',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    status: 'normal',
    grade: '小学五年级',
    school: '望京实验学校',
    publicSchool: '望京实验学校',
    parentName: '高山',
    parentPhone: '13611334455',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-020',
        courseId: 'course-robot-004',
        courseName: '013-乐高EV3/单片机机器人工程',
        pricePerLesson: 320,
        totalLessons: 40,
        remainingLessons: 22,
        consumedLessons: 18,
        bonusLessons: 0,
        status: 'active',
        expireDate: '2027-05-31',
        expiryDate: '2027-05-31'
      }
    ],
    wallet: { principalBalance: 3100, bonusBalance: 300, goldPoints: 90, ledger: [] },
    createdAt: '2026-01-18'
  },
  {
    id: 'std-021',
    name: '崔艺馨',
    studentNo: 'S948774',
    gender: 'female',
    age: 6,
    phone: '13811990022',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-cy',
    campusName: '朝阳校区',
    status: 'normal',
    grade: '幼儿园大班',
    school: '二十一世纪实验幼儿园',
    publicSchool: '二十一世纪实验幼儿园',
    parentName: '崔鹏',
    parentPhone: '13811990022',
    boundWechat: 'wx_cuipeng',
    wechatBound: true,
    faceEntered: false,
    coursePackages: [
      {
        packageId: 'pkg-021',
        courseId: 'course-kiro-005',
        courseName: '202-中鸣积木KIRO启蒙探索课',
        pricePerLesson: 220,
        totalLessons: 32,
        remainingLessons: 26,
        consumedLessons: 6,
        status: 'active',
        expireDate: '2027-08-31',
        expiryDate: '2027-08-31'
      }
    ],
    wallet: { principalBalance: 1600, bonusBalance: 200, goldPoints: 30, ledger: [] },
    createdAt: '2026-04-10'
  },
  {
    id: 'std-022',
    name: '卢浩然',
    studentNo: 'S948885',
    gender: 'male',
    age: 13,
    phone: '13911887766',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    status: 'normal',
    grade: '初中一年级',
    school: '北大附中',
    publicSchool: '北大附中',
    parentName: '卢勇',
    parentPhone: '13911887766',
    boundWechat: 'wx_luyong',
    wechatBound: true,
    faceEntered: true,
    coursePackages: [
      {
        packageId: 'pkg-022',
        courseId: 'course-cpp-002',
        courseName: '001-信息学奥赛C++高阶培优班',
        pricePerLesson: 350,
        totalLessons: 48,
        remainingLessons: 38,
        consumedLessons: 10,
        bonusLessons: 4,
        status: 'active',
        expireDate: '2027-09-30',
        expiryDate: '2027-09-30'
      }
    ],
    wallet: { principalBalance: 6600, bonusBalance: 1000, goldPoints: 175, ledger: [] },
    createdAt: '2026-02-28'
  }
]

// 待分班学员列表
export const MOCK_UNASSIGNED_STUDENTS: UnassignedStudentItem[] = [
  {
    id: 'unas-001',
    studentId: 'std-005',
    name: '陈宇杰',
    studentNo: 'S948101',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=60',
    gender: 'male',
    phone: '13811229988',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    courseId: 'course-scratch-001',
    courseName: '012-软编Scratch创意图形编程',
    unassignedLessons: 48,
    preferredTime: '周六上午 09:00-10:30',
    signupDate: '2026-09-18',
    counselor: '张学管',
    assessmentScore: 92,
    assessmentSummary: '逻辑思维清晰，空间想象力突出，建议编入Scratch创意周末1班。'
  },
  {
    id: 'unas-002',
    studentId: 'std-006',
    name: '林若汐',
    studentNo: 'S948102',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60',
    gender: 'female',
    phone: '13661188223',
    campusId: 'campus-bj-yy',
    campusName: '远洋校区',
    courseId: 'course-python-003',
    courseName: '008-Python人工智能趣味算法',
    unassignedLessons: 48,
    preferredTime: '周日下午 14:00-16:00',
    signupDate: '2026-09-19',
    counselor: '王学管',
    assessmentScore: 95,
    assessmentSummary: '具备图形化编程底子，英文打字速度快，适合Python进阶算法班。'
  },
  {
    id: 'unas-003',
    studentId: 'std-007',
    name: '周泽铭',
    studentNo: 'S948103',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60',
    gender: 'male',
    phone: '13522334455',
    campusId: 'campus-bj-wj',
    campusName: '望京校区',
    courseId: 'course-robot-004',
    courseName: '013-乐高EV3/单片机机器人工程',
    unassignedLessons: 36,
    preferredTime: '周六下午 16:30-18:00',
    signupDate: '2026-09-20',
    counselor: '孙学管',
    assessmentScore: 89,
    assessmentSummary: '动手拼接与机械传动理解深刻，适合EV3机器人工程实战班。'
  }
]

// 服务费与代报考管理清单 (易快报对接)
export const MOCK_SERVICE_FEES: ServiceFeeRecord[] = [
  {
    id: 'sf-001',
    certNo: 'BK20260901-01',
    studentId: 'std-001',
    studentName: '张小萌',
    studentNo: 'S948918',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    examType: '中国电子学会 Scratch 软件编程一级考级',
    category: 'certification',
    fee: 360,
    invoiceTitle: '张建国 (个人)',
    yikuaibaoVoucherNo: 'YKB-20260901-0089',
    status: 'verified',
    createTime: '2026-09-01 10:20',
    verifyTime: '2026-09-02 14:15',
    operator: '张学管',
    voucherImage: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400'
  },
  {
    id: 'sf-002',
    certNo: 'BK20260905-02',
    studentId: 'std-002',
    studentName: '李浩轩',
    studentNo: 'S765585',
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    examType: '全国青少年信息学奥林匹克联赛 CSP-J 初赛',
    category: 'competition',
    fee: 500,
    invoiceTitle: '北京明德科技发展有限公司',
    yikuaibaoVoucherNo: '',
    status: 'pending',
    createTime: '2026-09-05 14:10',
    operator: '李销售'
  },
  {
    id: 'sf-003',
    certNo: 'BK20260910-03',
    studentId: 'std-009',
    studentName: '何天宇',
    studentNo: 'S948206',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    examType: '第15届蓝桥杯青少组国赛代报名考务费',
    category: 'competition',
    fee: 680,
    invoiceTitle: '何伟 (个人)',
    yikuaibaoVoucherNo: 'YKB-20260911-0112',
    status: 'verified',
    createTime: '2026-09-10 09:30',
    verifyTime: '2026-09-11 11:20',
    operator: '何学管'
  },
  {
    id: 'sf-004',
    certNo: 'BK20260915-04',
    studentId: 'std-008',
    studentName: '孙嘉怡',
    studentNo: 'S821105',
    campusId: 'campus-bj-hd',
    campusName: '海淀分校',
    examType: '中国工信部少儿编程二级认证考务费',
    category: 'certification',
    fee: 420,
    invoiceTitle: '孙磊 (个人)',
    yikuaibaoVoucherNo: '',
    status: 'pending',
    createTime: '2026-09-15 16:45',
    operator: '孙学管'
  }
]

// ==========================================
// 业务操作函数 API
// ==========================================

export function getStudents(filters?: {
  keyword?: string
  campusId?: string
  status?: string
  grade?: string
}): Student[] {
  let result = [...MOCK_STUDENTS]

  if (filters?.campusId) {
    result = result.filter(s => s.campusId === filters.campusId)
  }

  if (filters?.keyword) {
    const q = filters.keyword.trim().toLowerCase()
    result = result.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.studentNo.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        (s.parentPhone && s.parentPhone.includes(q))
    )
  }

  if (filters?.status && filters.status !== 'all') {
    result = result.filter(s => s.status === filters.status)
  }

  if (filters?.grade) {
    const g = filters.grade.trim()
    result = result.filter(s => s.grade.includes(g))
  }

  return result
}

export function getStudentById(id: string): Student | undefined {
  return MOCK_STUDENTS.find(s => s.id === id)
}

export function addStudent(data: Partial<Student>): Student {
  const autoNo = `S${Math.floor(100000 + Math.random() * 900000)}`
  const newStudent: Student = {
    id: data.id || `std-${Date.now()}`,
    name: data.name || '新学员',
    studentNo: data.studentNo || autoNo,
    gender: data.gender || 'male',
    age: data.age || 8,
    phone: data.phone || '13800000000',
    avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    campusId: data.campusId || 'campus-bj-hq',
    campusName: CAMPUSES_MAP[data.campusId || 'campus-bj-hq'] || '总部校区',
    grade: data.grade || '小学三年级',
    school: data.school || data.publicSchool || '未录入学校',
    publicSchool: data.publicSchool || data.school || '未录入学校',
    parentName: data.parentName || '家长',
    parentPhone: data.parentPhone || data.phone || '13800000000',
    parentWechat: data.parentWechat || '',
    boundWechat: data.boundWechat || '',
    wechatBound: data.wechatBound ?? false,
    faceEntered: data.faceEntered ?? false,
    status: data.status || 'normal',
    wallet: data.wallet || { principalBalance: 0, bonusBalance: 0, goldPoints: 0, ledger: [] },
    coursePackages: data.coursePackages || [],
    learningRecords: [],
    communicationRecords: [],
    competitionRecords: [],
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString()
  }

  MOCK_STUDENTS.unshift(newStudent)
  saveCustomStudentsToStorage()
  return newStudent
}

const STUDENTS_STORAGE_KEY = 'yixiao_mock_students_data_v3'
const UNASSIGNED_STORAGE_KEY = 'yixiao_mock_unassigned_data_v3'
const LEGACY_STORAGE_KEY = 'yixiao_mock_students_custom'

// 初始化时自动恢复 localStorage 中的学员全量状态（包含所有签约课包、钱包、异动与新增学员）
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem(STUDENTS_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)
    if (saved) {
      const list: Student[] = JSON.parse(saved)
      if (Array.isArray(list)) {
        for (const item of list) {
          const idx = MOCK_STUDENTS.findIndex((s) => s.id === item.id || s.studentNo === item.studentNo)
          if (idx >= 0) {
            // 用缓存中的最新状态（课包、余额、在读状态等）覆盖预置数据
            MOCK_STUDENTS[idx] = { ...MOCK_STUDENTS[idx], ...item }
          } else {
            // 新增建档学员
            MOCK_STUDENTS.unshift(item)
          }
        }
      }
    }

    const savedUnassigned = localStorage.getItem(UNASSIGNED_STORAGE_KEY)
    if (savedUnassigned) {
      const uList: UnassignedStudentItem[] = JSON.parse(savedUnassigned)
      if (Array.isArray(uList)) {
        MOCK_UNASSIGNED_STUDENTS.length = 0
        MOCK_UNASSIGNED_STUDENTS.push(...uList)
      }
    }
  }
} catch (e) {
  console.warn('[Mock Students] Failed to restore from storage:', e)
}

export function saveAllStudentsToStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(MOCK_STUDENTS))
      localStorage.setItem(UNASSIGNED_STORAGE_KEY, JSON.stringify(MOCK_UNASSIGNED_STUDENTS))
    }
  } catch (e) {
    console.warn('[Mock Students] Failed to sync students to storage:', e)
  }
}

// 保持旧函数签名兼容
export const saveCustomStudentsToStorage = saveAllStudentsToStorage

export function updateStudent(id: string, patch: Partial<Student>): Student | undefined {
  const index = MOCK_STUDENTS.findIndex(s => s.id === id)
  if (index === -1) return undefined
  MOCK_STUDENTS[index] = {
    ...MOCK_STUDENTS[index],
    ...patch,
    updatedAt: new Date().toISOString()
  }
  saveAllStudentsToStorage()
  return MOCK_STUDENTS[index]
}

export function deleteStudent(id: string): boolean {
  const index = MOCK_STUDENTS.findIndex(s => s.id === id)
  if (index >= 0) {
    MOCK_STUDENTS.splice(index, 1)
    saveAllStudentsToStorage()
    return true
  }
  return false
}

// 7 大异动分支状态机执行器
export function applyAbnormalMovement(payload: AbnormalMovementPayload): {
  success: boolean
  message: string
  diff?: number
  walletCredited?: number
  pendingPaymentRequired?: number
  refundAmount?: number
  student?: Student
} {
  const student = MOCK_STUDENTS.find(s => s.id === payload.studentId)
  if (!student) {
    return { success: false, message: '学员未找到' }
  }

  switch (payload.movementType) {
    // 1. 转班 (Transfer Class)
    case 'transfer_class': {
      if (student.status === 'suspended') {
        return { success: false, message: '学员当前处于停课休学状态，禁止转班' }
      }
      const pkg = student.coursePackages.find(p => p.packageId === payload.packageId)
      if (!pkg || pkg.status !== 'active') {
        return { success: false, message: '选中的课包不存在或非有效在读状态' }
      }
      if (payload.targetClassCurrentCount !== undefined && payload.targetClassCapacity !== undefined) {
        if (payload.targetClassCurrentCount >= payload.targetClassCapacity) {
          return { success: false, message: '目标班级已达到满班人数上限，无法转入' }
        }
      }
      pkg.classId = payload.toClassId
      const targetClass = MOCK_AVAILABLE_CLASSES.find(c => c.id === payload.toClassId)
      if (targetClass) {
        pkg.className = targetClass.name
      }
      return { success: true, message: '转班成功，课时已等额转移至新班级', student }
    }

    // 2. 换课 (Change Course)
    case 'change_course': {
      const oldPkg = student.coursePackages.find(p => p.packageId === payload.packageId)
      if (!oldPkg || oldPkg.status !== 'active') {
        return { success: false, message: '原课包不存在或非有效状态' }
      }
      const newLessons = payload.newPurchasedLessons || 0
      if (newLessons <= 0) {
        return { success: false, message: '拟购买新课课时数必须大于0' }
      }
      const newCourse = MOCK_COURSES.find(c => c.id === payload.newCourseId)
      if (!newCourse) {
        return { success: false, message: '目标新课程不存在' }
      }

      const oldPrice = oldPkg.pricePerLesson || 280
      const oldResidualValue = Number((oldPkg.remainingLessons * oldPrice).toFixed(2))
      const newTotalCost = Number((newLessons * newCourse.pricePerLesson).toFixed(2))
      const diff = Number((oldResidualValue - newTotalCost).toFixed(2))

      oldPkg.status = 'completed' // 原课包终结

      let walletCredited = 0
      let pendingPaymentRequired = 0

      if (diff > 0) {
        // 差额退回本金
        student.wallet.principalBalance = Number((student.wallet.principalBalance + diff).toFixed(2))
        student.wallet.ledger = student.wallet.ledger || []
        student.wallet.ledger.unshift({
          id: `w-${Date.now()}`,
          type: 'refund',
          amount: diff,
          principalChange: diff,
          bonusChange: 0,
          time: new Date().toISOString().replace('T', ' ').slice(0, 19),
          description: `换课差额退款：${oldPkg.courseName} -> ${newCourse.name}`,
          operator: payload.operator || '教务处'
        })
        walletCredited = diff
      } else if (diff < 0) {
        pendingPaymentRequired = Math.abs(diff)
      }

      const newPkg: StudentCoursePackage = {
        packageId: `pkg-${Date.now()}`,
        courseId: newCourse.id,
        courseName: newCourse.name,
        pricePerLesson: newCourse.pricePerLesson,
        totalLessons: newLessons,
        remainingLessons: newLessons,
        consumedLessons: 0,
        bonusLessons: 0,
        status: 'active',
        expireDate: '2027-12-31',
        expiryDate: '2027-12-31'
      }
      student.coursePackages.push(newPkg)

      return {
        success: true,
        message: diff >= 0 ? `换课成功！差额 ¥${diff} 已自动退回学员电子钱包` : `换课成功！需补缴差额 ¥${pendingPaymentRequired}`,
        diff,
        walletCredited,
        pendingPaymentRequired,
        student
      }
    }

    // 3. 停课/休学 (Suspend)
    case 'suspend': {
      if (student.status === 'suspended') {
        return { success: false, message: '该学员已处于停课休学状态，请勿重复操作' }
      }
      if (student.status === 'dropped_out') {
        return { success: false, message: '已结业/退费学员禁止办理停课' }
      }
      const suspensionDays = payload.suspensionDays || 30
      student.status = 'suspended'
      for (const pkg of student.coursePackages) {
        if (pkg.status === 'active') {
          pkg.status = 'frozen'
          const expStr = pkg.expireDate || pkg.expiryDate
          if (expStr) {
            const d = new Date(expStr)
            d.setDate(d.getDate() + suspensionDays)
            const newExp = d.toISOString().split('T')[0]
            pkg.expireDate = newExp
            pkg.expiryDate = newExp
          }
        }
      }
      return { success: true, message: `停课办理成功，有效期已自动顺延 ${suspensionDays} 天`, student }
    }

    // 4. 复课 (Resume)
    case 'resume': {
      if (student.status !== 'suspended') {
        return { success: false, message: '学员当前非停课状态，无需办理复课' }
      }
      student.status = 'normal'
      for (const pkg of student.coursePackages) {
        if (pkg.status === 'frozen') {
          pkg.status = 'active'
        }
      }
      return { success: true, message: '复课成功！课包资产已全部解冻', student }
    }

    // 5. 转校 (Transfer Campus)
    case 'transfer_campus': {
      if (!payload.targetCampusId) {
        return { success: false, message: '请指定目标校区' }
      }
      if (student.campusId === payload.targetCampusId) {
        return { success: false, message: '目标校区不能与当前归属校区相同' }
      }
      if (payload.authorizedCampusIds && !payload.authorizedCampusIds.includes(payload.targetCampusId)) {
        return { success: false, message: `跨校区转校失败：目标校区 ${payload.targetCampusId} 未授权` }
      }
      student.campusId = payload.targetCampusId
      student.campusName = CAMPUSES_MAP[payload.targetCampusId] || payload.targetCampusId
      student.status = 'normal'
      return { success: true, message: `转校成功，学籍已划转入 [${student.campusName}]`, student }
    }

    // 6. 转让 (Transfer Student)
    case 'transfer_student': {
      if (!payload.targetStudentId) {
        return { success: false, message: '请选择受让目标学员' }
      }
      const targetStudent = MOCK_STUDENTS.find(s => s.id === payload.targetStudentId)
      if (!targetStudent) {
        return { success: false, message: '受让目标学员不存在' }
      }
      const transferredPackages: StudentCoursePackage[] = []
      for (const pkg of student.coursePackages) {
        if (pkg.status === 'active' && pkg.remainingLessons > 0) {
          transferredPackages.push({
            ...pkg,
            packageId: `pkg-trans-${Date.now()}-${pkg.packageId}`
          })
          pkg.status = 'completed'
          pkg.remainingLessons = 0
        }
      }
      const transferredWallet = { ...student.wallet }
      student.wallet.principalBalance = 0
      student.wallet.bonusBalance = 0

      targetStudent.coursePackages = targetStudent.coursePackages || []
      targetStudent.coursePackages.push(...transferredPackages)
      targetStudent.wallet = targetStudent.wallet || { principalBalance: 0, bonusBalance: 0 }
      targetStudent.wallet.principalBalance += transferredWallet.principalBalance
      targetStudent.wallet.bonusBalance += transferredWallet.bonusBalance

      return {
        success: true,
        message: `转让成功！已将 ${transferredPackages.length} 个课包及钱包余额 ¥${transferredWallet.principalBalance + transferredWallet.bonusBalance} 移交至学员 [${targetStudent.name}]`,
        student
      }
    }

    // 7. 退费 (Refund)
    case 'refund': {
      const pkg = student.coursePackages.find(p => p.packageId === payload.packageId)
      if (!pkg) {
        return { success: false, message: '未找到待退费课包' }
      }
      if (pkg.status === 'refunded' || pkg.status === 'completed') {
        return { success: false, message: '该课包已达终态（已退费/已结课），无法重复发起退费' }
      }

      const price = pkg.pricePerLesson || 280
      const bonus = pkg.bonusLessons || 0
      const purchasedRegular = pkg.totalLessons - bonus
      const consumed = pkg.totalLessons - pkg.remainingLessons

      // 盛通退费核心计算公式
      let refundableAmount = Math.max(0, pkg.remainingLessons - bonus) * price

      // 若消耗课时超出了购买正课，按正课单价补扣赠课
      if (consumed > purchasedRegular) {
        const excessBonusConsumed = consumed - purchasedRegular
        const clawback = excessBonusConsumed * price
        refundableAmount = Math.max(0, refundableAmount - clawback)
      }

      const deductionFee = payload.deductionFee || 0
      refundableAmount = Math.max(0, refundableAmount - deductionFee)
      refundableAmount = Number(refundableAmount.toFixed(2))

      pkg.status = 'refunded'
      pkg.remainingLessons = 0
      pkg.bonusLessons = 0

      // 如果名下所有课包都已退或结课，置为已退学流失
      if (student.coursePackages.every(p => p.status === 'refunded' || p.status === 'completed')) {
        student.status = 'dropped_out'
      }

      saveAllStudentsToStorage()
      return {
        success: true,
        message: `退费结算完成！应退金额：¥${refundableAmount}（已扣除手续教材费 ¥${deductionFee}）`,
        refundAmount: refundableAmount,
        student
      }
    }

    default:
      return { success: false, message: '不支持的异动类型' }
  }
}

// 报名签约开单流
export function enrollStudent(params: {
  studentId: string
  courseId: string
  lessonCount: number
  bonusLessons: number
  pricePerLesson: number
  discountAmount: number
  couponAmount: number
  actualAmount: number
  paymentMethod: 'wechat' | 'alipay' | 'bank_transfer' | 'pos' | 'wallet'
  campusId: string
  operator?: string
}): { success: boolean; message: string; packageId: string; orderNo: string } {
  const student = MOCK_STUDENTS.find(s => s.id === params.studentId)
  if (!student) {
    return { success: false, message: '学员不存在', packageId: '', orderNo: '' }
  }

  const course = MOCK_COURSES.find(c => c.id === params.courseId)
  const courseName = course ? course.name : '标准课程'
  const packageId = `pkg-new-${Date.now()}`
  const orderNo = `ORD${Date.now()}`

  // 若钱包支付，扣减钱包余额
  if (params.paymentMethod === 'wallet') {
    const totalWallet = student.wallet.principalBalance + student.wallet.bonusBalance
    if (params.actualAmount > totalWallet) {
      return { success: false, message: '电子钱包余额不足以完成支付', packageId: '', orderNo: '' }
    }
    // 优先扣除赠送金
    if (student.wallet.bonusBalance >= params.actualAmount) {
      student.wallet.bonusBalance -= params.actualAmount
    } else {
      const rest = params.actualAmount - student.wallet.bonusBalance
      student.wallet.bonusBalance = 0
      student.wallet.principalBalance -= rest
    }
  }

  const newPkg: StudentCoursePackage = {
    packageId,
    courseId: params.courseId,
    courseName,
    pricePerLesson: params.pricePerLesson,
    totalLessons: params.lessonCount + params.bonusLessons,
    remainingLessons: params.lessonCount + params.bonusLessons,
    consumedLessons: 0,
    bonusLessons: params.bonusLessons,
    status: 'active',
    expireDate: '2027-12-31',
    expiryDate: '2027-12-31',
    orderNo
  }

  student.coursePackages.unshift(newPkg)
  student.status = 'normal'

  // 自动推入待分班调度池
  MOCK_UNASSIGNED_STUDENTS.unshift({
    id: `unas-${Date.now()}`,
    studentId: student.id,
    name: student.name,
    studentNo: student.studentNo,
    avatar: student.avatar,
    gender: student.gender,
    phone: student.phone,
    campusId: params.campusId,
    campusName: CAMPUSES_MAP[params.campusId] || '总部校区',
    courseId: params.courseId,
    courseName,
    unassignedLessons: params.lessonCount + params.bonusLessons,
    preferredTime: '待排班确认',
    signupDate: new Date().toISOString().split('T')[0],
    counselor: params.operator || '销售学管',
    assessmentScore: 90,
    assessmentSummary: '报名签约新生，已自动推入待分班学员池。'
  })

  // 同步生成财务中心订单台账并持久化
  try {
    saveOrder({
      id: `ord-${Date.now()}`,
      orderNo,
      studentId: student.id,
      studentName: student.name,
      studentNo: student.studentNo,
      phone: student.phone,
      courseId: params.courseId,
      courseName,
      courseType: 'regular',
      campusId: params.campusId,
      campusName: CAMPUSES_MAP[params.campusId] || '总部校区',
      orderType: 'regular',
      chargeType: 'regular',
      status: 'paid',
      orderStatus: 'paid',
      originalPrice: params.lessonCount * params.pricePerLesson,
      discountAmount: params.discountAmount || 0,
      couponAmount: params.couponAmount || 0,
      receivableAmount: params.actualAmount,
      actualAmount: params.actualAmount,
      paymentMethod: params.paymentMethod,
      signupTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      payTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
      goodsDelivery: 'none',
      creator: params.operator || '教务学管',
      submitter: params.operator || '教务学管',
      performanceOwner: '李销售',
      salesOwner: '李销售',
      channel: 'ground',
      studentStatus: 'reading',
      abnormalStatus: 'normal',
      invoiceStatus: 'unissued',
      contractSigned: 'signed',
      isLocked: false
    })
  } catch (err) {
    console.warn('[Mock Enroll] saveOrder failed:', err)
  }

  // 关键：全量持久化学员资产与待分班池到 localStorage
  saveAllStudentsToStorage()

  return {
    success: true,
    message: `学员 [${student.name}] 报名签约成功！课包资产已入库，并自动排入待分班池。`,
    packageId,
    orderNo
  }
}

// 电子钱包操作
export function rechargeWallet(studentId: string, principalAmount: number, bonusAmount = 0, operator = '财务主管'): boolean {
  const student = MOCK_STUDENTS.find(s => s.id === studentId)
  if (!student) return false

  student.wallet.principalBalance = Number((student.wallet.principalBalance + principalAmount).toFixed(2))
  student.wallet.bonusBalance = Number((student.wallet.bonusBalance + bonusAmount).toFixed(2))
  student.wallet.ledger = student.wallet.ledger || []
  student.wallet.ledger.unshift({
    id: `w-${Date.now()}`,
    type: 'recharge',
    amount: principalAmount + bonusAmount,
    principalChange: principalAmount,
    bonusChange: bonusAmount,
    time: new Date().toISOString().replace('T', ' ').slice(0, 19),
    description: `电子钱包充值 (本金 ¥${principalAmount}${bonusAmount > 0 ? ' + 赠送 ¥' + bonusAmount : ''})`,
    operator
  })
  saveAllStudentsToStorage()
  return true
}

export function withdrawWallet(studentId: string, amount: number): { success: boolean; message: string } {
  const student = MOCK_STUDENTS.find(s => s.id === studentId)
  if (!student) return { success: false, message: '学员未找到' }
  if (amount <= 0) return { success: false, message: '提现金额必须大于0' }
  if (amount > student.wallet.principalBalance) {
    return { success: false, message: '提现金额不得超过本金余额（赠送金不可提现）' }
  }

  student.wallet.principalBalance = Number((student.wallet.principalBalance - amount).toFixed(2))
  student.wallet.ledger = student.wallet.ledger || []
  student.wallet.ledger.unshift({
    id: `w-${Date.now()}`,
    type: 'withdraw',
    amount: -amount,
    principalChange: -amount,
    bonusChange: 0,
    time: new Date().toISOString().replace('T', ' ').slice(0, 19),
    description: `合规提现出账 ¥${amount}`,
    operator: '财务核销'
  })
  saveAllStudentsToStorage()
  return { success: true, message: `本金提现成功，扣减 ¥${amount}` }
}

// 待分班学员操作
export function getUnassignedStudents(campusId?: string): UnassignedStudentItem[] {
  if (!campusId || campusId === 'campus-bj-hq' || campusId === 'HQ001') {
    return [...MOCK_UNASSIGNED_STUDENTS]
  }
  return MOCK_UNASSIGNED_STUDENTS.filter(u => u.campusId === campusId)
}

export function assignClassToStudent(studentId: string, classId: string, className: string): boolean {
  const student = MOCK_STUDENTS.find(s => s.id === studentId)
  if (!student) return false

  // 绑定班级到第一个对应的课包
  const targetPkg = student.coursePackages.find(p => p.status === 'active' && (!p.classId || p.classId === ''))
  if (targetPkg) {
    targetPkg.classId = classId
    targetPkg.className = className
  }

  // 从待分班列表中移除
  const uIndex = MOCK_UNASSIGNED_STUDENTS.findIndex(u => u.studentId === studentId)
  if (uIndex >= 0) {
    MOCK_UNASSIGNED_STUDENTS.splice(uIndex, 1)
  }

  // 同步将学员编入教务中心实体班级花名册并更新在读人数与持久化
  enrollStudentIntoClass(classId, studentId)

  saveAllStudentsToStorage()
  return true
}

// 服务费与代报考管理操作
export function getServiceFeeRecords(campusId?: string): ServiceFeeRecord[] {
  if (!campusId || campusId === 'campus-bj-hq' || campusId === 'HQ001') {
    return [...MOCK_SERVICE_FEES]
  }
  return MOCK_SERVICE_FEES.filter(s => s.campusId === campusId)
}

export function addServiceFeeRecord(record: Partial<ServiceFeeRecord>): ServiceFeeRecord {
  const newRecord: ServiceFeeRecord = {
    id: record.id || `sf-${Date.now()}`,
    certNo: record.certNo || `BK${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`,
    studentId: record.studentId || 'std-001',
    studentName: record.studentName || '学员',
    studentNo: record.studentNo || 'S948918',
    campusId: record.campusId || 'campus-bj-hq',
    campusName: CAMPUSES_MAP[record.campusId || 'campus-bj-hq'] || '总部校区',
    examType: record.examType || '软件编程考级',
    category: record.category || 'certification',
    fee: record.fee || 300,
    invoiceTitle: record.invoiceTitle || `${record.studentName || '学员'} (个人)`,
    yikuaibaoVoucherNo: record.yikuaibaoVoucherNo || '',
    status: record.status || 'pending',
    createTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
    operator: record.operator || '教务主管'
  }
  MOCK_SERVICE_FEES.unshift(newRecord)
  return newRecord
}

export function verifyServiceFeeRecord(id: string, voucherNo?: string): boolean {
  const record = MOCK_SERVICE_FEES.find(r => r.id === id)
  if (record) {
    record.status = 'verified'
    record.verifyTime = new Date().toISOString().replace('T', ' ').slice(0, 16)
    record.yikuaibaoVoucherNo = voucherNo || `YKB-${Date.now().toString().slice(-6)}`
    return true
  }
  return false
}

export function batchVerifyServiceFeeRecords(ids: string[], voucherNo?: string): number {
  let count = 0
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16)
  const defaultVoucher = voucherNo || `YKB-BATCH-${Date.now().toString().slice(-6)}`
  for (const id of ids) {
    const record = MOCK_SERVICE_FEES.find(r => r.id === id)
    if (record && record.status === 'pending') {
      record.status = 'verified'
      record.verifyTime = now
      record.yikuaibaoVoucherNo = defaultVoucher
      count++
    }
  }
  return count
}
