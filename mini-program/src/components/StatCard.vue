<template>
  <view class="metric-card">
    <view class="card-header">
      <view class="title-left">
        <text class="metric-title">{{ title }}</text>
        <AppIcon
          name="help-circle"
          size="30rpx"
          color="#94A3B8"
          class="help-icon"
          v-if="helpText"
          @click="handleHelp"
        />
      </view>
      <slot name="header-right">
        <view class="filters-group" v-if="period">
          <view class="filter-dropdown" @click="handlePeriodClick">
            <text class="filter-text">{{ period }}</text>
            <AppIcon name="chevron-down" size="20rpx" color="#2F54EB" />
          </view>
        </view>
      </slot>
    </view>

    <!-- 主指标大字呈现 -->
    <view class="big-metric-value" v-if="value !== undefined && value !== null && value !== ''">
      {{ formattedValue }}
      <text class="metric-unit-text" v-if="unit">{{ unit }}</text>
    </view>

    <!-- 三联/四联子卡片矩阵 -->
    <view
      class="sub-cards-row"
      :class="subCardsLayoutClass"
      v-if="subCards && subCards.length > 0"
    >
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
        <AppIcon
          v-if="sub.icon"
          :name="sub.icon"
          size="36rpx"
          :color="getSubIconColor(sub.type)"
          class="sub-icon"
        />
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
import AppIcon from './AppIcon.vue';

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

const subCardsLayoutClass = computed(() => {
  const len = props.subCards?.length || 0;
  if (len === 1) return 'layout-cols-1';
  if (len === 2) return 'layout-cols-2';
  if (len === 3) return 'layout-cols-3';
  if (len === 4) return 'layout-cols-4-split-2'; // 4个卡片显示为两行，每行2个
  return 'layout-cols-3'; // 默认及超过4个时最多一行3个
});

function getSubIconColor(type?: string): string {
  switch (type) {
    case 'regular':
      return '#2563EB';
    case 'expand':
      return '#0D9488';
    case 'wallet':
      return '#D97706';
    case 'warning':
      return '#DC2626';
    case 'other':
      return '#6366F1';
    default:
      return '#475569';
  }
}

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
  border-radius: 28rpx;
  padding: 28rpx 32rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 4rpx 20rpx rgba(15, 23, 42, 0.03);
  box-sizing: border-box;
  overflow: hidden;
  transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.22s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .title-left {
      display: flex;
      align-items: center;
      gap: 10rpx;

      .metric-title {
        font-size: 30rpx;
        font-weight: 700;
        color: #0F172A;
        letter-spacing: 0.2rpx;
      }

      .help-icon {
        font-size: 26rpx;
        color: #94A3B8;
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

        &:active {
          transform: scale(0.85);
        }
      }
    }

    .filters-group {
      display: flex;
      align-items: center;
      gap: 12rpx;

      .filter-dropdown {
        display: inline-flex;
        align-items: center;
        gap: 6rpx;
        background: #EEF2FF;
        padding: 8rpx 18rpx;
        border-radius: 9999rpx;
        border: 1rpx solid rgba(47, 84, 235, 0.14);
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease;

        &:active {
          transform: scale(0.95);
          background: #DBEAFE;
        }

        .filter-text {
          font-size: 22rpx;
          color: #2F54EB;
          font-weight: 600;
          white-space: nowrap;
        }
      }
    }
  }

  .big-metric-value {
    font-size: 54rpx;
    font-weight: 900;
    color: #0F172A;
    margin-bottom: 24rpx;
    letter-spacing: -1.5rpx;
    line-height: 1.1;

    .metric-unit-text {
      font-size: 24rpx;
      font-weight: 600;
      color: #64748B;
      margin-left: 10rpx;
      letter-spacing: 0;
    }
  }

  .sub-cards-row {
    display: grid;
    gap: 16rpx;
    margin-bottom: 24rpx;
    width: 100%;
    box-sizing: border-box;
    grid-template-columns: repeat(3, 1fr);

    &.layout-cols-1 {
      grid-template-columns: 1fr;
    }

    &.layout-cols-2 {
      grid-template-columns: repeat(2, 1fr);
    }

    &.layout-cols-3 {
      grid-template-columns: repeat(3, 1fr);
    }

    // 4个显示两行，每行2个
    &.layout-cols-4-split-2 {
      grid-template-columns: repeat(2, 1fr);
    }

    .sub-card {
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
      padding: 18rpx 20rpx;
      border-radius: 20rpx;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 1rpx solid rgba(15, 23, 42, 0.05);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      cursor: pointer;
      overflow: hidden;

      &:active {
        transform: scale(0.96);
      }

      .card-texts {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;

        .sub-label {
          font-size: 20rpx;
          color: #64748B;
          margin-bottom: 6rpx;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sub-value {
          font-size: 28rpx;
          font-weight: 700;
          color: #0F172A;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
      }

      .sub-icon {
        flex-shrink: 0;
        margin-left: 10rpx;
        font-size: 32rpx;
        line-height: 1;
      }

      &.regular-card {
        background: #EEF2FF;
        border-color: rgba(47, 84, 235, 0.12);
      }

      &.expand-card {
        background: #FFFBEB;
        border-color: rgba(217, 119, 6, 0.12);
      }

      &.other-card {
        background: #F0FDF4;
        border-color: rgba(22, 163, 74, 0.12);
      }

      &.wallet-card {
        background: #FAF5FF;
        border-color: rgba(147, 51, 234, 0.12);
      }

      &.warning-card {
        background: #FEF2F2;
        border-color: rgba(220, 38, 38, 0.12);
      }

      &.default-sub-card {
        background: #F8FAFC;
        border-color: rgba(15, 23, 42, 0.06);
      }
    }
  }

  .card-footer-info {
    margin-top: 20rpx;
    padding-top: 18rpx;
    border-top: 1rpx solid rgba(15, 23, 42, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-between;

    .footer-label {
      font-size: 22rpx;
      color: #64748B;
      font-weight: 500;
    }

    .footer-val {
      font-size: 24rpx;
      font-weight: 700;
      color: #2F54EB;
    }
  }
}
</style>
