<template>
  <view class="orders-page-container">
    <!-- 顶部状态栏与自定义导航 -->
    <view class="custom-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-inner">
        <view class="left-nav" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="page-title">订单管理</text>
          <view class="campus-selector" @click.stop="handleSwitchCampus">
            <text class="campus-name">{{ campusStore.currentCampusName }}</text>
            <text class="arrow">▼</text>
          </view>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 财务指标数据看板卡片 -->
    <view class="summary-board-card">
      <view class="board-header">
        <text class="board-title">财务营收看板</text>
        <text class="board-date">今日实时数据</text>
      </view>
      <view class="board-metrics-row">
        <view class="metric-block">
          <text class="metric-num-highlight">¥{{ summary.todayPaidAmount.toFixed(2) }}</text>
          <text class="metric-desc">今日实收</text>
        </view>
        <view class="metric-vertical-line"></view>
        <view class="metric-block">
          <text class="metric-num">{{ summary.monthOrderCount }}</text>
          <text class="metric-desc">本月订单(笔)</text>
        </view>
        <view class="metric-vertical-line"></view>
        <view class="metric-block">
          <text class="metric-num text-orange">{{ summary.pendingOrderCount }}</text>
          <text class="metric-desc">待支付</text>
        </view>
      </view>
    </view>

    <!-- 2. 搜索框 -->
    <view class="search-bar-wrap">
      <view class="search-input-box">
        <AppIcon name="search" size="32rpx" color="#94A3B8" />
        <input
          class="search-input"
          type="text"
          v-model="searchKeyword"
          placeholder="输入订单号/学员姓名/手机号查询"
          placeholder-class="placeholder-text"
          @input="fetchOrders"
        />
        <view v-if="searchKeyword" class="clear-btn" @click="clearSearch">
          <AppIcon name="x" size="28rpx" color="#94A3B8" />
        </view>
      </view>
    </view>

    <!-- 3. 类型与状态筛选胶囊 -->
    <view class="filters-pills-bar">
      <scroll-view class="pills-scroll" scroll-x>
        <view
          class="pill-item"
          v-for="t in typeFilters"
          :key="t.key"
          :class="{ active: currentType === t.key }"
          @click="selectType(t.key)"
        >
          {{ t.label }}
        </view>
      </scroll-view>
      <view class="status-dropdown-btn" @click="handleStatusFilter">
        <text class="status-btn-text">{{ statusFilterText }}</text>
        <AppIcon name="chevron-down" size="24rpx" color="#64748B" />
      </view>
    </view>

    <!-- 动态小计横幅 -->
    <view class="summary-subtotal-strip" v-if="orderList.length > 0">
      <AppIcon name="bar-chart-3" size="32rpx" color="#2F54EB" />
      <text class="subtotal-text">当前条件下：共计 {{ orderList.length }} 笔订单，实收总额 ¥{{ totalPaidInList.toFixed(2) }} 元</text>
    </view>

    <!-- 4. 订单卡片列表 -->
    <scroll-view class="orders-scroll-list" scroll-y>
      <view v-if="orderList.length > 0" class="cards-flow">
        <view
          class="order-record-card"
          v-for="item in orderList"
          :key="item.id"
          @click="handleCardClick(item)"
        >
          <!-- 订单头部: 订单号、日期、状态标签 -->
          <view class="order-header-row">
            <view class="order-no-box">
              <AppIcon name="receipt" size="32rpx" color="#64748B" />
              <text class="order-no-text">{{ item.orderNo }}</text>
            </view>
            <view class="status-tag" :class="'tag-' + item.status">
              {{ item.statusText }}
            </view>
          </view>

          <!-- 订单内容行: 学员、课程包规格 -->
          <view class="order-body-box">
            <view class="student-name-line">
              <text class="stu-name">{{ item.studentName }}</text>
              <text class="stu-phone">({{ item.studentPhone }})</text>
              <view class="type-badge">{{ item.orderTypeText }}</view>
            </view>

            <view class="items-list-box">
              <view
                class="sub-item-row"
                v-for="sub in item.items"
                :key="sub.id"
              >
                <text class="sub-item-name">• {{ sub.itemName }}</text>
                <text class="sub-item-qty">x{{ sub.quantity }}</text>
              </view>
            </view>

            <!-- 金额明细 -->
            <view class="amount-summary-row">
              <view class="pay-method-badge">{{ item.paymentMethod }}</view>
              <view class="amount-group">
                <text class="discount-text" v-if="item.discountAmount > 0">
                  已省¥{{ item.discountAmount }}
                </text>
                <text class="paid-label">实付:</text>
                <text class="paid-amount-large">¥{{ item.paidAmount }}</text>
              </view>
            </view>
          </view>

          <!-- 卡片底部: 下单时间与操作按钮 -->
          <view class="order-footer-row" @click.stop>
            <text class="order-time-text">{{ item.createdAtText }}</text>
            <view class="order-actions-group">
              <view class="action-btn-gray" @click="handleVoucher(item)">凭证</view>
              <view class="action-btn-blue" @click="handleCardClick(item)">查看详情</view>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-state-box">
        <view class="empty-emoji">
          <AppIcon name="inbox" size="112rpx" color="#CBD5E1" />
        </view>
        <text class="empty-text">暂无订单记录</text>
      </view>

      <view class="bottom-safe-space"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCampusStore } from '../../stores/campusStore';
import { financeApi, OrderItemModel, OrderSummaryModel } from '../../api/finance';
import AppIcon from '../../components/AppIcon.vue';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

const searchKeyword = ref('');
const currentType = ref('all');
const currentStatus = ref('all');
const statusFilterText = ref('全部状态');

const typeFilters = [
  { key: 'all', label: '全部' },
  { key: 'enroll', label: '新签报读' },
  { key: 'renewal', label: '续费充值' },
  { key: 'recharge', label: '钱包充值' },
  { key: 'refund', label: '退费单' },
];

const summary = ref<OrderSummaryModel>({
  todayPaidAmount: 4992,
  monthOrderCount: 12,
  pendingOrderCount: 1,
  totalRefundAmount: 1200,
});

const orderList = ref<OrderItemModel[]>([]);

const totalPaidInList = computed(() => {
  return orderList.value.reduce((acc, cur) => acc + (cur.status === 'paid' ? cur.paidAmount : 0), 0);
});

const handleCampusChanged = () => {
  fetchSummary();
  fetchOrders();
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
  } catch (err) {
    console.warn('获取系统信息异常:', err);
  }

  fetchSummary();
  fetchOrders();

  uni.$on('campus-changed', handleCampusChanged);
});

onUnmounted(() => {
  uni.$off('campus-changed', handleCampusChanged);
});

const fetchSummary = async () => {
  try {
    summary.value = await financeApi.getOrderSummary({ campusId: campusStore.currentCampusId });
  } catch (e: any) {
    console.warn('[orders/index] 获取汇总失败:', e);
    uni.showToast({ title: e?.message || '获取财务汇总失败', icon: 'none' });
  }
};

const fetchOrders = async () => {
  try {
    const res = await financeApi.getOrders({
      keyword: searchKeyword.value,
      orderType: currentType.value,
      status: currentStatus.value,
      campusId: campusStore.currentCampusId,
    });
    orderList.value = res.list;
  } catch (e: any) {
    console.warn('[orders/index] 获取订单列表失败:', e);
    uni.showToast({ title: e?.message || '获取订单列表失败', icon: 'none' });
  }
};

const selectType = (key: string) => {
  currentType.value = key;
  fetchOrders();
};

const clearSearch = () => {
  searchKeyword.value = '';
  fetchOrders();
};

const handleStatusFilter = () => {
  const options = ['全部状态', '已支付', '待支付', '已退费', '已驳回', '已作废'];
  const keys = ['all', 'paid', 'pending', 'refunded', 'rejected', 'voided'];
  uni.showActionSheet({
    itemList: options,
    success: (res) => {
      statusFilterText.value = options[res.tapIndex];
      currentStatus.value = keys[res.tapIndex];
      fetchOrders();
    },
  });
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
        fetchSummary();
        fetchOrders();
      }
    },
  });
};

const handleCardClick = (item: OrderItemModel) => {
  uni.navigateTo({
    url: `/package-finance/orders/detail?orderId=${item.id}&orderNo=${item.orderNo}`,
  });
};

const handleVoucher = (item: OrderItemModel) => {
  uni.showModal({
    title: '支付凭证',
    content: `订单 ${item.orderNo} 的电子核销流水凭证已生成并存证。`,
    showCancel: false,
    confirmText: '查看',
  });
};
</script>

<style scoped>
.orders-page-container {
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

/* 财务看板卡片 */
.summary-board-card {
  background: linear-gradient(135deg, #1D4ED8 0%, #1E3A8A 100%);
  margin: 20rpx 24rpx;
  border-radius: 28rpx;
  padding: 32rpx;
  color: #FFFFFF;
  box-shadow: 0 10rpx 28rpx rgba(29, 78, 216, 0.28);
  border: 1rpx solid rgba(255, 255, 255, 0.12);
  transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1);
}

.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.board-title {
  font-size: 30rpx;
  font-weight: 700;
  letter-spacing: 0.2rpx;
}

.board-date {
  font-size: 22rpx;
  opacity: 0.85;
}

.board-metrics-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.metric-block {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-num-highlight {
  font-size: 42rpx;
  font-weight: 900;
  color: #FEF08A;
  letter-spacing: -0.5rpx;
}

.metric-num {
  font-size: 38rpx;
  font-weight: 800;
  letter-spacing: -0.5rpx;
}

.text-orange {
  color: #FDBA74;
}

.metric-desc {
  font-size: 22rpx;
  opacity: 0.85;
  margin-top: 6rpx;
}

.metric-vertical-line {
  width: 1rpx;
  height: 48rpx;
  background: rgba(255, 255, 255, 0.25);
}

/* 搜索栏 */
.search-bar-wrap {
  padding: 0 24rpx 16rpx 24rpx;
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

/* 筛选胶囊栏 */
.filters-pills-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  padding: 14rpx 24rpx;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 2rpx 6rpx rgba(15, 23, 42, 0.02);
}

.pills-scroll {
  flex: 1;
  white-space: nowrap;
  margin-right: 16rpx;
}

.pill-item {
  display: inline-block;
  font-size: 24rpx;
  padding: 8rpx 26rpx;
  border-radius: 9999rpx;
  background: #F8FAFC;
  color: #475569;
  margin-right: 12rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease, color 0.2s ease;

  &:active {
    transform: scale(0.93);
  }
}

.pill-item.active {
  background: #EEF2FF;
  color: #2F54EB;
  font-weight: 700;
  border-color: rgba(47, 84, 235, 0.25);
  box-shadow: 0 2rpx 8rpx rgba(47, 84, 235, 0.12);
}

.status-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  font-size: 24rpx;
  color: #2F54EB;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:active {
    transform: scale(0.92);
  }
}

/* 订单卡片流 */
.orders-scroll-list {
  flex: 1;
  padding: 20rpx 24rpx;
  box-sizing: border-box;
}

.cards-flow {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.order-record-card {
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

.order-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #F8FAFC;
  padding-bottom: 16rpx;
}

.order-no-box {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.order-icon {
  font-size: 28rpx;
}

.order-no-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
}

.status-tag {
  font-size: 22rpx;
  padding: 2rpx 14rpx;
  border-radius: 6rpx;
  font-weight: 600;
}

.tag-paid {
  background: #E8F7ED;
  color: #10B981;
}

.tag-pending {
  background: #FEF3C7;
  color: #D97706;
}

.tag-refunded {
  background: #F3F4F6;
  color: #6B7280;
}

.tag-voided {
  background: #FEE2E2;
  color: #EF4444;
}

.order-body-box {
  padding: 16rpx 0;
}

.student-name-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.stu-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.stu-phone {
  font-size: 24rpx;
  color: #6B7280;
}

.type-badge {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.items-list-box {
  margin: 12rpx 0;
}

.sub-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 26rpx;
  color: #4B5563;
  margin-top: 6rpx;
}

.sub-item-name {
  flex: 1;
}

.sub-item-qty {
  color: #9CA3AF;
  font-size: 24rpx;
}

.amount-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}

.pay-method-badge {
  background: #F3F4F6;
  color: #4B5563;
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.amount-group {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.discount-text {
  font-size: 22rpx;
  color: #EF4444;
}

.paid-label {
  font-size: 24rpx;
  color: #374151;
}

.paid-amount-large {
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}

.order-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1rpx solid #F8FAFC;
  padding-top: 16rpx;
}

.order-time-text {
  font-size: 22rpx;
  color: #9CA3AF;
}

.order-actions-group {
  display: flex;
  gap: 16rpx;
}

.action-btn-gray {
  font-size: 24rpx;
  background: #F3F4F6;
  color: #4B5563;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
}

.action-btn-blue {
  font-size: 24rpx;
  background: #EFF6FF;
  color: #2563EB;
  font-weight: 600;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
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

.summary-subtotal-strip {
  display: flex;
  align-items: center;
  background: #EFF6FF;
  border: 1rpx solid #BFDBFE;
  border-radius: 12rpx;
  margin: 0 24rpx 16rpx 24rpx;
  padding: 14rpx 20rpx;
}

.subtotal-icon {
  font-size: 26rpx;
  margin-right: 12rpx;
}

.subtotal-text {
  font-size: 24rpx;
  color: #1E40AF;
  font-weight: 500;
}

.bottom-safe-space {
  height: calc(80rpx + constant(safe-area-inset-bottom));
  height: calc(80rpx + env(safe-area-inset-bottom));
}
</style>
