<template>
  <ParentPage title="成长" tab="growth">
    <!-- 成长概览 -->
    <view class="summary">
      <view class="stat">
        <text class="num">{{ summary?.lessonsAttended ?? '–' }}</text>
        <text class="label">上课次数</text>
      </view>
      <view class="stat">
        <text class="num">{{ summary?.evaluations ?? '–' }}</text>
        <text class="label">课评</text>
      </view>
      <view class="stat">
        <text class="num">{{ summary?.photos ?? '–' }}</text>
        <text class="label">照片</text>
      </view>
      <view class="stat">
        <text class="num">{{ summary?.videos ?? '–' }}</text>
        <text class="label">视频</text>
      </view>
    </view>

    <view class="segments">
      <view class="segment" :class="{ active: type === 'photo' }" @click="setType('photo')">照片</view>
      <view class="segment" :class="{ active: type === 'video' }" @click="setType('video')">视频</view>
    </view>

    <view v-if="loading && weeks.length === 0" class="hint">加载中…</view>
    <EmptyState
      v-else-if="weeks.length === 0"
      :icon="type === 'photo' ? 'image' : 'video'"
      :title="type === 'photo' ? '还没有课堂照片' : '还没有课堂视频'"
      description="老师发布课评后，课堂照片和视频会按周汇总在这里"
    />

    <view v-else class="weeks">
      <view v-for="week in weeks" :key="week.weekStart" class="week">
        <view class="week-head">
          <text class="week-range">{{ rangeText(week.weekStart, week.weekEnd) }}</text>
          <text class="week-meta">
            {{ week.lessonCount }} 节课 · {{ type === 'photo' ? week.photos.length + ' 张照片' : week.videos.length + ' 个视频' }}
          </text>
        </view>

        <view v-if="type === 'photo'" class="photo-grid">
          <view
            v-for="(p, idx) in week.photos"
            :key="idx"
            class="photo-cell"
            @click="previewWeek(week, idx)"
            @longpress="photoActions(p)"
          >
            <image class="photo" :src="mediaUrl(p.thumbUrl)" mode="aspectFill" lazy-load />
            <view v-if="p.isOwn" class="own-badge">本人</view>
          </view>
        </view>

        <view v-else class="video-list">
          <view v-for="(v, idx) in week.videos" :key="idx" class="video-row" @click="playVideo(v.url)">
            <view class="video-thumb">
              <AppIcon name="play-circle" size="56rpx" color="#FFFFFF" />
            </view>
            <view class="video-info">
              <text class="video-title">{{ v.lessonTitle }}</text>
              <text class="video-sub">{{ formatDateCn(v.date) }} · {{ v.isOwn ? '本人视频' : '课堂视频' }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="list-footer">
        <text v-if="loadingMore">加载中…</text>
        <text v-else-if="!nextCursor">没有更多了</text>
      </view>
    </view>
  </ParentPage>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import EmptyState from '../components/EmptyState.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, mediaUrl, type AlbumWeek, type GrowthSummary } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { formatDateCn } from '../utils/format';

const parentStore = useParentStore();
const summary = ref<GrowthSummary | null>(null);
const weeks = ref<AlbumWeek[]>([]);
const nextCursor = ref<string | null>(null);
const type = ref<'photo' | 'video'>('photo');
const loading = ref(false);
const loadingMore = ref(false);

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
    success: () => openLesson(photo.scheduleEventId),
  });
}

function openLesson(scheduleEventId: string) {
  uni.navigateTo({
    url: `/package-parent/evaluations/detail?sid=${encodeURIComponent(parentStore.currentStudentId)}&eid=${encodeURIComponent(scheduleEventId)}`,
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
.summary {
  display: flex;
  padding: 28rpx 8rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;

  .num {
    font-size: 44rpx;
    font-weight: 700;
    color: #0F172A;
    font-variant-numeric: tabular-nums;
  }

  .label {
    font-size: 24rpx;
    color: #64748B;
  }
}

.segments {
  display: flex;
  gap: 8rpx;
  padding: 6rpx;
  margin-bottom: 24rpx;
  border-radius: 9999rpx;
  background: rgba(15, 23, 42, 0.05);
}

.segment {
  flex: 1;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  border-radius: 9999rpx;
  font-size: 26rpx;
  color: #475569;

  &.active {
    background: #FFFFFF;
    color: #0F172A;
    font-weight: 600;
    box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.08);
  }
}

.hint {
  padding: 80rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #94A3B8;
}

.weeks {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.week-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16rpx;

  .week-range {
    font-size: 30rpx;
    font-weight: 700;
    color: #0F172A;
  }

  .week-meta {
    font-size: 24rpx;
    color: #64748B;
  }
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  border-radius: 20rpx;
  overflow: hidden;
}

.photo-cell {
  position: relative;
  height: 220rpx;
  background: #EFF2F8;

  .photo {
    width: 100%;
    height: 100%;
  }
}

.own-badge {
  position: absolute;
  left: 8rpx;
  top: 8rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: rgba(47, 84, 235, 0.9);
  color: #FFFFFF;
  font-size: 20rpx;
}

.video-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.video-row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 20rpx;
  background: #FFFFFF;
  border-radius: 20rpx;
}

.video-thumb {
  width: 160rpx;
  height: 112rpx;
  border-radius: 12rpx;
  background: #1E293B;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.video-info {
  min-width: 0;

  .video-title {
    display: block;
    font-size: 28rpx;
    font-weight: 600;
    color: #0F172A;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .video-sub {
    display: block;
    margin-top: 6rpx;
    font-size: 24rpx;
    color: #64748B;
  }
}

.list-footer {
  padding: 16rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #94A3B8;
}
</style>
