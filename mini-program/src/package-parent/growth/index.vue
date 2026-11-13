<template>
  <ParentPage title="成长" overline="记录每一次进步" tab="growth" :restored="snapshot.restored.value">
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

    <view v-if="archive && archive.photos + archive.videos > 0" class="archive-card" @click="openArchive">
      <view class="archive-icon">
        <AppIcon name="folder-user" size="36rpx" :color="P_COLORS.brand" />
      </view>
      <view class="archive-info">
        <text class="archive-title">历史档案</text>
        <text class="archive-sub">{{ archiveRange }} · {{ archive.photos }} 张照片 · {{ archive.videos }} 段视频</text>
      </view>
      <AppIcon name="chevron-right" size="26rpx" :color="P_COLORS.ink4" />
    </view>

    <PSegmented :model-value="type" :options="TYPE_OPTIONS" @update:model-value="setType" />

    <view v-if="loading && weeks.length === 0" class="sk-week">
      <view class="sk-title" />
      <view class="sk-grid" />
    </view>
    <ErrorState v-else-if="loadError && weeks.length === 0" :message="loadError" @retry="load(true)" />
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

        <!-- 拼图版式按张数选，最多显示 6 张，多出来的在最后一格显示「+N」 (以前 2、4、5 张时会留空格) -->
        <view v-if="type === 'photo'" class="mosaic" :class="`layout-${mosaicLayout(week.photos.length)}`">
          <view
            v-for="(p, idx) in week.photos.slice(0, MOSAIC_MAX)"
            :key="idx"
            class="cell"
            role="button"
            tabindex="0"
            :aria-label="`查看第 ${idx + 1} 张照片`"
            @click="previewWeek(week, idx)"
          >
            <image class="photo" :src="mediaUrl(p.thumbUrl)" mode="aspectFill" lazy-load />
            <text v-if="p.isOwn && idx === 0" class="own-badge">{{ childName }}</text>
            <view v-if="idx === MOSAIC_MAX - 1 && week.photos.length > MOSAIC_MAX" class="more-mask">
              <text>+{{ week.photos.length - MOSAIC_MAX }}</text>
            </view>
          </view>
        </view>
        <!-- 这一周的课评入口：以前只能长按照片才出来，H5 上长按还会弹出浏览器的保存图片菜单 -->
        <view v-if="type === 'photo'" class="week-lessons">
          <view
            v-for="lesson in weekLessons(week)"
            :key="lesson.scheduleEventId"
            class="lesson-link"
            role="button"
            tabindex="0"
            @click="openLesson(lesson.scheduleEventId)"
          >
            <text class="lesson-link-text">看《{{ lesson.lessonTitle }}》课评</text>
            <AppIcon name="chevron-right" size="24rpx" :color="P_COLORS.brand" />
          </view>
        </view>

        <view v-else class="video-list">
          <view role="button" tabindex="0" v-for="(v, idx) in week.videos" :key="idx" class="video-row" @click="playVideo(v.url)">
            <view class="video-thumb">
              <image v-if="v.thumbUrl && v.thumbUrl !== v.url" class="video-cover" :src="mediaUrl(v.thumbUrl)" mode="aspectFill" lazy-load />
              <view class="play">
                <AppIcon name="play-circle" size="48rpx" :color="P_COLORS.white" />
              </view>
            </view>
            <view class="video-info">
              <text class="video-title">{{ v.lessonTitle }}</text>
              <text class="video-sub">{{ formatDateCn(v.date) }} · {{ v.isOwn ? `${childName}的视频` : '课堂视频' }}</text>
            </view>
            <AppIcon name="chevron-right" size="26rpx" :color="P_COLORS.ink4" />
          </view>
        </view>
      </view>

      <view class="list-footer">
        <text v-if="loadingMore">加载中…</text>
        <text v-else-if="moreError" role="button" tabindex="0" class="more-retry" @click="load(false)">加载失败，点这里重试</text>
        <text v-else-if="!nextCursor">· 已经到底了 ·</text>
      </view>
    </view>

    <!-- #ifdef H5 -->
    <VideoOverlay :url="playingUrl" @close="playingUrl = ''" />
    <!-- #endif -->
  </ParentPage>
</template>

<script setup lang="ts">
import { usePageSnapshot } from '../utils/pageSnapshot';
import { P_COLORS } from '../styles/colors';
import { computed, ref, watch } from 'vue';
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import EmptyState from '../components/EmptyState.vue';
import PSegmented from '../components/PSegmented.vue';
import ErrorState from '../components/ErrorState.vue';
import { describeLoadError } from '../utils/loadError';
import VideoOverlay from '../components/VideoOverlay.vue';
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
const TYPE_OPTIONS: Array<{ value: 'photo' | 'video'; label: string }> = [
  { value: 'photo', label: '照片' },
  { value: 'video', label: '视频' },
];
const loading = ref(false);
const loadingMore = ref(false);

const childName = computed(() => parentStore.currentChild?.name || '孩子');
const archive = computed(() => summary.value?.archive ?? null);
const archiveRange = computed(() => {
  const { earliestDate, latestDate } = archive.value || {};
  if (!earliestDate || !latestDate) return '';
  const fmt = (d: string) => `${d.slice(0, 4)}.${Number(d.slice(5, 7))}`;
  return `${fmt(earliestDate)} – ${fmt(latestDate)}`;
});

function openArchive() {
  uni.navigateTo({ url: '/package-parent/growth/archive' });
}

const lessons = useCountUp(() => summary.value?.lessonsAttended);
const evaluations = useCountUp(() => summary.value?.evaluations);
// 统计含历史档案，否则老生家长会看到 0 张照片而下方有几百张历史照片
const photos = useCountUp(() => summary.value && summary.value.photos + (summary.value.archive?.photos ?? 0));
const videos = useCountUp(() => summary.value && summary.value.videos + (summary.value.archive?.videos ?? 0));

const stats = computed(() => [
  { key: 'lessons', label: '次上课', value: lessons.value, icon: 'calendar-check', color: P_COLORS.mint },
  { key: 'evals', label: '篇课评', value: evaluations.value, icon: 'message-square', color: P_COLORS.brand },
  { key: 'photos', label: '张照片', value: photos.value, icon: 'image', color: P_COLORS.sky },
  { key: 'videos', label: '段视频', value: videos.value, icon: 'video', color: P_COLORS.indigo },
]);

const loadError = ref('');
const moreError = ref(false);

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
  loadError.value = '';
  moreError.value = false;
  try {
    const res = await parentApi.album(sid, { cursor: reset ? null : nextCursor.value, type: type.value });
    if (sid !== parentStore.currentStudentId) return;
    weeks.value = reset ? res.weeks : [...weeks.value, ...res.weeks];
    nextCursor.value = res.nextCursor;
    if (reset) {
      lastLoadedAt = Date.now();
      lastLoadedFor = sid;
    }
    snapshot.save(sid, { weeks: weeks.value, nextCursor: nextCursor.value, summary: summary.value, type: type.value });
  } catch (err) {
    if (reset) {
      weeks.value = [];
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

const MOSAIC_MAX = 6;
/** 张数 → 版式：1 张整幅；2、4 张平分；3、5、6 张一大带几小 */
function mosaicLayout(count: number): number {
  return Math.min(count, MOSAIC_MAX);
}

/** 这一周照片涉及的课 (去重，按出现顺序) */
function weekLessons(week: AlbumWeek) {
  const seen = new Map<string, { scheduleEventId: string; lessonTitle: string }>();
  for (const p of week.photos) {
    if (!seen.has(p.scheduleEventId)) seen.set(p.scheduleEventId, { scheduleEventId: p.scheduleEventId, lessonTitle: p.lessonTitle });
  }
  return [...seen.values()];
}

function openLesson(scheduleEventId: string) {
  uni.navigateTo({
    url: `/package-parent/evaluations/detail?sid=${encodeURIComponent(parentStore.currentStudentId)}&eid=${encodeURIComponent(scheduleEventId)}`,
  });
}

const playingUrl = ref('');

function playVideo(url: string) {
  // #ifdef MP-WEIXIN
  uni.previewMedia({ sources: [{ url: mediaUrl(url), type: 'video' }] });
  // #endif
  // #ifdef H5
  playingUrl.value = mediaUrl(url);
  // #endif
}

// 从详情返回时，1 分钟内不重新加载，列表和滚动位置保持不动
const FRESH_MS = 60 * 1000;
let lastLoadedAt = 0;
let lastLoadedFor = '';
const snapshot = usePageSnapshot<{ weeks: AlbumWeek[]; nextCursor: string | null; summary: GrowthSummary | null; type: 'photo' | 'video' }>('parent-growth');
onShow(() => {
  const sid = parentStore.currentStudentId;
  if (sid && weeks.value.length === 0) {
    const snap = snapshot.restore(sid);
    if (snap) {
      weeks.value = snap.data.weeks;
      nextCursor.value = snap.data.nextCursor;
      summary.value = snap.data.summary;
      type.value = snap.data.type;
      lastLoadedFor = sid;
      lastLoadedAt = snap.at;
    }
  }
  if (sid && sid === lastLoadedFor && Date.now() - lastLoadedAt < FRESH_MS) return;
  load(true);
});
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
  @include p-card;
  @include p-enter;
  position: relative;
  padding: 28rpx;
  overflow: hidden;
}

.stat-icon {
  position: absolute;
  right: 24rpx;
  top: 24rpx;
  width: 60rpx;
  height: 60rpx;
  border-radius: $p-r-sm;
  display: flex;
  align-items: center;
  justify-content: center;
}

.t-lessons .stat-icon {
  background: $p-mint-50;
}

.t-evals .stat-icon {
  background: $p-brand-50;
}

.t-photos .stat-icon {
  background: $p-sky-50;
}

.t-videos .stat-icon {
  background: $p-indigo-50;
}

.stat-num {
  @include p-num;
  display: block;
  font-size: p-fs($p-fs-display);
  font-weight: 600;
  line-height: 1.1;
}

.stat-label {
  display: block;
  margin-top: 8rpx;
  font-size: p-fs($p-fs-small);
  color: $p-ink-2;
}

.archive-card {
  @include p-card;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
  margin-bottom: 28rpx;
}

.archive-icon {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  border-radius: $p-r-inner;
  background: $p-indigo-50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.archive-info {
  flex: 1;
  min-width: 0;
}

.archive-title {
  display: block;
  font-size: p-fs($p-fs-body);
  font-weight: 600;
  color: $p-ink;
}

.archive-sub {
  display: block;
  margin-top: 6rpx;
  font-size: p-fs($p-fs-caption);
  color: $p-ink-2;
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
  @include p-section-title; // 分区标题统一样式

}

.week-meta {
  font-size: p-fs($p-fs-caption);
  color: $p-ink-3;
}

.mosaic {
  display: grid;
  // 6 列网格：各版式用跨列拼满，不留空格
  grid-template-columns: repeat(6, 1fr);
  grid-auto-rows: 168rpx;
  gap: 8rpx;
  border-radius: $p-r-card;
  overflow: hidden;

  &.layout-1 .cell {
    grid-column: span 6;
    grid-row: span 2;
  }
  &.layout-2 .cell {
    grid-column: span 3;
    grid-row: span 2;
  }
  &.layout-4 .cell {
    grid-column: span 3;
  }
  // 3、5、6 张：第一张大图占左上 4×2，其余小图
  &.layout-3,
  &.layout-5,
  &.layout-6 {
    .cell {
      grid-column: span 2;
    }
    .cell:first-child {
      grid-column: span 4;
      grid-row: span 2;
    }
  }
  &.layout-3 .cell:not(:first-child) {
    grid-row: span 1;
  }
  &.layout-5 .cell:nth-child(n + 4) {
    grid-column: span 3;
  }
}

.cell {
  position: relative;
  background: $p-fill-soft;
  overflow: hidden;

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
  border-radius: $p-r-sm;
  background: rgba(255, 255, 255, 0.92);
  color: $p-brand;
  font-size: p-fs($p-fs-caption);
  font-weight: 600;
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
  position: relative;
  overflow: hidden;
  width: 176rpx;
  height: 120rpx;
  border-radius: $p-r-inner;
  background:
    linear-gradient(135deg, $p-ink-dark, $p-ink);
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
  font-size: p-fs($p-fs-body);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-sub {
  display: block;
  margin-top: 6rpx;
  font-size: p-fs($p-fs-caption);
  color: $p-ink-3;
}

.list-footer {
  @include p-list-footer;
}

.sk-title {
  @include p-skeleton;
  width: 280rpx;
  height: 36rpx;
  border-radius: $p-r-sm;
  margin-bottom: 20rpx;
}

.sk-grid {
  @include p-skeleton;
  height: 360rpx;
  border-radius: $p-r-card;
}

// 翻页失败时的重试入口
.more-retry {
  @include p-hit-min;
  color: $p-brand;
  font-weight: $p-fw-medium;
}

.more-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.45);
  color: $p-surface;
  font-size: p-fs($p-fs-title);
  font-weight: $p-fw-bold;
}

.week-lessons {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 24rpx;
  margin-top: 16rpx;
}

.lesson-link {
  @include p-hit-min;
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  color: $p-brand;
}

.lesson-link-text {
  font-size: p-fs($p-fs-small);
}

.video-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.play {
  position: relative;
  z-index: 1;
}
</style>
