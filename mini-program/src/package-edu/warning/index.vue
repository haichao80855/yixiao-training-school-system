<template>
  <GenericSubPage title="学员预警 · 课消与流失监控" icon="⚡">
    <view class="warning-dashboard">
      <!-- 1. 预警指标看板 -->
      <view class="metrics-row">
        <view class="metric-card urgent">
          <text class="num">{{ metrics.urgent }}</text>
          <text class="label">紧急预警</text>
        </view>
        <view class="metric-card warning">
          <text class="num">{{ metrics.warning }}</text>
          <text class="label">重点关注</text>
        </view>
        <view class="metric-card info">
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
            @click="currentCategory = cat.key"
          >
            <text class="tab-name">{{ cat.label }}</text>
            <text class="tab-badge" v-if="cat.count > 0">{{ cat.count }}</text>
          </view>
        </view>
      </scroll-view>

      <!-- 3. 搜索栏 -->
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="searchKeyword"
          placeholder="搜索预警学员姓名/手机号"
          placeholder-class="ph"
        />
        <text v-if="searchKeyword" class="clear-btn" @click="searchKeyword = ''">✕</text>
      </view>

      <!-- 4. 预警卡片列表 -->
      <view class="warning-list">
        <view
          v-for="item in filteredList"
          :key="item.id"
          class="warning-card"
          :class="item.level"
        >
          <view class="card-header">
            <view class="student-info">
              <text class="student-name">{{ item.studentName }}</text>
              <text class="grade-tag">{{ item.grade }} · {{ item.courseName }}</text>
            </view>
            <view class="level-badge" :class="item.level">
              {{ item.level === 'urgent' ? '紧急预警' : '重点关注' }}
            </view>
          </view>

          <view class="card-body">
            <text class="reason-desc">{{ item.reason }}</text>
            <view class="detail-row">
              <text class="campus-text">校区: {{ item.campusName }}</text>
              <text class="date-text">更新时间: {{ item.updatedAt }}</text>
            </view>
          </view>

          <view class="card-actions">
            <button class="action-btn secondary" @click="handleAction(item, 'contact')">家校沟通</button>
            <button class="action-btn primary" @click="handleAction(item, 'resolve')">立即处理</button>
          </view>
        </view>
      </view>
    </view>
  </GenericSubPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import GenericSubPage from '../../components/GenericSubPage.vue';
import { studentApi } from '../../api/student';

interface WarningItem {
  id: string;
  studentName: string;
  grade: string;
  courseName: string;
  level: 'urgent' | 'warning';
  reason: string;
  campusName: string;
  updatedAt: string;
  type: string;
}

const currentCategory = ref('all');
const searchKeyword = ref('');

const metrics = ref({
  urgent: 12,
  warning: 28,
  pending: 15,
});

const categories = ref([
  { key: 'all', label: '全部', count: 55 },
  { key: 'pending_class', label: '待入班', count: 15 },
  { key: 'lessons_low', label: '剩余课次', count: 18 },
  { key: 'contract_expiring', label: '即将到期', count: 9 },
  { key: 'absence', label: '连续缺勤', count: 7 },
  { key: 'dormant', label: '沉睡学员', count: 6 },
]);

const warningList = ref<WarningItem[]>([
  {
    id: 'w-1',
    studentName: '李思聪',
    grade: '初二',
    courseName: '初中数学培优',
    level: 'urgent',
    reason: '正课剩余课次不足 2 次，近 14 天未安排新课续费',
    campusName: '中关村校区',
    updatedAt: '10-15 14:30',
    type: 'lessons_low'
  },
  {
    id: 'w-2',
    studentName: '王梓涵',
    grade: '小五',
    courseName: '少儿硬笔书法',
    level: 'urgent',
    reason: '已缴费完成 7 天，当前处于待入班资产池未安排班级',
    campusName: '国贸校区',
    updatedAt: '10-15 11:20',
    type: 'pending_class'
  },
  {
    id: 'w-3',
    studentName: '张美玲',
    grade: '初三',
    courseName: '中考物理满分班',
    level: 'warning',
    reason: '连续请假 2 次，需发起教务补课调度或学管回访',
    campusName: '中关村校区',
    updatedAt: '10-14 17:00',
    type: 'absence'
  }
]);

onMounted(async () => {
  try {
    const res = await studentApi.getWarningRoster();
    if (res && res.statistics) {
      metrics.value.urgent = res.statistics.criticalCount ?? metrics.value.urgent;
      metrics.value.warning = res.statistics.warningCount ?? metrics.value.warning;
      if (res.statistics.dormantCount !== undefined) {
        categories.value = categories.value.map((c) => {
          if (c.key === 'dormant') return { ...c, count: res.statistics.dormantCount };
          if (c.key === 'lessons_low') return { ...c, count: res.statistics.criticalCount };
          if (c.key === 'contract_expiring') return { ...c, count: res.statistics.warningCount };
          return c;
        });
      }
      if (Array.isArray(res.list) && res.list.length > 0) {
        const liveItems: WarningItem[] = res.list.map((item: any, idx: number) => ({
          id: item.studentId || `w-live-${idx}`,
          studentName: item.studentName || '学员',
          grade: '在读',
          courseName: '常规课程',
          level: (item.consumptionHealth?.warningLevel === 'critical' || item.decision?.advice === 'URGENT_RENEWAL') ? 'urgent' : 'warning',
          reason: item.consumptionHealth?.warningLevel === 'critical'
            ? `剩余课次仅剩 ${item.assetSummary?.totalRemainingLessons || 0} 节，消课风险极高`
            : `耗尽预测还有 ${item.consumptionHealth?.estimatedDepletionDays || 30} 天，建议及时跟进续费`,
          campusName: item.campusName || '总部校区',
          updatedAt: item.consumptionHealth?.lastAttendanceDate || '今日',
          type: item.consumptionHealth?.dormantRisk === 'dormant_warning' ? 'dormant' : 'lessons_low',
        }));
        warningList.value = [...liveItems, ...warningList.value];
      }
    }
  } catch (e) {
    console.warn('[warning] 加载预警大盘失败，保留本地预警:', e);
  }
});

const filteredList = computed(() => {
  return warningList.value.filter(item => {
    const matchCategory = currentCategory.value === 'all' || item.type === currentCategory.value;
    const matchKeyword = !searchKeyword.value || item.studentName.includes(searchKeyword.value);
    return matchCategory && matchKeyword;
  });
});

const handleAction = (item: WarningItem, action: string) => {
  if (action === 'contact') {
    uni.showToast({ title: `发起沟通: ${item.studentName}`, icon: 'none' });
  } else {
    uni.showToast({ title: `处理预警: ${item.studentName}`, icon: 'success' });
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
  .metric-card {
    flex: 1;
    background: #FFFFFF;
    border-radius: 16rpx;
    padding: 24rpx 16rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
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
.warning-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.04);
  border-left: 6rpx solid #FA8C16;
  &.urgent { border-left-color: #F5222D; }
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
</style>
