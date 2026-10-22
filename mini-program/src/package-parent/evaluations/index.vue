<template>
  <ParentPage title="课评" tab="evaluations" :unread="unreadCount">
    <view v-if="loading && items.length === 0" class="skeleton-list">
      <view v-for="i in 3" :key="i" class="skeleton-card" />
    </view>

    <EmptyState
      v-else-if="!loading && items.length === 0"
      icon="message-square"
      title="还没有课评"
      description="孩子上课后，老师发布的课堂评价会出现在这里"
    />

    <view v-else class="feed">
      <block v-for="item in items" :key="item.scheduleEventId">
        <!-- 已发布课评卡片 -->
        <view v-if="item.evaluation" class="eval-card" @click="openDetail(item)">
          <view class="card-top">
            <text class="date">{{ formatDateCn(item.date) }} · {{ item.timeSlot }}</text>
            <view v-if="item.evaluation.unread" class="unread-dot" />
          </view>
          <text class="lesson-title">{{ item.evaluation.lessonTitle }}</text>
          <text class="course-line">{{ item.courseName }}<text v-if="item.teacherName"> · {{ item.teacherName }}</text></text>

          <view v-if="item.evaluation.rating !== null || item.evaluation.tag" class="meta-row">
            <StarRating v-if="item.evaluation.rating !== null" :value="item.evaluation.rating" />
            <text v-if="item.evaluation.tag" class="tag">{{ item.evaluation.tag }}</text>
          </view>

          <text v-if="item.evaluation.commentPreview" class="comment">{{ item.evaluation.commentPreview }}</text>

          <view v-if="item.evaluation.photoThumbs.length" class="thumbs">
            <view v-for="(thumb, idx) in item.evaluation.photoThumbs" :key="idx" class="thumb">
              <image class="thumb-img" :src="mediaUrl(thumb)" mode="aspectFill" lazy-load />
              <view v-if="idx === 2 && item.evaluation.photoCount > 3" class="thumb-more">
                +{{ item.evaluation.photoCount - 3 }}
              </view>
            </view>
          </view>
          <view v-if="item.evaluation.hasVideo" class="video-hint">
            <AppIcon name="play-circle" size="28rpx" color="#2F54EB" />
            <text>含课堂视频</text>
          </view>
        </view>

        <!-- 未出勤或课评未发布：简要行 -->
        <view v-else class="slim-row">
          <text class="slim-date">{{ formatDateCn(item.date) }}</text>
          <text class="slim-course">{{ item.courseName }}</text>
          <text class="slim-status" :class="'st-' + item.attendance">{{ slimLabel(item) }}</text>
        </view>
      </block>

      <view class="list-footer">
        <text v-if="loadingMore">加载中…</text>
        <text v-else-if="!nextCursor">没有更多了</text>
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
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, mediaUrl, type FeedItem } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { formatDateCn, ATTENDANCE_LABEL } from '../utils/format';

const parentStore = useParentStore();
const items = ref<FeedItem[]>([]);
const nextCursor = ref<string | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
let loadedFor = '';

const unreadCount = computed(() => items.value.filter((i) => i.evaluation?.unread).length);

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
    if (sid !== parentStore.currentStudentId) return; // 加载期间切换了孩子
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
  // 首次进入或从详情返回时刷新 (更新已读状态)；先刷新子女列表，离校学员可能已过只读期
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
.feed {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.eval-card {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.04);

  &:active {
    background: #FAFBFE;
  }
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .date {
    font-size: 24rpx;
    color: #64748B;
  }
}

.unread-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #DC2626;
}

.lesson-title {
  display: block;
  margin-top: 12rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #0F172A;
  line-height: 1.4;
}

.course-line {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #64748B;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 20rpx;
}

.tag {
  padding: 4rpx 16rpx;
  border-radius: 9999rpx;
  background: #ECFDF3;
  color: #15803D;
  font-size: 22rpx;
  font-weight: 600;
}

.comment {
  display: block;
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #334155;
}

.thumbs {
  display: flex;
  gap: 12rpx;
  margin-top: 20rpx;
}

.thumb {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  border-radius: 16rpx;
  overflow: hidden;
  background: #EFF2F8;

  .thumb-img {
    width: 100%;
    height: 100%;
  }
}

.thumb-more {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  color: #FFFFFF;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-hint {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #2F54EB;
}

.slim-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 28rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.6);
  border: 1rpx dashed rgba(15, 23, 42, 0.1);
  font-size: 24rpx;

  .slim-date {
    color: #64748B;
    flex-shrink: 0;
  }

  .slim-course {
    flex: 1;
    color: #475569;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .slim-status {
    flex-shrink: 0;
    color: #64748B;

    &.st-absent {
      color: #DC2626;
    }

    &.st-leave {
      color: #D97706;
    }
  }
}

.list-footer {
  padding: 24rpx 0 8rpx;
  text-align: center;
  font-size: 24rpx;
  color: #94A3B8;
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.skeleton-card {
  height: 320rpx;
  border-radius: 24rpx;
  background: linear-gradient(90deg, #EFF2F8 25%, #F6F8FC 50%, #EFF2F8 75%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}
</style>
