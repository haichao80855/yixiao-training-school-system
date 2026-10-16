<template>
  <view class="mp-chart-container" :style="{ height: containerHeight }">
    <!-- 1. 折线趋势图 (Line) -->
    <view
      v-if="type === 'line'"
      class="line-chart-wrapper"
      @touchstart="handleTouch"
      @touchmove="handleTouch"
      @touchend="handleTouchEnd"
    >
      <image class="chart-svg-img" :src="lineResult.svgDataUri" mode="scaleToFill" />

      <!-- 动态手势交互 Crosshair 辅助线与 Floating Tooltip 浮层 -->
      <view v-if="activePoint" class="interactive-overlay">
        <view class="crosshair-line" :style="{ left: activePoint.x + 'px' }" />
        <view
          class="floating-tooltip"
          :style="{ left: tooltipX + 'px', top: Math.max(10, activePoint.y - 48) + 'px' }"
        >
          <text class="tooltip-label">{{ activePoint.label }}</text>
          <text class="tooltip-val">{{ activePoint.value }} {{ unit }}</text>
        </view>
      </view>

      <!-- Y 轴刻度标注 (右侧或左侧) -->
      <view class="y-ticks-column">
        <text class="tick-label top-tick">{{ lineResult.max }}</text>
        <text class="tick-label mid-tick">{{ Math.round((lineResult.max + lineResult.min) / 2) }}</text>
        <text class="tick-label btm-tick">{{ lineResult.min }}</text>
      </view>
    </view>

    <!-- 2. 环形占比图 (Donut) -->
    <view v-else-if="type === 'donut'" class="donut-chart-wrapper">
      <view class="donut-visual-box">
        <image class="donut-svg-img" :src="donutResult.svgDataUri" mode="aspectFit" />
        <view class="donut-center-info">
          <text class="center-title">{{ centerTitle || '总额' }}</text>
          <text class="center-val">{{ displayCenterValue }}</text>
        </view>
      </view>
      <view class="donut-legend-list" v-if="showLegend">
        <view class="legend-row" v-for="slice in donutResult.slices" :key="slice.label">
          <view class="legend-color-dot" :style="{ backgroundColor: slice.color }" />
          <text class="legend-name">{{ slice.label }}</text>
          <text class="legend-pct">{{ slice.formattedPercent }}</text>
          <text class="legend-val">¥{{ Number(slice.value).toLocaleString() }}</text>
        </view>
      </view>
    </view>

    <!-- 3. 招生转化漏斗图 (Funnel) -->
    <view v-else-if="type === 'funnel'" class="funnel-chart-wrapper">
      <view class="funnel-step-row" v-for="step in funnelResult.steps" :key="step.step">
        <view class="step-label-col">
          <text class="step-name">{{ step.step }}</text>
          <text class="step-val">{{ step.value }} 人</text>
        </view>
        <view class="step-bar-col">
          <view
            class="step-bar-inner"
            :style="{ width: step.widthPct + '%', backgroundColor: step.color }"
          />
        </view>
        <view class="step-rate-col">
          <text class="rate-badge">{{ step.conversionRate }}</text>
        </view>
      </view>
    </view>

    <!-- 4. 柱状图 (Bar) -->
    <view v-else-if="type === 'bar'" class="bar-chart-wrapper">
      <view class="bar-columns-row">
        <view class="bar-col-item" v-for="bar in barResult.items" :key="bar.label">
          <text class="bar-val-text">{{ bar.value }}</text>
          <view class="bar-pillar-wrap">
            <view
              class="bar-pillar-inner"
              :style="{ height: bar.heightPct + '%', backgroundColor: bar.color }"
            />
          </view>
          <text class="bar-label-text">{{ bar.label }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  transformLineSeries,
  transformDonutSlices,
  transformFunnelSteps,
  transformBarSeries,
  LinePoint,
} from '../utils/chart';

const props = withDefaults(
  defineProps<{
    type?: 'line' | 'donut' | 'funnel' | 'bar';
    data?: any[];
    height?: string;
    unit?: string;
    centerTitle?: string;
    centerValue?: string;
    color?: string;
    fillColor?: string;
    showLegend?: boolean;
  }>(),
  {
    type: 'line',
    data: () => [],
    height: '340rpx',
    unit: '',
    centerTitle: '',
    centerValue: '',
    color: '#2F54EB',
    fillColor: 'rgba(47, 84, 235, 0.12)',
    showLegend: true,
  }
);

const containerHeight = computed(() => props.height);

const lineResult = computed(() => {
  if (props.type !== 'line') {
    return {
      points: [],
      pathD: '',
      areaPathD: '',
      yAxisTicks: [],
      min: 0,
      max: 100,
      svgDataUri: '',
    };
  }
  return transformLineSeries(props.data, {
    color: props.color,
    fillColor: props.fillColor,
  });
});

const donutResult = computed(() => {
  if (props.type !== 'donut') return { slices: [], total: 0, svgDataUri: '' };
  return transformDonutSlices(props.data);
});

const funnelResult = computed(() => {
  if (props.type !== 'funnel') return { steps: [], maxVal: 0 };
  return transformFunnelSteps(props.data);
});

const barResult = computed(() => {
  if (props.type !== 'bar') return { items: [], maxVal: 0 };
  return transformBarSeries(props.data);
});

const displayCenterValue = computed(() => {
  if (props.centerValue) return props.centerValue;
  if (donutResult.value.total <= 0) return '0.00';
  return Number(donutResult.value.total).toLocaleString();
});

// 手势交互悬浮 Tooltip 状态
const activePoint = ref<LinePoint | null>(null);
const tooltipX = computed(() => {
  if (!activePoint.value) return 0;
  return Math.max(10, Math.min(260, activePoint.value.x - 45));
});

function handleTouch(e: any) {
  if (!lineResult.value.points || lineResult.value.points.length === 0) return;
  const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!touch) return;
  const clientX = touch.clientX ?? touch.x ?? 0;

  let nearest = lineResult.value.points[0];
  let minDiff = Infinity;
  for (const pt of lineResult.value.points) {
    const diff = Math.abs(pt.x - clientX);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = pt;
    }
  }
  activePoint.value = nearest;
}

let timer: any = null;
function handleTouchEnd() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    activePoint.value = null;
  }, 1800);
}
</script>

<style lang="scss" scoped>
.mp-chart-container {
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

.line-chart-wrapper {
  width: 100%;
  height: 100%;
  position: relative;

  .chart-svg-img {
    width: 100%;
    height: 100%;
  }

  .interactive-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;

    .crosshair-line {
      position: absolute;
      top: 16rpx;
      bottom: 24rpx;
      width: 2rpx;
      background-color: #2F54EB;
      opacity: 0.6;
    }

    .floating-tooltip {
      position: absolute;
      background: rgba(17, 24, 39, 0.88);
      border-radius: 12rpx;
      padding: 8rpx 16rpx;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
      z-index: 10;

      .tooltip-label {
        font-size: 20rpx;
        color: #9CA3AF;
      }
      .tooltip-val {
        font-size: 24rpx;
        color: #FFFFFF;
        font-weight: 700;
      }
    }
  }

  .y-ticks-column {
    position: absolute;
    right: 8rpx;
    top: 0;
    bottom: 24rpx;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    pointer-events: none;

    .tick-label {
      font-size: 18rpx;
      color: #9CA3AF;
      text-align: right;
    }
  }
}

.donut-chart-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 16rpx;
  height: 100%;

  .donut-visual-box {
    position: relative;
    width: 210rpx;
    height: 210rpx;
    flex-shrink: 0;

    .donut-svg-img {
      width: 100%;
      height: 100%;
    }

    .donut-center-info {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      .center-title {
        font-size: 20rpx;
        color: #6B7280;
      }
      .center-val {
        font-size: 24rpx;
        font-weight: 700;
        color: #111827;
      }
    }
  }

  .donut-legend-list {
    flex: 1;
    margin-left: 28rpx;

    .legend-row {
      display: flex;
      align-items: center;
      margin-bottom: 12rpx;
      font-size: 22rpx;

      &:last-child {
        margin-bottom: 0;
      }

      .legend-color-dot {
        width: 14rpx;
        height: 14rpx;
        border-radius: 4rpx;
        margin-right: 12rpx;
        flex-shrink: 0;
      }
      .legend-name {
        flex: 1;
        color: #374151;
      }
      .legend-pct {
        color: #6B7280;
        margin-right: 16rpx;
      }
      .legend-val {
        color: #111827;
        font-weight: 600;
      }
    }
  }
}

.funnel-chart-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 12rpx 0;

  .funnel-step-row {
    display: flex;
    align-items: center;

    .step-label-col {
      width: 140rpx;
      display: flex;
      flex-direction: column;

      .step-name {
        font-size: 22rpx;
        color: #4B5563;
      }
      .step-val {
        font-size: 22rpx;
        font-weight: 600;
        color: #111827;
      }
    }

    .step-bar-col {
      flex: 1;
      height: 28rpx;
      background: #F3F4F6;
      border-radius: 14rpx;
      overflow: hidden;
      margin: 0 16rpx;

      .step-bar-inner {
        height: 100%;
        border-radius: 14rpx;
        transition: width 0.35s cubic-bezier(0.05, 0.7, 0.1, 1);
        will-change: width;
      }
    }

    .step-rate-col {
      width: 100rpx;
      text-align: right;

      .rate-badge {
        font-size: 20rpx;
        color: #2F54EB;
        background: #EEF2FF;
        padding: 4rpx 12rpx;
        border-radius: 9999rpx;
        font-weight: 700;
        border: 1rpx solid rgba(47, 84, 235, 0.15);
      }
    }
  }
}

.bar-chart-wrapper {
  width: 100%;
  height: 100%;
  padding-top: 20rpx;

  .bar-columns-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 100%;

    .bar-col-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 60rpx;
      height: 100%;

      .bar-val-text {
        font-size: 20rpx;
        color: #475569;
        margin-bottom: 8rpx;
        font-weight: 600;
      }

      .bar-pillar-wrap {
        flex: 1;
        width: 24rpx;
        background: #F1F5F9;
        border-radius: 12rpx;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        overflow: hidden;

        .bar-pillar-inner {
          width: 100%;
          border-radius: 12rpx;
          transition: height 0.35s cubic-bezier(0.05, 0.7, 0.1, 1);
          will-change: height;
        }
      }

      .bar-label-text {
        font-size: 20rpx;
        color: #64748B;
        margin-top: 8rpx;
        font-weight: 500;
      }
    }
  }
}
</style>
