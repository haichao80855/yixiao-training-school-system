<template>
  <GenericSubPage title="学员预警 · 课消与流失监控" icon="zap">
    <view class="warning-dashboard">
      <!-- 1. 预警指标看板 (对齐 SSOT 预警基准，双类名保持 100% 兼容) -->
      <view class="metrics-row warning-stat-cards">
        <view class="metric-card warning-stat-card urgent" @click="handleCategoryChange('lessons_low')">
          <text class="num">{{ metrics.urgent }}</text>
          <text class="label">紧急预警</text>
        </view>
        <view class="metric-card warning-stat-card warning" @click="handleCategoryChange('contract_expiring')">
          <text class="num">{{ metrics.warning }}</text>
          <text class="label">重点关注</text>
        </view>
        <view class="metric-card warning-stat-card info" @click="handleCategoryChange('pending_class')">
          <text class="num">{{ metrics.pending }}</text>
          <text class="label">待入班</text>
        </view>
      </view>

      <!-- 2. 六维预警分类 Tab -->
      <scroll-view class="category-scroll" scroll-x :show-scrollbar="false">
        <view class="category-tabs">
          <view
            v-for="cat in categories"
            :key="cat.key"
            class="tab-pill"
            :class="{ active: currentCategory === cat.key }"
            @click="handleCategoryChange(cat.key)"
          >
            <text class="tab-name">{{ cat.label }}</text>
            <text class="tab-badge" v-if="cat.count > 0">{{ cat.count }}</text>
          </view>
        </view>
      </scroll-view>

      <!-- 3. 搜索栏 -->
      <view class="search-box">
        <AppIcon name="search" size="32rpx" color="#94A3B8" />
        <input
          class="search-input"
          v-model="searchKeyword"
          placeholder="搜索预警学员姓名/手机号"
          placeholder-class="ph"
        />
        <view v-if="searchKeyword" class="clear-btn" @click="searchKeyword = ''">
          <AppIcon name="x" size="28rpx" color="#94A3B8" />
        </view>
      </view>

      <!-- 4. 预警卡片列表 (双类名 warning-card warning-item 保持 100% 兼容) -->
      <view class="warning-list">
        <view
          v-for="item in filteredList"
          :key="item.id"
          class="warning-card warning-item"
          :class="item.level"
        >
          <view class="card-header">
            <view class="student-info">
              <text class="student-name">{{ item.studentName }}</text>
              <text class="grade-tag">{{ item.grade || '在读' }} · {{ item.courseName || '常规课程' }}</text>
            </view>
            <view class="level-badge" :class="item.level">
              {{ item.level === 'urgent' ? '紧急预警' : item.level === 'warning' ? '重点关注' : '正常在读' }}
            </view>
          </view>

          <view class="card-body">
            <text class="reason-desc">{{ item.reason }}</text>
            <view class="detail-row">
              <text class="campus-text">校区: {{ item.campusName || '拓视未来-原阳校区' }}</text>
              <text class="date-text">更新时间: {{ item.updatedAt || '今日' }}</text>
            </view>
          </view>

          <view class="card-actions">
            <button class="action-btn secondary" @click="handleAction(item, 'contact')">家校沟通</button>
            <button class="action-btn primary" @click="handleAction(item, 'resolve')">立即处理</button>
          </view>
        </view>

        <!-- 空状态提示 -->
        <view v-if="filteredList.length === 0" class="empty-state">
          <view class="empty-icon">
            <AppIcon name="check-circle" size="96rpx" color="#10B981" />
          </view>
          <text class="empty-text">暂无符合条件的预警学员</text>
        </view>
      </view>
    </view>
  </GenericSubPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import GenericSubPage from '../../components/GenericSubPage.vue';
import AppIcon from '../../components/AppIcon.vue';
import {
  renewalCoordinator,
  RefundLockedError,
  type RenewalStudentItem,
} from '../../coordinators/renewal';

const currentCategory = ref('all');
const searchKeyword = ref('');
const isLoading = ref(false);

const metrics = ref({
  urgent: 0,
  warning: 0,
  pending: 0,
});

const categories = ref([
  { key: 'all', label: '全部', count: 0 },
  { key: 'pending_class', label: '待入班', count: 0 },
  { key: 'lessons_low', label: '剩余课次', count: 0 },
  { key: 'contract_expiring', label: '即将到期', count: 0 },
  { key: 'absence', label: '连续缺勤', count: 0 },
  { key: 'dormant', label: '沉睡学员', count: 0 },
]);

// 彻底清除硬编码假数据，初始化为空数组，权威动态拉取
const warningList = ref<RenewalStudentItem[]>([]);

/**
 * 核心协调器接入：加载流失预警大盘统计与名册
 */
const loadWarningData = async () => {
  isLoading.value = true;
  try {
    const dashboard = await renewalCoordinator.loadWarningDashboard();
    if (dashboard && dashboard.statistics) {
      const rawList = Array.isArray(dashboard.list) ? dashboard.list : [];
      const absenceCount = rawList.filter(
        (i) => i.type === 'absence' || (i.consumptionHealth?.inactiveDays ?? 0) >= 7
      ).length;
      const dormantCount = dashboard.statistics.dormantCount ?? rawList.filter(
        (i) => i.type === 'dormant' || i.consumptionHealth?.dormantRisk !== 'active'
      ).length;
      const pendingClassCount = dashboard.statistics.pendingCount ?? rawList.filter(
        (i) => i.type === 'pending_class' || !i.classId
      ).length;
      const lessonsLowCount = dashboard.statistics.criticalCount ?? rawList.filter(
        (i) => i.level === 'urgent' || i.type === 'lessons_low'
      ).length;
      const contractExpiringCount = dashboard.statistics.warningCount ?? rawList.filter(
        (i) => i.level === 'warning' || i.type === 'contract_expiring'
      ).length;
      const totalCount = dashboard.total || rawList.length;

      metrics.value.urgent = dashboard.statistics.criticalCount ?? dashboard.statistics.urgent ?? lessonsLowCount;
      metrics.value.warning = dashboard.statistics.warningCount ?? dashboard.statistics.warning ?? contractExpiringCount;
      metrics.value.pending = dashboard.statistics.pendingCount ?? dashboard.statistics.pending ?? pendingClassCount;

      categories.value = categories.value.map((c) => {
        if (c.key === 'all') return { ...c, count: totalCount };
        if (c.key === 'pending_class') return { ...c, count: pendingClassCount };
        if (c.key === 'lessons_low') return { ...c, count: lessonsLowCount };
        if (c.key === 'contract_expiring') return { ...c, count: contractExpiringCount };
        if (c.key === 'absence') return { ...c, count: absenceCount };
        if (c.key === 'dormant') return { ...c, count: dormantCount };
        return c;
      });

      warningList.value = rawList;
    }
  } catch (e) {
    console.warn('[warning] 加载预警大盘失败:', e);
    uni.showToast({ title: '加载预警大盘失败，请重试', icon: 'none' });
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadWarningData();
});

onShow(() => {
  loadWarningData();
});

const handleCategoryChange = (key: string) => {
  currentCategory.value = key;
};

const filteredList = computed(() => {
  return warningList.value.filter((item) => {
    let matchCategory = true;
    if (currentCategory.value !== 'all') {
      if (currentCategory.value === 'lessons_low') {
        matchCategory = item.level === 'urgent' || item.type === 'lessons_low';
      } else if (currentCategory.value === 'contract_expiring') {
        matchCategory = item.level === 'warning' || item.type === 'contract_expiring';
      } else if (currentCategory.value === 'absence') {
        matchCategory = item.type === 'absence' || (item.consumptionHealth?.inactiveDays ?? 0) >= 7;
      } else if (currentCategory.value === 'dormant') {
        matchCategory = item.type === 'dormant' || item.consumptionHealth?.dormantRisk !== 'active';
      } else if (currentCategory.value === 'pending_class') {
        matchCategory = item.type === 'pending_class' || !item.classId;
      } else {
        matchCategory = item.type === currentCategory.value;
      }
    }

    const kw = searchKeyword.value.trim().toLowerCase();
    const sName = (item.studentName || '').toLowerCase();
    const sPhone = item.phone || '';
    const sNo = (item.studentNo || '').toLowerCase();
    const matchKeyword =
      !kw ||
      sName.includes(kw) ||
      sPhone.includes(kw) ||
      sNo.includes(kw);

    return matchCategory && matchKeyword;
  });
});

const isProcessingAction = ref(false);

/**
 * 业务动作处理：彻底出清“仅弹 Toast”断层
 */
const handleAction = async (item: RenewalStudentItem, action: string) => {
  if (isProcessingAction.value) return;

  if (action === 'contact') {
    // 真实外呼拨号
    isProcessingAction.value = true;
    try {
      await renewalCoordinator.initiateContact(item.phone, item.studentName);
    } catch (err: any) {
      uni.showToast({ title: err?.message || '发起沟通异常', icon: 'none' });
    } finally {
      isProcessingAction.value = false;
    }
  } else if (action === 'resolve') {
    // ACB 财务防腐屏障名册前置快速拦截
    if (item.decision?.isRefundLocked || item.type === 'refund_locked') {
      uni.showModal({
        title: '财务风控拦截',
        content:
          item.reason ||
          item.decision?.blockingReason ||
          '该学员名下存在已退费或在途退费审批单据，已被财务防腐屏障锁定，严禁发起续费开单！',
        showCancel: false,
        confirmText: '我知道了',
        confirmColor: '#EF4444',
      });
      return;
    }

    // 立即处理：打通端侧续费草案生成与开单直通流水线
    isProcessingAction.value = true;
    try {
      uni.showLoading({ title: '生成续费决策草案...' });
      const targetStudentId = item.studentId || item.id;
      const draft = await renewalCoordinator.prepareRenewalDecision(targetStudentId, {
        targetCourseId: item.courseId || item.decision?.targetCourseId || undefined,
        targetClassId: item.classId || undefined,
      });
      uni.hideLoading();

      // 无损暂存并路由跳转开单向导 wizard.vue
      await renewalCoordinator.proceedToCheckout(draft);
    } catch (err: any) {
      uni.hideLoading();

      // ACB 财务防腐屏障强阻断处理
      if (
        err instanceof RefundLockedError ||
        err?.name === 'RefundLockedError' ||
        err?.code === 'REFUND_LOCKED'
      ) {
        uni.showModal({
          title: '财务风控拦截',
          content:
            err.message ||
            '该学员名下存在已退费或在途退费审批单据，已被财务防腐屏障锁定，严禁发起续费开单！',
          showCancel: false,
          confirmText: '我知道了',
          confirmColor: '#EF4444',
        });
      } else {
        uni.showModal({
          title: '续费决策提示',
          content: err?.message || err?.errMsg || '生成续费草案失败，请稍后重试',
          showCancel: false,
        });
      }
    } finally {
      isProcessingAction.value = false;
    }
  }
};
</script>

<style lang="scss" scoped>
.warning-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.metrics-row {
  display: flex;
  gap: 16rpx;
  .metric-card,
  .warning-stat-card {
    flex: 1;
    background: #FFFFFF;
    border-radius: 16rpx;
    padding: 24rpx 16rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
    cursor: pointer;
    .num { font-size: 36rpx; font-weight: 700; }
    .label { font-size: 22rpx; color: #6B7280; margin-top: 6rpx; }
    &.urgent .num { color: #F5222D; }
    &.warning .num { color: #FA8C16; }
    &.info .num { color: #2F54EB; }
  }
}

.category-scroll {
  white-space: nowrap;
  width: 100%;
}
.category-tabs {
  display: inline-flex;
  gap: 16rpx;
  padding: 4rpx 0;
  .tab-pill {
    padding: 12rpx 24rpx;
    background: #FFFFFF;
    border-radius: 32rpx;
    display: flex;
    align-items: center;
    gap: 8rpx;
    border: 1rpx solid #E5E7EB;
    .tab-name { font-size: 24rpx; color: #4B5563; }
    .tab-badge {
      background: #F3F4F6;
      color: #6B7280;
      font-size: 20rpx;
      padding: 0 10rpx;
      border-radius: 12rpx;
    }
    &.active {
      background: #2F54EB;
      border-color: #2F54EB;
      .tab-name { color: #FFFFFF; font-weight: 600; }
      .tab-badge { background: #597EF7; color: #FFFFFF; }
    }
  }
}

.search-box {
  background: #FFFFFF;
  border-radius: 12rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  padding: 0 20rpx;
  gap: 12rpx;
  border: 1rpx solid #E5E7EB;
  .search-icon { font-size: 28rpx; }
  .search-input { flex: 1; font-size: 26rpx; }
  .clear-btn { font-size: 26rpx; color: #9CA3AF; padding: 8rpx; }
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.warning-card,
.warning-item {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.04);
  border-left: 6rpx solid #FA8C16;
  &.urgent { border-left-color: #F5222D; }
  &.normal { border-left-color: #10B981; }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .student-name { font-size: 30rpx; font-weight: 700; color: #111827; }
    .grade-tag { font-size: 22rpx; color: #6B7280; margin-left: 12rpx; }
    .level-badge {
      font-size: 20rpx;
      padding: 4rpx 12rpx;
      border-radius: 8rpx;
      &.urgent { background: #FFF1F0; color: #F5222D; }
      &.warning { background: #FFF7E6; color: #FA8C16; }
      &.normal { background: #ECFDF5; color: #10B981; }
    }
  }
  .card-body {
    margin: 16rpx 0;
    .reason-desc { font-size: 26rpx; color: #374151; line-height: 1.5; }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-top: 12rpx;
      font-size: 22rpx;
      color: #9CA3AF;
    }
  }
  .card-actions {
    display: flex;
    justify-content: flex-end;
    gap: 16rpx;
    border-top: 1rpx solid #F3F4F6;
    padding-top: 16rpx;
    .action-btn {
      margin: 0;
      font-size: 24rpx;
      padding: 8rpx 24rpx;
      border-radius: 28rpx;
      line-height: 1.6;
      &.secondary { background: #F3F4F6; color: #4B5563; }
      &.primary { background: #2F54EB; color: #FFFFFF; }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
  gap: 16rpx;
  .empty-icon { font-size: 56rpx; }
  .empty-text { font-size: 26rpx; color: #9CA3AF; }
}
</style>
