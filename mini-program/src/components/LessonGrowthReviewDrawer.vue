<template>
  <view v-if="visible" class="growth-drawer-mask" @click="handleClose">
    <view class="growth-drawer-content" @click.stop>
      <!-- 抽屉顶部把手与标题栏 -->
      <view class="drawer-header">
        <view class="drag-handle"></view>
        <view class="header-main-row">
          <view class="header-left">
            <text class="header-title">随堂多媒体学情成长卡</text>
            <text class="header-sub">ADR-0010 多媒体雷达实录</text>
          </view>
          <view class="header-right-actions">
            <view class="header-edit-pill" @click="handleGoEdit">
              <AppIcon name="edit" size="26rpx" color="#2563EB" />
              <text class="edit-pill-text">改课评</text>
            </view>
            <view class="close-icon-btn" @click="handleClose">
              <AppIcon name="x" size="36rpx" color="#94A3B8" />
            </view>
          </view>
        </view>
      </view>

      <!-- 抽屉滚动内容区 (采用弹性容器包裹保证微信小程序 scroll-view 获得确定视口高度) -->
      <view class="drawer-scroll-wrapper">
        <scroll-view
          class="drawer-scroll-body"
          scroll-y
          :enhanced="true"
          :show-scrollbar="false"
          :bounces="true"
        >
          <view v-if="isLoading" class="loading-box">
            <text class="loading-tip">正在投影学员多媒体学情雷达...</text>
          </view>

        <view v-else-if="growthData" class="growth-card-body">
          <!-- 1. 学员与课程概览卡片 -->
          <view class="student-hero-banner">
            <view class="hero-avatar">
              <AppIcon name="user" size="44rpx" color="#FFFFFF" />
            </view>
            <view class="hero-info">
              <view class="name-score-line">
                <text class="student-name">{{ growthData.studentName }}</text>
                <view class="score-badge">
                  <text class="score-num">{{ growthData.score }}分</text>
                  <text class="level-tag">{{ growthData.levelText }}</text>
                </view>
                <view class="honor-tag">{{ growthData.performanceTag }}</view>
              </view>
              <text class="hero-course-desc">{{ growthData.className }} · {{ growthData.dateText }}</text>
            </view>
          </view>

          <!-- 2. 纯数学原生 5 维核心素养雷达图 (0 依赖 SVG) -->
          <view class="section-card">
            <view class="section-title-row">
              <text class="section-title">5 维核心素养雷达</text>
              <text class="section-tag">双向考勤折算</text>
            </view>

            <view class="radar-box">
              <image
                v-if="radarSvgUri"
                class="radar-svg-img"
                :src="radarSvgUri"
                mode="aspectFit"
              />

              <!-- 5 维指标胶囊列表 -->
              <view class="dimension-chips-grid">
                <view class="dim-chip" v-for="dim in growthData.radarDimensions" :key="dim.key">
                  <text class="dim-name">{{ dim.label }}</text>
                  <text class="dim-score">{{ dim.score }}</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 3. 教师个性化随堂寄语 -->
          <view class="section-card">
            <view class="section-title-row">
              <text class="section-title">教师随堂评语</text>
              <text class="section-tag">不可变版本存证</text>
            </view>
            <view class="teacher-comment-bubble">
              <text class="quote-mark">“</text>
              <text class="comment-text">{{ growthData.teacherComment }}</text>
              <text class="quote-mark right">”</text>
            </view>

            <!-- 教学重难点 -->
            <view class="syllabus-points-wrap" v-if="growthData.syllabusPoints.length > 0">
              <text class="sub-label">随堂知识素养：</text>
              <view class="points-chips">
                <text class="point-badge" v-for="(p, idx) in growthData.syllabusPoints" :key="idx">
                  ✓ {{ p }}
                </text>
              </view>
            </view>
          </view>

          <!-- 4. 9 宫格多媒体相册 -->
          <view class="section-card" v-if="growthData.photos.length > 0">
            <view class="section-title-row">
              <text class="section-title">随堂精彩瞬间</text>
              <text class="section-sub">{{ growthData.photos.length }} 张照片</text>
            </view>
            <view class="nine-grid-photos">
              <view
                class="photo-item-cell"
                v-for="(photo, pIdx) in growthData.photos"
                :key="pIdx"
                @click="previewPhoto(pIdx)"
              >
                <image class="grid-img" :src="photo.thumbUrl || photo.url" mode="aspectFill" />
              </view>
            </view>
          </view>

          <!-- 5. 随堂视频直放入口 -->
          <view class="section-card video-card" v-if="growthData.video">
            <view class="section-title-row">
              <text class="section-title">随堂实操视频</text>
              <text class="section-tag success">直放就绪</text>
            </view>
            <video
              class="growth-video-player"
              :src="growthData.video.videoUrl"
              :poster="growthData.video.coverUrl"
              controls
            ></video>
          </view>

          <!-- 6. 随堂勋章 -->
          <view class="section-card" v-if="growthData.badges.length > 0">
            <view class="section-title-row">
              <text class="section-title">获得随堂荣誉</text>
            </view>
            <view class="badges-row">
              <view class="badge-item" v-for="(badge, bIdx) in growthData.badges" :key="bIdx">
                <view class="badge-circle">🏅</view>
                <text class="badge-name">{{ badge.name }}</text>
                <text class="badge-desc">{{ badge.desc }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="drawer-bottom-space"></view>
      </scroll-view>
      </view>

      <!-- 抽屉底部安全操作栏 -->
      <view class="drawer-action-footer">
        <view class="re-edit-btn" @click="handleGoEdit">
          <AppIcon name="edit" size="30rpx" color="#2563EB" />
          <text class="btn-text">改课评</text>
        </view>
        <view class="confirm-close-btn" @click="handleClose">
          确定并返回
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { learningGrowthProjector, type LessonGrowthView } from '../projectors/learning-growth';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  visible: boolean;
  scheduleId: string;
  studentId: string;
  className?: string;
  studentName?: string;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'close'): void;
}>();

const isLoading = ref(false);
const growthData = ref<LessonGrowthView | null>(null);

const radarSvgUri = computed(() => {
  if (growthData.value?.radarSvgDataUri) {
    return growthData.value.radarSvgDataUri;
  }
  const points = growthData.value?.radarSvgPolygonPoints;
  if (!points) return '';
  if (typeof (learningGrowthProjector as any).generateRadarSvgDataUri === 'function') {
    return (learningGrowthProjector as any).generateRadarSvgDataUri(points, growthData.value?.radarDimensions);
  }
  return '';
});

watch(
  () => [props.visible, props.scheduleId, props.studentId],
  async ([newVisible, newSchId, newStuId]) => {
    if (newVisible && newSchId && newStuId) {
      await loadGrowthData(newSchId as string, newStuId as string);
    }
  },
  { immediate: true }
);

const loadGrowthData = async (scheduleId: string, studentId: string) => {
  isLoading.value = true;
  try {
    const view = await learningGrowthProjector.projectLessonGrowth({
      scheduleId,
      studentId,
      forceRefresh: true,
    });
    growthData.value = view;
  } catch (err) {
    console.error('[LessonGrowthReviewDrawer] 加载学情失败:', err);
  } finally {
    isLoading.value = false;
  }
};

const previewPhoto = (startIndex: number) => {
  if (!growthData.value || growthData.value.photos.length === 0) return;
  const urls = growthData.value.photos.map((p) => p.url);
  uni.previewImage({
    current: urls[startIndex] || urls[0],
    urls,
  });
};

const handleClose = () => {
  emit('update:visible', false);
  emit('close');
};

const handleGoEdit = () => {
  handleClose();
  const schId = props.scheduleId;
  const stuId = props.studentId;
  const stuName = growthData.value?.studentName || props.studentName || '';
  const clsName = props.className || growthData.value?.className || '';
  uni.navigateTo({
    url: `/package-edu/evaluation/edit?studentId=${stuId}&studentName=${encodeURIComponent(stuName)}&scheduleId=${schId}&className=${encodeURIComponent(clsName)}&isRevision=1`,
  });
};
</script>

<style lang="scss" scoped>
.growth-drawer-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4rpx);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  animation: fadeIn 0.25s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.growth-drawer-content {
  background: #F8FAFC;
  border-radius: 36rpx 36rpx 0 0;
  height: 85vh;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -8rpx 32rpx rgba(0, 0, 0, 0.12);
  animation: slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.drawer-header {
  flex-shrink: 0;
  padding: 16rpx 32rpx 20rpx;
  background: #FFFFFF;
  border-radius: 36rpx 36rpx 0 0;
  border-bottom: 1rpx solid #F1F5F9;
  z-index: 10;

  .drag-handle {
    width: 64rpx;
    height: 8rpx;
    background: #CBD5E1;
    border-radius: 4rpx;
    margin: 0 auto 16rpx;
  }

  .header-main-row {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .header-left {
      display: flex;
      flex-direction: column;

      .header-title {
        font-size: 32rpx;
        font-weight: 700;
        color: #0F172A;
      }

      .header-sub {
        font-size: 22rpx;
        color: #2563EB;
        font-weight: 500;
        margin-top: 4rpx;
      }
    }

    .header-right-actions {
      display: flex;
      align-items: center;
      gap: 16rpx;

      .header-edit-pill {
        display: flex;
        align-items: center;
        gap: 8rpx;
        padding: 8rpx 20rpx;
        background: #EFF6FF;
        border: 1rpx solid #BFDBFE;
        border-radius: 28rpx;
        cursor: pointer;
        transition: opacity 0.2s;

        &:active {
          opacity: 0.75;
        }

        .edit-pill-text {
          font-size: 24rpx;
          font-weight: 600;
          color: #2563EB;
        }
      }

      .close-icon-btn {
        padding: 10rpx;
        cursor: pointer;
      }
    }
  }
}

.drawer-scroll-wrapper {
  flex: 1;
  height: 0;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  position: relative;
}

.drawer-scroll-body {
  width: 100%;
  height: 100%;
  padding: 24rpx;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;

  .loading-box {
    padding: 100rpx 0;
    display: flex;
    justify-content: center;
    .loading-tip {
      font-size: 26rpx;
      color: #94A3B8;
    }
  }

  .growth-card-body {
    display: flex;
    flex-direction: column;
    gap: 24rpx;
  }
}

/* 1. 顶部 Hero Banner */
.student-hero-banner {
  background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%);
  border-radius: 24rpx;
  padding: 28rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  color: #FFFFFF;

  .hero-avatar {
    width: 88rpx;
    height: 88rpx;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hero-info {
    flex: 1;

    .name-score-line {
      display: flex;
      align-items: center;
      gap: 14rpx;
      margin-bottom: 6rpx;

      .student-name {
        font-size: 34rpx;
        font-weight: 700;
      }

      .score-badge {
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.25);
        padding: 4rpx 14rpx;
        border-radius: 20rpx;
        font-size: 22rpx;
        font-weight: 700;
        gap: 6rpx;

        .level-tag {
          color: #FEF08A;
        }
      }

      .honor-tag {
        font-size: 20rpx;
        background: #F59E0B;
        padding: 4rpx 12rpx;
        border-radius: 12rpx;
        font-weight: 600;
      }
    }

    .hero-course-desc {
      font-size: 22rpx;
      opacity: 0.88;
    }
  }
}

/* 通用板块卡片 */
.section-card {
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 24rpx 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.02);

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .section-title {
      font-size: 28rpx;
      font-weight: 700;
      color: #1E293B;
    }

    .section-tag {
      font-size: 20rpx;
      color: #2563EB;
      background: #EFF6FF;
      padding: 4rpx 12rpx;
      border-radius: 8rpx;
      font-weight: 600;

      &.success {
        color: #16A34A;
        background: #DCFCE7;
      }
    }

    .section-sub {
      font-size: 22rpx;
      color: #64748B;
    }
  }
}

/* 2. 原生 SVG 雷达 (小程序 <image> 矢量渲染) */
.radar-box {
  display: flex;
  flex-direction: column;
  align-items: center;

  .radar-svg-img,
  .radar-svg {
    width: 380rpx;
    height: 380rpx;
    display: block;
  }

  .dimension-chips-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12rpx;
    margin-top: 16rpx;
    width: 100%;

    .dim-chip {
      background: #F1F5F9;
      border-radius: 12rpx;
      padding: 8rpx 16rpx;
      display: flex;
      align-items: center;
      gap: 8rpx;

      .dim-name {
        font-size: 22rpx;
        color: #475569;
      }

      .dim-score {
        font-size: 22rpx;
        font-weight: 700;
        color: #2563EB;
      }
    }
  }
}

/* 3. 随堂评语与教学大纲 */
.teacher-comment-bubble {
  background: #F8FAFC;
  border-left: 6rpx solid #2563EB;
  border-radius: 12rpx;
  padding: 20rpx;
  position: relative;
  margin-bottom: 16rpx;

  .quote-mark {
    font-size: 32rpx;
    color: #94A3B8;
    font-family: serif;
    &.right {
      float: right;
    }
  }

  .comment-text {
    font-size: 26rpx;
    color: #334155;
    line-height: 1.6;
  }
}

.syllabus-points-wrap {
  .sub-label {
    font-size: 22rpx;
    color: #64748B;
    font-weight: 600;
  }

  .points-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10rpx;
    margin-top: 8rpx;

    .point-badge {
      font-size: 22rpx;
      color: #1E40AF;
      background: #DBEAFE;
      padding: 6rpx 14rpx;
      border-radius: 8rpx;
    }
  }
}

/* 4. 9 宫格相册 */
.nine-grid-photos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;

  .photo-item-cell {
    aspect-ratio: 1;
    border-radius: 16rpx;
    overflow: hidden;
    background: #E2E8F0;

    .grid-img {
      width: 100%;
      height: 100%;
    }
  }
}

/* 5. 视频播放 */
.video-card {
  .growth-video-player {
    width: 100%;
    height: 340rpx;
    border-radius: 16rpx;
  }
}

/* 6. 勋章列表 */
.badges-row {
  display: flex;
  gap: 16rpx;
  justify-content: space-around;

  .badge-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;

    .badge-circle {
      font-size: 40rpx;
    }

    .badge-name {
      font-size: 22rpx;
      font-weight: 700;
      color: #1E293B;
    }

    .badge-desc {
      font-size: 18rpx;
      color: #94A3B8;
    }
  }
}

.drawer-bottom-space {
  height: 60rpx;
}

/* 底部操作按钮 (固定在抽屉底部，自适应全面屏安全区) */
.drawer-action-footer {
  flex-shrink: 0;
  z-index: 10;
  padding: 20rpx 32rpx calc(24rpx + constant(safe-area-inset-bottom));
  padding: 20rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  background: #FFFFFF;
  border-top: 1rpx solid #E2E8F0;
  display: flex;
  align-items: center;
  gap: 20rpx;

  .re-edit-btn {
    width: 200rpx;
    height: 80rpx;
    background: #EFF6FF;
    border: 1rpx solid #BFDBFE;
    color: #2563EB;
    font-size: 26rpx;
    font-weight: 600;
    border-radius: 40rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    cursor: pointer;
    transition: opacity 0.2s;

    &:active {
      opacity: 0.8;
    }

    .btn-text {
      font-size: 26rpx;
      font-weight: 600;
      color: #2563EB;
    }
  }

  .confirm-close-btn {
    flex: 1;
    height: 80rpx;
    background: #2563EB;
    color: #FFFFFF;
    font-size: 28rpx;
    font-weight: 700;
    border-radius: 40rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
}
</style>
