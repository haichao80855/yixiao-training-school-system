<template>
  <view class="eval-manage-container">
    <!-- 顶部状态栏与自定义导航 (对齐截图 055: < 课评管理 | 总部校区 ▼) -->
    <view class="custom-nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-inner">
        <view class="left-nav" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="page-title">课评管理</text>
          <view class="campus-selector" @click.stop="handleSwitchCampus">
            <text class="campus-name">{{ campusStore.currentCampusName }}</text>
            <text class="arrow">▼</text>
          </view>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 概览流式指标看板 -->
    <view class="metrics-overview-bar">
      <view class="metric-pill" :class="{ active: currentStatusFilter === 'all' }" @click="setStatusFilter('all')">
        <text class="metric-num">{{ metrics.totalCount }}</text>
        <text class="metric-label">学员总人次</text>
      </view>
      <view class="metric-pill warn" :class="{ active: currentStatusFilter === 'pending' }" @click="setStatusFilter('pending')">
        <text class="metric-num">{{ metrics.pendingCount }}</text>
        <text class="metric-label">待评学员</text>
      </view>
      <view class="metric-pill success" :class="{ active: currentStatusFilter === 'pushed' }" @click="setStatusFilter('pushed')">
        <text class="metric-num">{{ metrics.pushedCount }}</text>
        <text class="metric-label">已评推送</text>
      </view>
      <view class="metric-pill info">
        <text class="metric-num">{{ metrics.coverageRateText }}</text>
        <text class="metric-label">评价覆盖率</text>
      </view>
    </view>

    <!-- 2. 搜索栏 (对齐截图 055: Q 输入学员姓名/手机号查询) -->
    <view class="search-bar-wrap">
      <view class="search-box">
        <AppIcon name="search" size="32rpx" color="#94A3B8" />
        <input
          class="search-input"
          type="text"
          v-model="searchKeyword"
          placeholder="输入学员姓名/手机号/学号/班级查询"
          placeholder-class="placeholder-text"
          @input="handleKeywordChange"
        />
        <view v-if="searchKeyword" class="clear-btn" @click="clearKeyword">
          <AppIcon name="x" size="28rpx" color="#94A3B8" />
        </view>
      </view>
    </view>

    <!-- 3. 日期区间与状态筛选栏 (对齐截图 055: 上课时间 ▼  2026-10-12 至 2026-10-18 ▼ | 筛选) -->
    <view class="date-filter-bar">
      <view class="filter-left-group">
        <view class="dropdown-item">
          <text class="item-text">上课时间</text>
          <AppIcon name="chevron-down" size="24rpx" color="#64748B" />
        </view>
        <view class="dropdown-item date-range-picker" @click="handleSelectDateRange">
          <text class="range-text">{{ dateRangeText }}</text>
          <AppIcon name="chevron-down" size="24rpx" color="#64748B" />
        </view>
      </view>
      <view class="filter-right-btn" @click="handleOpenFilter">
        <text class="filter-icon">Y</text>
        <text class="filter-label">{{ statusFilterLabel }}</text>
      </view>
    </view>

    <!-- 4. 学员课评卡片流 (对齐截图 055) -->
    <scroll-view class="cards-scroll-body" scroll-y refresher-enabled :refresher-triggered="isRefreshing" @refresherrefresh="onPullDownRefresh">
      <view v-if="isLoading && rosterItems.length === 0" class="loading-state">
        <text class="loading-tip">正在投影花名册全景...</text>
      </view>

      <view v-else-if="rosterItems.length === 0" class="empty-state">
        <AppIcon name="inbox" size="72rpx" color="#CBD5E1" />
        <text class="empty-text">当前时段暂无待评学员记录</text>
      </view>

      <view v-else class="evaluation-student-card" v-for="item in rosterItems" :key="`${item.scheduleId}-${item.id}`">
        <!-- 卡片主体信息 -->
        <view class="card-left-info">
          <!-- 头像与主信息行 -->
          <view class="student-main-row">
            <view class="student-avatar-circle">
              <AppIcon name="user" size="40rpx" color="#2F54EB" />
            </view>
            <view class="name-status-block">
              <view class="name-status-row">
                <view class="name-badge-wrap">
                  <text class="student-name">{{ item.name }}</text>
                  <text v-if="item.isLowBalance" class="low-balance-badge">余{{ item.remainingLessons ?? 0 }}课时</text>
                </view>
                <text class="push-status-tag" :class="{ pushed: item.isPushed }">
                  {{ item.pushStatusText }}
                </text>
              </view>
              <!-- 签到与时段标签 -->
              <view class="attendance-time-line">
                <view class="badge-pill badge-offline">{{ item.courseTypeLabel || '线下课' }}</view>
                <view class="badge-pill badge-signed">已签到</view>
                <text class="sign-time-text">签到时间：{{ item.signTime }}</text>
              </view>
            </view>
          </view>

          <!-- 电话与学号 -->
          <view class="meta-row">
            <text class="meta-text">电话：{{ item.phone }}</text>
            <text class="meta-text stu-no-gap">学号：{{ item.studentNo }}</text>
          </view>

          <!-- 班级 -->
          <view class="meta-row">
            <text class="meta-text">班级：{{ item.className }}</text>
          </view>
        </view>

        <!-- 右侧写课评/看学情按钮 (终结死循环跳转) -->
        <view class="card-right-action">
          <view
            class="write-eval-pill-btn"
            :class="{ pushed: item.isPushed }"
            @click="handleEvaluationAction(item)"
          >
            {{ item.isPushed ? '看学情' : '写课评' }}
          </view>
        </view>
      </view>

      <view class="safe-padding-bottom"></view>
    </scroll-view>

    <!-- 学情成长投影抽屉 (彻底终结移动端死循环跳转) -->
    <LessonGrowthReviewDrawer
      :visible="growthDrawerVisible"
      :schedule-id="activeGrowthScheduleId"
      :student-id="activeGrowthStudentId"
      :student-name="activeGrowthStudentName"
      @close="growthDrawerVisible = false"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useCampusStore } from '../../stores/campusStore';
import { evaluationRosterProjector, type EvaluationRosterItemView, type EvaluationMetricsSummary, type EvaluationRosterView } from '../../projectors/evaluation-roster';
import AppIcon from '../../components/AppIcon.vue';
import LessonGrowthReviewDrawer from '../../components/LessonGrowthReviewDrawer.vue';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

// 多媒体学情成长抽屉状态
const growthDrawerVisible = ref(false);
const activeGrowthScheduleId = ref('');
const activeGrowthStudentId = ref('');
const activeGrowthStudentName = ref('');

const searchKeyword = ref('');
const dateRangeText = ref('2026-10-12 至 2026-10-18');
const currentStatusFilter = ref<'all' | 'pending' | 'pushed'>('all');
const isRefreshing = ref(false);
const isLoading = ref(false);

const rosterItems = ref<EvaluationRosterItemView[]>([]);
const metrics = ref<EvaluationMetricsSummary>({
  pendingCount: 0,
  pushedCount: 0,
  totalCount: 0,
  coverageRate: 0,
  coverageRateText: '0%',
});

const statusFilterLabel = computed(() => {
  if (currentStatusFilter.value === 'pending') return '仅待评';
  if (currentStatusFilter.value === 'pushed') return '仅已评';
  return '全部状态';
});

const handleEvaluationUpdated = (_payload?: { studentId?: string }) => {
  loadRoster(true);
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

  uni.$on('studentEvaluationUpdated', handleEvaluationUpdated);

  await loadRoster(false);
});

onUnmounted(() => {
  uni.$off('studentEvaluationUpdated', handleEvaluationUpdated);
});

// 监听校区上下文响应式切换，自动重载当前校区花名册
watch(
  () => campusStore.currentCampusId,
  async (newCampusId, oldCampusId) => {
    if (newCampusId && newCampusId !== oldCampusId) {
      await loadRoster(true);
    }
  }
);

/**
 * 核心调度：调用端侧待评花名册投影深模块
 */
const loadRoster = async (forceRefresh: boolean = false) => {
  isLoading.value = true;
  try {
    const campusId = campusStore.currentCampusId || 'campus-bj-hq';
    const view = await evaluationRosterProjector.projectRoster(
      {
        campusId,
        dateRange: dateRangeText.value,
        keyword: searchKeyword.value,
        statusFilter: currentStatusFilter.value,
        forceRefresh,
      },
      (freshView: EvaluationRosterView) => {
        // SWR 静默再校验更新回调
        applyView(freshView);
      }
    );

    applyView(view);
  } catch (err) {
    console.error('[manage.vue] 投影花名册失败:', err);
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
  }
};

const applyView = (view: EvaluationRosterView) => {
  rosterItems.value = [...view.items];
  metrics.value = { ...view.metrics };
};

const handleKeywordChange = () => {
  loadRoster(false);
};

const clearKeyword = () => {
  searchKeyword.value = '';
  loadRoster(false);
};

const setStatusFilter = (status: 'all' | 'pending' | 'pushed') => {
  if (currentStatusFilter.value === status) return;
  currentStatusFilter.value = status;
  loadRoster(false);
};

const onPullDownRefresh = async () => {
  isRefreshing.value = true;
  await loadRoster(true);
};

const handleGoBack = () => {
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({ url: '/pages/workbench/index' });
    },
  });
};

const handleSwitchCampus = () => {
  const list = campusStore.campuses.length > 0 ? campusStore.campuses.map((c) => c.name) : ['拓视未来-原阳校区'];
  uni.showActionSheet({
    itemList: list,
    success: (res) => {
      if (campusStore.campuses[res.tapIndex]) {
        campusStore.setCampus(campusStore.campuses[res.tapIndex]);
      } else {
        campusStore.currentCampusName = list[res.tapIndex];
      }
    },
  });
};

const handleSelectDateRange = () => {
  uni.showActionSheet({
    itemList: ['本周 (2026-10-12 至 2026-10-18)', '上周 (2026-10-05 至 2026-10-11)', '近 30 天'],
    success: (res) => {
      dateRangeText.value = ['2026-10-12 至 2026-10-18', '2026-10-05 至 2026-10-11', '近 30 天'][res.tapIndex];
      loadRoster(false);
    },
  });
};

const handleOpenFilter = () => {
  uni.showActionSheet({
    itemList: ['全部状态', '仅待评学员', '仅已推送学员'],
    success: (res) => {
      const filters: Array<'all' | 'pending' | 'pushed'> = ['all', 'pending', 'pushed'];
      currentStatusFilter.value = filters[res.tapIndex];
      loadRoster(false);
    },
  });
};

const handleEvaluationAction = (item: EvaluationRosterItemView) => {
  if (item.isPushed) {
    // 已推送：原地拉起学情成长全景抽屉，展示雷达图、教师寄语、相册与音视频
    activeGrowthScheduleId.value = item.scheduleId || 'sch-qmyy-12';
    activeGrowthStudentId.value = item.id;
    activeGrowthStudentName.value = item.name;
    growthDrawerVisible.value = true;
  } else {
    // 待推送/未评：进入单人课评录入界面
    const scheduleParam = item.scheduleId ? `&scheduleId=${encodeURIComponent(item.scheduleId)}` : '';
    uni.navigateTo({
      url: `/package-edu/evaluation/edit?studentId=${item.id}&studentName=${encodeURIComponent(item.name)}&className=${encodeURIComponent(item.className)}${scheduleParam}`,
    });
  }
};
</script>

<style lang="scss" scoped>
.eval-manage-container {
  min-height: 100vh;
  background-color: #F8FAFC;
  display: flex;
  flex-direction: column;
}

.custom-nav-header {
  background: linear-gradient(180deg, #E6EFFF 0%, #F8FAFC 100%);
  position: sticky;
  top: 0;
  z-index: 100;

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
      }

      .page-title {
        font-size: 34rpx;
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

/* 概览流式指标看板 */
.metrics-overview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx 8rpx;
  gap: 12rpx;

  .metric-pill {
    flex: 1;
    background: #FFFFFF;
    border-radius: 16rpx;
    padding: 12rpx 10rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.02);
    border: 1rpx solid #E2E8F0;
    transition: all 0.2s ease;

    &.active {
      border-color: #2563EB;
      background: #EFF6FF;
    }

    .metric-num {
      font-size: 28rpx;
      font-weight: 700;
      color: #1E293B;
    }

    .metric-label {
      font-size: 20rpx;
      color: #64748B;
      margin-top: 2rpx;
    }

    &.warn .metric-num {
      color: #D97706;
    }

    &.success .metric-num {
      color: #16A34A;
    }

    &.info .metric-num {
      color: #2563EB;
    }
  }
}

/* 2. 搜索框 (对齐截图 055) */
.search-bar-wrap {
  padding: 8rpx 24rpx 12rpx;

  .search-box {
    height: 76rpx;
    background: #FFFFFF;
    border-radius: 38rpx;
    display: flex;
    align-items: center;
    padding: 0 24rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.02);

    .search-input {
      flex: 1;
      height: 100%;
      font-size: 26rpx;
      color: #1F2937;
      margin-left: 12rpx;
    }

    .placeholder-text {
      color: #9CA3AF;
      font-size: 24rpx;
    }

    .clear-btn {
      font-size: 24rpx;
      color: #9CA3AF;
      padding: 8rpx;
    }
  }
}

/* 3. 日期区间与筛选 (对齐截图 055) */
.date-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 24rpx 16rpx;

  .filter-left-group {
    display: flex;
    align-items: center;
    gap: 16rpx;

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 6rpx;

      .item-text {
        font-size: 26rpx;
        color: #2563EB;
        font-weight: 500;
      }

      .range-text {
        font-size: 26rpx;
        color: #2563EB;
        font-weight: 500;
      }
    }
  }

  .filter-right-btn {
    display: flex;
    align-items: center;
    gap: 6rpx;
    padding-left: 20rpx;
    border-left: 1rpx solid #E5E7EB;

    .filter-icon {
      font-size: 22rpx;
      color: #6B7280;
    }

    .filter-label {
      font-size: 24rpx;
      color: #6B7280;
    }
  }
}

/* 4. 学员课评卡片列表 (对齐截图 055) */
.cards-scroll-body {
  flex: 1;
  padding: 0 24rpx;
  box-sizing: border-box;

  .loading-state,
  .empty-state {
    padding: 80rpx 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16rpx;

    .loading-tip,
    .empty-text {
      font-size: 26rpx;
      color: #94A3B8;
    }
  }

  .evaluation-student-card {
    background: #FFFFFF;
    border-radius: 24rpx;
    padding: 24rpx 28rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.02);

    .card-left-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8rpx;

      .student-main-row {
        display: flex;
        align-items: center;
        gap: 18rpx;
        margin-bottom: 8rpx;

        .student-avatar-circle {
          width: 88rpx;
          height: 88rpx;
          border-radius: 50%;
          background: #FEE2E2;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .name-status-block {
          flex: 1;

          .name-status-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8rpx;

            .name-badge-wrap {
              display: flex;
              align-items: center;
              gap: 12rpx;

              .student-name {
                font-size: 32rpx;
                font-weight: 700;
                color: #111827;
              }

              .low-balance-badge {
                font-size: 18rpx;
                color: #DC2626;
                background: #FEE2E2;
                padding: 2rpx 8rpx;
                border-radius: 6rpx;
                font-weight: 600;
              }
            }

            .push-status-tag {
              font-size: 22rpx;
              color: #2563EB;
              font-weight: 500;

              &.pushed {
                color: #10B981;
              }
            }
          }

          .attendance-time-line {
            display: flex;
            align-items: center;
            gap: 10rpx;

            .badge-pill {
              font-size: 18rpx;
              padding: 2rpx 10rpx;
              border-radius: 6rpx;
              font-weight: 600;

              &.badge-offline {
                background: #E0E7FF;
                color: #3730A3;
              }

              &.badge-signed {
                background: #DCFCE7;
                color: #15803D;
              }
            }

            .sign-time-text {
              font-size: 20rpx;
              color: #6B7280;
            }
          }
        }
      }

      .meta-row {
        display: flex;
        align-items: center;

        .meta-text {
          font-size: 24rpx;
          color: #6B7280;
        }

        .stu-no-gap {
          margin-left: 28rpx;
        }
      }
    }

    .card-right-action {
      margin-left: 20rpx;

      .write-eval-pill-btn {
        width: 144rpx;
        height: 60rpx;
        background: #EEF2FF;
        color: #2F54EB;
        font-size: 24rpx;
        font-weight: 600;
        border-radius: 9999rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border: 1rpx solid rgba(47, 84, 235, 0.15);
        transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
        will-change: transform;

        &:active {
          transform: scale(0.92);
        }

        &.pushed {
          background: #ECFDF5;
          color: #059669;
          border-color: rgba(5, 150, 105, 0.25);
        }
      }
    }
  }

  .safe-padding-bottom {
    height: calc(60rpx + constant(safe-area-inset-bottom));
    height: calc(60rpx + env(safe-area-inset-bottom));
  }
}
</style>
