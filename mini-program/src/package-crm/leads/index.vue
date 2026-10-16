<template>
  <GenericSubPage title="CRM中心 · 线索与试听跟进" icon="target">
    <view class="leads-container">
      <!-- 1. 线索管道统计 -->
      <view class="pipeline-summary">
        <view class="stat-cell">
          <text class="value">24</text>
          <text class="title">今日新线索</text>
        </view>
        <view class="stat-cell">
          <text class="value">18</text>
          <text class="title">待跟进</text>
        </view>
        <view class="stat-cell">
          <text class="value">9</text>
          <text class="title">本周试听</text>
        </view>
        <view class="stat-cell">
          <text class="value highlight">42%</text>
          <text class="title">成交转化率</text>
        </view>
      </view>

      <!-- 2. 跟进阶段选项卡 -->
      <view class="stage-tabs">
        <view
          v-for="stage in stageList"
          :key="stage.key"
          class="stage-tab-item"
          :class="{ active: currentStage === stage.key }"
          @click="currentStage = stage.key"
        >
          <text class="stage-text">{{ stage.label }}</text>
          <view class="underline" v-if="currentStage === stage.key"></view>
        </view>
      </view>

      <!-- 3. 搜索与渠道快捷栏 -->
      <view class="filter-section">
        <view class="search-bar">
          <AppIcon name="search" size="32rpx" color="#94A3B8" />
          <input
            class="search-input"
            v-model="keyword"
            placeholder="搜索线索姓名/手机号"
          />
          <view v-if="keyword" class="clear-icon" @click="keyword = ''">
            <AppIcon name="x" size="28rpx" color="#94A3B8" />
          </view>
        </view>
      </view>

      <!-- 4. 线索列表卡片 -->
      <view class="lead-cards-list">
        <view
          v-for="lead in filteredLeads"
          :key="lead.id"
          class="lead-card"
        >
          <view class="lead-top">
            <view class="lead-basic">
              <text class="lead-name">{{ lead.parentName }}</text>
              <text class="lead-relation">({{ lead.studentName }}家长)</text>
              <view class="intent-tag" :class="lead.intent">
                {{ lead.intent }}级意向
              </view>
            </view>
            <text class="source-tag">{{ lead.source }}</text>
          </view>

          <view class="lead-mid">
            <text class="interest-course">意向: {{ lead.targetCourse }}</text>
            <text class="last-comment">最新跟进: {{ lead.lastRemark }}</text>
            <text class="follow-time">更新时间: {{ lead.updatedAt }}</text>
          </view>

          <view class="lead-bottom-actions">
            <button class="lead-btn outline" @click="handleCall(lead.phone)">拨打电话</button>
            <button class="lead-btn outline" @click="handleFollowUp(lead)">写跟进</button>
            <button class="lead-btn primary" @click="handleTrial(lead)">预约试听</button>
          </view>
        </view>
      </view>
    </view>
  </GenericSubPage>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import GenericSubPage from '../../components/GenericSubPage.vue';
import AppIcon from '../../components/AppIcon.vue';

interface LeadItem {
  id: string;
  parentName: string;
  studentName: string;
  phone: string;
  intent: 'S' | 'A' | 'B';
  source: string;
  targetCourse: string;
  lastRemark: string;
  updatedAt: string;
  stage: string;
}

const currentStage = ref('all');
const keyword = ref('');

const stageList = ref([
  { key: 'all', label: '全部' },
  { key: 'new', label: '新线索' },
  { key: 'contacting', label: '跟进中' },
  { key: 'trial', label: '已约试听' },
  { key: 'won', label: '已成交' },
]);

const leads = ref<LeadItem[]>([
  {
    id: 'lead-01',
    parentName: '陈女士',
    studentName: '乐乐(5岁)',
    phone: '13811223344',
    intent: 'S',
    source: '门店到访',
    targetCourse: '少儿体适能初级班',
    lastRemark: '对周六上午时段意向强烈，已预约周末试听课',
    updatedAt: '10-15 15:10',
    stage: 'trial'
  },
  {
    id: 'lead-02',
    parentName: '刘先生',
    studentName: '天天(8岁)',
    phone: '13988776655',
    intent: 'A',
    source: '抖音广告',
    targetCourse: '少儿机器人编程',
    lastRemark: '电话沟通意向较好，已加微信发送机构介绍资料',
    updatedAt: '10-15 13:40',
    stage: 'contacting'
  },
  {
    id: 'lead-03',
    parentName: '赵妈妈',
    studentName: '萱萱(6岁)',
    phone: '13655443322',
    intent: 'S',
    source: '学员转介绍',
    targetCourse: '中国舞考级基础班',
    lastRemark: '老学员张涵妈妈转介绍，准备直接到校开单',
    updatedAt: '10-15 10:25',
    stage: 'new'
  }
]);

const filteredLeads = computed(() => {
  return leads.value.filter(item => {
    const matchStage = currentStage.value === 'all' || item.stage === currentStage.value;
    const matchKeyword = !keyword.value || 
      item.parentName.includes(keyword.value) || 
      item.studentName.includes(keyword.value) || 
      item.phone.includes(keyword.value);
    return matchStage && matchKeyword;
  });
});

const handleCall = (phone: string) => {
  uni.makePhoneCall({
    phoneNumber: phone,
    fail: () => {
      uni.showToast({ title: `呼叫号码: ${phone}`, icon: 'none' });
    }
  });
};

const handleFollowUp = (lead: LeadItem) => {
  uni.showToast({ title: `登记跟进: ${lead.studentName}`, icon: 'none' });
};

const handleTrial = (lead: LeadItem) => {
  uni.showToast({ title: `预约试听: ${lead.studentName}`, icon: 'success' });
};
</script>

<style lang="scss" scoped>
.leads-container {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.pipeline-summary {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx 16rpx;
  display: flex;
  justify-content: space-around;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  .stat-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    .value {
      font-size: 34rpx;
      font-weight: 700;
      color: #1F2937;
      &.highlight { color: #52C41A; }
    }
    .title {
      font-size: 22rpx;
      color: #6B7280;
      margin-top: 6rpx;
    }
  }
}

.stage-tabs {
  display: flex;
  background: #FFFFFF;
  border-radius: 12rpx;
  padding: 0 16rpx;
  border-bottom: 1rpx solid #E5E7EB;
  .stage-tab-item {
    flex: 1;
    height: 80rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    .stage-text {
      font-size: 26rpx;
      color: #6B7280;
    }
    &.active .stage-text {
      color: #2F54EB;
      font-weight: 600;
    }
    .underline {
      position: absolute;
      bottom: 0;
      width: 48rpx;
      height: 4rpx;
      background: #2F54EB;
      border-radius: 2rpx;
    }
  }
}

.filter-section {
  .search-bar {
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
    .clear-icon { font-size: 26rpx; color: #9CA3AF; padding: 8rpx; }
  }
}

.lead-cards-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.lead-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.04);
  .lead-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .lead-basic {
      display: flex;
      align-items: center;
      gap: 10rpx;
      .lead-name { font-size: 30rpx; font-weight: 700; color: #111827; }
      .lead-relation { font-size: 22rpx; color: #6B7280; }
      .intent-tag {
        font-size: 20rpx;
        padding: 2rpx 10rpx;
        border-radius: 6rpx;
        &.S { background: #FFF1F0; color: #F5222D; font-weight: 600; }
        &.A { background: #FFF7E6; color: #FA8C16; }
        &.B { background: #E6F7FF; color: #1890FF; }
      }
    }
    .source-tag {
      font-size: 20rpx;
      color: #6B7280;
      background: #F3F4F6;
      padding: 4rpx 12rpx;
      border-radius: 6rpx;
    }
  }
  .lead-mid {
    margin: 16rpx 0;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    .interest-course { font-size: 26rpx; color: #2F54EB; font-weight: 500; }
    .last-comment { font-size: 24rpx; color: #374151; line-height: 1.4; }
    .follow-time { font-size: 20rpx; color: #9CA3AF; }
  }
  .lead-bottom-actions {
    display: flex;
    justify-content: flex-end;
    gap: 16rpx;
    border-top: 1rpx solid #F3F4F6;
    padding-top: 16rpx;
    .lead-btn {
      margin: 0;
      font-size: 24rpx;
      padding: 8rpx 24rpx;
      border-radius: 28rpx;
      line-height: 1.6;
      &.outline { background: #F3F4F6; color: #374151; }
      &.primary { background: #2F54EB; color: #FFFFFF; }
    }
  }
}
</style>
