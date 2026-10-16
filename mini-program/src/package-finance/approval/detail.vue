<template>
  <view class="approval-detail-page">
    <!-- 顶部状态栏与自定义导航 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-left" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="nav-title">审批详情</text>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 顶部状态大横幅 -->
    <view class="status-banner" :class="'banner-' + detail.status">
      <view class="banner-icon-box">
        <text class="banner-emoji">{{ getStatusEmoji(detail.status) }}</text>
      </view>
      <view class="banner-text-group">
        <text class="banner-title">{{ detail.statusText }}</text>
        <text class="banner-sub">单号: {{ detail.approvalNo }}</text>
      </view>
    </view>

    <scroll-view class="detail-scroll-view" scroll-y>
      <!-- 1. 业务单据核心信息卡片 -->
      <view class="detail-section-card">
        <view class="card-title-line">
          <text class="section-title">申请内容</text>
          <view class="biz-badge">{{ detail.businessTypeText }}</view>
        </view>

        <view class="detail-grid">
          <view class="detail-item">
            <text class="lbl">学员姓名：</text>
            <text class="val font-bold">{{ detail.studentName }}</text>
          </view>
          <view class="detail-item">
            <text class="lbl">关联合同课程：</text>
            <text class="val">{{ detail.courseName }}</text>
          </view>
          <view class="detail-item" v-if="detail.amount > 0">
            <text class="lbl">{{ detail.businessType === 'refund' ? '退款核准总额：' : '申请特批总额：' }}</text>
            <text class="val amount-red">¥{{ detail.amount.toFixed(2) }}</text>
          </view>
          <view class="detail-item" v-if="detail.refundLessons">
            <text class="lbl">冲减课时：</text>
            <text class="val">{{ detail.refundLessons }} 课次</text>
          </view>
          <view class="detail-item">
            <text class="lbl">经办发起人：</text>
            <text class="val">{{ detail.applicantName }} ({{ detail.applicantRole }})</text>
          </view>
          <view class="detail-item">
            <text class="lbl">申请发起时间：</text>
            <text class="val">{{ detail.createdAtText }}</text>
          </view>
          <view class="detail-item full-width-item">
            <text class="lbl">申请详细理由：</text>
            <text class="val text-dark">{{ detail.reason }}</text>
          </view>
        </view>

        <!-- 退款银行账户（仅退费类型展示） -->
        <view class="bank-account-box" v-if="detail.businessType === 'refund' && detail.accountNo">
          <view class="bank-title">退款结算账户</view>
          <view class="bank-info-line">账户姓名：{{ detail.accountName }}</view>
          <view class="bank-info-line">银行卡号：{{ detail.accountNo }}</view>
          <view class="bank-info-line">开户银行：{{ detail.bankName }}</view>
        </view>
      </view>

      <!-- 2. 垂直审批流转时间线 (Timeline) -->
      <view class="detail-section-card">
        <view class="section-title">审批流转时间线</view>
        <view class="timeline-container">
          <view
            class="timeline-node"
            v-for="(node, idx) in detail.timeline"
            :key="node.nodeId"
            :class="{ last: idx === detail.timeline.length - 1 }"
          >
            <!-- 左侧轴线与状态圆点 -->
            <view class="timeline-axis">
              <view
                class="timeline-dot"
                :class="'dot-' + node.status"
              >
                <text v-if="node.status === 'approved'">✓</text>
                <text v-else-if="node.status === 'rejected'">✕</text>
                <text v-else>⏱</text>
              </view>
              <view class="timeline-line" v-if="idx < detail.timeline.length - 1"></view>
            </view>

            <!-- 右侧节点详细内容 -->
            <view class="timeline-content">
              <view class="node-title-row">
                <text class="node-name">{{ node.nodeName }}</text>
                <text class="node-status-text" :class="'text-' + node.status">
                  {{ node.statusText }}
                </text>
              </view>
              <view class="approver-info">
                {{ node.approverName }} ({{ node.approverRole }})
              </view>
              <view class="node-time" v-if="node.actionTimeText">
                {{ node.actionTimeText }}
              </view>
              <view class="node-comment-bubble" v-if="node.comment">
                <text class="quote">“</text>
                <text class="comment-text">{{ node.comment }}</text>
                <text class="quote">”</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="bottom-safe-space"></view>
    </scroll-view>

    <!-- 3. 底部审批动作栏 (待审批时高亮呈现) -->
    <view class="fixed-audit-bar" v-if="detail.status === 'pending'">
      <view class="audit-btn-reject" @click="handleRejectAction">
        驳回申请
      </view>
      <view class="audit-btn-approve" @click="handleApproveAction">
        同意签批
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { financeApi, ApprovalDetailModel } from '../../api/finance';

const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

const approvalId = ref('appr-01');

const detail = ref<ApprovalDetailModel>({
  id: 'appr-01',
  approvalNo: 'APPR-20261015-001',
  businessType: 'refund',
  businessTypeText: '退费审批',
  status: 'pending',
  statusText: '待我审批',
  currentStep: 2,
  totalSteps: 2,
  applicantName: '冯老师',
  applicantRole: '教务顾问',
  campusId: 'campus-bj-hq',
  campusName: '总部校区',
  createdAtText: '2026-10-15 10:30',
  studentName: '郑扶摇',
  courseName: '启蒙英语',
  amount: 3200,
  reason: '学员家庭因工作变动搬家迁往外地，无法继续参加线下课程。',
  currentNodeName: '等待【校长】终审',
  accountName: '郑** (学员母亲)',
  accountNo: '622202******8899',
  bankName: '招商银行北京分行',
  remainingLessons: 50,
  refundLessons: 50,
  serviceFee: 0,
  timeline: [],
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
  } catch (err) {
    console.warn('获取胶囊尺寸或状态栏异常:', err);
  }

  const pages = getCurrentPages();
  const curPage = pages[pages.length - 1];
  const query = (curPage as any)?.options || {};
  if (query.approvalId) approvalId.value = query.approvalId;

  fetchDetail();
});

const fetchDetail = async () => {
  try {
    detail.value = await financeApi.getApprovalDetail(approvalId.value);
  } catch (e: any) {
    console.warn('[approval/detail] 获取审批详情异常:', e);
    uni.showToast({ title: e?.message || '获取审批详情失败', icon: 'none' });
  }
};

const getStatusEmoji = (status: string) => {
  if (status === 'approved') return '✓';
  if (status === 'rejected') return '✕';
  return '⏱';
};

const handleGoBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: '/package-finance/approval/index' });
  }
};

const handleApproveAction = () => {
  uni.showModal({
    title: '终审签批通过',
    editable: true,
    placeholderText: '请输入审批通过批注 (选填)',
    confirmText: '确认签批',
    success: async (res) => {
      if (res.confirm) {
        try {
          await financeApi.auditApproval(detail.value.id, {
            action: 'pass',
            comment: res.content || '校长核准，同意退费出账。',
          });

          detail.value.status = 'approved';
          detail.value.statusText = '已通过';
          detail.value.timeline.push({
            nodeId: `node-done-${Date.now()}`,
            nodeName: '校长终审签批',
            approverName: '李校长',
            approverRole: '校区负责人',
            status: 'approved',
            statusText: '已批准',
            actionTimeText: '刚刚',
            comment: res.content || '校长核准，同意退费出账。',
          });
          uni.showToast({ title: '已成功签批通过！', icon: 'success' });
        } catch (e: any) {
          uni.showToast({ title: e?.message || '签批通过处理失败', icon: 'none' });
        }
      }
    },
  });
};

const handleRejectAction = () => {
  uni.showModal({
    title: '终审驳回',
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
          await financeApi.auditApproval(detail.value.id, {
            action: 'reject',
            comment: res.content.trim(),
          });

          detail.value.status = 'rejected';
          detail.value.statusText = '已驳回';
          detail.value.timeline.push({
            nodeId: `node-rej-${Date.now()}`,
            nodeName: '校长终审签批',
            approverName: '李校长',
            approverRole: '校区负责人',
            status: 'rejected',
            statusText: '已驳回',
            actionTimeText: '刚刚',
            comment: res.content.trim(),
          });
          uni.showToast({ title: '已驳回审批单', icon: 'none' });
        } catch (e: any) {
          uni.showToast({ title: e?.message || '审批驳回处理失败', icon: 'none' });
        }
      }
    },
  });
};
</script>

<style scoped>
.approval-detail-page {
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

/* 横幅 */
.status-banner {
  padding: 28rpx 36rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.banner-pending {
  background: #F59E0B;
  color: #FFFFFF;
}

.banner-approved {
  background: #10B981;
  color: #FFFFFF;
}

.banner-rejected {
  background: #EF4444;
  color: #FFFFFF;
}

.banner-icon-box {
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

.banner-text-group {
  display: flex;
  flex-direction: column;
}

.banner-title {
  font-size: 34rpx;
  font-weight: 700;
}

.banner-sub {
  font-size: 24rpx;
  opacity: 0.9;
  margin-top: 4rpx;
}

/* 卡片流 */
.detail-scroll-view {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}

.detail-section-card {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
  margin-bottom: 24rpx;
}

.card-title-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid #F8FAFC;
  padding-bottom: 16rpx;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.biz-badge {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 6rpx;
  font-weight: 500;
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.detail-item {
  display: flex;
  font-size: 26rpx;
}

.lbl {
  color: #6B7280;
  width: 200rpx;
}

.val {
  color: #374151;
  flex: 1;
}

.font-bold {
  font-weight: 700;
  color: #111827;
}

.amount-red {
  color: #EF4444;
  font-size: 32rpx;
  font-weight: 800;
}

.full-width-item {
  flex-direction: column;
  gap: 6rpx;
}

.text-dark {
  color: #1F2937;
  line-height: 1.5;
}

.bank-account-box {
  background: #F8FAFC;
  border-radius: 12rpx;
  padding: 18rpx 20rpx;
  margin-top: 20rpx;
}

.bank-title {
  font-size: 24rpx;
  font-weight: 700;
  color: #374151;
  margin-bottom: 8rpx;
}

.bank-info-line {
  font-size: 24rpx;
  color: #6B7280;
  margin-top: 4rpx;
}

/* 时间线 Timeline */
.timeline-container {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
}

.timeline-node {
  display: flex;
  position: relative;
  min-height: 120rpx;
}

.timeline-axis {
  width: 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-dot {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  color: #FFFFFF;
  z-index: 2;
}

.dot-approved {
  background: #10B981;
}

.dot-rejected {
  background: #EF4444;
}

.dot-pending {
  background: #F59E0B;
}

.timeline-line {
  flex: 1;
  width: 4rpx;
  background: #E5E7EB;
  margin-top: 4rpx;
  margin-bottom: 4rpx;
}

.timeline-content {
  flex: 1;
  padding-left: 20rpx;
  padding-bottom: 32rpx;
}

.node-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.node-name {
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
}

.node-status-text {
  font-size: 24rpx;
  font-weight: 600;
}

.text-approved {
  color: #10B981;
}

.text-rejected {
  color: #EF4444;
}

.text-pending {
  color: #F59E0B;
}

.approver-info {
  font-size: 24rpx;
  color: #6B7280;
  margin-top: 6rpx;
}

.node-time {
  font-size: 22rpx;
  color: #9CA3AF;
  margin-top: 4rpx;
}

.node-comment-bubble {
  background: #F9FAFB;
  border-radius: 12rpx;
  padding: 12rpx 16rpx;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #374151;
  line-height: 1.4;
}

.quote {
  color: #9CA3AF;
  font-weight: 700;
}

/* 底部操作固定条 */
.fixed-audit-bar {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 28rpx;
  background: #FFFFFF;
  border-top: 1rpx solid #F3F4F6;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.audit-btn-reject {
  flex: 1;
  background: #FEE2E2;
  color: #EF4444;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.audit-btn-approve {
  flex: 1;
  background: #10B981;
  color: #FFFFFF;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: 600;
  box-shadow: 0 6rpx 16rpx rgba(16, 185, 129, 0.35);
}

.bottom-safe-space {
  height: 100rpx;
}
</style>
