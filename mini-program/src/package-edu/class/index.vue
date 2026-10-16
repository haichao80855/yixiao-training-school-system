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
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          type="text"
          v-model="searchKeyword"
          placeholder="输入班级名称查询"
          placeholder-class="placeholder-text"
          @input="fetchClasses"
        />
        <text v-if="searchKeyword" class="clear-btn" @click="clearSearch">✕</text>
      </view>
    </view>

    <!-- 2. 日期区间与筛选栏 (对齐截图 019: 上课时间 ▼ 开始日期 至 结束日期 ▼ | Y 筛选) -->
    <view class="date-filter-bar">
      <view class="filter-left-group">
        <view class="dropdown-pill" @click="handleTimeFilter">
          <text class="item-text">上课时间</text>
          <text class="arrow">▼</text>
        </view>
        <view class="dropdown-pill date-range-picker" @click="handleSelectDateRange">
          <text class="range-text">{{ dateRangeText }}</text>
          <text class="arrow">▼</text>
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
        <text class="empty-emoji">🥺</text>
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
  background: #F4F6FA;
  border-radius: 36rpx;
  padding: 12rpx 24rpx;
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #111827;
}

.clear-btn {
  font-size: 24rpx;
  color: #9CA3AF;
  padding: 4rpx 10rpx;
}

.placeholder-text {
  color: #9CA3AF;
  font-size: 26rpx;
}

/* 日期与筛选栏 */
.date-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  padding: 16rpx 24rpx;
  border-top: 1rpx solid #F3F4F6;
  border-bottom: 1rpx solid #F3F4F6;
}

.filter-left-group {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.dropdown-pill {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.item-text,
.range-text {
  font-size: 26rpx;
  color: #374151;
}

.range-text {
  color: #2563EB;
}

.filter-right-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  color: #2563EB;
}

.filter-icon {
  font-size: 26rpx;
  font-weight: 700;
}

.filter-label {
  font-size: 26rpx;
  font-weight: 600;
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
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
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
  border-radius: 8rpx;
}

.badge-active {
  background: #2F6BF4;
  color: #FFFFFF;
}

.badge-completed {
  background: #E5E7EB;
  color: #6B7280;
}

.start-date-text {
  font-size: 24rpx;
  color: #9CA3AF;
}

.class-title-text {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 16rpx;
}

.class-attr-stats-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.class-type-pill {
  font-size: 22rpx;
  background: #EFF6FF;
  color: #2563EB;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.stat-item {
  font-size: 24rpx;
  color: #6B7280;
}

.bold-val {
  font-weight: 700;
  color: #111827;
}

.meta-details-box {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  border-top: 1rpx solid #F8FAFC;
  padding-top: 16rpx;
}

.meta-line {
  font-size: 24rpx;
  color: #6B7280;
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
  color: #9CA3AF;
}

.bottom-safe-space {
  height: 80rpx;
}
</style>
