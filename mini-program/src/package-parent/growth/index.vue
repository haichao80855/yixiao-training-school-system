<template>
  <ParentPage title="成长" overline="记录每一次进步" tab="growth">
    <!-- 成长概览 -->
    <view class="stats">
      <view v-for="(s, idx) in stats" :key="s.key" class="stat" :class="'t-' + s.key" :style="enterDelay(idx)">
        <view class="stat-icon">
          <AppIcon :name="s.icon" size="32rpx" :color="s.color" />
        </view>
        <text class="stat-num">{{ s.value }}</text>
        <text class="stat-label">{{ s.label }}</text>
      </view>
    </view>

    <view class="segments">
      <view class="seg-thumb" :class="{ right: type === 'video' }" />
      <view class="segment" :class="{ active: type === 'photo' }" @click="setType('photo')">照片</view>
      <view class="segment" :class="{ active: type === 'video' }" @click="setType('video')">视频</view>
    </view>

    <view v-if="loading && weeks.length === 0" class="sk-week">
      <view class="sk-title" />
      <view class="sk-grid" />
    </view>
    <EmptyState
      v-else-if="weeks.length === 0"
      :icon="type === 'photo' ? 'image' : 'video'"
      :title="type === 'photo' ? '还没有课堂照片' : '还没有课堂视频'"
      description="老师发布课评后，课堂照片和视频会按周整理在这里"
    />

    <view v-else class="weeks">
      <view v-for="(week, wIdx) in weeks" :key="week.weekStart" class="week" :style="enterDelay(wIdx + 2)">
        <view class="week-head">
          <text class="week-range">{{ rangeText(week.weekStart, week.weekEnd) }}</text>
          <text class="week-meta">
            {{ week.lessonCount }} 节课 · {{ type === 'photo' ? week.photos.length + ' 张' : week.videos.length + ' 段' }}
          </text>
        </view>

        <view v-if="type === 'photo'" class="mosaic" :class="{ single: week.photos.length === 1 }">
          <view
            v-for="(p, idx) in week.photos"
            :key="idx"
            class="cell"
            :class="{ big: idx === 0 && week.photos.length >= 3 }"
            @click="previewWeek(week, idx)"
            @longpress="photoActions(p)"
          >
            <image class="photo" :src="mediaUrl(p.thumbUrl)" mode="aspectFill" lazy-load />
            <text v-if="p.isOwn && idx === 0" class="own-badge">{{ childName }}</text>
          </view>
        </view>

        <view v-else class="video-list">
          <view v-for="(v, idx) in week.videos" :key="idx" class="video-row" @click="playVideo(v.url)">
            <view class="video-thumb">
              <view class="play">
                <AppIcon name="play-circle" size="48rpx" color="#FFFFFF" />
              </view>
            </view>
            <view class="video-info">
              <text class="video-title">{{ v.lessonTitle }}</text>
              <text class="video-sub">{{ formatDateCn(v.date) }} · {{ v.isOwn ? `${childName}的视频` : '课堂视频' }}</text>
            </view>
            <AppIcon name="chevron-right" size="26rpx" color="#958F88" />
          </view>
        </view>
      </view>

      <view class="list-footer">
        <text v-if="loadingMore">加载中…</text>
        <text v-else-if="!nextCursor">· 已经到底了 ·</text>
      </view>
    </view>
  </ParentPage>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import EmptyState from '../components/EmptyState.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, mediaUrl, type AlbumWeek, type GrowthSummary } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { formatDateCn } from '../utils/format';
import { enterDelay, useCountUp } from '../utils/visual';

const parentStore = useParentStore();
const summary = ref<GrowthSummary | null>(null);
const weeks = ref<AlbumWeek[]>([]);
const nextCursor = ref<string | null>(null);
const type = ref<'photo' | 'video'>('photo');
const loading = ref(false);
const loadingMore = ref(false);

const childName = computed(() => parentStore.currentChild?.name || '孩子');

const lessons = useCountUp(() => summary.value?.lessonsAttended);
const evaluations = useCountUp(() => summary.value?.evaluations);
const photos = useCountUp(() => summary.value?.photos);
const videos = useCountUp(() => summary.value?.videos);

const stats = computed(() => [
  { key: 'lessons', label: '次上课', value: lessons.value, icon: 'calendar-check', color: '#22935F' },
  { key: 'evals', label: '篇课评', value: evaluations.value, icon: 'message-square', color: '#2F54EB' },
  { key: 'photos', label: '张照片', value: photos.value, icon: 'image', color: '#E0703A' },
  { key: 'videos', label: '段视频', value: videos.value, icon: 'video', color: '#7457E0' },
]);

async function load(reset = true) {
  const sid = parentStore.currentStudentId;
  if (!sid) return;
  if (reset) {
    loading.value = true;
    parentApi
      .growthSummary(sid)
      .then((res) => {
        if (sid === parentStore.currentStudentId) summary.value = res;
      })
      .catch(() => undefined);
  } else {
    if (!nextCursor.value || loadingMore.value) return;
    loadingMore.value = true;
  }
  try {
    const res = await parentApi.album(sid, { cursor: reset ? null : nextCursor.value, type: type.value });
    if (sid !== parentStore.currentStudentId) return;
    weeks.value = reset ? res.weeks : [...weeks.value, ...res.weeks];
    nextCursor.value = res.nextCursor;
  } catch {
    if (reset) weeks.value = [];
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function setType(value: 'photo' | 'video') {
  if (type.value === value) return;
  type.value = value;
  weeks.value = [];
  load(true);
}

function rangeText(start: string, end: string) {
  const fmt = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function previewWeek(week: AlbumWeek, index: number) {
  const urls = week.photos.map((p) => mediaUrl(p.url));
  uni.previewImage({ urls, current: urls[index] });
}

function photoActions(photo: AlbumWeek['photos'][number]) {
  uni.showActionSheet({
    itemList: ['查看这节课的课评'],
    success: () => {
      uni.navigateTo({
        url: `/package-parent/evaluations/detail?sid=${encodeURIComponent(parentStore.currentStudentId)}&eid=${encodeURIComponent(photo.scheduleEventId)}`,
      });
    },
  });
}

function playVideo(url: string) {
  // #ifdef MP-WEIXIN
  uni.previewMedia({ sources: [{ url: mediaUrl(url), type: 'video' }] });
  // #endif
}

onShow(() => load(true));
watch(() => parentStore.currentStudentId, () => load(true));
onReachBottom(() => load(false));
onPullDownRefresh(async () => {
  await load(true);
  uni.stopPullDownRefresh();
});
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  margin-bottom: 40rpx;
}

.stat {
  @include p-enter;
  position: relative;
  padding: 28rpx;
  border-radius: 36rpx;
  overflow: hidden;

  &.t-lessons {
    background: $p-mint-50;
  }

  &.t-evals {
    background: $p-brand-50;
  }

  &.t-photos {
    background: $p-peach-50;
  }

  &.t-videos {
    background: $p-lilac-50;
  }
}

.stat-icon {
  position: absolute;
  right: 24rpx;
  top: 24rpx;
  width: 60rpx;
  height: 60rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-num {
  @include p-num;
  display: block;
  font-size: 60rpx;
  font-weight: 700;
  line-height: 1.1;
}

.stat-label {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: $p-ink-2;
}

.segments {
  position: relative;
  display: flex;
  padding: 6rpx;
  margin-bottom: 36rpx;
  border-radius: 24rpx;
  background: $p-fill;
}

.seg-thumb {
  position: absolute;
  left: 6rpx;
  top: 6rpx;
  bottom: 6rpx;
  width: calc(50% - 6rpx);
  border-radius: 18rpx;
  background: $p-surface;
  box-shadow: 0 2rpx 6rpx rgba(29, 27, 24, 0.08);
  transition: transform 0.3s $p-ease-out;

  &.right {
    transform: translateX(100%);
  }
}

.segment {
  position: relative;
  z-index: 1;
  flex: 1;
  height: 68rpx;
  line-height: 68rpx;
  text-align: center;
  font-size: 26rpx;
  color: $p-ink-2;
  transition: color 0.2s ease;

  &.active {
    color: $p-ink;
    font-weight: 650;
  }
}

.weeks {
  display: flex;
  flex-direction: column;
  gap: 48rpx;
}

.week {
  @include p-enter;
}

.week-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 4rpx 18rpx;
}

.week-range {
  font-size: 30rpx;
  font-weight: 700;
}

.week-meta {
  font-size: 23rpx;
  color: $p-ink-3;
}

.mosaic {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 168rpx;
  gap: 8rpx;
  border-radius: 32rpx;
  overflow: hidden;

  &.single {
    grid-template-columns: 1fr;
    grid-auto-rows: 400rpx;
  }
}

.cell {
  position: relative;
  background: #ECE8E2;
  overflow: hidden;

  &.big {
    grid-column: span 2;
    grid-row: span 2;
  }

  &:active .photo {
    opacity: 0.85;
  }
}

.photo {
  width: 100%;
  height: 100%;
  display: block;
  transition: opacity 0.15s ease;
}

.own-badge {
  position: absolute;
  left: 12rpx;
  top: 12rpx;
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.92);
  color: $p-brand;
  font-size: 20rpx;
  font-weight: 700;
}

.video-list {
  @include p-card;
  padding: 8rpx 24rpx;
}

.video-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid $p-line;

  &:last-child {
    border-bottom: none;
  }
}

.video-thumb {
  width: 176rpx;
  height: 120rpx;
  border-radius: 20rpx;
  background:
    radial-gradient(circle at 80% 20%, rgba(116, 87, 224, 0.5) 0, rgba(116, 87, 224, 0) 55%),
    linear-gradient(135deg, #2B2A33, #1D1B18);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.video-info {
  flex: 1;
  min-width: 0;
}

.video-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
  color: $p-ink-3;
}

.list-footer {
  padding: 8rpx 0;
  text-align: center;
  font-size: 22rpx;
  color: $p-ink-3;
  letter-spacing: 0.1em;
}

.sk-title {
  @include p-skeleton;
  width: 280rpx;
  height: 36rpx;
  border-radius: 18rpx;
  margin-bottom: 20rpx;
}

.sk-grid {
  @include p-skeleton;
  height: 360rpx;
  border-radius: 32rpx;
}
</style>
