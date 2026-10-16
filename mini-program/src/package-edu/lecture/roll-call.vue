<template>
  <view class="rollcall-page-container">
    <!-- 顶部状态栏与导航 (对齐截图 016: < 课次详情) -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-left" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="nav-title">课次详情</text>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 课次基础信息卡片 (对齐截图 016 头部) -->
    <view class="schedule-summary-card">
      <view class="tags-time-row">
        <view class="tag-pill tag-offline">线下课</view>
        <view class="tag-pill tag-completed">已上</view>
        <text class="time-range">{{ schedule.timeRange }}</text>
      </view>

      <view class="class-title">{{ schedule.className }}</view>

      <view class="attribute-badges-row">
        <view class="attr-pill pill-blue">正常班</view>
        <view class="attr-pill pill-light-blue">讲师: {{ schedule.teacherName }}</view>
        <view class="attr-pill pill-light-blue">教务: {{ schedule.advisorName }}</view>
      </view>

      <view class="info-meta-lines">
        <view class="meta-line">班级：{{ schedule.classroomName }}</view>
        <view class="meta-line">课程：{{ schedule.courseName }}</view>
      </view>
    </view>

    <!-- 2. 签到课评功能操作栏 (对齐截图 016) -->
    <view class="section-action-strip">
      <view class="strip-left">
        <text class="section-heading">签到课评</text>
        <view class="attendance-ratio">
          实到/应到: <text class="highlight-count">{{ presentCount }}/{{ students.length }}</text>
        </view>
      </view>
      <view class="strip-actions">
        <text class="action-link" @click="handleAutoEvaluation">生成自动课评</text>
        <text class="action-link" @click="handleAddTempStudent">临时学员</text>
        <text class="action-link" @click="handleBatchRollCall">批量签到</text>
      </view>
    </view>

    <!-- 3. 一键推送横幅 (对齐截图 016: 填写课评后，点击这里一键推送 [全部推送]) -->
    <view class="push-notice-banner">
      <view class="banner-left">
        <text class="plane-icon">✈️</text>
        <text class="notice-desc">填写课评后，点击这里一键推送</text>
      </view>
      <view class="push-all-btn" @click="handlePushAll">全部推送</view>
    </view>

    <!-- 4. 学员点名花名册流 (对齐截图 016) -->
    <scroll-view class="students-scroll-list" scroll-y>
      <view class="student-card-item" v-for="stu in students" :key="stu.studentId">
        <!-- 学员头像与角标 -->
        <view class="avatar-wrap">
          <view class="avatar-circle">
            <text class="avatar-emoji">👦</text>
          </view>
          <view class="tag-corner">正</view>
        </view>

        <!-- 学员姓名与学号、课耗 -->
        <view class="student-info-col">
          <text class="student-name">{{ stu.name }}</text>
          <text class="student-no">学号: {{ stu.studentNo }}</text>
          <view class="burn-pill" @click="handleEditDeduct(stu)">
            <text class="burn-text">本次课耗 {{ stu.deductLessons }}</text>
            <text class="burn-arrow">›</text>
          </view>
        </view>

        <!-- 右侧签到状态与课评操作按钮 -->
        <view class="actions-col">
          <view
            class="status-toggle-btn"
            :class="'status-' + stu.status"
            @click="toggleStudentStatus(stu)"
          >
            {{ getStatusText(stu.status) }}
          </view>
          <view class="eval-btn" @click="handleWriteEvaluation(stu)">
            {{ stu.evaluated ? '已评价' : '写课评' }}
          </view>
        </view>
      </view>

      <view class="bottom-safe-space"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { eduApi, ScheduleEventModel, StudentRollCallModel } from '../../api/edu';
import { fulfillmentCoordinator, type FulfillmentSession } from '../../coordinators/fulfillment';

const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

// 课次信息 (对齐截图 016)
const schedule = ref<ScheduleEventModel>({
  id: 'sch-qmyy-12',
  campusId: 'campus-bj-hq',
  classId: 'cls-qmyy-002',
  className: '周二18.30周六10.00班-12',
  courseId: 'crs-qmyy',
  courseName: '启蒙英语',
  teacherId: 'teacher-feng',
  teacherName: '冯老师',
  advisorName: '冯老师',
  classroomId: 'cr-002',
  classroomName: '启蒙英语-002班',
  date: '2026-10-13',
  startTime: '18:30:00',
  endTime: '20:30:00',
  timeRange: '2026-10-13 18:30:00-20:30:00',
  semanticType: 'completed',
  classType: '线下课',
  status: 'completed',
  expectedCount: 10,
  actualCount: 10,
});

// 参课学员名单 (对齐截图 016)
const students = ref<StudentRollCallModel[]>([
  { studentId: 's-01', studentNo: 'S950014', name: '董御', status: 'present', deductLessons: 1, remainingLessons: 84, tag: '正', evaluated: false },
  { studentId: 's-02', studentNo: 'S950007', name: '张景恒', status: 'present', deductLessons: 1, remainingLessons: 72, tag: '正', evaluated: false },
  { studentId: 's-03', studentNo: 'S950006', name: '吴炳润', status: 'present', deductLessons: 1, remainingLessons: 60, tag: '正', evaluated: false },
  { studentId: 's-04', studentNo: 'S950003', name: '郑扶摇', status: 'present', deductLessons: 1, remainingLessons: 55, tag: '正', evaluated: false },
  { studentId: 's-05', studentNo: 'S950005', name: '孙佳音', status: 'present', deductLessons: 1, remainingLessons: 48, tag: '正', evaluated: false },
  { studentId: 's-06', studentNo: 'S950009', name: '赵梓涵', status: 'present', deductLessons: 1, remainingLessons: 42, tag: '正', evaluated: false },
  { studentId: 's-07', studentNo: 'S950010', name: '周子程', status: 'present', deductLessons: 1, remainingLessons: 36, tag: '正', evaluated: false },
  { studentId: 's-08', studentNo: 'S950011', name: '钱思睿', status: 'present', deductLessons: 1, remainingLessons: 30, tag: '正', evaluated: false },
  { studentId: 's-09', studentNo: 'S950012', name: '李浩轩', status: 'present', deductLessons: 1, remainingLessons: 24, tag: '正', evaluated: false },
  { studentId: 's-10', studentNo: 'S950013', name: '陈楚河', status: 'present', deductLessons: 1, remainingLessons: 18, tag: '正', evaluated: false },
]);

const presentCount = computed(() => {
  return students.value.filter((s) => s.status === 'present').length;
});

const fulfillmentSession = ref<FulfillmentSession | null>(null);

onMounted(async () => {
  try {
    const info = uni.getSystemInfoSync();
    statusBarHeight.value = info.statusBarHeight || 20;
    // #ifdef MP-WEIXIN
    const btn = uni.getMenuButtonBoundingClientRect();
    if (btn) {
      capsuleRightWidth.value = info.windowWidth - btn.left + 8;
    }
    // #endif
  } catch (e) {}

  // 接收路由参数动态水化
  const pages = getCurrentPages();
  const curPage = pages[pages.length - 1];
  const query = (curPage as any)?.options || {};
  if (query.scheduleId) {
    try {
      const session = await fulfillmentCoordinator.loadSession(query.scheduleId);
      fulfillmentSession.value = session;
      schedule.value = session.schedule as any;
      if (session.students && session.students.length > 0) {
        students.value = session.students.map((s) => ({
          studentId: s.studentId,
          studentNo: s.studentNo,
          name: s.name,
          avatar: s.avatar,
          status: s.status,
          deductLessons: s.deductLessons,
          remainingLessons: s.remainingLessons,
          phone: s.phone,
          tag: '正',
          evaluated: Boolean(s.comment || s.rating !== 5),
        }));
      }
    } catch (e) {
      const wb = await eduApi.getFulfillmentWorkbench(query.scheduleId);
      if (wb) {
        schedule.value = wb.schedule;
        if (wb.students && wb.students.length > 0) {
          students.value = wb.students;
        }
      }
    }
  }
});

const getStatusText = (status: string) => {
  switch (status) {
    case 'present': return '已到';
    case 'leave': return '请假';
    case 'absent': return '未到';
    case 'late': return '迟到';
    default: return '已到';
  }
};

const toggleStudentStatus = (stu: StudentRollCallModel) => {
  const map: Record<string, 'present' | 'leave' | 'absent'> = {
    present: 'leave',
    leave: 'absent',
    absent: 'present',
  };
  stu.status = map[stu.status] || 'present';
  stu.deductLessons = stu.status === 'present' ? 1 : 0;
  if (fulfillmentSession.value) {
    fulfillmentSession.value.setStudentStatus(stu.studentId, stu.status, stu.deductLessons);
  }
};

const handleEditDeduct = (stu: StudentRollCallModel) => {
  uni.showActionSheet({
    itemList: ['扣减 1 课时', '扣减 2 课时', '免扣课时 (0 课时)'],
    success: (res) => {
      stu.deductLessons = res.tapIndex === 0 ? 1 : res.tapIndex === 1 ? 2 : 0;
      if (fulfillmentSession.value) {
        fulfillmentSession.value.setStudentStatus(stu.studentId, stu.status, stu.deductLessons);
      }
      uni.showToast({ title: `已调整为扣除 ${stu.deductLessons} 课时`, icon: 'none' });
    },
  });
};

const handleAutoEvaluation = () => {
  uni.showToast({ title: '已依据启蒙英语课程大纲自动生成全员课评', icon: 'success' });
  students.value.forEach((s) => (s.evaluated = true));
};

const handleAddTempStudent = () => {
  uni.showModal({
    title: '添加临时插班学员',
    editable: true,
    placeholderText: '请输入插班学员姓名',
    success: (res) => {
      if (res.confirm && res.content) {
        students.value.push({
          studentId: 'temp-' + Date.now(),
          studentNo: 'S95' + Math.floor(Math.random() * 9000 + 1000),
          name: res.content,
          status: 'present',
          deductLessons: 1,
          remainingLessons: 10,
          tag: '临',
          evaluated: false,
        });
        uni.showToast({ title: '插班学员添加成功', icon: 'success' });
      }
    },
  });
};

const handleBatchRollCall = () => {
  uni.showActionSheet({
    itemList: ['全班一键已到 (全勤)', '全班一键请假 (不扣课时)'],
    success: (res) => {
      const targetStatus: 'present' | 'leave' = res.tapIndex === 0 ? 'present' : 'leave';
      const deduct = targetStatus === 'present' ? 1 : 0;
      students.value.forEach((s) => {
        s.status = targetStatus;
        s.deductLessons = deduct;
      });
      if (fulfillmentSession.value) {
        fulfillmentSession.value.batchMarkAttendance(targetStatus);
      }
      uni.showToast({
        title: targetStatus === 'present' ? '已设置为全员到课' : '已设置为全员请假',
        icon: targetStatus === 'present' ? 'success' : 'none',
      });
    },
  });
};

const handleWriteEvaluation = (stu: StudentRollCallModel) => {
  uni.navigateTo({
    url: `/package-edu/evaluation/edit?studentId=${stu.studentId}&studentName=${encodeURIComponent(stu.name)}&scheduleId=${schedule.value.id}&className=${encodeURIComponent(schedule.value.className)}`,
  });
};

const handlePushAll = async () => {
  uni.showModal({
    title: '一键推送与履约',
    content: `确认向 ${presentCount.value} 位到课学员家长微信推送随堂课评，并完成课时核销扣减？`,
    confirmColor: '#FF6B00',
    success: async (res) => {
      if (res.confirm) {
        uni.showLoading({ title: '正在履约推送...' });
        try {
          if (fulfillmentSession.value) {
            for (const s of students.value) {
              fulfillmentSession.value.setStudentStatus(s.studentId, s.status, s.deductLessons);
            }
            await fulfillmentSession.value.commit();
          } else {
            await fulfillmentCoordinator.fulfill(schedule.value.id);
          }
          uni.hideLoading();
          uni.showToast({ title: '推送成功！微信通知已出站', icon: 'success' });
          setTimeout(() => {
            uni.navigateBack();
          }, 1000);
        } catch (e: any) {
          uni.hideLoading();
          uni.showToast({ title: e?.message || '推送失败，请重试', icon: 'none' });
        }
      }
    },
  });
};

const handleGoBack = () => {
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({ url: '/package-edu/lecture/index' });
    },
  });
};
</script>

<style lang="scss" scoped>
.rollcall-page-container {
  min-height: 100vh;
  background-color: #F8FAFC;
  display: flex;
  flex-direction: column;
}

.nav-bar {
  background: #FFFFFF;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1rpx solid #F3F4F6;

  .nav-inner {
    height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24rpx;

    .nav-left {
      display: flex;
      align-items: center;
      gap: 12rpx;

      .back-arrow {
        font-size: 52rpx;
        color: #1F2937;
        font-weight: 300;
      }

      .nav-title {
        font-size: 34rpx;
        font-weight: 700;
        color: #111827;
      }
    }
  }
}

/* 1. 课次概况卡片 (对齐截图 016) */
.schedule-summary-card {
  background: #FFFFFF;
  padding: 24rpx 28rpx;
  border-bottom: 1rpx solid #F3F4F6;

  .tags-time-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 14rpx;

    .tag-pill {
      font-size: 20rpx;
      padding: 4rpx 14rpx;
      border-radius: 8rpx;
      font-weight: 600;

      &.tag-offline {
        background: #E0E7FF;
        color: #3730A3;
      }

      &.tag-completed {
        background: #DCFCE7;
        color: #15803D;
      }
    }

    .time-range {
      font-size: 24rpx;
      color: #6B7280;
    }
  }

  .class-title {
    font-size: 34rpx;
    font-weight: 700;
    color: #111827;
    margin-bottom: 14rpx;
  }

  .attribute-badges-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-bottom: 16rpx;

    .attr-pill {
      font-size: 22rpx;
      padding: 4rpx 14rpx;
      border-radius: 8rpx;

      &.pill-blue {
        background: #2563EB;
        color: #FFFFFF;
        font-weight: 600;
      }

      &.pill-light-blue {
        background: #EFF6FF;
        color: #1D4ED8;
      }
    }
  }

  .info-meta-lines {
    border-top: 1rpx solid #F9FAFB;
    padding-top: 12rpx;

    .meta-line {
      font-size: 24rpx;
      color: #6B7280;
      line-height: 1.6;
    }
  }
}

/* 2. 签到课评功能操作栏 (对齐截图 016) */
.section-action-strip {
  padding: 20rpx 28rpx 12rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .strip-left {
    display: flex;
    align-items: baseline;
    gap: 16rpx;

    .section-heading {
      font-size: 30rpx;
      font-weight: 700;
      color: #111827;
    }

    .attendance-ratio {
      font-size: 24rpx;
      color: #6B7280;

      .highlight-count {
        color: #111827;
        font-weight: 600;
      }
    }
  }

  .strip-actions {
    display: flex;
    align-items: center;
    gap: 20rpx;

    .action-link {
      font-size: 24rpx;
      color: #2563EB;
      font-weight: 500;
    }
  }
}

/* 3. 一键推送横幅 (对齐截图 016) */
.push-notice-banner {
  margin: 12rpx 24rpx 16rpx;
  background: #FFF7ED;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .banner-left {
    display: flex;
    align-items: center;
    gap: 10rpx;

    .plane-icon {
      font-size: 28rpx;
    }

    .notice-desc {
      font-size: 22rpx;
      color: #EA580C;
      font-weight: 500;
    }
  }

  .push-all-btn {
    background: #FF6B00;
    color: #FFFFFF;
    font-size: 22rpx;
    font-weight: 600;
    padding: 8rpx 24rpx;
    border-radius: 24rpx;
  }
}

/* 4. 学员点名列表 (对齐截图 016) */
.students-scroll-list {
  flex: 1;
  padding: 0 24rpx;
  box-sizing: border-box;

  .student-card-item {
    background: #FFFFFF;
    border-radius: 20rpx;
    padding: 20rpx 24rpx;
    display: flex;
    align-items: center;
    margin-bottom: 16rpx;
    box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.02);

    .avatar-wrap {
      position: relative;
      width: 96rpx;
      height: 96rpx;
      margin-right: 20rpx;

      .avatar-circle {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: #FEE2E2;
        display: flex;
        align-items: center;
        justify-content: center;

        .avatar-emoji {
          font-size: 54rpx;
        }
      }

      .tag-corner {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 32rpx;
        height: 32rpx;
        border-radius: 50%;
        background: #3B82F6;
        color: #FFFFFF;
        font-size: 18rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2rpx solid #FFFFFF;
        font-weight: 700;
      }
    }

    .student-info-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6rpx;

      .student-name {
        font-size: 30rpx;
        font-weight: 700;
        color: #111827;
      }

      .student-no {
        font-size: 22rpx;
        color: #6B7280;
      }

      .burn-pill {
        display: inline-flex;
        align-items: center;
        gap: 4rpx;
        background: #FFF7ED;
        padding: 4rpx 14rpx;
        border-radius: 8rpx;
        width: fit-content;
        margin-top: 4rpx;

        .burn-text {
          font-size: 20rpx;
          color: #EA580C;
          font-weight: 600;
        }

        .burn-arrow {
          font-size: 20rpx;
          color: #EA580C;
        }
      }
    }

    .actions-col {
      display: flex;
      flex-direction: column;
      gap: 12rpx;
      align-items: flex-end;

      .status-toggle-btn {
        width: 140rpx;
        height: 56rpx;
        border-radius: 28rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24rpx;
        font-weight: 600;

        &.status-present {
          background: #DCFCE7;
          color: #15803D;
        }

        &.status-leave {
          background: #FEF3C7;
          color: #B45309;
        }

        &.status-absent {
          background: #FEE2E2;
          color: #B91C1C;
        }
      }

      .eval-btn {
        width: 140rpx;
        height: 56rpx;
        border-radius: 28rpx;
        background: #EFF6FF;
        color: #2563EB;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24rpx;
        font-weight: 600;
      }
    }
  }

  .bottom-safe-space {
    height: 40rpx;
  }
}
</style>
