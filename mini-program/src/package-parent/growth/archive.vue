<template>
  <ParentPage title="历史档案" :show-back="true">
    <PSegmented :model-value="type" :options="TYPE_OPTIONS" @update:model-value="setType" />

    <view v-if="loading && months.length === 0" class="sk-grid" />
    <ErrorState v-else-if="loadError && months.length === 0" :message="loadError" @retry="load(true)" />
    <EmptyState
      v-else-if="months.length === 0"
      :icon="type === 'photo' ? 'image' : 'video'"
      :title="type === 'photo' ? '没有历史照片' : '没有历史视频'"
      description="孩子以前的课堂照片和视频会按月份整理在这里"
    />

    <view v-else class="months">
      <view v-for="m in months" :key="m.month" class="month">
        <view class="month-head">
          <text class="month-title">{{ monthText(m.month) }}</text>
          <text class="month-meta">{{ m.dayCount }} 天 · {{ m.items.length }} {{ type === 'photo' ? '张' : '段' }}</text>
        </view>

        <view v-if="type === 'photo'" class="photo-grid">
          <view role="button" tabindex="0" v-for="(p, idx) in m.items" :key="p.id" class="cell" @click="preview(m, idx)">
            <image class="photo" :src="mediaUrl(p.thumbUrl)" mode="aspectFill" lazy-load />
          </view>
        </view>

        <view v-else class="video-grid">
          <view role="button" tabindex="0" v-for="v in m.items" :key="v.id" class="video-cell" @click="playVideo(v.url)">
            <!-- 横屏和竖屏视频混排，完整显示画面，避免裁掉孩子 -->
            <image class="video-cover" :src="mediaUrl(v.thumbUrl)" mode="aspectFit" lazy-load />
            <view class="play">
              <AppIcon name="play-circle" size="56rpx" :color="P_COLORS.white" />
            </view>
            <text class="video-date">{{ formatDateCn(v.date) }}</text>
          </view>
        </view>
      </view>

      <view class="list-footer">
        <text v-if="loadingMore">加载中…</text>
        <text v-else-if="moreError" role="button" tabindex="0" class="load-more" @click="load(false)">加载失败，点这里重试</text>
        <text v-else-if="!nextCursor">· 已经到底了 ·</text>
        <!-- 内容不满一屏时页面无法滚动，触底加载不会触发，保留手动入口 -->
        <text role="button" tabindex="0" v-else class="load-more" @click="load(false)">查看更早的{{ type === 'photo' ? '照片' : '视频' }}</text>
      </view>
    </view>

    <!-- #ifdef H5 -->
    <VideoOverlay :url="playingUrl" @close="playingUrl = ''" />
    <!-- #endif -->
  </ParentPage>
</template>

<script setup lang="ts">
import { P_COLORS } from '../styles/colors';
import { ref, watch } from 'vue';
import { onLoad, onReachBottom } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import EmptyState from '../components/EmptyState.vue';
import PSegmented from '../components/PSegmented.vue';
import ErrorState from '../components/ErrorState.vue';
import { describeLoadError } from '../utils/loadError';
import VideoOverlay from '../components/VideoOverlay.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, mediaUrl, type ArchiveMonth } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { formatDateCn, formatMonthCn } from '../utils/format';

const parentStore = useParentStore();
const type = ref<'photo' | 'video'>('photo');
const TYPE_OPTIONS: Array<{ value: 'photo' | 'video'; label: string }> = [
  { value: 'photo', label: '照片' },
  { value: 'video', label: '视频' },
];
const months = ref<ArchiveMonth[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
const playingUrl = ref('');

const loadError = ref('');
const moreError = ref(false);

async function load(reset = true) {
  const sid = parentStore.currentStudentId;
  if (!sid) return;
  if (reset) {
    loading.value = true;
  } else {
    if (!nextCursor.value || loadingMore.value) return;
    loadingMore.value = true;
  }
  const requestedType = type.value;
  loadError.value = '';
  moreError.value = false;
  try {
    const res = await parentApi.archive(sid, { cursor: reset ? null : nextCursor.value, type: requestedType });
    if (sid !== parentStore.currentStudentId || requestedType !== type.value) return;
    months.value = reset ? res.months : [...months.value, ...res.months];
    nextCursor.value = res.nextCursor;
  } catch (err) {
    if (reset) {
      months.value = [];
      loadError.value = describeLoadError(err);
    } else {
      moreError.value = true;
    }
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function setType(value: 'photo' | 'video') {
  if (type.value === value) return;
  type.value = value;
  months.value = [];
  nextCursor.value = null;
  load(true);
}

function monthText(month: string) {
  return formatMonthCn(month);
}

function preview(month: ArchiveMonth, index: number) {
  const urls = month.items.map((p) => mediaUrl(p.url));
  uni.previewImage({ urls, current: urls[index] });
}

function playVideo(url: string) {
  // #ifdef MP-WEIXIN
  uni.previewMedia({ sources: [{ url: mediaUrl(url), type: 'video' }] });
  // #endif
  // #ifdef H5
  playingUrl.value = mediaUrl(url);
  // #endif
}

onLoad(() => load(true));
watch(() => parentStore.currentStudentId, () => {
  months.value = [];
  nextCursor.value = null;
  load(true);
});
onReachBottom(() => load(false));
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.months {
  display: flex;
  flex-direction: column;
  gap: 48rpx;
}

.month-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.month-title {
  @include p-section-title; // 分区标题统一样式

}

.month-meta {
  font-size: p-fs($p-fs-caption);
  color: $p-ink-3;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 216rpx;
  gap: 8rpx;
  border-radius: $p-r-inner;
  overflow: hidden;
}

.cell {
  background: $p-fill-soft;
  overflow: hidden;
}

.photo {
  width: 100%;
  height: 100%;
  display: block;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
}

.video-cell {
  position: relative;
  height: 280rpx;
  border-radius: $p-r-inner;
  overflow: hidden;
  background: linear-gradient(135deg, $p-ink-dark, $p-ink);
}

.video-cover {
  width: 100%;
  height: 100%;
  display: block;
}

.play {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
}

.video-date {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24rpx 16rpx 10rpx;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
  color: $p-surface;
  font-size: p-fs($p-fs-caption);
}

.list-footer {
  @include p-list-footer;
}

.load-more {
  display: inline-block;
  padding: 16rpx 32rpx;
  font-size: p-fs($p-fs-body);
  color: $p-brand;
  letter-spacing: 0;
}

.sk-grid {
  @include p-skeleton;
  height: 640rpx;
  border-radius: $p-r-inner;
}
</style>
