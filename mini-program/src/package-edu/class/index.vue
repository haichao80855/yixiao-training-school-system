<template>
  <view class="class-list-container">
    <!-- 顶部状态栏与自定义导航 (对齐截图 019: < 班级管理 | 总部校区 ▼) -->
    <view class="custom-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-inner">
        <view class="left-nav" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="page-title">班级管理</text>
          <view class="campus-selector" @click.stop="handleSwitchCampus">
            <text class="campus-name">{{ campusStore.currentCampusName }}</text>
            <text class="arrow">▼</text>
          </view>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 搜索栏 (对齐截图 019: Q 输入班级名称查询) -->
    <view class="search-bar-wrap">
      <view class="search-input-box">
        <AppIcon name="search" size="32rpx" color="#94A3B8" />
        <input
          class="search-input"
          type="text"
          v-model="searchKeyword"
          placeholder="输入班级名称查询"
          placeholder-class="placeholder-text"
          @input="fetchClasses"
        />
        <view v-if="searchKeyword" class="clear-btn" @click="clearSearch">
          <AppIcon name="x" size="28rpx" color="#94A3B8" />
        </view>
      </view>
    </view>

    <!-- 2. 日期区间与筛选栏 (对齐截图 019: 上课时间 ▼ 开始日期 至 结束日期 ▼ | Y 筛选) -->
    <view class="date-filter-bar">
      <view class="filter-left-group">
        <view class="dropdown-pill" @click="handleTimeFilter">
          <text class="item-text">上课时间</text>
          <AppIcon name="chevron-down" size="24rpx" color="#64748B" />
        </view>
        <view class="dropdown-pill date-range-picker" @click="handleSelectDateRange">
          <text class="range-text">{{ dateRangeText }}</text>
          <AppIcon name="chevron-down" size="24rpx" color="#64748B" />
        </view>
      </view>
      <view class="filter-right-btn" @click="handleOpenDrawer">
        <text class="filter-icon">Y</text>
        <text class="filter-label">筛选</text>
      </view>
    </view>

    <!-- 3. 班级卡片流 (对齐截图 019) -->
    <scroll-view class="class-cards-scroll" scroll-y>
      <view v-if="classList.length > 0" class="cards-wrapper">
        <view
          class="class-record-card"
          v-for="item in classList"
          :key="item.id"
          @click="handleCardClick(item)"
        >
          <!-- 状态徽章与开班日期 -->
          <view class="card-top-row">
            <view class="status-badge" :class="'badge-' + item.status">
              {{ item.statusText }}
            </view>
            <text class="start-date-text">{{ item.startDateText }}</text>
          </view>

          <!-- 班级大标题 (如: 少儿书法-001班 / 启蒙英语-002班) -->
          <view class="class-title-text">{{ item.name }}</view>

          <!-- 属性与进度行: 常规班 | 结课 0/全部 100 | 学员 10/班容 10 -->
          <view class="class-attr-stats-row">
            <view class="class-type-pill">{{ item.classType }}</view>
            <view class="stat-item">
              结课 <text class="bold-val">{{ item.completedLessons }}</text>/全部 <text class="bold-val">{{ item.totalLessons }}</text>
            </view>
            <view class="stat-item">
              学员 <text class="bold-val">{{ item.currentStudentCount }}</text>/班容 <text class="bold-val">{{ item.capacity }}</text>
            </view>
          </view>

          <!-- 课程与教职信息 -->
          <view class="meta-details-box">
            <view class="meta-line">课程：{{ item.courseName }}</view>
            <view class="meta-line staff-line">
              <text>讲师：{{ item.teacherName }}</text>
              <text class="advisor-gap">教务：{{ item.advisorName }}</text>
            </view>
            <view class="meta-line">上课时间：{{ item.schedulePatternText }}</view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-state-box">
        <view class="empty-emoji">
          <AppIcon name="inbox" size="112rpx" color="#CBD5E1" />
        </view>
        <text class="empty-text">暂无班级数据</text>
      </view>

      <view class="bottom-safe-space"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCampusStore } from '../../stores/campusStore';
import { classApi, ClassListItemModel } from '../../api/class';
import AppIcon from '../../components/AppIcon.vue';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

const searchKeyword = ref('');
const dateRangeText = ref('开始日期 至 结束日期');
const classList = ref<ClassListItemModel[]>([]);

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

  fetchClasses();
});

const fetchClasses = async () => {
  classList.value = await classApi.getClasses({
    keyword: searchKeyword.value,
    campusId: campusStore.currentCampusId,
  });
};

const clearSearch = () => {
  searchKeyword.value = '';
  fetchClasses();
};

const handleGoBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: '/pages/workbench/index' });
  }
};

const handleSwitchCampus = () => {
  uni.showActionSheet({
    itemList: campusStore.availableCampuses.map((c) => c.name),
    success: (res) => {
      const selected = campusStore.availableCampuses[res.tapIndex];
      if (selected) {
        campusStore.switchCampus(selected.id);
        fetchClasses();
      }
    },
  });
};

const handleTimeFilter = () => {
  uni.showActionSheet({
    itemList: ['全部上课时间', '本周', '下周', '本月'],
    success: () => {},
  });
};

const handleSelectDateRange = () => {
  uni.showToast({ title: '日期范围选择已就绪', icon: 'none' });
};

const handleOpenDrawer = () => {
  uni.showActionSheet({
    itemList: ['全部班级', '我的班级', '正常班', '已结课班级'],
    success: (res) => {
      if (res.tapIndex === 1) {
        // 我的班级
        classList.value = classList.value.filter((c) => c.teacherName === '冯老师');
      } else {
        fetchClasses();
      }
    },
  });
};

const handleCardClick = (item: ClassListItemModel) => {
  uni.navigateTo({
    url: `/package-edu/class/detail?classId=${item.id}&name=${encodeURIComponent(item.name)}`,
  });
};
</script>

<style scoped>
.class-list-container {
  min-height: 100vh;
  background-color: #F8F9FD;
  display: flex;
  flex-direction: column;
}

/* 顶部导航 */
.custom-header {
  background: #FFFFFF;
}

.header-inner {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
}

.left-nav {
  display: flex;
  align-items: center;
}

.back-arrow {
  font-size: 52rpx;
  color: #1F2937;
  margin-right: 16rpx;
  line-height: 1;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
  margin-right: 16rpx;
}

.campus-selector {
  display: flex;
  align-items: center;
  background: #F4F6F9;
  padding: 6rpx 16rpx;
  border-radius: 24rpx;
}

.campus-name {
  font-size: 26rpx;
  font-weight: 600;
  color: #1F2937;
  margin-right: 6rpx;
}

.arrow {
  font-size: 20rpx;
  color: #8C9BAB;
}

/* 搜索栏 */
.search-bar-wrap {
  background: #FFFFFF;
  padding: 16rpx 24rpx;
}

.search-input-box {
  display: flex;
  align-items: center;
  background: #EFF2F8;
  border-radius: 9999rpx;
  padding: 14rpx 28rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.04);
  transition: background-color 0.2s ease, border-color 0.2s ease;

  &:focus-within {
    background: #FFFFFF;
    border-color: #2F54EB;
    box-shadow: 0 0 0 2rpx rgba(47, 84, 235, 0.15);
  }
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
  line-height: 1;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #0F172A;
}

.clear-btn {
  font-size: 24rpx;
  color: #94A3B8;
  padding: 4rpx 10rpx;
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:active {
    transform: scale(0.85);
  }
}

.placeholder-text {
  color: #94A3B8;
  font-size: 26rpx;
}

/* 日期与筛选栏 */
.date-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  padding: 18rpx 24rpx;
  border-top: 1rpx solid rgba(15, 23, 42, 0.05);
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 2rpx 6rpx rgba(15, 23, 42, 0.02);
}

.filter-left-group {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.dropdown-pill {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 16rpx;
  background: #F8FAFC;
  border-radius: 9999rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease;

  &:active {
    transform: scale(0.94);
    background: #EEF2FF;
  }
}

.item-text {
  font-size: 24rpx;
  color: #334155;
  font-weight: 500;
}

.range-text {
  font-size: 24rpx;
  color: #2F54EB;
  font-weight: 600;
}

.arrow {
  font-size: 16rpx;
  color: #64748B;
}

.filter-right-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  color: #2F54EB;
  cursor: pointer;
  padding: 6rpx 14rpx;
  border-radius: 9999rpx;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:active {
    transform: scale(0.92);
  }
}

.filter-icon {
  font-size: 24rpx;
  font-weight: 700;
}

.filter-label {
  font-size: 24rpx;
  font-weight: 700;
}

/* 班级卡片 */
.class-cards-scroll {
  flex: 1;
  padding: 20rpx 24rpx;
  box-sizing: border-box;
}

.cards-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.class-record-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 4rpx 20rpx rgba(15, 23, 42, 0.03);
  transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.22s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;
  cursor: pointer;

  &:active {
    transform: scale(0.985);
    box-shadow: 0 2rpx 10rpx rgba(15, 23, 42, 0.02);
  }
}

.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.status-badge {
  font-size: 22rpx;
  font-weight: 600;
  padding: 4rpx 16rpx;
  border-radius: 9999rpx;
}

.badge-active {
  background: #2F54EB;
  color: #FFFFFF;
  box-shadow: 0 2rpx 8rpx rgba(47, 84, 235, 0.35);
}

.badge-completed {
  background: #F1F5F9;
  color: #64748B;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
}

.start-date-text {
  font-size: 24rpx;
  color: #94A3B8;
  font-weight: 500;
}

.class-title-text {
  font-size: 34rpx;
  font-weight: 700;
  color: #0F172A;
  margin-bottom: 16rpx;
  letter-spacing: 0.2rpx;
}

.class-attr-stats-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.class-type-pill {
  font-size: 22rpx;
  background: #EEF2FF;
  color: #2F54EB;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: 600;
  border: 1rpx solid rgba(47, 84, 235, 0.15);
}

.stat-item {
  font-size: 24rpx;
  color: #64748B;
}

.bold-val {
  font-weight: 700;
  color: #0F172A;
}

.meta-details-box {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  border-top: 1rpx solid rgba(15, 23, 42, 0.06);
  padding-top: 16rpx;
}

.meta-line {
  font-size: 24rpx;
  color: #64748B;
}

.staff-line {
  display: flex;
}

.advisor-gap {
  margin-left: 36rpx;
}

/* 空状态 */
.empty-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 0;
}

.empty-emoji {
  font-size: 72rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 26rpx;
  color: #94A3B8;
}

.bottom-safe-space {
  height: calc(80rpx + constant(safe-area-inset-bottom));
  height: calc(80rpx + env(safe-area-inset-bottom));
}
</style>
