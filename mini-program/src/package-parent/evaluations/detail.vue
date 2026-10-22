<template>
  <ParentPage title="课评详情" :show-back="true" :show-child-switcher="false">
    <view v-if="loading" class="loading">加载中…</view>

    <EmptyState v-else-if="!detail" icon="message-square" title="课评暂不可查看" description="老师可能还在完善这节课的评价" />

    <view v-else class="detail">
      <!-- 课次信息 -->
      <view class="lesson-head">
        <text class="lesson-title">{{ detail.lessonTitle }}</text>
        <text class="lesson-meta">{{ formatDateCn(detail.date) }} · {{ detail.timeSlot }}</text>
        <text class="lesson-meta">{{ detail.courseName }}<text v-if="detail.teacherName"> · {{ detail.teacherName }}</text></text>
      </view>

      <!-- 孩子的专属评价 -->
      <view v-if="detail.forChild" class="section">
        <text class="section-title">给{{ childName }}的评价</text>
        <view v-if="detail.forChild.rating !== null || detail.forChild.tag" class="meta-row">
          <StarRating v-if="detail.forChild.rating !== null" :value="detail.forChild.rating" size="32rpx" :show-value="true" />
          <text v-if="detail.forChild.tag" class="tag">{{ detail.forChild.tag }}</text>
        </view>
        <text v-if="detail.forChild.comment" class="body-text">{{ detail.forChild.comment }}</text>

        <view v-if="detail.forChild.photos.length" class="photo-grid">
          <image
            v-for="(p, idx) in detail.forChild.photos"
            :key="idx"
            class="grid-photo"
            :src="mediaUrl(p.thumbUrl)"
            mode="aspectFill"
            lazy-load
            @click="preview(detail.forChild.photos, idx)"
          />
        </view>
        <video v-if="detail.forChild.video" class="video" :src="mediaUrl(detail.forChild.video.url)" object-fit="contain" />

        <view v-if="detail.forChild.homework" class="homework">
          <view class="homework-head">
            <AppIcon name="pen-tool" size="28rpx" color="#2F54EB" />
            <text>课后作业</text>
          </view>
          <text class="body-text">{{ detail.forChild.homework }}</text>
        </view>
      </view>

      <!-- 本节课内容 -->
      <view v-if="detail.content.keyPoints.length || detail.content.html" class="section">
        <text class="section-title">本节课学了什么</text>
        <view v-if="detail.content.keyPoints.length" class="points">
          <view v-for="(point, idx) in detail.content.keyPoints" :key="idx" class="point">
            <view class="point-dot" />
            <text>{{ point }}</text>
          </view>
        </view>
        <view v-if="detail.content.html">
          <view v-if="showFullContent" class="rich">
            <rich-text :nodes="detail.content.html" />
          </view>
          <text class="toggle" @click="showFullContent = !showFullContent">
            {{ showFullContent ? '收起' : '查看完整内容' }}
          </text>
        </view>
      </view>

      <!-- 全班课堂评价与照片 -->
      <view
        v-if="detail.overall.comment || detail.overall.voice || detail.classMedia.photos.length || detail.classMedia.video"
        class="section"
      >
        <text class="section-title">课堂记录</text>
        <view v-if="detail.overall.rating !== null && !detail.forChild" class="meta-row">
          <StarRating :value="detail.overall.rating" size="32rpx" :show-value="true" />
        </view>
        <text v-if="detail.overall.comment" class="body-text">{{ detail.overall.comment }}</text>

        <view v-if="detail.overall.voice" class="voice" @click="toggleVoice">
          <AppIcon :name="playing ? 'minus' : 'mic'" size="32rpx" color="#2F54EB" />
          <text>{{ playing ? '正在播放老师语音' : '老师语音点评' }}</text>
          <text v-if="detail.overall.voice.seconds" class="voice-len">{{ detail.overall.voice.seconds }}″</text>
        </view>

        <view v-if="detail.classMedia.photos.length" class="photo-grid">
          <image
            v-for="(p, idx) in detail.classMedia.photos"
            :key="idx"
            class="grid-photo"
            :src="mediaUrl(p.thumbUrl)"
            mode="aspectFill"
            lazy-load
            @click="preview(detail.classMedia.photos, idx)"
          />
        </view>
        <video v-if="detail.classMedia.video" class="video" :src="mediaUrl(detail.classMedia.video.url)" object-fit="contain" />
      </view>
    </view>
  </ParentPage>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import StarRating from '../components/StarRating.vue';
import EmptyState from '../components/EmptyState.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, mediaUrl, type EvaluationDetail, type PhotoLink } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { formatDateCn } from '../utils/format';

const parentStore = useParentStore();
const detail = ref<EvaluationDetail | null>(null);
const loading = ref(true);
const showFullContent = ref(false);
const playing = ref(false);
const studentId = ref('');
let audio: UniApp.InnerAudioContext | null = null;

const childName = computed(
  () => parentStore.children.find((c) => c.studentId === studentId.value)?.name || '孩子',
);

onLoad(async (query: any) => {
  studentId.value = decodeURIComponent(query?.sid || parentStore.currentStudentId);
  const eventId = decodeURIComponent(query?.eid || '');
  try {
    detail.value = await parentApi.evaluationDetail(studentId.value, eventId);
    parentApi.markRead(studentId.value, eventId).catch(() => undefined);
  } catch {
    detail.value = null;
  } finally {
    loading.value = false;
  }
});

onUnload(() => {
  audio?.destroy();
  audio = null;
});

function preview(photos: PhotoLink[], index: number) {
  const urls = photos.map((p) => mediaUrl(p.url));
  uni.previewImage({ urls, current: urls[index] });
}

function toggleVoice() {
  const voice = detail.value?.overall.voice;
  if (!voice?.url) return;
  if (!audio) {
    audio = uni.createInnerAudioContext();
    audio.src = mediaUrl(voice.url);
    audio.onEnded(() => (playing.value = false));
    audio.onError(() => {
      playing.value = false;
      uni.showToast({ title: '语音加载失败', icon: 'none' });
    });
  }
  if (playing.value) {
    audio.pause();
    playing.value = false;
  } else {
    audio.play();
    playing.value = true;
  }
}
</script>

<style lang="scss" scoped>
.loading {
  padding: 120rpx 0;
  text-align: center;
  color: #94A3B8;
  font-size: 26rpx;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.lesson-head {
  padding: 8rpx 4rpx 8rpx;

  .lesson-title {
    display: block;
    font-size: 40rpx;
    font-weight: 700;
    color: #0F172A;
    line-height: 1.35;
  }

  .lesson-meta {
    display: block;
    margin-top: 8rpx;
    font-size: 26rpx;
    color: #64748B;
  }
}

.section {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.04);
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0F172A;
  margin-bottom: 20rpx;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.tag {
  padding: 4rpx 16rpx;
  border-radius: 9999rpx;
  background: #ECFDF3;
  color: #15803D;
  font-size: 22rpx;
  font-weight: 600;
}

.body-text {
  display: block;
  font-size: 30rpx;
  line-height: 1.75;
  color: #1E293B;
  white-space: pre-wrap;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 24rpx;
}

.grid-photo {
  width: 100%;
  height: 200rpx;
  border-radius: 12rpx;
  background: #EFF2F8;
}

.video {
  width: 100%;
  height: 388rpx;
  margin-top: 20rpx;
  border-radius: 16rpx;
  background: #0F172A;
}

.homework {
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #F5F8FF;

  .homework-head {
    display: flex;
    align-items: center;
    gap: 10rpx;
    margin-bottom: 10rpx;
    font-size: 26rpx;
    font-weight: 600;
    color: #2F54EB;
  }
}

.points {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.point {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #1E293B;
}

.point-dot {
  width: 12rpx;
  height: 12rpx;
  margin-top: 16rpx;
  border-radius: 50%;
  background: #2F54EB;
  flex-shrink: 0;
}

.rich {
  margin-top: 20rpx;
  font-size: 28rpx;
  line-height: 1.75;
  color: #334155;
}

.toggle {
  display: inline-block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #2F54EB;
}

.voice {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 20rpx;
  padding: 16rpx 28rpx;
  border-radius: 9999rpx;
  background: #EEF2FF;
  font-size: 26rpx;
  color: #1E3A8A;

  .voice-len {
    color: #64748B;
  }
}
</style>
