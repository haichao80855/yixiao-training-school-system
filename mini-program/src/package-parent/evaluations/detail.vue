<template>
  <ParentPage title="课评详情" :immersive="true" :show-child-switcher="false">
    <!-- 加载中 -->
    <view v-if="loading" class="loading-hero">
      <view class="sk-hero" />
      <view class="sheet">
        <view class="sk-block" />
        <view class="sk-block short" />
      </view>
    </view>

    <view v-else-if="!detail" class="missing">
      <EmptyState icon="message-square" title="课评暂不可查看" description="老师可能还在完善这节课的评价，稍后再来看看" />
    </view>

    <view v-else class="detail">
      <!-- 顶部大图 -->
      <view class="hero" :class="{ plain: heroPhotos.length === 0 }">
        <swiper
          v-if="heroPhotos.length"
          class="hero-swiper"
          :circular="heroPhotos.length > 1"
          @change="heroIndex = $event.detail.current"
        >
          <swiper-item v-for="(p, idx) in heroPhotos" :key="idx" @click="preview(heroPhotos, idx)">
            <image class="hero-img" :src="mediaUrl(p.url)" mode="aspectFill" />
          </swiper-item>
        </swiper>
        <view class="hero-shade" />
        <view class="hero-text">
          <text class="hero-meta">{{ formatDateCn(detail.date) }} · {{ detail.timeSlot }}</text>
          <text class="hero-title">{{ detail.lessonTitle }}</text>
          <text v-if="detail.courseName" class="hero-course">{{ detail.courseName }}</text>
        </view>
        <view v-if="heroPhotos.length > 1" class="hero-dots">
          <view v-for="(p, idx) in heroPhotos.slice(0, 8)" :key="idx" class="dot" :class="{ on: idx === heroIndex }" />
        </view>
        <text v-if="heroPhotos.length > 1" class="hero-count">{{ heroIndex + 1 }} / {{ heroPhotos.length }}</text>
      </view>

      <view class="sheet">
        <!-- 老师写给孩子 -->
        <view v-if="letter" class="letter enter" style="animation-delay: 60ms">
          <view class="letter-head">
            <text class="letter-from">{{ teacherName }}写给{{ childName }}</text>
            <StarRating v-if="letter.rating !== null" :value="letter.rating" size="28rpx" />
          </view>
          <text class="quote-mark">“</text>
          <text v-if="letter.comment" class="letter-body">{{ letter.comment }}</text>
          <text class="letter-sign">— {{ teacherName }} · {{ formatDateCn(detail.date, false) }}</text>
          <view v-if="letter.tag" class="letter-tags">
            <text class="tag">{{ letter.tag }}</text>
          </view>
        </view>

        <!-- 孩子的专属照片 (顶部大图展示的是班级照片时) / 视频 -->
        <view v-if="ownPhotosBelow.length || detail.forChild?.video" class="section enter" style="animation-delay: 120ms">
          <text class="section-title">{{ childName }}的作品</text>
          <view v-if="ownPhotosBelow.length" class="photo-grid">
            <image
              v-for="(p, idx) in ownPhotosBelow"
              :key="idx"
              class="grid-photo"
              :src="mediaUrl(p.thumbUrl)"
              mode="aspectFill"
              lazy-load
              @click="preview(ownPhotosBelow, idx)"
            />
          </view>
          <video
            v-if="detail.forChild?.video"
            class="video"
            :src="mediaUrl(detail.forChild.video.url)"
            object-fit="cover"
            :show-center-play-btn="true"
          />
        </view>

        <!-- 本节课学了什么 -->
        <view v-if="detail.content.keyPoints.length || detail.content.html" class="section enter" style="animation-delay: 160ms">
          <text class="section-title">本节课学了什么</text>
          <view class="learn-card">
            <view v-for="(point, idx) in detail.content.keyPoints" :key="idx" class="learn-row">
              <view class="check">
                <AppIcon name="check" size="24rpx" color="#2F54EB" :stroke-width="3" />
              </view>
              <text class="learn-text">{{ point }}</text>
            </view>
            <view v-if="detail.content.html" class="learn-more">
              <view v-if="showFullContent" class="rich">
                <rich-text :nodes="detail.content.html" />
              </view>
              <view class="toggle" @click="showFullContent = !showFullContent">
                <text>{{ showFullContent ? '收起完整内容' : '查看完整内容' }}</text>
                <AppIcon :name="showFullContent ? 'chevron-up' : 'chevron-down'" size="24rpx" color="#2F54EB" />
              </view>
            </view>
          </view>
        </view>

        <!-- 课后作业 -->
        <view v-if="detail.forChild?.homework" class="section enter" style="animation-delay: 200ms">
          <text class="section-title">课后小任务</text>
          <view class="homework">
            <view class="hw-icon">
              <AppIcon name="pen-tool" size="30rpx" color="#8A4B0F" />
            </view>
            <text class="hw-text">{{ detail.forChild.homework }}</text>
          </view>
        </view>

        <!-- 课堂记录 -->
        <view v-if="hasClassRecord" class="section enter" style="animation-delay: 240ms">
          <text class="section-title">课堂记录</text>
          <view class="class-card">
            <view v-if="!letter && detail.overall.rating !== null" class="class-rating">
              <StarRating :value="detail.overall.rating" size="28rpx" :show-value="true" />
            </view>
            <text v-if="detail.overall.comment" class="class-comment">{{ detail.overall.comment }}</text>

            <view v-if="detail.overall.voice" class="voice" :class="{ playing }" @click="toggleVoice">
              <view class="voice-btn">
                <AppIcon :name="playing ? 'minus' : 'mic'" size="28rpx" color="#FFFFFF" />
              </view>
              <view class="wave">
                <view v-for="i in 18" :key="i" class="bar" :style="{ height: waveHeight(i) + 'rpx', animationDelay: i * 60 + 'ms' }" />
              </view>
              <text v-if="detail.overall.voice.seconds" class="voice-len">{{ detail.overall.voice.seconds }}″</text>
            </view>

            <scroll-view v-if="classPhotosBelow.length" class="strip" scroll-x :show-scrollbar="false" enhanced>
              <view class="strip-inner">
                <image
                  v-for="(p, idx) in classPhotosBelow"
                  :key="idx"
                  class="strip-photo"
                  :src="mediaUrl(p.thumbUrl)"
                  mode="aspectFill"
                  lazy-load
                  @click="preview(classPhotosBelow, idx)"
                />
              </view>
            </scroll-view>

            <video
              v-if="detail.classMedia.video"
              class="video"
              :src="mediaUrl(detail.classMedia.video.url)"
              object-fit="cover"
            />
          </view>
        </view>

        <view class="end-mark">
          <text>· {{ teacherName }}用心记录的一节课 ·</text>
        </view>
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
const heroIndex = ref(0);
const studentId = ref('');
let audio: UniApp.InnerAudioContext | null = null;

const childName = computed(() => parentStore.children.find((c) => c.studentId === studentId.value)?.name || '孩子');
const teacherName = computed(() => detail.value?.teacherName || '老师');

/** 顶部大图优先展示孩子本人的照片，没有时用班级照片 */
const heroPhotos = computed<PhotoLink[]>(() => {
  const d = detail.value;
  if (!d) return [];
  return d.forChild?.photos.length ? d.forChild.photos : d.classMedia.photos;
});
const heroIsOwn = computed(() => !!detail.value?.forChild?.photos.length);
const ownPhotosBelow = computed(() => (heroIsOwn.value ? [] : detail.value?.forChild?.photos || []));
const classPhotosBelow = computed(() => (heroIsOwn.value ? detail.value?.classMedia.photos || [] : []));

/** 写给孩子的信：优先本人专属评价，没有时用课堂总评 */
const letter = computed(() => {
  const d = detail.value;
  if (!d) return null;
  if (d.forChild && (d.forChild.comment || d.forChild.rating !== null)) {
    return { comment: d.forChild.comment, rating: d.forChild.rating, tag: d.forChild.tag };
  }
  return null;
});

const hasClassRecord = computed(() => {
  const d = detail.value;
  return !!d && !!(d.overall.comment || d.overall.voice || classPhotosBelow.value.length || d.classMedia.video || (!letter.value && d.overall.rating !== null));
});

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

/** 语音条的静态波形 (确定性，非随机) */
function waveHeight(i: number) {
  return 10 + Math.round(Math.abs(Math.sin(i * 1.7)) * 26);
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
@import '../styles/tokens.scss';

.enter {
  @include p-enter;
}

/* ---------- Hero ---------- */
.hero {
  position: relative;
  height: 680rpx;
  background: #2B2A33;
  overflow: hidden;

  &.plain {
    height: 520rpx;
    background:
      radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.18) 0, rgba(255, 255, 255, 0) 40%),
      radial-gradient(circle at 10% 90%, rgba(255, 196, 140, 0.35) 0, rgba(255, 196, 140, 0) 45%),
      linear-gradient(150deg, #3A5BEF 0%, #2440C2 100%);
  }
}

.hero-swiper {
  width: 100%;
  height: 100%;
}

.hero-img {
  width: 100%;
  height: 100%;
  animation: hero-zoom 1.2s $p-ease-out both;
}

@keyframes hero-zoom {
  from {
    transform: scale(1.06);
    opacity: 0.6;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.hero-shade {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0) 28%, rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.6) 100%);
}

.plain .hero-shade {
  display: none;
}

.hero-text {
  position: absolute;
  left: 36rpx;
  right: 36rpx;
  bottom: 84rpx;
  color: #FFFFFF;
  pointer-events: none;
  animation: p-fade-up 0.5s $p-ease-out 0.1s both;
}

.hero-meta {
  display: block;
  font-size: 24rpx;
  opacity: 0.85;
}

.hero-title {
  display: block;
  margin-top: 8rpx;
  font-size: 48rpx;
  font-weight: 700;
  line-height: 1.3;
  text-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.25);
}

.hero-course {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  opacity: 0.8;
}

.hero-dots {
  position: absolute;
  left: 36rpx;
  bottom: 52rpx;
  display: flex;
  gap: 10rpx;
  pointer-events: none;

  .dot {
    width: 12rpx;
    height: 12rpx;
    border-radius: 6rpx;
    background: rgba(255, 255, 255, 0.5);
    transition: width 0.3s $p-ease-out, background-color 0.3s ease;

    &.on {
      width: 32rpx;
      background: #FFFFFF;
    }
  }
}

.hero-count {
  position: absolute;
  right: 32rpx;
  bottom: 48rpx;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(0, 0, 0, 0.35);
  color: #FFFFFF;
  font-size: 22rpx;
  @include p-num;
}

/* ---------- Sheet ---------- */
.sheet {
  position: relative;
  z-index: 2;
  margin-top: -36rpx;
  padding: 36rpx 32rpx 80rpx;
  border-radius: 44rpx 44rpx 0 0;
  background: $p-canvas;
}

.letter {
  position: relative;
  padding: 36rpx 36rpx 32rpx;
  border-radius: $p-r-card;
  background: linear-gradient(180deg, #FFF8EF 0%, #FFFFFF 72%);
  border: 2rpx solid #F3E6D4;
  box-shadow: $p-shadow;
}

.letter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.letter-from {
  font-size: 26rpx;
  font-weight: 700;
  color: #9A5B1A;
}

.quote-mark {
  display: block;
  height: 36rpx;
  margin-top: 20rpx;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 88rpx;
  line-height: 0.9;
  color: #F2C88E;
}

.letter-body {
  display: block;
  margin-top: 4rpx;
  font-size: 31rpx;
  line-height: 1.85;
  color: $p-ink;
  white-space: pre-wrap;
}

.letter-sign {
  display: block;
  margin-top: 20rpx;
  text-align: right;
  font-size: 24rpx;
  color: $p-ink-3;
}

.letter-tags {
  margin-top: 20rpx;
}

.tag {
  @include p-chip;
  background: $p-mint-50;
  color: $p-mint;
}

.section {
  margin-top: 48rpx;
}

.section-title {
  display: block;
  margin: 0 4rpx 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: $p-ink;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  border-radius: $p-r-inner;
  overflow: hidden;
}

.grid-photo {
  width: 100%;
  height: 220rpx;
  display: block;
  background: #ECE8E2;
}

.video {
  width: 100%;
  height: 392rpx;
  margin-top: 16rpx;
  border-radius: $p-r-inner;
  background: #1D1B18;
}

.learn-card {
  @include p-card;
  padding: 8rpx 28rpx;
}

.learn-row {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 22rpx 0;
  border-bottom: 2rpx solid $p-line;

  &:last-child {
    border-bottom: none;
  }
}

.check {
  width: 40rpx;
  height: 40rpx;
  margin-top: 2rpx;
  border-radius: 50%;
  background: $p-brand-50;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.learn-text {
  flex: 1;
  font-size: 29rpx;
  line-height: 1.6;
  color: $p-ink;
}

.learn-more {
  padding: 8rpx 0 20rpx;
}

.rich {
  padding: 12rpx 0;
  font-size: 28rpx;
  line-height: 1.8;
  color: $p-ink-2;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 8rpx;
  font-size: 26rpx;
  color: $p-brand;
}

.homework {
  @include p-card;
  display: flex;
  gap: 20rpx;
  padding: 28rpx;
  border-left: 8rpx solid $p-amber;
}

.hw-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  background: $p-amber-50;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hw-text {
  flex: 1;
  font-size: 29rpx;
  line-height: 1.7;
  color: $p-ink;
}

.class-card {
  @include p-card;
  padding: 28rpx;
}

.class-rating {
  margin-bottom: 16rpx;
}

.class-comment {
  display: block;
  font-size: 29rpx;
  line-height: 1.75;
  color: $p-ink-2;
}

.voice {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 24rpx;
  padding: 14rpx 28rpx 14rpx 14rpx;
  border-radius: 9999rpx;
  background: $p-brand-50;
}

.voice-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: $p-brand;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wave {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6rpx;
  height: 44rpx;

  .bar {
    width: 6rpx;
    border-radius: 3rpx;
    background: rgba(47, 84, 235, 0.45);
  }
}

.voice.playing .bar {
  background: $p-brand;
  animation: wave 0.9s ease-in-out infinite alternate;
}

@keyframes wave {
  from {
    transform: scaleY(0.5);
  }
  to {
    transform: scaleY(1.15);
  }
}

.voice-len {
  @include p-num;
  font-size: 24rpx;
  color: $p-ink-2;
}

.strip {
  margin: 24rpx -28rpx 0;
  width: calc(100% + 56rpx);
  white-space: nowrap;
}

.strip-inner {
  display: inline-flex;
  gap: 12rpx;
  padding: 0 28rpx;
}

.strip-photo {
  width: 240rpx;
  height: 240rpx;
  border-radius: 20rpx;
  background: #ECE8E2;
  flex-shrink: 0;
}

.end-mark {
  margin-top: 56rpx;
  text-align: center;
  font-size: 22rpx;
  color: $p-ink-3;
  letter-spacing: 0.08em;
}

/* ---------- Loading & missing ---------- */
.sk-hero {
  @include p-skeleton;
  height: 600rpx;
}

.loading-hero .sheet {
  min-height: 600rpx;
}

.sk-block {
  @include p-skeleton;
  height: 280rpx;
  border-radius: $p-r-card;

  &.short {
    height: 180rpx;
    margin-top: 32rpx;
  }
}

.missing {
  padding-top: 200rpx;
}
</style>
