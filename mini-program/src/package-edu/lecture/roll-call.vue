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
        <view class="meta-line">班级：{{ schedule.className || schedule.classroomName }}</view>
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
        <AppIcon name="send" size="32rpx" color="#EA580C" class="plane-icon" />
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
            <AppIcon name="user" size="52rpx" color="#2F54EB" />
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
          <view
            class="eval-btn"
            :class="{ evaluated: stu.evaluated }"
            @click="handleEvaluationAction(stu)"
          >
            {{ stu.evaluated ? '看学情' : '写课评' }}
          </view>
        </view>
      </view>

      <view class="bottom-safe-space"></view>
    </scroll-view>

    <!-- 学情成长预览抽屉 (终结死循环跳转) -->
    <LessonGrowthReviewDrawer
      :visible="growthDrawerVisible"
      :schedule-id="schedule.id"
      :student-id="activeGrowthStudentId"
      :student-name="activeGrowthStudentName"
      :class-name="schedule.className"
      @close="growthDrawerVisible = false"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { eduApi, ScheduleEventModel, StudentRollCallModel } from '../../api/edu';
import { fulfillmentCoordinator, type FulfillmentSession } from '../../coordinators/fulfillment';
import AppIcon from '../../components/AppIcon.vue';
import LessonGrowthReviewDrawer from '../../components/LessonGrowthReviewDrawer.vue';

const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

// 学情成长预览抽屉状态
const growthDrawerVisible = ref(false);
const activeGrowthStudentId = ref('');
const activeGrowthStudentName = ref('');

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
  expectedCount: 0,
  actualCount: 0,
});

// 参课学员名单 (根据实际班级花名册水化)
const students = ref<StudentRollCallModel[]>([]);

const presentCount = computed(() => {
  return students.value.filter((s) => s.status === 'present' || s.status === 'late').length;
});

const fulfillmentSession = ref<FulfillmentSession | null>(null);
let activeScheduleId = '';

const loadRollCallData = async (scheduleId: string) => {
  activeScheduleId = scheduleId;
  try {
    const session = await fulfillmentCoordinator.loadSession(scheduleId);
    fulfillmentSession.value = session;
    schedule.value = session.schedule as any;
    if (session.students) {
      students.value = session.students.map((s) => {
        const studentPhotos = s.photos || [];
        const isStudentEvaluated = Boolean(
          s.isEvaluated ||
          (s as any).evaluated ||
          (studentPhotos.length > 0) ||
          s.videoUrl ||
          s.comment
        );
        return {
          studentId: s.studentId,
          studentNo: s.studentNo,
          name: s.name,
          avatar: s.avatar,
          status: s.status,
          deductLessons: s.deductLessons,
          remainingLessons: s.remainingLessons,
          phone: s.phone,
          tag: '正',
          evaluated: isStudentEvaluated,
          isEvaluated: isStudentEvaluated,
          isExempt: Boolean(s.isExempt),
          photos: studentPhotos,
          videoUrl: s.videoUrl,
          comment: s.comment,
          rating: s.rating,
        };
      });
    } else {
      students.value = [];
    }
  } catch (e) {
    const wb = await eduApi.getFulfillmentWorkbench(scheduleId);
    if (wb) {
      schedule.value = wb.schedule;
      if (wb.students) {
        students.value = wb.students.map((s: any) => ({
          ...s,
          name: s.studentName || s.name,
          evaluated: Boolean(s.isEvaluated || s.evaluated || s.currentComment || s.comment || (s.photos && s.photos.length > 0) || s.videoUrl),
        }));
      } else {
        students.value = [];
      }
    }
  }
};

// 监听课评保存/提交广播通知 (0毫秒即时变为“看学情”)
const handleEvaluationUpdated = (payload: { studentId?: string; evaluated?: boolean }) => {
  if (payload?.studentId) {
    const target = students.value.find((s) => s.studentId === payload.studentId);
    if (target) {
      target.evaluated = payload.evaluated !== undefined ? payload.evaluated : true;
    }
  }
};

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

  // 注册全局课评更新广播
  uni.$on('studentEvaluationUpdated', handleEvaluationUpdated);

  // 接收路由参数动态水化
  const pages = getCurrentPages();
  const curPage = pages[pages.length - 1];
  const query = (curPage as any)?.options || {};
  if (query.scheduleId) {
    await loadRollCallData(query.scheduleId);
  }
});

onShow(async () => {
  // 页面从子页面返回时，静默核验履约会话中已评价学员状态 (确保 Web 端与小程序双向实时互通)
  if (activeScheduleId) {
    try {
      const session = await fulfillmentCoordinator.loadSession(activeScheduleId);
      if (session && session.students && session.students.length > 0) {
        session.students.forEach((s) => {
          const item = students.value.find((stu) => stu.studentId === s.studentId);
          if (item) {
            item.status = s.status;
            item.deductLessons = s.deductLessons;
            const isStudentEvaluated = Boolean(
              s.isEvaluated ||
              (s as any).evaluated ||
              s.comment ||
              (s.photos && s.photos.length > 0) ||
              s.videoUrl
            );
            if (isStudentEvaluated) {
              item.evaluated = true;
              item.isEvaluated = true;
              if (Array.isArray(s.photos)) item.photos = s.photos;
              item.videoUrl = s.videoUrl || undefined;
              if (s.comment !== undefined) item.comment = s.comment;
            }
          }
        });
      }
    } catch (e) {}
  }
});

onUnmounted(() => {
  uni.$off('studentEvaluationUpdated', handleEvaluationUpdated);
  if (syncAttendanceTimer) {
    clearTimeout(syncAttendanceTimer);
    syncAttendanceTimer = null;
  }
});

// 考勤变更静默同步定时器
let syncAttendanceTimer: any = null;

// 同步考勤变更 (本地 Storage 草稿即刻写入 + 服务端数据库静默落盘)
const syncAttendanceChange = async (immediate = false) => {
  if (!activeScheduleId) return;

  const doSync = async () => {
    // 1. 本地 Storage 草稿即刻落盘
    if (fulfillmentSession.value) {
      await fulfillmentSession.value.saveDraft();
    }

    // 2. 组装当前最新出勤与课耗，静默同步持久化至服务端数据库
    try {
      const studentOverrides = students.value.map((s) => ({
        studentId: s.studentId,
        attendanceStatus: s.status,
        deductLessons: s.deductLessons,
      }));

      await eduApi.commitEvaluation({
        scheduleEventId: activeScheduleId,
        publish: false,
        dispatchStrategy: 'ATTENDED_ONLY',
        payload: {
          lessonTitle: schedule.value.className ? `${schedule.value.className} - 随堂考勤` : '随堂考勤记录',
          studyContentHtml: '随堂出勤记录与课评草稿',
          teacherComment: '随堂教学进展正常',
          overallRating: 5.0,
          studentOverrides,
        },
      });
    } catch (err) {
      console.warn('[roll-call] 静默同步考勤到服务端异常 (本地草稿已保全):', err);
    }
  };

  if (immediate) {
    if (syncAttendanceTimer) {
      clearTimeout(syncAttendanceTimer);
      syncAttendanceTimer = null;
    }
    await doSync();
  } else {
    // 本地草稿 0 毫秒即时落盘，防退出丢失
    if (fulfillmentSession.value) {
      fulfillmentSession.value.saveDraft();
    }
    if (syncAttendanceTimer) clearTimeout(syncAttendanceTimer);
    syncAttendanceTimer = setTimeout(() => {
      doSync();
      syncAttendanceTimer = null;
    }, 300);
  }
};

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
  syncAttendanceChange();
};

const handleEditDeduct = (stu: StudentRollCallModel) => {
  uni.showActionSheet({
    itemList: ['扣减 1 课时', '扣减 2 课时', '免扣课时 (0 课时)'],
    success: (res) => {
      stu.deductLessons = res.tapIndex === 0 ? 1 : res.tapIndex === 1 ? 2 : 0;
      if (fulfillmentSession.value) {
        fulfillmentSession.value.setStudentStatus(stu.studentId, stu.status, stu.deductLessons);
      }
      syncAttendanceChange();
      uni.showToast({ title: `已调整为扣除 ${stu.deductLessons} 课时`, icon: 'none' });
    },
  });
};

const handleAutoEvaluation = () => {
  if (fulfillmentSession.value) {
    fulfillmentSession.value.updateEvaluationDraft({
      templateName: '通用课评模板',
      studyContentHtml: '本节课重点掌握核心知识点与随堂交互，学员发音精准，课堂表现专注积极！',
      teacherComment: '全员课堂专注投入，表现优异！',
      overallRating: 5.0,
    });
    for (const s of students.value) {
      fulfillmentSession.value.updatePersonalizedComment(s.studentId, '本节课知识点掌握牢固，随堂练习完成出色！', 5.0);
    }
  }
  students.value.forEach((s) => (s.evaluated = true));
  uni.showToast({ title: '已依据课程大纲自动生成全员课评', icon: 'success' });
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
      syncAttendanceChange();
      uni.showToast({
        title: targetStatus === 'present' ? '已设置为全员到课' : '已设置为全员请假',
        icon: targetStatus === 'present' ? 'success' : 'none',
      });
    },
  });
};

const handleEvaluationAction = (stu: StudentRollCallModel) => {
  if (stu.evaluated) {
    // 已评价：原地拉起学情成长全景抽屉，彻底杜绝死循环跳转与重复保存
    activeGrowthStudentId.value = stu.studentId;
    activeGrowthStudentName.value = stu.name;
    growthDrawerVisible.value = true;
  } else {
    // 未评价：进入单人课评深度定制录入界面
    uni.navigateTo({
      url: `/package-edu/evaluation/edit?studentId=${stu.studentId}&studentName=${encodeURIComponent(stu.name)}&scheduleId=${schedule.value.id}&className=${encodeURIComponent(schedule.value.className || schedule.value.classroomName)}`,
    });
  }
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
            await fulfillmentCoordinator.quickFulfill(schedule.value.id);
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

const handleGoBack = async () => {
  await syncAttendanceChange(true);
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
      width: 32rpx;
      height: 32rpx;
      flex-shrink: 0;
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
        overflow: hidden;
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
      min-width: 0;
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
      flex-shrink: 0;

      .status-toggle-btn {
        width: 140rpx;
        height: 56rpx;
        box-sizing: border-box;
        border-radius: 9999rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24rpx;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
        transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        will-change: transform;

        &:active {
          transform: scale(0.92);
        }

        &.status-present {
          background: #DCFCE7;
          color: #15803D;
          border: 1rpx solid rgba(21, 128, 61, 0.15);
        }

        &.status-leave {
          background: #FEF3C7;
          color: #B45309;
          border: 1rpx solid rgba(180, 83, 9, 0.15);
        }

        &.status-absent {
          background: #FEE2E2;
          color: #B91C1C;
          border: 1rpx solid rgba(185, 28, 28, 0.15);
        }

        &.status-late {
          background: #F3E8FF;
          color: #7E22CE;
          border: 1rpx solid rgba(126, 34, 206, 0.15);
        }
      }

      .eval-btn {
        width: 140rpx;
        height: 56rpx;
        box-sizing: border-box;
        border-radius: 9999rpx;
        background: #EEF2FF;
        color: #2F54EB;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24rpx;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
        border: 1rpx solid rgba(47, 84, 235, 0.15);
        transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        will-change: transform;

        &:active {
          transform: scale(0.92);
        }

        &.evaluated {
          background: #ECFDF5;
          color: #059669;
          border-color: rgba(5, 150, 105, 0.25);
        }
      }
    }
  }

  .bottom-safe-space {
    height: calc(60rpx + constant(safe-area-inset-bottom));
    height: calc(60rpx + env(safe-area-inset-bottom));
  }
}
</style>
