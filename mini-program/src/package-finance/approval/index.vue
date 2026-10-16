<template>
  <view class="approval-page-container">
    <!-- 顶部状态栏与自定义导航 -->
    <view class="custom-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-inner">
        <view class="left-nav" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="page-title">审批中心</text>
          <view class="campus-selector" @click.stop="handleSwitchCampus">
            <text class="campus-name">{{ campusStore.currentCampusName }}</text>
            <text class="arrow">▼</text>
          </view>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 顶层业务类型三大 Tab (对齐截图 035: 退费审批 | 收款审批 | 异动审批) -->
    <view class="business-type-tabs">
      <view
        class="biz-tab"
        :class="{ active: currentBizType === 'refund' }"
        @click="switchBizType('refund')"
      >
        <text class="tab-label">退费审批</text>
        <view class="tab-indicator" v-if="currentBizType === 'refund'"></view>
      </view>
      <view
        class="biz-tab"
        :class="{ active: currentBizType === 'receipt' }"
        @click="switchBizType('receipt')"
      >
        <text class="tab-label">收款审批</text>
        <view class="tab-indicator" v-if="currentBizType === 'receipt'"></view>
      </view>
      <view
        class="biz-tab"
        :class="{ active: currentBizType === 'transfer' }"
        @click="switchBizType('transfer')"
      >
        <text class="tab-label">异动审批</text>
        <view class="tab-indicator" v-if="currentBizType === 'transfer'"></view>
      </view>
    </view>

    <!-- 2. 二级状态胶囊分栏 (待我审批 | 我发起的 | 已处理) -->
    <view class="sub-status-bar">
      <view
        class="status-pill"
        :class="{ active: currentStatus === 'pending' }"
        @click="switchStatus('pending')"
      >
        待我审批
      </view>
      <view
        class="status-pill"
        :class="{ active: currentStatus === 'my' }"
        @click="switchStatus('my')"
      >
        我发起的
      </view>
      <view
        class="status-pill"
        :class="{ active: currentStatus === 'approved' }"
        @click="switchStatus('approved')"
      >
        已处理
      </view>
    </view>

    <!-- 3. 审批单卡片列表 -->
    <scroll-view class="approvals-scroll-body" scroll-y>
      <view v-if="approvalList.length > 0" class="cards-flow">
        <view
          class="approval-card"
          v-for="item in approvalList"
          :key="item.id"
          @click="handleCardClick(item)"
        >
          <!-- 头部: 编号与状态 -->
          <view class="card-head-line">
            <view class="head-left">
              <text class="type-icon">{{ getBizIcon(item.businessType) }}</text>
              <text class="no-text">{{ item.approvalNo }}</text>
            </view>
            <view class="status-pill-badge" :class="'badge-' + item.status">
              {{ item.statusText }}
            </view>
          </view>

          <!-- 申请人信息 -->
          <view class="applicant-row">
            <text class="applicant-text">申请人：{{ item.applicantName }} ({{ item.applicantRole }})</text>
            <text class="apply-time">{{ item.createdAtText }}</text>
          </view>

          <!-- 主体内容 -->
          <view class="approval-main-box">
            <view class="stu-course-row">
              <text class="stu-name-large">{{ item.studentName }}</text>
              <view class="course-name-tag">{{ item.courseName }}</view>
            </view>

            <view class="amount-row" v-if="item.amount > 0">
              <text class="amount-label">{{ item.businessType === 'refund' ? '申请退费金额：' : '申请特批金额：' }}</text>
              <text class="amount-val">¥{{ item.amount }}</text>
            </view>

            <view class="reason-box">
              <text class="reason-label">理由说明：</text>
              <text class="reason-content">{{ item.reason }}</text>
            </view>
          </view>

          <!-- 当前审批进度提示 -->
          <view class="progress-node-bar">
            <text class="progress-dot">●</text>
            <text class="node-name-text">{{ item.currentNodeName }}</text>
          </view>

          <!-- 底部审核动作栏 (仅在待审批时展示同意/驳回) -->
          <view class="card-actions-footer" @click.stop>
            <view class="view-detail-link" @click="handleCardClick(item)">
              查看审批链 ›
            </view>
            <view class="buttons-group" v-if="item.status === 'pending'">
              <view class="action-btn-reject" @click="handleReject(item)">驳回</view>
              <view class="action-btn-approve" @click="handleApprove(item)">同意</view>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-else class="empty-state-box">
        <text class="empty-emoji">📝</text>
        <text class="empty-text">当前暂无此状态的审批单</text>
      </view>

      <view class="bottom-safe-space"></view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useCampusStore } from '../../stores/campusStore';
import { financeApi, ApprovalItemModel } from '../../api/finance';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

const currentBizType = ref<'refund' | 'receipt' | 'transfer'>('refund');
const currentStatus = ref<'pending' | 'my' | 'approved'>('pending');
const approvalList = ref<ApprovalItemModel[]>([]);

const handleCampusChanged = () => {
  fetchApprovals();
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
    console.warn('获取胶囊尺寸或状态栏异常:', err);
  }

  const pages = getCurrentPages();
  const curPage = pages[pages.length - 1];
  const query = (curPage as any)?.options || {};

  // 支持外部携带 type=receipt 或 refund 传参
  if (query.type === 'receipt') {
    currentBizType.value = 'receipt';
  } else if (query.type === 'transfer') {
    currentBizType.value = 'transfer';
  } else {
    currentBizType.value = 'refund';
  }

  fetchApprovals();

  uni.$on('campus-changed', handleCampusChanged);
});

onUnmounted(() => {
  uni.$off('campus-changed', handleCampusChanged);
});

const fetchApprovals = async () => {
  try {
    const res = await financeApi.getApprovals({
      businessType: currentBizType.value,
      status: currentStatus.value === 'approved' ? 'approved' : 'pending',
    });
    approvalList.value = res.list;
  } catch (e: any) {
    console.warn('[approval/index] 获取审批列表异常:', e);
    uni.showToast({ title: e?.message || '获取审批列表失败', icon: 'none' });
  }
};

const switchBizType = (type: 'refund' | 'receipt' | 'transfer') => {
  currentBizType.value = type;
  fetchApprovals();
};

const switchStatus = (status: 'pending' | 'my' | 'approved') => {
  currentStatus.value = status;
  fetchApprovals();
};

const getBizIcon = (type: string) => {
  if (type === 'refund') return '💸';
  if (type === 'receipt') return '💰';
  return '🔄';
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
        fetchApprovals();
      }
    },
  });
};

const handleCardClick = (item: ApprovalItemModel) => {
  uni.navigateTo({
    url: `/package-finance/approval/detail?approvalId=${item.id}&approvalNo=${item.approvalNo}`,
  });
};

const handleApprove = (item: ApprovalItemModel) => {
  uni.showModal({
    title: '审批通过确认',
    editable: true,
    placeholderText: '请输入审批通过批注 (选填)',
    confirmText: '确认同意',
    success: async (res) => {
      if (res.confirm) {
        try {
          await financeApi.auditApproval(item.id, {
            action: 'pass',
            comment: res.content || '审核无误，同意签批。',
          });

          item.status = 'approved';
          item.statusText = '已通过';
          item.currentNodeName = '审批已签批通过';
          uni.showToast({ title: '已审核通过', icon: 'success' });
        } catch (e: any) {
          uni.showToast({ title: e?.message || '审核通过处理失败', icon: 'none' });
        }
      }
    },
  });
};

const handleReject = (item: ApprovalItemModel) => {
  uni.showModal({
    title: '审批驳回',
    editable: true,
    placeholderText: '请输入驳回原因 (必填)',
    confirmText: '确认驳回',
    confirmColor: '#EF4444',
    success: async (res) => {
      if (res.confirm) {
        if (!res.content || !res.content.trim()) {
          uni.showToast({ title: '驳回原因必须填写', icon: 'none' });
          return;
        }
        try {
          await financeApi.auditApproval(item.id, {
            action: 'reject',
            comment: res.content.trim(),
          });

          item.status = 'rejected';
          item.statusText = '已驳回';
          item.currentNodeName = '已被驳回并退回';
          uni.showToast({ title: '审批已驳回', icon: 'none' });
        } catch (e: any) {
          uni.showToast({ title: e?.message || '审批驳回处理失败', icon: 'none' });
        }
      }
    },
  });
};
</script>

<style scoped>
.approval-page-container {
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

/* 业务三大 Tab */
.business-type-tabs {
  display: flex;
  background: #FFFFFF;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #F3F4F6;
}

.biz-tab {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 24rpx 0;
}

.tab-label {
  font-size: 30rpx;
  font-weight: 500;
  color: #6B7280;
}

.biz-tab.active .tab-label {
  font-weight: 700;
  color: #2F6BF4;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  width: 56rpx;
  height: 6rpx;
  background: #2F6BF4;
  border-radius: 4rpx;
}

/* 状态胶囊栏 */
.sub-status-bar {
  display: flex;
  gap: 16rpx;
  background: #FFFFFF;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #F3F4F6;
}

.status-pill {
  font-size: 24rpx;
  padding: 8rpx 26rpx;
  border-radius: 24rpx;
  background: #F3F4F6;
  color: #4B5563;
}

.status-pill.active {
  background: #EFF6FF;
  color: #2563EB;
  font-weight: 600;
}

/* 列表流 */
.approvals-scroll-body {
  flex: 1;
  padding: 20rpx 24rpx;
  box-sizing: border-box;
}

.cards-flow {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.approval-card {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.card-head-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #F8FAFC;
  padding-bottom: 14rpx;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.type-icon {
  font-size: 28rpx;
}

.no-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
}

.status-pill-badge {
  font-size: 22rpx;
  padding: 2rpx 14rpx;
  border-radius: 6rpx;
  font-weight: 600;
}

.badge-pending {
  background: #FEF3C7;
  color: #D97706;
}

.badge-approved {
  background: #E8F7ED;
  color: #10B981;
}

.badge-rejected {
  background: #FEE2E2;
  color: #EF4444;
}

.applicant-row {
  display: flex;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: #9CA3AF;
}

.approval-main-box {
  padding: 16rpx 0;
}

.stu-course-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.stu-name-large {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

.course-name-tag {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.amount-row {
  display: flex;
  align-items: baseline;
  margin-top: 12rpx;
}

.amount-label {
  font-size: 26rpx;
  color: #4B5563;
}

.amount-val {
  font-size: 36rpx;
  font-weight: 800;
  color: #EF4444;
}

.reason-box {
  background: #F9FAFB;
  border-radius: 12rpx;
  padding: 14rpx 18rpx;
  margin-top: 14rpx;
  font-size: 24rpx;
}

.reason-label {
  color: #6B7280;
  font-weight: 600;
}

.reason-content {
  color: #374151;
}

.progress-node-bar {
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: #EFF6FF;
  border-radius: 8rpx;
  padding: 8rpx 16rpx;
  margin-top: 10rpx;
}

.progress-dot {
  font-size: 16rpx;
  color: #2563EB;
}

.node-name-text {
  font-size: 24rpx;
  color: #1E40AF;
  font-weight: 500;
}

.card-actions-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1rpx solid #F8FAFC;
  padding-top: 16rpx;
  margin-top: 14rpx;
}

.view-detail-link {
  font-size: 24rpx;
  color: #2563EB;
  font-weight: 500;
}

.buttons-group {
  display: flex;
  gap: 16rpx;
}

.action-btn-reject {
  background: #FEE2E2;
  color: #EF4444;
  font-size: 24rpx;
  font-weight: 600;
  padding: 10rpx 32rpx;
  border-radius: 24rpx;
}

.action-btn-approve {
  background: #10B981;
  color: #FFFFFF;
  font-size: 24rpx;
  font-weight: 600;
  padding: 10rpx 32rpx;
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

.bottom-safe-space {
  height: 80rpx;
}
</style>
