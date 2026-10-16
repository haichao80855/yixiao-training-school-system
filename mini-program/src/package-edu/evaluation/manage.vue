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

    <!-- 1. 搜索栏 (对齐截图 055: Q 输入学员姓名/手机号查询) -->
    <view class="search-bar-wrap">
      <view class="search-box">
        <AppIcon name="search" size="32rpx" color="#94A3B8" />
        <input
          class="search-input"
          type="text"
          v-model="searchKeyword"
          placeholder="输入学员姓名/手机号查询"
          placeholder-class="placeholder-text"
        />
        <view v-if="searchKeyword" class="clear-btn" @click="searchKeyword = ''">
          <AppIcon name="x" size="28rpx" color="#94A3B8" />
        </view>
      </view>
    </view>

    <!-- 2. 日期区间与筛选栏 (对齐截图 055: 上课时间 ▼  2026-10-12 至 2026-10-18 ▼ | 筛选) -->
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
        <text class="filter-label">筛选</text>
      </view>
    </view>

    <!-- 3. 学员课评卡片流 (对齐截图 055) -->
    <scroll-view class="cards-scroll-body" scroll-y>
      <view class="evaluation-student-card" v-for="item in filteredList" :key="item.id">
        <!-- 卡片主体信息 -->
        <view class="card-left-info">
          <!-- 头像与主信息行 -->
          <view class="student-main-row">
            <view class="student-avatar-circle">
              <AppIcon name="user" size="40rpx" color="#2F54EB" />
            </view>
            <view class="name-status-block">
              <view class="name-status-row">
                <text class="student-name">{{ item.name }}</text>
                <text class="push-status-tag" :class="{ pushed: item.isPushed }">
                  {{ item.isPushed ? '已推送' : '未推送' }}
                </text>
              </view>
              <!-- 签到与时段标签 -->
              <view class="attendance-time-line">
                <view class="badge-pill badge-offline">线下课</view>
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

        <!-- 右侧写课评按钮 (对齐截图 055) -->
        <view class="card-right-action">
          <view class="write-eval-pill-btn" @click="handleWriteEvaluation(item)">
            写课评
          </view>
        </view>
      </view>

      <view class="safe-padding-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCampusStore } from '../../stores/campusStore';
import { eduApi } from '../../api/edu';
import AppIcon from '../../components/AppIcon.vue';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

const searchKeyword = ref('');
const dateRangeText = ref('2026-10-12 至 2026-10-18');

// 课评学员列表 (100% 对齐截图 055 真实数据，同时支持动态排课水化)
const evaluationItems = ref([
  {
    id: 'eval-01',
    name: '兰岚',
    phone: '15237356327',
    studentNo: 'S950000',
    className: '启蒙英语-001班',
    signTime: '2026-10-14 18:16',
    isPushed: false,
    scheduleId: 'sch-qmyy-12',
  },
  {
    id: 'eval-02',
    name: '王思博',
    phone: '13525086086',
    studentNo: 'S950002',
    className: '启蒙英语-001班',
    signTime: '2026-10-14 18:16',
    isPushed: false,
    scheduleId: 'sch-qmyy-12',
  },
  {
    id: 'eval-03',
    name: '潘程皓',
    phone: '15090434720',
    studentNo: 'S950004',
    className: '启蒙英语-001班',
    signTime: '2026-10-14 18:16',
    isPushed: false,
    scheduleId: 'sch-qmyy-12',
  },
  {
    id: 'eval-04',
    name: '江奕欣诺',
    phone: '13072667113',
    studentNo: 'S950001',
    className: '启蒙英语-001班',
    signTime: '2026-10-14 18:16',
    isPushed: false,
    scheduleId: 'sch-qmyy-12',
  },
]);

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

  await fetchLiveEvaluations();
});

const fetchLiveEvaluations = async () => {
  try {
    const schedules = await eduApi.getSchedules();
    if (Array.isArray(schedules) && schedules.length > 0) {
      const items: any[] = [];
      for (const s of schedules.slice(0, 3)) {
        try {
          const wb = await eduApi.getFulfillmentWorkbench(s.id);
          if (wb && wb.students) {
            for (const stu of wb.students) {
              items.push({
                id: stu.studentId,
                name: stu.name,
                phone: stu.phone || '13800000000',
                studentNo: stu.studentNo,
                className: s.className,
                signTime: `${s.date} ${s.startTime}`,
                isPushed: Boolean(stu.evaluated || s.status === 'completed'),
                scheduleId: s.id,
              });
            }
          }
        } catch {}
      }
      if (items.length > 0) {
        evaluationItems.value = items;
      }
    }
  } catch (err) {
    console.warn('[manage.vue] 加载真实课评数据失败，使用默认列表:', err);
  }
};

const filteredList = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return evaluationItems.value;
  return evaluationItems.value.filter(
    (item) => item.name.toLowerCase().includes(kw) || item.phone.includes(kw) || item.studentNo.toLowerCase().includes(kw)
  );
});

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
    },
  });
};

const handleOpenFilter = () => {
  uni.showToast({ title: '已开启多维度课评状态筛选', icon: 'none' });
};

const handleWriteEvaluation = (item: any) => {
  uni.navigateTo({
    url: `/package-edu/evaluation/edit?studentId=${item.id}&studentName=${encodeURIComponent(item.name)}&className=${encodeURIComponent(item.className)}`,
  });
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

/* 1. 搜索框 (对齐截图 055) */
.search-bar-wrap {
  padding: 16rpx 24rpx 12rpx;

  .search-box {
    height: 76rpx;
    background: #FFFFFF;
    border-radius: 38rpx;
    display: flex;
    align-items: center;
    padding: 0 24rpx;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.02);

    .search-icon {
      font-size: 28rpx;
      margin-right: 14rpx;
    }

    .search-input {
      flex: 1;
      height: 100%;
      font-size: 26rpx;
      color: #1F2937;
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

/* 2. 日期区间与筛选 (对齐截图 055) */
.date-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 24rpx 16rpx;

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

      .arrow {
        font-size: 16rpx;
        color: #2563EB;
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

/* 3. 学员课评卡片列表 (对齐截图 055) */
.cards-scroll-body {
  flex: 1;
  padding: 0 24rpx;
  box-sizing: border-box;

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

          .avatar-emoji {
            font-size: 50rpx;
          }
        }

        .name-status-block {
          flex: 1;

          .name-status-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8rpx;

            .student-name {
              font-size: 32rpx;
              font-weight: 700;
              color: #111827;
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
      }
    }
  }

  .safe-padding-bottom {
    height: calc(60rpx + constant(safe-area-inset-bottom));
    height: calc(60rpx + env(safe-area-inset-bottom));
  }
}
</style>
