<template>
  <view class="lecture-page-container">
    <!-- 顶部自定义导航栏 (对齐截图 012/013: < 讲台 | 总部校区 ▼) -->
    <view class="custom-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-inner">
        <view class="left-nav" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="page-title">讲台</text>
          <view class="campus-selector" @click.stop="handleSwitchCampus">
            <text class="campus-name">{{ campusStore.currentCampusName }}</text>
            <text class="arrow">▼</text>
          </view>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 顶部周日历导航条 (对齐截图 012/013) -->
    <view class="calendar-strip-card">
      <view class="week-days-row">
        <view
          class="day-col"
          v-for="(day, idx) in weekDays"
          :key="idx"
          :class="{ selected: selectedDate === day.fullDate }"
          @click="selectDay(day.fullDate)"
        >
          <text class="week-name">{{ day.name }}</text>
          <view class="day-number-badge" :class="{ is_today: day.isToday }">
            <text class="day-val">{{ day.isToday ? '今' : day.dateNum }}</text>
          </view>
          <view class="course-dot" v-if="day.hasCourse"></view>
          <text class="expand-arrow" v-if="selectedDate === day.fullDate">⏬</text>
        </view>
      </view>
    </view>

    <!-- 状态筛选胶囊条 (对齐截图 012/013: 未上 | 已上 | 结课 | 筛选) -->
    <view class="filter-pills-bar">
      <view class="pills-group">
        <view
          class="pill-item"
          v-for="status in statusList"
          :key="status.key"
          :class="{ active: currentStatus === status.key }"
          @click="currentStatus = status.key"
        >
          {{ status.label }}
        </view>
      </view>
      <view class="filter-btn" @click="handleFilterDrawer">
        <text class="filter-icon">Y</text>
        <text class="filter-text">筛选</text>
      </view>
    </view>

    <!-- 课次列表区域 -->
    <scroll-view class="schedule-scroll-list" scroll-y>
      <!-- 有课次卡片 (对齐截图 013: 课程记录) -->
      <view v-if="filteredSchedules.length > 0" class="cards-wrapper">
        <view
          class="schedule-card"
          v-for="item in filteredSchedules"
          :key="item.id"
          @click="handleCardClick(item)"
        >
          <!-- 标签与时段 -->
          <view class="card-meta-row">
            <view class="tags-box">
              <view class="badge-tag badge-offline">线下课</view>
              <view class="badge-tag" :class="item.status === 'completed' ? 'badge-completed' : 'badge-pending'">
                {{ item.status === 'completed' ? '已上' : '未上' }}
              </view>
            </view>
            <text class="time-range-text">{{ item.timeRange }}</text>
          </view>

          <!-- 课程/班次大标题 -->
          <view class="class-title-text">{{ item.className }}</view>

          <!-- 班级类型与出勤人数 -->
          <view class="attendance-stat-row">
            <view class="class-attr-pill">正常班</view>
            <view class="stat-counts">
              实到 <text class="bold-num">{{ item.actualCount }}</text>/ 应到 <text class="bold-num">{{ item.expectedCount }}</text>
            </view>
          </view>

          <!-- 班级与教职人员信息 -->
          <view class="info-details-box">
            <view class="info-line">班级：{{ item.classroomName }}</view>
            <view class="info-line staff-line">
              <text>讲师：{{ item.teacherName }}</text>
              <text class="advisor-gap">教务：{{ item.advisorName || item.teacherName }}</text>
            </view>
          </view>

          <!-- 底部双操作按钮 (对齐截图 013: [结课] 与 [操作]) -->
          <view class="card-actions-row" @click.stop>
            <view class="action-pill-btn btn-finish" @click="handleFinishClass(item)">结课</view>
            <view class="action-pill-btn btn-more" @click="openActionMenu(item)">操作</view>
          </view>
        </view>
      </view>

      <!-- 空状态 (对齐截图 012: 暂无数据) -->
      <view v-else class="empty-state-card">
        <view class="empty-emoji-box">
          <text class="empty-emoji">🥺</text>
        </view>
        <text class="empty-label">暂无数据</text>
      </view>
    </scroll-view>

    <!-- 1. 底部弹出操作菜单 (对齐截图 014: 备课 / 签到课评 / 取消) -->
    <view class="modal-mask" v-if="showActionSheet" @click="showActionSheet = false">
      <view class="action-sheet-panel" @click.stop>
        <view class="sheet-item" @click="handleActionItem('prep')">备课</view>
        <view class="sheet-divider"></view>
        <view class="sheet-item" @click="handleActionItem('rollcall')">签到/课评</view>
        <view class="sheet-gap"></view>
        <view class="sheet-item cancel-item" @click="showActionSheet = false">取消</view>
      </view>
    </view>

    <!-- 2. 课程资源 / 备课弹窗 (对齐截图 015: 课程资源 PPT-HTML) -->
    <view class="modal-mask" v-if="showResourceModal" @click="showResourceModal = false">
      <view class="resource-modal-card" @click.stop>
        <view class="resource-modal-header">
          <text class="modal-title">课程资源</text>
          <text class="close-x" @click="showResourceModal = false">✕</text>
        </view>
        <view class="resource-modal-body">
          <text class="resource-section-label">PPT-HTML</text>
          <view class="resource-empty-box">
            <text class="sad-icon">🥺</text>
            <text class="empty-text">暂无PPT-HTML</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCampusStore } from '../../stores/campusStore';
import { eduApi, ScheduleEventModel } from '../../api/edu';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

// 状态筛选
const statusList = [
  { key: 'all', label: '未上' },
  { key: 'completed', label: '已上' },
  { key: 'settled', label: '结课' },
];
const currentStatus = ref('completed');

// 选中的排课课次与弹窗状态
const selectedSchedule = ref<ScheduleEventModel | null>(null);
const showActionSheet = ref(false);
const showResourceModal = ref(false);

// 日历 7 天排布 (对齐截图 012/013: 11~17号, 13号选中, 15号为今日)
const weekDays = ref([
  { name: '日', dateNum: '11', fullDate: '2026-10-11', isToday: false, hasCourse: true },
  { name: '一', dateNum: '12', fullDate: '2026-10-12', isToday: false, hasCourse: false },
  { name: '二', dateNum: '13', fullDate: '2026-10-13', isToday: false, hasCourse: true },
  { name: '三', dateNum: '14', fullDate: '2026-10-14', isToday: false, hasCourse: true },
  { name: '四', dateNum: '15', fullDate: '2026-10-15', isToday: true, hasCourse: false },
  { name: '五', dateNum: '16', fullDate: '2026-10-16', isToday: false, hasCourse: false },
  { name: '六', dateNum: '17', fullDate: '2026-10-17', isToday: false, hasCourse: true },
]);
const selectedDate = ref('2026-10-13');

// 排课数据列表
const scheduleList = ref<ScheduleEventModel[]>([]);

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

  await fetchDaySchedules(selectedDate.value);
});

const fetchDaySchedules = async (dateStr: string) => {
  const list = await eduApi.getSchedules({ date: dateStr });
  scheduleList.value = Array.isArray(list) ? list : [];
};

const selectDay = (dateStr: string) => {
  selectedDate.value = dateStr;
  fetchDaySchedules(dateStr);
};

const filteredSchedules = computed(() => {
  if (currentStatus.value === 'completed') {
    return scheduleList.value.filter((s) => s.status === 'completed');
  }
  if (currentStatus.value === 'all') {
    return scheduleList.value.filter((s) => s.status !== 'completed');
  }
  return scheduleList.value;
});

const handleGoBack = () => {
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({ url: '/pages/workbench/index' });
    },
  });
};

const handleSwitchCampus = () => {
  uni.showActionSheet({
    itemList: campusStore.campuses.length > 0 ? campusStore.campuses.map((c) => c.name) : ['总部校区', '远洋校区'],
    success: (res) => {
      if (campusStore.campuses[res.tapIndex]) {
        campusStore.setCampus(campusStore.campuses[res.tapIndex]);
      } else {
        campusStore.currentCampusName = ['总部校区', '远洋校区'][res.tapIndex];
      }
    },
  });
};

const handleFilterDrawer = () => {
  uni.showToast({ title: '已应用全部课程筛选', icon: 'none' });
};

const handleCardClick = (item: ScheduleEventModel) => {
  uni.navigateTo({
    url: `/package-edu/lecture/roll-call?scheduleId=${item.id}&classId=${item.classId}`,
  });
};

const handleFinishClass = async (item: ScheduleEventModel) => {
  uni.showModal({
    title: '确认一键结课',
    content: `即将对「${item.className}」执行全勤消课与自动课评持久化，确定结课？`,
    confirmColor: '#2F54EB',
    success: async (res) => {
      if (res.confirm) {
        try {
          uni.showLoading({ title: '正在履约消课...' });
          await eduApi.fulfillLesson({ scheduleEventId: item.id });
          uni.hideLoading();
          uni.showToast({ title: '结课履约成功', icon: 'success' });
          item.status = 'completed';
        } catch (e: any) {
          uni.hideLoading();
          uni.showToast({ title: e?.message || '结课失败，请重试', icon: 'none' });
        }
      }
    },
  });
};

const openActionMenu = (item: ScheduleEventModel) => {
  selectedSchedule.value = item;
  showActionSheet.value = true;
};

const handleActionItem = (action: 'prep' | 'rollcall') => {
  showActionSheet.value = false;
  if (action === 'prep') {
    showResourceModal.value = true;
  } else if (action === 'rollcall') {
    uni.navigateTo({
      url: `/package-edu/lecture/roll-call?scheduleId=${selectedSchedule.value?.id}`,
    });
  }
};
</script>

<style lang="scss" scoped>
.lecture-page-container {
  min-height: 100vh;
  background-color: #F8FAFC;
  display: flex;
  flex-direction: column;
}

/* 自定义顶部导航 (对齐截图 012/013) */
.custom-header {
  background: linear-gradient(180deg, #E6EFFF 0%, #F8FAFC 100%);
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;

  .header-inner {
    height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24rpx;

    .left-nav {
      display: flex;
      align-items: center;
      gap: 12rpx;

      .back-arrow {
        font-size: 52rpx;
        color: #1F2937;
        font-weight: 300;
        margin-right: 4rpx;
      }

      .page-title {
        font-size: 36rpx;
        font-weight: 700;
        color: #111827;
      }

      .campus-selector {
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.7);
        padding: 4rpx 14rpx;
        border-radius: 24rpx;
        margin-left: 8rpx;

        .campus-name {
          font-size: 24rpx;
          color: #374151;
          font-weight: 500;
        }

        .arrow {
          font-size: 16rpx;
          color: #6B7280;
          margin-left: 6rpx;
        }
      }
    }
  }
}

/* 顶部横向滚动周日历 (对齐截图 012/013) */
.calendar-strip-card {
  background: #FFFFFF;
  padding: 16rpx 20rpx 12rpx;
  border-bottom: 1rpx solid #F3F4F6;

  .week-days-row {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .day-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 72rpx;
      position: relative;

      .week-name {
        font-size: 22rpx;
        color: #9CA3AF;
        margin-bottom: 8rpx;
      }

      .day-number-badge {
        width: 60rpx;
        height: 60rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;

        .day-val {
          font-size: 28rpx;
          color: #111827;
          font-weight: 600;
        }

        &.is_today {
          background-color: #2F54EB;
          .day-val {
            color: #FFFFFF;
            font-size: 24rpx;
          }
        }
      }

      .course-dot {
        width: 8rpx;
        height: 8rpx;
        border-radius: 50%;
        background-color: #2F54EB;
        margin-top: 4rpx;
      }

      .expand-arrow {
        font-size: 18rpx;
        margin-top: 2rpx;
        transform: scale(0.8);
      }

      &.selected {
        .day-number-badge:not(.is_today) {
          background-color: #3B5998;
          .day-val {
            color: #FFFFFF;
          }
        }
      }
    }
  }
}

/* 状态切换胶囊条 (对齐截图 012/013: 未上 | 已上 | 结课 | 筛选) */
.filter-pills-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;

  .pills-group {
    display: flex;
    align-items: center;
    gap: 16rpx;

    .pill-item {
      padding: 10rpx 28rpx;
      border-radius: 12rpx;
      font-size: 26rpx;
      color: #4B5563;
      background: #FFFFFF;
      font-weight: 500;

      &.active {
        background: #FFFFFF;
        color: #111827;
        font-weight: 700;
        box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
      }
    }
  }

  .filter-btn {
    display: flex;
    align-items: center;
    gap: 6rpx;
    padding-left: 20rpx;
    border-left: 1rpx solid #E5E7EB;

    .filter-icon {
      font-size: 22rpx;
      color: #6B7280;
    }

    .filter-text {
      font-size: 24rpx;
      color: #6B7280;
    }
  }
}

/* 课次列表与卡片 (对齐截图 013) */
.schedule-scroll-list {
  flex: 1;
  padding: 0 24rpx 40rpx;
  box-sizing: border-box;

  .cards-wrapper {
    display: flex;
    flex-direction: column;
    gap: 20rpx;
  }

  .schedule-card {
    background: #FFFFFF;
    border-radius: 24rpx;
    padding: 24rpx 28rpx;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.02);

    .card-meta-row {
      display: flex;
      align-items: center;
      gap: 12rpx;
      margin-bottom: 12rpx;

      .tags-box {
        display: flex;
        gap: 8rpx;

        .badge-tag {
          font-size: 20rpx;
          padding: 4rpx 12rpx;
          border-radius: 8rpx;
          font-weight: 600;

          &.badge-offline {
            background: #E0E7FF;
            color: #3730A3;
          }

          &.badge-completed {
            background: #DCFCE7;
            color: #15803D;
          }

          &.badge-pending {
            background: #FEF3C7;
            color: #B45309;
          }
        }
      }

      .time-range-text {
        font-size: 24rpx;
        color: #6B7280;
      }
    }

    .class-title-text {
      font-size: 32rpx;
      font-weight: 700;
      color: #111827;
      margin-bottom: 14rpx;
    }

    .attendance-stat-row {
      display: flex;
      align-items: center;
      gap: 16rpx;
      margin-bottom: 16rpx;

      .class-attr-pill {
        background: #2563EB;
        color: #FFFFFF;
        font-size: 20rpx;
        font-weight: 600;
        padding: 4rpx 12rpx;
        border-radius: 8rpx;
      }

      .stat-counts {
        font-size: 24rpx;
        color: #4B5563;

        .bold-num {
          font-weight: 700;
          color: #111827;
        }
      }
    }

    .info-details-box {
      border-top: 1rpx solid #F3F4F6;
      padding-top: 14rpx;
      margin-bottom: 16rpx;

      .info-line {
        font-size: 24rpx;
        color: #6B7280;
        line-height: 1.6;

        &.staff-line {
          display: flex;
          align-items: center;

          .advisor-gap {
            margin-left: 36rpx;
          }
        }
      }
    }

    .card-actions-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 16rpx;

      .action-pill-btn {
        padding: 10rpx 36rpx;
        border-radius: 32rpx;
        font-size: 26rpx;
        font-weight: 600;

        &.btn-finish {
          background: #FFF1E8;
          color: #E65A1A;
        }

        &.btn-more {
          background: #E8F0FE;
          color: #1D4ED8;
        }
      }
    }
  }

  .empty-state-card {
    background: #FFFFFF;
    border-radius: 24rpx;
    padding: 140rpx 40rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.02);
    margin-top: 20rpx;

    .empty-emoji-box {
      font-size: 72rpx;
      margin-bottom: 16rpx;
    }

    .empty-label {
      font-size: 28rpx;
      color: #9CA3AF;
    }
  }
}

/* 底部弹出操作菜单 (对齐截图 014) */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;

  .action-sheet-panel {
    width: 100%;
    background: #FFFFFF;
    border-top-left-radius: 28rpx;
    border-top-right-radius: 28rpx;
    overflow: hidden;
    padding-bottom: constant(safe-area-inset-bottom);
    padding-bottom: env(safe-area-inset-bottom);

    .sheet-item {
      height: 104rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32rpx;
      font-weight: 500;
      color: #1F2937;

      &.cancel-item {
        color: #4B5563;
      }
    }

    .sheet-divider {
      height: 1rpx;
      background: #F3F4F6;
      width: 100%;
    }

    .sheet-gap {
      height: 14rpx;
      background: #F4F6F9;
      width: 100%;
    }
  }

  /* 课程资源模态框 (对齐截图 015) */
  .resource-modal-card {
    width: 90%;
    background: #FFFFFF;
    border-radius: 28rpx;
    margin-bottom: 40rpx;
    padding: 32rpx;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);

    .resource-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24rpx;

      .modal-title {
        font-size: 32rpx;
        font-weight: 700;
        color: #111827;
      }

      .close-x {
        font-size: 34rpx;
        color: #9CA3AF;
        padding: 8rpx;
      }
    }

    .resource-modal-body {
      .resource-section-label {
        font-size: 26rpx;
        font-weight: 600;
        color: #374151;
        margin-bottom: 16rpx;
        display: block;
      }

      .resource-empty-box {
        background: #F9FAFB;
        border-radius: 16rpx;
        padding: 80rpx 40rpx;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12rpx;

        .sad-icon {
          font-size: 60rpx;
        }

        .empty-text {
          font-size: 26rpx;
          color: #9CA3AF;
        }
      }
    }
  }
}
</style>
