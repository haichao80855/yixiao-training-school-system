<template>
  <view class="order-detail-page">
    <!-- 顶部状态栏与自定义导航 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-left" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="nav-title">订单详情</text>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 顶部状态大横幅 -->
    <view class="status-banner" :class="'banner-' + order.status">
      <view class="banner-icon-circle">
        <AppIcon :name="order.status === 'paid' ? 'check' : 'help-circle'" size="48rpx" color="#FFFFFF" />
      </view>
      <view class="banner-text-box">
        <text class="banner-main-title">{{ order.statusText }}</text>
        <text class="banner-sub-text">订单编号: {{ order.orderNo }}</text>
      </view>
    </view>

    <scroll-view class="receipt-scroll-view" scroll-y>
      <!-- 电子收据主体卡片 (Receipt Card) -->
      <view class="receipt-card">
        <!-- 锯齿顶部装饰 -->
        <view class="receipt-top-teeth"></view>

        <!-- 作废大红水印 -->
        <view class="void-watermark" v-if="order.status === 'voided'">
          <text class="void-watermark-text">【 已 作 废 】</text>
        </view>

        <!-- 机构抬头与印章 -->
        <view class="receipt-header">
          <text class="school-name">一校云 · 培训收费收据</text>
          <text class="school-campus">{{ campusStore.currentCampusName }}</text>
          <view class="seal-stamp">
            <text class="seal-inner">财务专用章</text>
          </view>
        </view>

        <!-- 签约学员档案行 -->
        <view class="receipt-section-block">
          <view class="block-title">签约学员</view>
          <view class="info-grid">
            <view class="info-row">
              <text class="lbl">学员姓名：</text>
              <text class="val font-bold">{{ order.studentName }}</text>
            </view>
            <view class="info-row">
              <text class="lbl">学号：</text>
              <text class="val">{{ order.studentNo }}</text>
            </view>
            <view class="info-row">
              <text class="lbl">联系电话：</text>
              <text class="val">{{ order.studentPhone }}</text>
            </view>
          </view>
        </view>

        <view class="dashed-divider"></view>

        <!-- 购买明细明细表 -->
        <view class="receipt-section-block">
          <view class="block-title">签约收费明细</view>
          <view class="items-table">
            <view class="table-head">
              <text class="th-name">项目名称</text>
              <text class="th-qty">数量</text>
              <text class="th-price">单价</text>
              <text class="th-subtotal">金额</text>
            </view>
            <view
              class="table-row"
              v-for="sub in order.items"
              :key="sub.id"
            >
              <text class="td-name">{{ sub.itemName }}</text>
              <text class="td-qty">{{ sub.quantity }}</text>
              <text class="td-price">¥{{ sub.unitPrice }}</text>
              <text class="td-subtotal">¥{{ sub.subtotal }}</text>
            </view>
          </view>
        </view>

        <view class="dashed-divider"></view>

        <!-- 结算账单明细 -->
        <view class="receipt-section-block">
          <view class="fee-line">
            <text class="fee-lbl">合同应收总计：</text>
            <text class="fee-val">¥{{ order.totalAmount.toFixed(2) }}</text>
          </view>
          <view class="fee-line text-red" v-if="order.discountAmount > 0">
            <text class="fee-lbl">优惠减免抵扣：</text>
            <text class="fee-val">-¥{{ order.discountAmount.toFixed(2) }}</text>
          </view>
          <view class="fee-line paid-highlight-line">
            <text class="paid-lbl">实际实收金额：</text>
            <text class="paid-val">¥{{ order.paidAmount.toFixed(2) }}</text>
          </view>
          <view class="fee-line capital-rmb-line">
            <text class="capital-lbl">大写金额：</text>
            <text class="capital-val">{{ digitUppercase(order.paidAmount) }}</text>
          </view>
          <view class="fee-line meta-small-line">
            <text class="fee-lbl">支付渠道方式：</text>
            <text class="fee-val">{{ order.paymentMethod }}</text>
          </view>
          <view class="fee-line meta-small-line">
            <text class="fee-lbl">经办操作人员：</text>
            <text class="fee-val">{{ order.operatorName }}</text>
          </view>
          <view class="fee-line meta-small-line">
            <text class="fee-lbl">下单交易时间：</text>
            <text class="fee-val">{{ order.createdAtText }}</text>
          </view>
        </view>
      </view>

      <!-- 底部动作条 -->
      <view class="detail-actions-row">
        <view class="void-btn" v-if="order.status === 'paid'" @click="handleVoidOrder">
          作废订单
        </view>
        <view class="share-btn" @click="handlePrintReceipt">
          打印/分享收据
        </view>
      </view>

      <view class="safe-padding-bottom"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCampusStore } from '../../stores/campusStore';
import { financeApi, OrderItemModel } from '../../api/finance';
import AppIcon from '../../components/AppIcon.vue';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

const orderId = ref('ord-01');

const order = ref<OrderItemModel>({
  id: 'ord-01',
  orderNo: 'ORD20261015001',
  studentId: 's-01',
  studentName: '董御',
  studentPhone: '13460475611',
  studentNo: 'S950014',
  orderType: 'enroll',
  orderTypeText: '新签报读',
  status: 'paid',
  statusText: '交易成功',
  totalAmount: 6400,
  paidAmount: 4992,
  discountAmount: 1408,
  paymentMethod: '微信支付',
  createdAtText: '2026-10-15 16:32:10',
  operatorName: '冯老师',
  items: [
    { id: 'item-01', itemName: '启蒙英语 (100课次)', itemType: 'course', quantity: 1, unitPrice: 6400, subtotal: 6400 },
  ],
});

const digitUppercase = (n: number) => {
  const fraction = ['角', '分'];
  const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const unit = [
    ['元', '万', '亿'],
    ['', '拾', '佰', '仟'],
  ];
  let num = Math.abs(n || 0);
  let s = '';
  fraction.forEach((item, index) => {
    s += (digit[Math.floor(num * 10 * Math.pow(10, index)) % 10] + item).replace(/零./, '');
  });
  s = s || '整';
  num = Math.floor(num);
  for (let i = 0; i < unit[0].length && num > 0; i++) {
    let p = '';
    for (let j = 0; j < unit[1].length && num > 0; j++) {
      p = digit[num % 10] + unit[1][j] + p;
      num = Math.floor(num / 10);
    }
    s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
  }
  return s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整');
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

  const pages = getCurrentPages();
  const curPage = pages[pages.length - 1];
  const query = (curPage as any)?.options || {};
  if (query.orderId) orderId.value = query.orderId;

  fetchOrderDetail();
});

const fetchOrderDetail = async () => {
  try {
    order.value = await financeApi.getOrderById(orderId.value);
  } catch (e: any) {
    console.warn('[orders/detail] 获取详情失败:', e);
    uni.showToast({ title: e?.message || '获取订单详情失败', icon: 'none' });
  }
};

const handleGoBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: '/package-finance/orders/index' });
  }
};

const handleVoidOrder = () => {
  uni.showModal({
    title: '作废提醒',
    content: `确定要将订单【${order.value.orderNo}】作废吗？作废后不可恢复。`,
    confirmColor: '#EF4444',
    success: async (res) => {
      if (res.confirm) {
        try {
          await financeApi.voidOrder(order.value.id);
          order.value.status = 'voided';
          order.value.statusText = '已作废';
          uni.showToast({ title: '订单已作废', icon: 'none' });
        } catch (e: any) {
          uni.showToast({ title: e?.message || '作废订单失败', icon: 'none' });
        }
      }
    },
  });
};

const handlePrintReceipt = () => {
  uni.showModal({
    title: '电子凭据存证',
    content: '电子收据已自动生成，支持保存为图片或通过微信直接发送给家长！',
    showCancel: false,
    confirmText: '确定',
  });
};
</script>

<style scoped>
.order-detail-page {
  min-height: 100vh;
  background-color: #F3F4F6;
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

/* 状态横幅 */
.status-banner {
  padding: 28rpx 36rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.banner-paid {
  background: #10B981;
  color: #FFFFFF;
}

.banner-pending {
  background: #F59E0B;
  color: #FFFFFF;
}

.banner-refunded,
.banner-voided {
  background: #6B7280;
  color: #FFFFFF;
}

.banner-icon-circle {
  width: 72rpx;
  height: 72rpx;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-emoji {
  font-size: 40rpx;
  font-weight: 700;
}

.banner-text-box {
  display: flex;
  flex-direction: column;
}

.banner-main-title {
  font-size: 34rpx;
  font-weight: 700;
}

.banner-sub-text {
  font-size: 24rpx;
  opacity: 0.9;
  margin-top: 4rpx;
}

/* 电子收据卡片 */
.receipt-scroll-view {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}

.receipt-card {
  position: relative;
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 36rpx 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.receipt-top-teeth {
  position: absolute;
  top: -12rpx;
  left: 0;
  right: 0;
  height: 16rpx;
  background-image: radial-gradient(circle at 16rpx 0, transparent 10rpx, #FFFFFF 11rpx);
  background-size: 32rpx 16rpx;
  background-repeat: repeat-x;
}

.void-watermark {
  position: absolute;
  top: 45%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  border: 6rpx solid #DC2626;
  padding: 12rpx 40rpx;
  border-radius: 16rpx;
  opacity: 0.25;
  pointer-events: none;
  z-index: 10;
}

.void-watermark-text {
  font-size: 44rpx;
  font-weight: 900;
  color: #DC2626;
  letter-spacing: 8rpx;
}

.receipt-header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24rpx;
}

.school-name {
  font-size: 34rpx;
  font-weight: 800;
  color: #111827;
}

.school-campus {
  font-size: 24rpx;
  color: #6B7280;
  margin-top: 6rpx;
}

.seal-stamp {
  position: absolute;
  right: 0;
  top: 0;
  width: 140rpx;
  height: 140rpx;
  border: 4rpx solid #EF4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(-15deg);
  opacity: 0.7;
}

.seal-inner {
  font-size: 20rpx;
  color: #EF4444;
  font-weight: 700;
}

.receipt-section-block {
  margin: 16rpx 0;
}

.block-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #374151;
  margin-bottom: 12rpx;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.info-row {
  display: flex;
  font-size: 26rpx;
}

.lbl {
  color: #6B7280;
  width: 160rpx;
}

.val {
  color: #111827;
  flex: 1;
}

.font-bold {
  font-weight: 700;
}

.dashed-divider {
  border-top: 2rpx dashed #E5E7EB;
  margin: 20rpx 0;
}

/* 明细表 */
.items-table {
  width: 100%;
}

.table-head {
  display: flex;
  font-size: 22rpx;
  color: #9CA3AF;
  padding-bottom: 8rpx;
}

.table-row {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #374151;
  padding: 8rpx 0;
}

.th-name, .td-name { flex: 2; }
.th-qty, .td-qty { flex: 0.8; text-align: center; }
.th-price, .td-price { flex: 1; text-align: right; }
.th-subtotal, .td-subtotal { flex: 1.2; text-align: right; font-weight: 600; }

/* 费用汇总 */
.fee-line {
  display: flex;
  justify-content: space-between;
  font-size: 26rpx;
  color: #4B5563;
  margin-top: 8rpx;
}

.text-red {
  color: #EF4444;
}

.paid-highlight-line {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #F3F4F6;
}

.paid-lbl {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.paid-val {
  font-size: 40rpx;
  font-weight: 800;
  color: #2563EB;
}

.capital-rmb-line {
  margin-top: 10rpx;
  background: #FEF3C7;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
}

.capital-lbl {
  font-size: 22rpx;
  color: #92400E;
  font-weight: 600;
}

.capital-val {
  font-size: 24rpx;
  color: #B45309;
  font-weight: 700;
}

.meta-small-line {
  font-size: 22rpx;
  color: #9CA3AF;
}

/* 底部动作 */
.detail-actions-row {
  display: flex;
  gap: 20rpx;
  margin-top: 40rpx;
}

.void-btn {
  flex: 1;
  background: #FEE2E2;
  color: #DC2626;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: 9999rpx;
  font-size: 28rpx;
  font-weight: 700;
  cursor: pointer;
  border: 1rpx solid rgba(220, 38, 38, 0.15);
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.18s ease;
  will-change: transform;

  &:active {
    transform: scale(0.94);
    background: #FECACA;
  }
}

.share-btn {
  flex: 2;
  background: #2F54EB;
  color: #FFFFFF;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: 9999rpx;
  font-size: 28rpx;
  font-weight: 700;
  box-shadow: 0 6rpx 18rpx rgba(47, 84, 235, 0.35);
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.18s ease;
  will-change: transform;

  &:active {
    transform: scale(0.94);
    opacity: 0.9;
  }
}

.safe-padding-bottom {
  height: calc(60rpx + constant(safe-area-inset-bottom));
  height: calc(60rpx + env(safe-area-inset-bottom));
}
</style>
