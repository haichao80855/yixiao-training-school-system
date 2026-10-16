<template>
  <view class="metric-card">
    <view class="card-header">
      <view class="title-left">
        <text class="metric-title">{{ title }}</text>
        <text class="help-icon" v-if="helpText" @click="handleHelp">❓</text>
      </view>
      <slot name="header-right">
        <view class="filters-group" v-if="period">
          <view class="filter-dropdown" @click="handlePeriodClick">
            <text class="filter-text">{{ period }}</text>
            <text class="arrow">▼</text>
          </view>
        </view>
      </slot>
    </view>

    <!-- 主指标大字呈现 -->
    <view class="big-metric-value" v-if="value !== undefined && value !== null">
      {{ formattedValue }}
      <text class="metric-unit-text" v-if="unit">{{ unit }}</text>
    </view>

    <!-- 三联/四联子卡片矩阵 -->
    <view class="sub-cards-row" v-if="subCards && subCards.length > 0">
      <view
        class="sub-card"
        :class="sub.type ? `${sub.type}-card` : 'default-sub-card'"
        v-for="(sub, idx) in subCards"
        :key="idx"
      >
        <view class="card-texts">
          <text class="sub-label">{{ sub.label }}</text>
          <text class="sub-value">{{ sub.value }}</text>
        </view>
        <text class="sub-icon" v-if="sub.icon">{{ sub.icon }}</text>
      </view>
    </view>

    <!-- 内容插槽 (图表、漏斗、表格等) -->
    <slot></slot>

    <!-- 底部总结信息栏 -->
    <slot name="footer">
      <view class="card-footer-info" v-if="footerLabel">
        <text class="footer-label">{{ footerLabel }}</text>
        <text class="footer-val">{{ footerValue }}</text>
      </view>
    </slot>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface SubCardItem {
  label: string;
  value: string | number;
  icon?: string;
  type?: 'regular' | 'expand' | 'other' | 'wallet' | 'warning' | string;
}

const props = withDefaults(
  defineProps<{
    title: string;
    helpText?: string;
    value?: string | number;
    unit?: string;
    period?: string;
    periodOptions?: string[];
    subCards?: SubCardItem[];
    footerLabel?: string;
    footerValue?: string | number;
  }>(),
  {
    helpText: '',
    value: '',
    unit: '',
    period: '',
    periodOptions: () => ['10月', '今日', '本周', '本月', '上月', '本年'],
    subCards: () => [],
    footerLabel: '',
    footerValue: '',
  }
);

const emit = defineEmits<{
  (e: 'help-click', text: string): void;
  (e: 'period-change', period: string): void;
}>();

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return Number.isInteger(props.value) ? props.value.toString() : props.value.toFixed(2);
  }
  return props.value;
});

function handleHelp() {
  if (props.helpText) {
    uni.showModal({
      title: props.title,
      content: props.helpText,
      showCancel: false,
      confirmText: '我知道了',
      confirmColor: '#2F54EB',
    });
  }
  emit('help-click', props.helpText || props.title);
}

function handlePeriodClick() {
  if (props.periodOptions && props.periodOptions.length > 0) {
    uni.showActionSheet({
      itemList: props.periodOptions,
      success: (res) => {
        const selected = props.periodOptions[res.tapIndex];
        emit('period-change', selected);
      },
    });
  }
}
</script>

<style lang="scss" scoped>
.metric-card {
  margin: 20rpx 24rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .title-left {
      display: flex;
      align-items: center;
      gap: 8rpx;

      .metric-title {
        font-size: 30rpx;
        font-weight: 700;
        color: #111827;
      }

      .help-icon {
        font-size: 26rpx;
        color: #9CA3AF;
        cursor: pointer;
      }
    }

    .filters-group {
      display: flex;
      align-items: center;
      gap: 12rpx;

      .filter-dropdown {
        display: flex;
        align-items: center;
        gap: 6rpx;
        background: #F3F4F6;
        padding: 6rpx 16rpx;
        border-radius: 12rpx;

        .filter-text {
          font-size: 22rpx;
          color: #4B5563;
        }

        .arrow {
          font-size: 16rpx;
          color: #9CA3AF;
        }
      }
    }
  }

  .big-metric-value {
    font-size: 52rpx;
    font-weight: 900;
    color: #111827;
    margin-bottom: 24rpx;
    letter-spacing: -1rpx;

    .metric-unit-text {
      font-size: 24rpx;
      font-weight: 500;
      color: #6B7280;
      margin-left: 8rpx;
    }
  }

  .sub-cards-row {
    display: flex;
    gap: 16rpx;
    margin-bottom: 24rpx;

    .sub-card {
      flex: 1;
      padding: 16rpx 20rpx;
      border-radius: 16rpx;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .card-texts {
        display: flex;
        flex-direction: column;

        .sub-label {
          font-size: 20rpx;
          color: #6B7280;
          margin-bottom: 4rpx;
        }

        .sub-value {
          font-size: 28rpx;
          font-weight: 700;
          color: #111827;
        }
      }

      .sub-icon {
        font-size: 32rpx;
      }

      &.regular-card {
        background: #F0F5FF;
      }

      &.expand-card {
        background: #FFF7E6;
      }

      &.other-card {
        background: #F6FFED;
      }

      &.wallet-card {
        background: #FFF0F6;
      }

      &.warning-card {
        background: #FFF1F0;
      }

      &.default-sub-card {
        background: #F8FAFC;
      }
    }
  }

  .card-footer-info {
    margin-top: 20rpx;
    padding-top: 16rpx;
    border-top: 1rpx solid #F3F4F6;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .footer-label {
      font-size: 22rpx;
      color: #6B7280;
    }

    .footer-val {
      font-size: 24rpx;
      font-weight: 700;
      color: #2F54EB;
    }
  }
}
</style>
