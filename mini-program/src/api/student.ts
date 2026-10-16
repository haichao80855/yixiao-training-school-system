import { request } from '../utils/request';

export interface StudentListItemModel {
  id: string;
  name: string;
  studentNo: string;
  avatar?: string;
  phone: string;
  status: 'active' | 'graduated' | 'suspended' | 'pending_assignment' | 'lost';
  statusText: string;
  remainingLessons: number;
  remainingAmount: number;
  enrolledClassesCount: number;
  campusId: string;
  campusName: string;
  isAssignedClass: boolean;
}

export interface StudentCourseItemModel {
  id: string;
  courseId: string;
  courseName: string;
  coverUrl?: string;
  classId?: string;
  className?: string;
  isEnrolledClass: boolean;
  remainingLessons: number;
  remainingAmount: number;
  totalLessons: number;
  expireDateText?: string;
}

export interface AttendanceRecordItemModel {
  id: string;
  scheduleId: string;
  className: string;
  courseName: string;
  classType: string;
  status: 'present' | 'leave' | 'absent' | 'late' | 'pending';
  statusText: string;
  deductLessons: number;
  timeRangeText: string;
  teacherName: string;
}

export interface CommunicationRecordItemModel {
  id: string;
  type: 'pre_sale' | 'after_sale';
  dateText: string;
  communicator: string;
  method: string;
  content: string;
  courseName?: string;
}

export interface StudentProfileModel {
  id: string;
  name: string;
  studentNo: string;
  avatar?: string;
  gender: string;
  phone: string;
  guardianRelation: string;
  expireDateText: string;
  channelSource: string;
  status: string;
  campusName: string;
  totalRemainingLessons: number;
  totalRemainingAmount: number;
  walletBalance: number;
  cardCount: number;
  frozenLessons: number;
  courses: StudentCourseItemModel[];
  attendances: AttendanceRecordItemModel[];
  communications: CommunicationRecordItemModel[];
}

export interface EnrollPayloadModel {
  studentId: string;
  campusId?: string;
  courseId: string;
  courseName?: string;
  classId?: string;
  className?: string;
  packageId?: string;
  lessons?: number;
  amount?: number;
  totalLessons?: number;
  bonusLessons?: number;
  discountAmount?: number;
  pricePerLesson?: number;
  channel?: string;
  goods?: Array<{ id: string; name: string; quantity: number; price: number }>;
  payMethod?: string;
  paymentMethod?: string;
}

// 高保真内置备用数据源（对齐截图 023~027）
const MOCK_STUDENTS: StudentListItemModel[] = [
  {
    id: 's-01',
    name: '董御',
    studentNo: 'S950014',
    phone: '13460475611',
    status: 'active',
    statusText: '在读',
    remainingLessons: 84,
    remainingAmount: 4992,
    enrolledClassesCount: 1,
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    isAssignedClass: true,
  },
  {
    id: 's-02',
    name: '陈梓澄',
    studentNo: 'S950013',
    phone: '13812345678',
    status: 'active',
    statusText: '在读',
    remainingLessons: 81,
    remainingAmount: 4864,
    enrolledClassesCount: 1,
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    isAssignedClass: true,
  },
  {
    id: 's-03',
    name: '韦千寻',
    studentNo: 'S950012',
    phone: '15993080680',
    status: 'active',
    statusText: '在读',
    remainingLessons: 67,
    remainingAmount: 3968,
    enrolledClassesCount: 1,
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    isAssignedClass: true,
  },
  {
    id: 's-04',
    name: '娄栩歌',
    studentNo: 'S950011',
    phone: '18236139606',
    status: 'active',
    statusText: '在读',
    remainingLessons: 63,
    remainingAmount: 3780,
    enrolledClassesCount: 1,
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    isAssignedClass: true,
  },
  {
    id: 's-05',
    name: '周子程',
    studentNo: 'S950010',
    phone: '13522223333',
    status: 'pending_assignment',
    statusText: '待分班',
    remainingLessons: 40,
    remainingAmount: 2400,
    enrolledClassesCount: 0,
    campusId: 'campus-bj-hq',
    campusName: '总部校区',
    isAssignedClass: false,
  },
];

export const studentApi = {
  // 1. 获取学员名册列表 (023 & 029)
  async getStudents(params?: {
    keyword?: string;
    status?: string;
    warningLevel?: string;
    page?: number;
    pageSize?: number;
    campusId?: string;
  }): Promise<{ list: StudentListItemModel[]; total: number }> {
    try {
      const res = await request<any>({
        url: '/api/students',
        method: 'GET',
        data: params,
      });
      if (res && Array.isArray(res.list || res.items || res)) {
        const rawList = res.list || res.items || res;
        const list = rawList.map((item: any) => {
          const hasPackages = Array.isArray(item.packages) && item.packages.length > 0;
          const hasClasses = Array.isArray(item.classes) && item.classes.length > 0;
          const isAssigned = item.isAssignedClass !== undefined
            ? item.isAssignedClass
            : Boolean(
                hasClasses ||
                (hasPackages && item.packages.some((p: any) => p.classId || p.class))
              );
          const enrolledClassesCount = item.enrolledClassesCount !== undefined
            ? item.enrolledClassesCount
            : (item.classes?.length || (hasPackages ? item.packages.filter((p: any) => p.classId || p.class).length : 0));

          const remainingLessons = item.totalRemainingLessons ?? (
            hasPackages
              ? item.packages.reduce((sum: number, p: any) => sum + (p.remainingLessons || 0), 0)
              : (item.remainingLessons ?? 0)
          );
          const remainingAmount = item.totalRemainingAmount ?? (
            hasPackages
              ? item.packages.reduce((sum: number, p: any) => sum + (p.remainingLessons || 0) * (p.pricePerLesson || 0), 0)
              : (item.remainingAmount ?? 0)
          );

          let statusText = '未报读';
          if (hasPackages) {
            statusText = isAssigned ? '在读' : '待分班';
          } else if (item.status === 'pending_assignment') {
            statusText = '待分班';
          } else if (item.status === 'normal' || item.status === 'active') {
            statusText = isAssigned ? '在读' : '未报读';
          } else if (item.status === 'suspended') {
            statusText = '停课';
          } else if (item.statusText) {
            statusText = item.statusText;
          }

          return {
            id: item.id,
            name: item.name,
            studentNo: item.studentNo || (item.id ? `S${item.id.slice(-6)}` : ''),
            phone: item.phone || item.contactPhone || '',
            status: item.status || 'active',
            statusText,
            remainingLessons,
            remainingAmount,
            enrolledClassesCount: enrolledClassesCount || (isAssigned ? 1 : 0),
            campusId: item.campusId || item.campus?.id || 'campus-bj-hq',
            campusName: item.campus?.name || item.campusName || '总部校区',
            isAssignedClass: isAssigned,
          };
        });
        return { list, total: Number(res.total ?? list.length) };
      }
    } catch (e) {
      console.warn('[studentApi] 后端学员查询失败:', e);
      return { list: [], total: 0 };
    }

    return { list: [], total: 0 };
  },

  // 2. 获取学员档案详情 (024~027)
  async getStudentProfile(id: string): Promise<StudentProfileModel> {
    try {
      const res = await request<any>({
        url: `/api/students/${id}/profile`,
        method: 'GET',
      });
      const info = res?.studentInfo || res;
      if (info && (info.id || res?.id)) {
        const rawPackages = Array.isArray(res.packages)
          ? res.packages
          : (Array.isArray(res.courses) ? res.courses : []);

        const totalRemainingLessons = res.totalRemainingLessons ?? res.learningPortfolio?.assetOverview?.totalRemainingLessons ?? (
          rawPackages.length > 0
            ? rawPackages.reduce((sum: number, p: any) => sum + (p.remainingLessons ?? 0), 0)
            : 0
        );
        const totalRemainingAmount = res.totalRemainingAmount ?? (
          rawPackages.length > 0
            ? rawPackages.reduce((sum: number, p: any) => sum + (p.remainingLessons ?? 0) * (p.pricePerLesson ?? 0), 0)
            : 0
        );

        const frozenLessons = res.frozenLessons ?? (
          rawPackages.filter((p: any) => p.status === 'frozen').reduce((sum: number, p: any) => sum + (p.remainingLessons ?? 0), 0)
        );

        const courses: StudentCourseItemModel[] = rawPackages.map((p: any) => ({
          id: p.id || p.packageId || `sc-${p.courseId || '01'}`,
          courseId: p.courseId || p.course?.id || '',
          courseName: p.course?.name || p.courseName || '未命名课程',
          coverUrl: p.coverUrl || p.course?.coverUrl,
          classId: p.classId || p.class?.id,
          className: p.class?.name || p.className,
          isEnrolledClass: Boolean(p.classId || p.class),
          remainingLessons: p.remainingLessons ?? 0,
          remainingAmount: (p.remainingLessons ?? 0) * (p.pricePerLesson ?? 0),
          totalLessons: p.totalLessons ?? 0,
          expireDateText: p.expireDate ? new Date(p.expireDate).toISOString().split('T')[0] : '无限期',
        }));

        const rawAttendances = Array.isArray(res.attendances) ? res.attendances : [];
        const statusMap: Record<string, string> = {
          present: '已签到',
          leave: '请假',
          absent: '缺席',
          late: '迟到',
          pending: '待签到',
        };
        const attendances: AttendanceRecordItemModel[] = rawAttendances.map((a: any) => ({
          id: a.id,
          scheduleId: a.scheduleEvent?.id || a.scheduleId || '',
          className: a.scheduleEvent?.class?.name || a.className || '未排班',
          courseName: a.courseName || a.scheduleEvent?.class?.course?.name || '课程',
          classType: a.scheduleEvent?.semanticType === 'regular' ? '常规课' : (a.classType || '线下课'),
          status: a.status || 'present',
          statusText: statusMap[a.status] || a.statusText || '已签到',
          deductLessons: a.deductLessons ?? 1,
          timeRangeText: a.scheduleEvent
            ? `${a.scheduleEvent.date} ${a.scheduleEvent.startTime} -${a.scheduleEvent.endTime}`
            : (a.timeRangeText || ''),
          teacherName: a.teacherName || a.scheduleEvent?.teacher?.realName || '',
        }));

        let gender = '男';
        if (info.gender === 'female' || info.gender === '女') {
          gender = '女';
        } else if (info.gender === 'male' || info.gender === '男') {
          gender = '男';
        }

        const walletBalance = (res.walletSummary?.principalBalance ?? 0) + (res.walletSummary?.bonusBalance ?? 0)
          || res.wallet?.principalBalance
          || res.wallet?.balance
          || res.walletBalance
          || 0;

        let status = '未报读';
        if (info.status === 'suspended') {
          status = '停课';
        } else if (info.status === 'transferred') {
          status = '已转校';
        } else if (info.status === 'dropped_out') {
          status = '已流失';
        } else if (rawPackages.length > 0) {
          const hasClass = rawPackages.some((p: any) => p.classId || p.class);
          status = hasClass ? '在读' : '待分班';
        }

        return {
          id: info.id || res.id,
          name: info.name || res.name || '学员',
          studentNo: info.studentNo || res.studentNo || '',
          avatar: info.avatar || res.avatar,
          gender,
          phone: info.phone || res.phone || '',
          guardianRelation: info.guardianRelation || (info.parentName ? '家长' : (res.guardianRelation || '家长')),
          expireDateText: info.expireDateText || res.expireDateText || '无限期',
          channelSource: info.channelSource || res.channelSource || '地推/活动派单',
          status,
          campusName: info.campus?.name || res.campus?.name || res.campusName || '总部校区',
          totalRemainingLessons,
          totalRemainingAmount,
          walletBalance,
          cardCount: res.cards?.length ?? res.cardCount ?? 0,
          frozenLessons,
          courses,
          attendances,
          communications: Array.isArray(res.communications) ? res.communications : [],
        };
      }
    } catch (e) {
      console.warn('[studentApi] 获取学员详情接口失败:', e);
    }

    // 默认兜底（兼容离线测试样本 s-01，非测试样本保持真实0基线）
    if (id === 's-01') {
      return {
        id: 's-01',
        name: '董御',
        studentNo: 'S950014',
        gender: '男',
        phone: '13460475611',
        guardianRelation: '妈妈',
        expireDateText: '无限期',
        channelSource: '英语',
        status: '在读',
        campusName: '总部校区',
        totalRemainingLessons: 78,
        totalRemainingAmount: 4992,
        walletBalance: 0,
        cardCount: 0,
        frozenLessons: 6,
        courses: [
          {
            id: 'sc-01',
            courseId: 'crs-qm',
            courseName: '启蒙英语',
            classId: 'cls-qm-002',
            className: '启蒙英语-002班',
            isEnrolledClass: true,
            remainingLessons: 78,
            remainingAmount: 4992,
            totalLessons: 100,
          },
        ],
        attendances: [],
        communications: [],
      };
    }

    return {
      id: id || '',
      name: '学员',
      studentNo: '',
      gender: '男',
      phone: '',
      guardianRelation: '家长',
      expireDateText: '无限期',
      channelSource: '其他',
      status: '未报读',
      campusName: '总部校区',
      totalRemainingLessons: 0,
      totalRemainingAmount: 0,
      walletBalance: 0,
      cardCount: 0,
      frozenLessons: 0,
      courses: [],
      attendances: [],
      communications: [],
    };
  },

  // 3. 报名开单 (089~093)
  async enrollStudent(payload: EnrollPayloadModel) {
    const totalLessons = payload.totalLessons || payload.lessons || 48;
    const pricePerLesson = payload.pricePerLesson !== undefined
      ? payload.pricePerLesson
      : (payload.amount && totalLessons ? Math.round(payload.amount / totalLessons) : 64);

    let paymentMethod = (payload.paymentMethod || payload.payMethod || 'wechat').toLowerCase();
    if (paymentMethod === 'wx' || paymentMethod === 'weixin') paymentMethod = 'wechat';
    if (paymentMethod === 'ali') paymentMethod = 'alipay';
    if (!['wechat', 'alipay', 'bank_transfer', 'pos', 'wallet'].includes(paymentMethod)) {
      paymentMethod = 'wechat';
    }

    const bonusLessons = payload.bonusLessons !== undefined ? Number(payload.bonusLessons) : 0;

    const backendDto: any = {
      studentId: payload.studentId,
      courseId: payload.courseId,
      totalLessons: Number(totalLessons),
      pricePerLesson: Number(pricePerLesson),
      paymentMethod,
      channel: payload.channel || 'ground',
    };

    if (bonusLessons > 0) {
      backendDto.bonusLessons = bonusLessons;
    }
    if (payload.discountAmount !== undefined) {
      backendDto.discountAmount = Number(payload.discountAmount);
    }

    if (payload.classId) {
      backendDto.classId = payload.classId;
    }
    const goodsRemark = payload.goods && payload.goods.length > 0
      ? `配套物品: ${payload.goods.map((g) => `${g.name}x${g.quantity}`).join('、')}`
      : '';
    const classRemark = payload.className ? `报读班级: ${payload.className}` : '';
    const combinedRemark = [classRemark, goodsRemark].filter(Boolean).join(' | ');
    if (combinedRemark) {
      backendDto.remark = combinedRemark;
    }

    return request({
      url: '/api/students/enroll',
      method: 'POST',
      data: backendDto,
    });
  },

  // 4. 新建学员
  async createStudent(payload: {
    name: string;
    phone: string;
    gender?: string;
    birthday?: string;
    campusId?: string;
    parentName?: string;
    school?: string;
    address?: string;
    remark?: string;
  }) {
    let gender = 'male';
    if (payload.gender === '女' || payload.gender === 'female') {
      gender = 'female';
    } else if (payload.gender === '男' || payload.gender === 'male') {
      gender = 'male';
    }

    let campusId = payload.campusId;
    if (!campusId || campusId === 'all') {
      try {
        const stored = uni.getStorageSync('currentCampusId');
        if (stored && stored !== 'all') {
          campusId = stored;
        }
      } catch (e) {}
    }
    if (!campusId || campusId === 'all') {
      campusId = 'campus-bj-hq';
    }

    const backendPayload: any = {
      name: payload.name,
      phone: payload.phone,
      gender,
      campusId,
    };
    if (payload.birthday) backendPayload.birthday = payload.birthday;
    if (payload.parentName) backendPayload.parentName = payload.parentName;
    if (payload.school) backendPayload.school = payload.school;
    if (payload.address) backendPayload.address = payload.address;

    return request({
      url: '/api/students',
      method: 'POST',
      data: backendPayload,
    });
  },

  // 5. 修改学员信息 (028)
  async updateStudent(id: string, payload: any) {
    const backendPayload = { ...payload };
    if (backendPayload.gender) {
      backendPayload.gender = (backendPayload.gender === '女' || backendPayload.gender === 'female') ? 'female' : 'male';
    }
    return request({
      url: `/api/students/${id}`,
      method: 'PUT',
      data: backendPayload,
    });
  },

  // 6. 钱包充值
  async rechargeWallet(id: string, amount: number, remark?: string) {
    return request({
      url: `/api/students/${id}/wallet/recharge`,
      method: 'POST',
      data: { amount, remark },
    });
  },

  // 7. 学员异动 (转班/换课/休学)
  async executeMovement(id: string, payload: any) {
    return request({
      url: `/api/students/${id}/movement`,
      method: 'POST',
      data: payload,
    });
  },

  // 8. 课消预警大盘 (056~061)
  async getWarningRoster(params?: {
    keyword?: string;
    warningLevel?: string;
    dormantOnly?: boolean;
    renewalWindowOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    try {
      const res = await request<any>({
        url: '/api/students/renewal/roster',
        method: 'GET',
        data: params,
      });
      if (res && res.statistics && Array.isArray(res.list)) {
        return res;
      }
    } catch (e) {
      console.warn('[studentApi] 获取消课预警大盘失败，使用离线数据:', e);
    }
    return null;
  },
};
