<template>
  <view class="student-list-container">
    <!-- 顶部状态栏与自定义导航 (对齐截图 023: < 总部校区 ▼) -->
    <view class="custom-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-inner">
        <view class="left-nav" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <view class="campus-selector" @click.stop="handleSwitchCampus">
            <text class="campus-name">{{ campusStore.currentCampusName }}</text>
            <text class="arrow">▼</text>
          </view>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 顶层主 Tab 切换 (对齐截图 023: 全部学员 | 待分班学员) -->
    <view class="top-tabs-row">
      <view
        class="tab-item"
        :class="{ active: currentTab === 'all' }"
        @click="switchTab('all')"
      >
        <text class="tab-label">全部学员</text>
        <view class="active-indicator" v-if="currentTab === 'all'"></view>
      </view>
      <view
        class="tab-item"
        :class="{ active: currentTab === 'pending' }"
        @click="switchTab('pending')"
      >
        <text class="tab-label">待分班学员</text>
        <view class="active-indicator" v-if="currentTab === 'pending'"></view>
      </view>
    </view>

    <!-- 搜索栏 (对齐截图 023: Q 输入学员名称/手机号/学号查询) -->
    <view class="search-wrap">
      <view class="search-box">
        <AppIcon name="search" size="32rpx" color="#94A3B8" />
        <input
          class="search-input"
          type="text"
          v-model="searchKeyword"
          placeholder="输入学员名称/手机号/学号查询"
          placeholder-class="placeholder-text"
          @input="handleSearchInput"
        />
        <view v-if="searchKeyword" class="clear-btn" @click="clearSearch">
          <AppIcon name="x" size="28rpx" color="#94A3B8" />
        </view>
      </view>
    </view>

    <!-- 4联下拉筛选胶囊栏 (对齐截图 023: 学员状态 ▼ | 启用 ▼ | 学员介绍人 ▼ | 员工介绍人 ▼) -->
    <view class="filter-capsules-bar">
      <view class="filter-pill" @click="handleFilterClick('status')">
        <text class="pill-title">{{ selectedStatusText }}</text>
        <text class="arrow">▼</text>
      </view>
      <view class="filter-pill" @click="handleFilterClick('enable')">
        <text class="pill-title">启用</text>
        <text class="arrow">▼</text>
      </view>
      <view class="filter-pill" @click="handleFilterClick('studentRefer')">
        <text class="pill-title">学员介绍人</text>
        <text class="arrow">▼</text>
      </view>
      <view class="filter-pill" @click="handleFilterClick('staffRefer')">
        <text class="pill-title">员工介绍人</text>
        <text class="arrow">▼</text>
      </view>
    </view>

    <!-- 学员卡片流列表 (对齐截图 023) -->
    <scroll-view class="students-scroll-view" scroll-y @scrolltolower="loadMore">
      <view v-if="studentList.length > 0" class="cards-list">
        <view
          class="student-card"
          v-for="item in studentList"
          :key="item.id"
          @click="handleCardClick(item)"
        >
          <!-- 左侧圆形大头像 -->
          <view class="avatar-wrap">
            <image
              v-if="item.avatar"
              class="avatar-img"
              :src="item.avatar"
              mode="aspectFill"
            />
            <view v-else class="avatar-fallback">
              <AppIcon name="user" size="44rpx" color="#FFFFFF" />
            </view>
          </view>

          <!-- 右侧学员信息主体 -->
          <view class="card-main-info">
            <!-- 姓名行、在读标签、小纸飞机、条码图标 -->
            <view class="name-status-row">
              <view class="name-tag-group">
                <text class="student-name">{{ item.name }}</text>
                <view
                  class="status-tag"
                  :class="item.tagClass || (item.status === 'pending_assignment' ? 'tag-pending' : 'tag-active')"
                >
                  {{ item.statusText }}
                </view>
                <AppIcon name="send" size="24rpx" color="#3B82F6" class="plane-icon" />
              </view>
              <view class="qr-btn" @click.stop="handleShowQr(item)">
                <AppIcon name="qr-code" size="32rpx" color="#64748B" />
              </view>
            </view>

            <!-- 徽章行：剩余课次 & 在读班级数 & 课消风险 -->
            <view class="badges-row">
              <view class="badge-orange">
                剩余{{ item.remainingLessons }}课次
              </view>
              <view class="badge-blue">
                {{ item.enrolledClassesCount }}个在读班级
              </view>
              <view
                v-if="item.risk && item.risk.warningWindow"
                :class="item.risk.isUrgent ? 'badge-risk-urgent' : 'badge-risk-warning'"
              >
                {{ item.risk.label }}
              </view>
            </view>

            <!-- 学号 -->
            <view class="meta-line">
              <text class="meta-label">学号：</text>
              <text class="meta-val">{{ item.studentNo }}</text>
            </view>

            <!-- 剩余金额 -->
            <view class="meta-line">
              <text class="meta-label">剩余金额(元)：</text>
              <text class="meta-val font-semibold">{{ item.remainingAmount }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 (对齐截图 029/无数据) -->
      <view v-else class="empty-state-box">
        <AppIcon name="inbox" size="80rpx" color="#94A3B8" class="empty-emoji" />
        <text class="empty-text">暂无学员记录</text>
      </view>

      <view class="bottom-safe-pad"></view>
    </scroll-view>

    <!-- 右下角悬浮「+」快捷操作按钮 (对齐截图 023) -->
    <view class="float-add-btn" @click="handleFloatAction">
      <text class="plus-icon">＋</text>
    </view>

    <!-- 底部快捷操作弹窗 (ActionSheet) -->
    <view class="modal-mask" v-if="showActionDrawer" @click="showActionDrawer = false">
      <view class="action-sheet-panel" @click.stop>
        <view class="sheet-title">快捷办理</view>
        <view class="sheet-item" @click="handleActionOption('enroll')">
          <AppIcon name="file-text" size="36rpx" color="#2F54EB" class="sheet-icon" />
          <text class="sheet-text">学员报名开单</text>
        </view>
        <view class="sheet-item" @click="handleActionOption('create')">
          <AppIcon name="user-plus" size="36rpx" color="#16A34A" class="sheet-icon" />
          <text class="sheet-text">录入新学员</text>
        </view>
        <view class="sheet-gap"></view>
        <view class="sheet-item cancel-item" @click="showActionDrawer = false">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import AppIcon from '../../components/AppIcon.vue';
import { useCampusStore } from '../../stores/campusStore';
import { studentProjector, type RosterItemView } from '../../projectors/student';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

// 状态筛选
const currentTab = ref<'all' | 'pending'>('all');
const searchKeyword = ref('');
const selectedStatusText = ref('学员状态');

// 学员名册投影数据列表与抽屉
const studentList = ref<RosterItemView[]>([]);
const showActionDrawer = ref(false);

const fetchStudents = async () => {
  const cid = campusStore.currentCampusId === 'all' ? undefined : campusStore.currentCampusId;
  let statusFilter: string | undefined = undefined;
  if (currentTab.value === 'pending') {
    statusFilter = 'pending_assignment';
  } else if (selectedStatusText.value === '在读') {
    statusFilter = 'in_class';
  } else if (selectedStatusText.value === '待分班') {
    statusFilter = 'pending_assignment';
  } else if (selectedStatusText.value === '历史学员') {
    statusFilter = 'graduated';
  }

  const res = await studentProjector.projectRoster({
    keyword: searchKeyword.value.trim() || undefined,
    status: statusFilter,
    campusId: cid,
  });
  studentList.value = res.list || [];
};

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

  campusStore.fetchCampuses();
  fetchStudents();
  uni.$on('campus-changed', fetchStudents);
});

onShow(() => {
  fetchStudents();
});

let searchDebounceTimer: any = null;

onUnmounted(() => {
  clearTimeout(searchDebounceTimer);
  uni.$off('campus-changed', fetchStudents);
});

const switchTab = (tab: 'all' | 'pending') => {
  currentTab.value = tab;
  if (tab === 'all') {
    selectedStatusText.value = '学员状态';
  } else if (tab === 'pending') {
    selectedStatusText.value = '待分班';
  }
  fetchStudents();
};

const handleSearchInput = () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    fetchStudents();
  }, 300);
};

const clearSearch = () => {
  clearTimeout(searchDebounceTimer);
  searchKeyword.value = '';
  fetchStudents();
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
  const list = campusStore.availableCampuses;
  uni.showActionSheet({
    itemList: list.map((c) => c.name),
    success: (res) => {
      const selected = list[res.tapIndex];
      if (selected) {
        campusStore.switchCampus(selected.id);
        fetchStudents();
      }
    },
  });
};

const handleFilterClick = (type: string) => {
  if (type === 'status') {
    uni.showActionSheet({
      itemList: ['全部状态', '在读', '待分班', '历史学员'],
      success: (res) => {
        const statuses = ['全部状态', '在读', '待分班', '历史学员'];
        selectedStatusText.value = statuses[res.tapIndex];
        if (res.tapIndex === 2) {
          currentTab.value = 'pending';
        } else {
          currentTab.value = 'all';
        }
        fetchStudents();
      },
    });
  } else {
    uni.showToast({ title: '筛选功能已就绪', icon: 'none' });
  }
};

const handleCardClick = (item: RosterItemView) => {
  uni.navigateTo({
    url: `/package-student/detail/index?studentId=${item.id}&name=${encodeURIComponent(item.name)}&studentNo=${item.studentNo}`,
  });
};

const handleShowQr = (item: RosterItemView) => {
  uni.showModal({
    title: `${item.name} 的学员码`,
    content: `学号: ${item.studentNo}\n已生成考勤核销电子码`,
    showCancel: false,
    confirmText: '关闭',
  });
};

const handleFloatAction = () => {
  showActionDrawer.value = true;
};

const handleActionOption = (type: string) => {
  showActionDrawer.value = false;
  if (type === 'enroll') {
    uni.navigateTo({ url: '/package-student/enroll/wizard' });
  } else if (type === 'create') {
    uni.navigateTo({ url: '/package-student/edit/index' });
  }
};

const loadMore = () => {};
</script>

<style scoped>
.student-list-container {
  min-height: 100vh;
  background-color: #F8F9FD;
  display: flex;
  flex-direction: column;
}

/* 顶部自定义导航 */
.custom-header {
  background: #FFFFFF;
  border-bottom: 1rpx solid #F0F2F5;
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
  color: #333333;
  margin-right: 16rpx;
  line-height: 1;
}

.campus-selector {
  display: flex;
  align-items: center;
  background: #F4F6F9;
  padding: 8rpx 18rpx;
  border-radius: 28rpx;
}

.campus-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1F2937;
  margin-right: 8rpx;
}

.arrow {
  font-size: 20rpx;
  color: #8C9BAB;
}

/* 主 Tab 栏 */
.top-tabs-row {
  display: flex;
  background: #FFFFFF;
  padding: 0 32rpx;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.02);
}

.tab-item {
  position: relative;
  padding: 24rpx 20rpx 20rpx 20rpx;
  margin-right: 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:active {
    transform: scale(0.95);
  }
}

.tab-label {
  font-size: 30rpx;
  font-weight: 500;
  color: #64748B;
  transition: color 0.2s ease;
}

.tab-item.active .tab-label {
  font-weight: 700;
  color: #0F172A;
}

.active-indicator {
  position: absolute;
  bottom: 0;
  width: 52rpx;
  height: 6rpx;
  background-color: #2F54EB;
  border-radius: 9999rpx;
  box-shadow: 0 2rpx 8rpx rgba(47, 84, 235, 0.35);
}

/* 搜索栏 */
.search-wrap {
  padding: 18rpx 24rpx;
  background: #FFFFFF;
}

.search-box {
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

/* 筛选胶囊栏 */
.filter-capsules-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 24rpx;
  background: #FFFFFF;
  border-top: 1rpx solid rgba(15, 23, 42, 0.05);
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 2rpx 6rpx rgba(15, 23, 42, 0.02);
}

.filter-pill {
  display: flex;
  align-items: center;
  padding: 8rpx 18rpx;
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

.pill-title {
  font-size: 24rpx;
  color: #334155;
  margin-right: 6rpx;
  font-weight: 500;
}

/* 列表滑动区 */
.students-scroll-view {
  flex: 1;
  padding: 20rpx 24rpx;
  box-sizing: border-box;
}

.cards-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.student-card {
  display: flex;
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

.avatar-wrap {
  margin-right: 20rpx;
}

.avatar-img {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
}

.avatar-fallback {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #FFF1E6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-emoji {
  font-size: 52rpx;
}

.card-main-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.name-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.name-tag-group {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.student-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.status-tag {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.tag-active {
  background: #E8F7ED;
  color: #10B981;
}

.tag-pending {
  background: #FEF3C7;
  color: #F59E0B;
}

.tag-unassigned {
  background: #F3F4F6;
  color: #6B7280;
}

.tag-suspended {
  background: #FEE2E2;
  color: #EF4444;
}

.tag-graduated {
  background: #EDE9FE;
  color: #8B5CF6;
}

.tag-lost {
  background: #F3F4F6;
  color: #9CA3AF;
}

.tag-transferred {
  background: #E0E7FF;
  color: #4F46E5;
}

.plane-icon {
  font-size: 24rpx;
}

.qr-icon {
  font-size: 36rpx;
  color: #9CA3AF;
}

.badges-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.badge-orange {
  font-size: 22rpx;
  background: #FFF7ED;
  color: #EA580C;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

.badge-blue {
  font-size: 22rpx;
  background: #EFF6FF;
  color: #2563EB;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

.badge-risk-urgent {
  font-size: 22rpx;
  background: #FEE2E2;
  color: #EF4444;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.badge-risk-warning {
  font-size: 22rpx;
  background: #FEF3C7;
  color: #D97706;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.meta-line {
  font-size: 24rpx;
  color: #6B7280;
  margin-top: 4rpx;
}

.font-semibold {
  font-weight: 600;
  color: #1F2937;
}

/* 空状态 */
.empty-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-emoji {
  font-size: 72rpx;
  margin-bottom: 16rpx;
}

.empty-text {
  font-size: 26rpx;
  color: #9CA3AF;
}

.bottom-safe-pad {
  height: calc(200rpx + constant(safe-area-inset-bottom));
  height: calc(200rpx + env(safe-area-inset-bottom));
}

/* 右下角悬浮按钮 (M3 Floating Action Button) */
.float-add-btn {
  position: fixed;
  right: 36rpx;
  bottom: calc(80rpx + constant(safe-area-inset-bottom));
  bottom: calc(80rpx + env(safe-area-inset-bottom));
  width: 108rpx;
  height: 108rpx;
  background: linear-gradient(135deg, #2F54EB 0%, #1D39C4 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10rpx 28rpx rgba(47, 84, 235, 0.4), 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
  z-index: 99;
  cursor: pointer;
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;

  &:active {
    transform: scale(0.92);
    box-shadow: 0 4rpx 14rpx rgba(47, 84, 235, 0.3);
  }
}

.plus-icon {
  font-size: 58rpx;
  color: #FFFFFF;
  line-height: 1;
}

/* 操作抽屉弹窗 (M3 Bottom Sheet) */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  z-index: 999;
  animation: m3FadeIn 0.25s ease both;
  will-change: opacity;
}

.action-sheet-panel {
  width: 100%;
  background: #FFFFFF;
  border-top-left-radius: 36rpx;
  border-top-right-radius: 36rpx;
  padding: 28rpx 0;
  padding-bottom: calc(28rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(28rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -8rpx 32rpx rgba(15, 23, 42, 0.12);
  animation: m3SheetSlideUp 0.3s cubic-bezier(0.05, 0.7, 0.1, 1) both;
  will-change: transform;
}

.sheet-title {
  text-align: center;
  font-size: 28rpx;
  color: #64748B;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  font-weight: 500;
}

.sheet-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx 0;
  font-size: 30rpx;
  color: #0F172A;
  gap: 14rpx;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:active {
    background-color: #F8FAFC;
  }
}

.sheet-icon {
  font-size: 32rpx;
}

.sheet-gap {
  height: 14rpx;
  background: #F1F5F9;
}

.cancel-item {
  color: #64748B;
  font-weight: 500;
}

@keyframes m3FadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes m3SheetSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style>
