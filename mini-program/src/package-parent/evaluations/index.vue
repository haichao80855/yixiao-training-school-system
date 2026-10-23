<template>
  <ParentPage title="课评" :overline="todayText" tab="evaluations" :unread="unreadCount">
    <!-- 骨架屏 -->
    <view v-if="loading && items.length === 0" class="skeleton-list">
      <view v-for="i in 2" :key="i" class="sk-card">
        <view class="sk-line short" />
        <view class="sk-media" />
        <view class="sk-line" />
        <view class="sk-line mid" />
      </view>
    </view>

    <EmptyState
      v-else-if="!loading && items.length === 0"
      icon="message-square"
      title="还没有课评"
      description="孩子上完课后，老师写下的课堂评价和照片会出现在这里"
    />

    <view v-else class="feed">
      <!-- 新课评提示 -->
      <view v-if="firstUnread" class="new-banner" @click="openDetail(firstUnread)">
        <view class="new-count">
          <text class="new-num">{{ unreadCount }}</text>
        </view>
        <view class="new-text">
          <text class="new-title">{{ firstUnread.teacherName || '老师' }}发布了新课评</text>
          <text class="new-sub">《{{ firstUnread.evaluation?.lessonTitle }}》· {{ formatDateCn(firstUnread.date, false) }}</text>
        </view>
        <AppIcon name="chevron-right" size="28rpx" color="#2F54EB" />
      </view>

      <block v-for="group in groups" :key="group.month">
        <view class="month">
          <text>{{ group.label }}</text>
        </view>

        <block v-for="entry in group.items" :key="entry.item.scheduleEventId">
          <!-- 已发布课评 -->
          <view
            v-if="entry.item.evaluation"
            class="eval-card"
            :style="enterDelay(entry.index)"
            @click="openDetail(entry.item)"
          >
            <view class="card-meta">
              <text>{{ formatDateCn(entry.item.date) }} · {{ (entry.item.timeSlot || '').split('-')[0] }}</text>
              <text v-if="entry.item.evaluation.unread" class="new-pill">新</text>
            </view>

            <view v-if="entry.item.evaluation.photoThumbs.length || entry.item.evaluation.hasVideo" class="mosaic">
              <PhotoMosaic
                :thumbs="entry.item.evaluation.photoThumbs.map(mediaUrl)"
                :total="entry.item.evaluation.photoCount"
                :has-video="entry.item.evaluation.hasVideo"
              />
            </view>

            <text class="lesson-title">{{ entry.item.evaluation.lessonTitle }}</text>
            <text v-if="entry.item.courseName" class="course">{{ entry.item.courseName }}</text>

            <view v-if="entry.item.evaluation.commentPreview" class="quote">
              <view class="teacher-dot">{{ (entry.item.teacherName || '师').slice(0, 1) }}</view>
              <text class="quote-text">{{ entry.item.evaluation.commentPreview }}</text>
            </view>

            <view
              v-if="entry.item.evaluation.rating !== null || entry.item.evaluation.tag"
              class="card-foot"
            >
              <StarRating v-if="entry.item.evaluation.rating !== null" :value="entry.item.evaluation.rating" />
              <text v-if="entry.item.evaluation.tag" class="tag">{{ entry.item.evaluation.tag }}</text>
            </view>
          </view>

          <!-- 请假 / 缺勤 / 课评未发布 -->
          <view v-else class="slim-row" :style="enterDelay(entry.index)">
            <view class="slim-dot" />
            <text class="slim-date">{{ formatDateCn(entry.item.date, false) }}</text>
            <text class="slim-course">{{ entry.item.courseName || '课程' }}</text>
            <text class="slim-status" :class="'st-' + entry.item.attendance">{{ slimLabel(entry.item) }}</text>
          </view>
        </block>
      </block>

      <view class="list-footer">
        <text v-if="loadingMore">加载中…</text>
        <text v-else-if="!nextCursor">· 已经到底了 ·</text>
      </view>
    </view>
  </ParentPage>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import StarRating from '../components/StarRating.vue';
import EmptyState from '../components/EmptyState.vue';
import PhotoMosaic from '../components/PhotoMosaic.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, mediaUrl, type FeedItem } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { formatDateCn, formatLongDate, todayIso, ATTENDANCE_LABEL } from '../utils/format';
import { enterDelay } from '../utils/visual';

const parentStore = useParentStore();
const items = ref<FeedItem[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
let loadedFor = '';

const todayText = formatLongDate(todayIso());

const unreadCount = computed(() => items.value.filter((i) => i.evaluation?.unread).length);
const firstUnread = computed(() => items.value.find((i) => i.evaluation?.unread) || null);

/** 按月分组，保留全局序号用于入场错峰 */
const groups = computed(() => {
  const result: Array<{ month: string; label: string; items: Array<{ item: FeedItem; index: number }> }> = [];
  items.value.forEach((item, index) => {
    const month = (item.date || '').slice(0, 7);
    let group = result[result.length - 1];
    if (!group || group.month !== month) {
      const [y, m] = month.split('-');
      group = { month, label: y ? `${y}年${Number(m)}月` : '更早', items: [] };
      result.push(group);
    }
    group.items.push({ item, index });
  });
  return result;
});

async function load(reset = true) {
  const sid = parentStore.currentStudentId;
  if (!sid) return;
  if (reset) {
    loading.value = true;
  } else {
    if (!nextCursor.value || loadingMore.value) return;
    loadingMore.value = true;
  }
  try {
    const res = await parentApi.evaluations(sid, reset ? null : nextCursor.value);
    if (sid !== parentStore.currentStudentId) return;
    items.value = reset ? res.items : [...items.value, ...res.items];
    nextCursor.value = res.nextCursor;
    loadedFor = sid;
  } catch {
    // 错误提示由 request 统一处理
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

onShow(() => {
  parentStore.refresh().catch(() => undefined).finally(() => load(true));
});

watch(
  () => parentStore.currentStudentId,
  (sid) => {
    if (sid && sid !== loadedFor) {
      items.value = [];
      load(true);
    }
  },
);

onPullDownRefresh(async () => {
  await load(true);
  uni.stopPullDownRefresh();
});

onReachBottom(() => load(false));

function slimLabel(item: FeedItem) {
  if (item.attendance === 'present' || item.attendance === 'late') return '课评待发布';
  return ATTENDANCE_LABEL[item.attendance] || item.attendance;
}

function openDetail(item: FeedItem) {
  if (item.evaluation) item.evaluation.unread = false;
  uni.navigateTo({
    url: `/package-parent/evaluations/detail?sid=${encodeURIComponent(parentStore.currentStudentId)}&eid=${encodeURIComponent(item.scheduleEventId)}`,
  });
}
</script>

<style lang="scss" scoped>
@import '../styles/tokens.scss';

.feed {
  display: flex;
  flex-direction: column;
}

.new-banner {
  @include p-pressable;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 36rpx;
  border-radius: $p-r-inner;
  background: $p-brand-50;
  animation: p-fade-up 0.4s $p-ease-out both;
}

.new-count {
  width: 64rpx;
  height: 64rpx;
  border-radius: 20rpx;
  background: $p-brand;
  display: flex;
  align-items: center;
  justify-content: center;
}

.new-num {
  @include p-num;
  color: #FFFFFF;
  font-size: 30rpx;
  font-weight: 700;
}

.new-text {
  flex: 1;
  min-width: 0;
}

.new-title {
  display: block;
  font-size: 27rpx;
  font-weight: 600;
  color: #1E3A8A;
}

.new-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 23rpx;
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.month {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 8rpx 4rpx 20rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: $p-ink-2;

  &::after {
    content: '';
    flex: 1;
    height: 2rpx;
    background: $p-line;
  }
}

.eval-card {
  @include p-card;
  @include p-pressable;
  @include p-enter;
  padding: 28rpx;
  margin-bottom: 28rpx;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 24rpx;
  color: $p-ink-3;
}

.new-pill {
  @include p-chip;
  height: 36rpx;
  padding: 0 14rpx;
  font-size: 21rpx;
  background: $p-rose;
  color: #FFFFFF;
}

@keyframes new-glow {
  0% {
    box-shadow: 0 0 0 0 rgba(217, 66, 74, 0.45);
  }
  100% {
    box-shadow: 0 0 0 14rpx rgba(217, 66, 74, 0);
  }
}

.mosaic {
  display: block;
  margin: 20rpx 0 24rpx;
}

.lesson-title {
  display: block;
  margin-top: 16rpx;
  font-size: 34rpx;
  font-weight: 650;
  line-height: 1.38;
  color: $p-ink;
}

.mosaic + .lesson-title {
  margin-top: 0;
}

.course {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: $p-ink-3;
}

.quote {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
  background: $p-canvas;
}

.teacher-dot {
  width: 44rpx;
  height: 44rpx;
  margin-top: 2rpx;
  border-radius: 50%;
  background: $p-brand-50;
  color: $p-brand;
  font-size: 22rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.quote-text {
  flex: 1;
  font-size: 28rpx;
  line-height: 1.65;
  color: $p-ink-2;
}

.card-foot {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 20rpx;
}

.tag {
  @include p-chip;
  background: $p-mint-50;
  color: $p-mint;
}

.slim-row {
  @include p-enter;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 4rpx 8rpx 32rpx 12rpx;
  font-size: 25rpx;
  color: $p-ink-3;
}

.slim-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  border: 3rpx solid #CBD5E1;
  flex-shrink: 0;
}

.slim-date {
  color: $p-ink-2;
  font-weight: 500;
  flex-shrink: 0;
}

.slim-course {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slim-status {
  @include p-chip;
  height: 40rpx;
  font-size: 21rpx;
  font-weight: 500;
  background: $p-fill;
  color: $p-ink-2;

  &.st-leave {
    background: $p-peach-50;
    color: #B45309;
  }

  &.st-absent {
    background: $p-rose-50;
    color: $p-rose;
  }
}

.list-footer {
  padding: 16rpx 0 8rpx;
  text-align: center;
  font-size: 22rpx;
  color: $p-ink-3;
  letter-spacing: 0.1em;
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.sk-card {
  @include p-card;
  padding: 28rpx;
}

.sk-line {
  @include p-skeleton;
  height: 28rpx;
  border-radius: 14rpx;
  margin-top: 18rpx;

  &.short {
    width: 40%;
    margin-top: 0;
  }

  &.mid {
    width: 70%;
  }
}

.sk-media {
  @include p-skeleton;
  height: 340rpx;
  border-radius: $p-r-inner;
  margin-top: 20rpx;
}
</style>
