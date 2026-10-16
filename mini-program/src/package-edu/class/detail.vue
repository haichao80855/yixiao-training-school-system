<template>
  <view class="class-detail-container">
    <!-- 顶部状态栏与自定义导航 (对齐截图 020: < 班级详情) -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-left" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="nav-title">班级详情</text>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 班级核心信息卡片 (对齐截图 020 头部) -->
    <view class="class-header-card">
      <view class="header-status-date-row">
        <view class="status-badge-blue">{{ classData.statusText }}</view>
        <text class="date-range-text">{{ classData.startDateText }}</text>
      </view>

      <view class="class-name-large">{{ classData.name }}</view>

      <view class="class-type-badges-row">
        <view class="badge-blue-pill">常规班</view>
        <view class="badge-light-blue-pill">小班课</view>
        <view class="badge-ratio-pill">
          学员/班容: {{ classData.currentStudentCount }}/{{ classData.capacity }}
        </view>
      </view>

      <view class="class-meta-grid">
        <view class="meta-item">课程：{{ classData.courseName }}</view>
        <view class="meta-item">教室：{{ classData.classroomName }}</view>
        <view class="meta-item staff-row">
          <text>讲师：{{ classData.teacherName }}</text>
          <text class="advisor-gap">教务：{{ classData.advisorName }}</text>
        </view>
        <view class="meta-item">上课时间：{{ classData.schedulePatternText }}</view>
      </view>

      <!-- 底部指标与结班按钮 -->
      <view class="header-metrics-footer">
        <view class="metric-col">
          <text class="m-val">{{ classData.completedLessons }}</text>
          <text class="m-lbl">结课</text>
        </view>
        <view class="metric-col">
          <text class="m-val">{{ classData.totalLessons }}</text>
          <text class="m-lbl">全部课次</text>
        </view>
        <view class="metric-col">
          <text class="m-val">{{ scheduledCount }}</text>
          <text class="m-lbl">计划排课</text>
        </view>
        <view class="finish-class-btn" @click="handleCompleteClass">
          <text class="check-icon">✓</text>
          <text class="btn-lbl">结班</text>
        </view>
      </view>
    </view>

    <!-- 2. 三大核心 Tab (对齐截图 020/021/022: 排课表 | 签到记录 | 班级学员) -->
    <view class="class-tabs-bar">
      <view
        class="tab-cell"
        :class="{ active: currentTab === 'schedule' }"
        @click="currentTab = 'schedule'"
      >
        <text class="tab-cell-text">排课表 ({{ (classData.schedules || []).length }})</text>
        <view class="tab-underline" v-if="currentTab === 'schedule'"></view>
      </view>
      <view
        class="tab-cell"
        :class="{ active: currentTab === 'attendance' }"
        @click="currentTab = 'attendance'"
      >
        <text class="tab-cell-text">签到记录</text>
        <view class="tab-underline" v-if="currentTab === 'attendance'"></view>
      </view>
      <view
        class="tab-cell"
        :class="{ active: currentTab === 'students' }"
        @click="currentTab = 'students'"
      >
        <text class="tab-cell-text">班级学员 ({{ (classData.students || []).length }})</text>
        <view class="tab-underline" v-if="currentTab === 'students'"></view>
      </view>
    </view>

    <!-- 3. Tab 内容区 -->
    <scroll-view class="tab-scroll-body" scroll-y>
      <!-- ================= Tab 1: 排课表 (对齐截图 020) ================= -->
      <view v-if="currentTab === 'schedule'" class="schedule-tab-panel">
        <view v-if="classData.schedules && classData.schedules.length > 0" class="schedule-cards-list">
          <view
            class="schedule-card-row"
            v-for="item in classData.schedules"
            :key="item.id"
          >
            <view class="sch-badge-time-line">
              <view class="badge-offline">线下课</view>
              <view :class="item.status === 'completed' ? 'badge-completed' : (item.status === 'cancelled' ? 'badge-cancelled' : 'badge-not-yet')">
                {{ item.statusText || (item.status === 'completed' ? '已上' : '未上') }}
              </view>
              <text class="sch-time-text">{{ item.timeRange }}</text>
            </view>

            <view class="sch-class-title">{{ item.title }}</view>

            <view class="sch-stats-line">
              <view class="badge-ratio">实到/应到: {{ item.actualCount }}/{{ item.expectedCount }}</view>
              <view class="badge-deduct">扣{{ item.deductLessons }}课次</view>
            </view>

            <view class="sch-staff-action-row">
              <view class="sch-staff-text">
                <text>老师: {{ item.teacherName }}</text>
                <text class="advisor-gap">教务: {{ item.advisorName }}</text>
              </view>
              <view class="action-btn-pill" @click="handleScheduleAction(item)">操作</view>
            </view>
          </view>
        </view>

        <!-- 空状态：暂无排课 -->
        <view v-else class="empty-schedule-box">
          <view class="empty-icon">📅</view>
          <view class="empty-title">暂无排课记录</view>
          <view class="empty-desc">当前班级尚未排课或尚未生成上课日程</view>
        </view>
      </view>

      <!-- ================= Tab 2: 签到记录 (对齐截图 021) ================= -->
      <view v-else-if="currentTab === 'attendance'" class="attendance-tab-panel">
        <view class="att-summary-card">
          <text class="att-title">签到出勤总况</text>
          <text class="att-desc">当前班级已完成上课 {{ classData.completedLessons }} 次，累计签到履约 {{ totalAttendanceCount }} 人次。</text>
        </view>
      </view>

      <!-- ================= Tab 3: 班级学员 (对齐截图 022) ================= -->
      <view v-else class="students-tab-panel">
        <!-- 搜索与加入学员栏 -->
        <view class="stu-search-bar-row">
          <view class="search-input-box">
            <text class="search-icon">🔍</text>
            <input
              class="search-input"
              type="text"
              v-model="studentKeyword"
              placeholder="输入学员姓名/手机号/学号查询"
              placeholder-class="placeholder-text"
            />
          </view>
          <text class="add-stu-link" @click="handleAddStudentToClass">加入学员</text>
        </view>

        <!-- 已退班过滤复选框 -->
        <view class="filter-retired-row" @click="showRetired = !showRetired">
          <view class="checkbox-box" :class="{ checked: showRetired }">
            <text v-if="showRetired" class="check-mark">✓</text>
          </view>
          <text class="retired-text">已退班</text>
        </view>

        <!-- 学员花名册卡片流 (对齐截图 022) -->
        <view v-if="filteredStudents.length > 0" class="student-cards-flow">
          <view
            class="stu-roster-card"
            v-for="stu in filteredStudents"
            :key="stu.studentId"
          >
            <!-- 头像 -->
            <view class="avatar-circle">
              <text class="avatar-emoji">👦</text>
            </view>

            <!-- 学员主体 -->
            <view class="stu-info-block">
              <view class="name-lessons-line">
                <text class="stu-name">{{ stu.name }}</text>
                <view class="lessons-badge">可用{{ stu.availableLessons }}课次</view>
                <text class="qr-icon">⚏</text>
              </view>
              <view class="stu-meta-line">电话: {{ stu.phone }}  学号: {{ stu.studentNo }}</view>
              <view class="stu-meta-line">加入班级时间: {{ stu.joinDateText }}</view>
            </view>

            <!-- 操作按钮 -->
            <view class="stu-action-btn" @click="handleStudentAction(stu)">操作</view>
          </view>
        </view>

        <!-- 空状态：暂无在读学员 -->
        <view v-else class="empty-schedule-box">
          <view class="empty-icon">👥</view>
          <view class="empty-title">暂无在读学员</view>
          <view class="empty-desc">当前班级暂未分配在读学员</view>
          <view v-if="!isClassCompleted()" class="add-first-stu-btn" @click="handleAddStudentToClass">立即加入学员</view>
        </view>
      </view>

      <view class="bottom-safe-space"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { classCoordinator } from '../../coordinators/class';
import { classApi, ClassDetailModel, ClassScheduleItemModel, ClassStudentItemModel } from '../../api/class';

const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

const classId = ref('');
const currentTab = ref<'schedule' | 'attendance' | 'students'>('schedule');
const studentKeyword = ref('');
const showRetired = ref(false);

const classData = ref<ClassDetailModel>({
  id: '',
  name: '班级详情',
  statusText: '加载中...',
  startDateText: '--',
  courseName: '未指定课程',
  classroomName: '--',
  classType: '常规班',
  capacity: 10,
  currentStudentCount: 0,
  teacherName: '未分配讲师',
  advisorName: '未分配学管',
  schedulePatternText: '--',
  completedLessons: 0,
  totalLessons: 0,
  schedules: [],
  students: [],
});

const isSubmitting = ref(false);

const scheduledCount = computed(() => {
  return (classData.value.schedules || []).filter((s) => s.status === 'scheduled').length;
});

const totalAttendanceCount = computed(() => {
  return (classData.value.schedules || []).reduce((acc, s) => acc + (s.actualCount || 0), 0);
});

const fetchClassDetail = async () => {
  if (!classId.value) return;
  try {
    const data = await classCoordinator.loadClassWorkspace(classId.value);
    if (data) {
      classData.value = data;
    }
  } catch (e) {
    console.warn('[detail.vue] loadClassWorkspace fallback to classApi:', e);
    classData.value = await classApi.getClassDetail(classId.value);
  }
};

onLoad((query: any) => {
  if (query && query.classId) {
    classId.value = query.classId;
  }
  fetchClassDetail();
});

onMounted(() => {
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

  if (!classId.value) {
    const pages = getCurrentPages();
    const curPage = pages[pages.length - 1];
    const query = (curPage as any)?.options || (curPage as any)?.$page?.options || {};
    if (query.classId) {
      classId.value = query.classId;
      fetchClassDetail();
    }
  }
});

const isClassCompleted = () => {
  return (
    classData.value.statusText === '已结班' ||
    classData.value.statusText === '已结课' ||
    classData.value.statusText === '已归档' ||
    (classData.value as any).status === 'completed' ||
    (classData.value as any).status === 'archived'
  );
};

const filteredStudents = computed(() => {
  const list = Array.isArray(classData.value.students) ? classData.value.students : [];
  let result = list;
  if (!showRetired.value) {
    result = result.filter((s: any) => !(s && (s.isRetired || s.status === 'retired' || s.retired)));
  }
  if (!studentKeyword.value.trim()) return result;
  const kw = studentKeyword.value.trim().toLowerCase();
  return result.filter((s) => {
    if (!s) return false;
    const name = String(s.name || '').toLowerCase();
    const phone = String(s.phone || '');
    const no = String(s.studentNo || '').toLowerCase();
    return name.includes(kw) || phone.includes(kw) || no.includes(kw);
  });
});

const handleGoBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: '/package-edu/class/index' });
  }
};

const handleCompleteClass = () => {
  if (isClassCompleted()) {
    uni.showToast({ title: '该班级已结班归档，无需重复结班', icon: 'none' });
    return;
  }
  if (isSubmitting.value) return;

  uni.showModal({
    title: '结班确认',
    content: `确定要将班级【${classData.value.name}】进行结班归档吗？\n（未上课次将安全物理注销，在读课包回退待分班池）`,
    success: async (res) => {
      if (res.confirm) {
        if (isSubmitting.value) return;
        isSubmitting.value = true;
        try {
          uni.showLoading({ title: '正在结班...' });
          const prevStudentIds = (classData.value.students || []).map((s) => s.studentId);
          const receipt = await classCoordinator.completeClass(classData.value.id, {
            disposition: { mode: 'fallback_unassigned' },
            cancelFutureSchedules: true,
            remark: '移动端班级详情页正常结班归档',
            studentIds: prevStudentIds,
          });
          uni.hideLoading();

          // 1. 更新班级状态文本与字段
          classData.value.statusText = '已结班';
          (classData.value as any).status = 'completed';

          // 2. 联动排课日程流转为已取消并同步更新结课指标
          if (classData.value.schedules && classData.value.schedules.length > 0) {
            classCoordinator.syncCancelledSchedules(classData.value.schedules);
          }
          classData.value.completedLessons = (classData.value.schedules || []).filter(
            (s) => s && s.status === 'completed'
          ).length;

          // 3. 在班学员清零并清空花名册
          classData.value.currentStudentCount = 0;
          classData.value.students = [];

          // 4. 弹出包含释放课次数与回退学员数的结班审计提示
          const releasedCount = receipt.cancelledScheduleCount ?? 0;
          const fallbackCount = receipt.disposedStudentCount ?? 0;
          uni.showModal({
            title: '结班完成',
            content: `班级已成功结课归档！\n• 释放未上排课：${releasedCount} 节\n• 回退待分班学员：${fallbackCount} 人\n审计凭据：${receipt.receiptId || receipt.immutableFingerprint || '已归档'}`,
            showCancel: false,
            confirmText: '我知道了',
          });
        } catch (err: any) {
          uni.hideLoading();
          uni.showToast({
            title: err?.message || '结班操作失败，请重试',
            icon: 'none',
          });
        } finally {
          isSubmitting.value = false;
        }
      }
    },
  });
};

const handleScheduleAction = (item: ClassScheduleItemModel) => {
  if (item.status === 'cancelled') {
    uni.showToast({
      title: '该排课日程已取消，无法进行点名考勤',
      icon: 'none',
    });
    return;
  }
  uni.navigateTo({
    url: `/package-edu/lecture/roll-call?scheduleId=${item.id}`,
  });
};

const handleAddStudentToClass = () => {
  if (isClassCompleted()) {
    uni.showToast({ title: '该班级已结班归档，无法加入新学员', icon: 'none' });
    return;
  }
  uni.navigateTo({
    url: `/package-student/list/index?action=select_to_class&classId=${classData.value.id}`,
  });
};

const handleStudentAction = (stu: ClassStudentItemModel) => {
  uni.showActionSheet({
    itemList: ['查看档案', '调整课耗', '移出班级'],
    success: (res) => {
      if (res.tapIndex === 0) {
        uni.navigateTo({
          url: `/package-student/detail/index?studentId=${stu.studentId}&name=${encodeURIComponent(stu.name)}`,
        });
      } else if (res.tapIndex === 1) {
        uni.showToast({
          title: '课耗调整请前往PC端教务中心或学员档案进行操作',
          icon: 'none',
        });
      } else if (res.tapIndex === 2) {
        if (isClassCompleted()) {
          uni.showToast({ title: '该班级已结班，无法移出学员', icon: 'none' });
          return;
        }
        if (isSubmitting.value) {
          uni.showToast({ title: '操作正在处理中，请稍候', icon: 'none' });
          return;
        }
        uni.showModal({
          title: '移出提醒',
          content: `确定将学员【${stu.name}】移出当前班级吗？\n（名额将安全释放，课包回退待分班资产池）`,
          success: async (mRes) => {
            if (mRes.confirm) {
              if (isSubmitting.value) return;
              isSubmitting.value = true;
              try {
                uni.showLoading({ title: '正在移出...' });
                const result = await classCoordinator.removeStudent(classData.value.id, stu.studentId);
                uni.hideLoading();

                // 服务端真实落盘成功后再更新视图与在班计数
                const idx = classData.value.students.findIndex(
                  (s) => s.studentId === stu.studentId || (s as any).id === stu.studentId
                );
                if (idx >= 0) {
                  classData.value.students.splice(idx, 1);
                }
                if (typeof result?.newClassStudentCount === 'number') {
                  classData.value.currentStudentCount = result.newClassStudentCount;
                } else if (classData.value.currentStudentCount > 0) {
                  classData.value.currentStudentCount--;
                }
                uni.showToast({ title: result?.message || '已成功移出班级', icon: 'success' });
              } catch (err: any) {
                uni.hideLoading();
                uni.showToast({
                  title: err?.message || '移出学员失败，请稍后重试',
                  icon: 'none',
                });
              } finally {
                isSubmitting.value = false;
              }
            }
          },
        });
      }
    },
  });
};
</script>

<style scoped>
.class-detail-container {
  min-height: 100vh;
  background-color: #F8F9FD;
  display: flex;
  flex-direction: column;
}

/* 顶部导航 */
.nav-bar {
  background: #FFFFFF;
}

.nav-inner {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
}

.nav-left {
  display: flex;
  align-items: center;
}

.back-arrow {
  font-size: 52rpx;
  color: #1F2937;
  margin-right: 16rpx;
  line-height: 1;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

/* 班级信息头部卡片 */
.class-header-card {
  background: #FFFFFF;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #F3F4F6;
}

.header-status-date-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.status-badge-blue {
  background: #2F6BF4;
  color: #FFFFFF;
  font-size: 20rpx;
  font-weight: 600;
  padding: 2rpx 14rpx;
  border-radius: 6rpx;
}

.date-range-text {
  font-size: 24rpx;
  color: #9CA3AF;
}

.class-name-large {
  font-size: 40rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 16rpx;
}

.class-type-badges-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.badge-blue-pill {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

.badge-light-blue-pill {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

.badge-ratio-pill {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

.class-meta-grid {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  border-bottom: 1rpx solid #F3F4F6;
  padding-bottom: 24rpx;
}

.meta-item {
  font-size: 24rpx;
  color: #6B7280;
}

.staff-row {
  display: flex;
}

.advisor-gap {
  margin-left: 36rpx;
}

.header-metrics-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 24rpx;
}

.metric-col {
  display: flex;
  flex-direction: column;
}

.m-val {
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}

.m-lbl {
  font-size: 22rpx;
  color: #9CA3AF;
  margin-top: 4rpx;
}

.finish-class-btn {
  background: #F97316;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 12rpx 36rpx;
  border-radius: 36rpx;
}

.check-icon {
  font-size: 24rpx;
  font-weight: 700;
}

.btn-lbl {
  font-size: 26rpx;
  font-weight: 600;
}

/* 3 大 Tab 栏 */
.class-tabs-bar {
  display: flex;
  background: #FFFFFF;
  padding: 0 32rpx;
  border-bottom: 1rpx solid #F3F4F6;
}

.tab-cell {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 26rpx 0;
}

.tab-cell-text {
  font-size: 30rpx;
  color: #4B5563;
  font-weight: 500;
}

.tab-cell.active .tab-cell-text {
  color: #2F6BF4;
  font-weight: 700;
}

.tab-underline {
  position: absolute;
  bottom: 0;
  width: 48rpx;
  height: 6rpx;
  background: #2F6BF4;
  border-radius: 4rpx;
}

.tab-scroll-body {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}

/* 排课表卡片 */
.schedule-card-row {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.02);
  margin-bottom: 20rpx;
}

.sch-badge-time-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.badge-offline {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.badge-not-yet {
  background: #FFF7ED;
  color: #EA580C;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.badge-completed {
  background: #ECFDF5;
  color: #059669;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.badge-cancelled {
  background: #F3F4F6;
  color: #9CA3AF;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.sch-time-text {
  font-size: 24rpx;
  color: #9CA3AF;
}

.sch-class-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 12rpx;
}

.sch-stats-line {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.badge-ratio {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.badge-deduct {
  background: #F3F4F6;
  color: #4B5563;
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.sch-staff-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1rpx solid #F8FAFC;
  padding-top: 14rpx;
}

.sch-staff-text {
  font-size: 24rpx;
  color: #6B7280;
}

.action-btn-pill {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 24rpx;
  font-weight: 600;
  padding: 8rpx 28rpx;
  border-radius: 24rpx;
}

/* 签到记录 */
.att-summary-card {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 32rpx;
}

.att-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.att-desc {
  font-size: 26rpx;
  color: #6B7280;
  margin-top: 12rpx;
  line-height: 1.5;
}

/* 班级学员 */
.stu-search-bar-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.search-input-box {
  flex: 1;
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 36rpx;
  padding: 12rpx 24rpx;
}

.search-icon {
  font-size: 26rpx;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 24rpx;
  color: #111827;
}

.placeholder-text {
  font-size: 24rpx;
  color: #9CA3AF;
}

.add-stu-link {
  font-size: 28rpx;
  color: #2F6BF4;
  font-weight: 600;
  white-space: nowrap;
}

.filter-retired-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.checkbox-box {
  width: 30rpx;
  height: 30rpx;
  border: 2rpx solid #D1D5DB;
  border-radius: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-box.checked {
  background: #2F6BF4;
  border-color: #2F6BF4;
}

.check-mark {
  color: #FFFFFF;
  font-size: 18rpx;
}

.retired-text {
  font-size: 24rpx;
  color: #6B7280;
}

.student-cards-flow {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.stu-roster-card {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.02);
}

.avatar-circle {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #FFF1E6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.avatar-emoji {
  font-size: 48rpx;
}

.stu-info-block {
  flex: 1;
}

.name-lessons-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 6rpx;
}

.stu-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.lessons-badge {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.qr-icon {
  margin-left: auto;
  font-size: 32rpx;
  color: #9CA3AF;
  margin-right: 16rpx;
}

.stu-meta-line {
  font-size: 22rpx;
  color: #6B7280;
  margin-top: 4rpx;
}

.stu-action-btn {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 24rpx;
  font-weight: 600;
  padding: 10rpx 28rpx;
  border-radius: 24rpx;
}

.bottom-safe-space {
  height: 100rpx;
}

.empty-schedule-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 40rpx;
}

.empty-icon {
  font-size: 72rpx;
  margin-bottom: 20rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8rpx;
}

.empty-desc {
  font-size: 24rpx;
  color: #9CA3AF;
  margin-bottom: 28rpx;
}

.add-first-stu-btn {
  background: #2563EB;
  color: #FFFFFF;
  font-size: 26rpx;
  font-weight: 600;
  padding: 16rpx 48rpx;
  border-radius: 36rpx;
}
</style>
