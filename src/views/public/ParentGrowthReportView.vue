<template>
  <!-- 微信分享的学习报告：样式与家长端 H5 统一 (颜色、字号、卡片)，正文 15px 起 -->
  <div class="parent-theme report">
    <!-- 状态 1: 加载中 -->
    <div v-if="loading" class="state">
      <div class="spinner" />
      <p class="state-text">正在加载学习报告…</p>
    </div>

    <!-- 状态 2: 链接失效 / 暂时打不开 -->
    <div v-else-if="errorMessage" class="state">
      <div class="state-icon" :class="{ warn: !linkInvalid }">
        <Lock v-if="linkInvalid" class="icon-lg" />
        <WifiOff v-else class="icon-lg" />
      </div>
      <h3 class="state-title">{{ linkInvalid ? '链接已失效' : '报告暂时打不开' }}</h3>
      <p class="state-text">{{ errorMessage }}</p>
      <!-- 网络问题可以重试；链接失效只能找老师要新链接 -->
      <button v-if="!linkInvalid" class="retry" type="button" @click="loadReport">重新加载</button>
      <p v-else class="state-hint">请联系授课老师或班主任重新发送链接。</p>
    </div>

    <!-- 状态 3: 报告内容 -->
    <div v-else class="page">
      <header class="hero">
        <div class="avatar">
          <img v-if="headerData.avatar" :src="headerData.avatar" alt="" />
          <span v-else>{{ headerData.name.slice(-1) }}</span>
        </div>
        <div>
          <h1 class="hero-name">{{ headerData.name }}</h1>
          <p class="hero-sub">
            {{ isSingleLesson ? '本节课学习报告' : headerData.attendedCount ? `已上 ${headerData.attendedCount} 次课` : '学习报告' }}
          </p>
        </div>
      </header>

      <main class="cards">
        <article v-for="(lesson, idx) in lessonList" :key="lesson.lessonId || idx" class="card">
          <div class="card-head">
            <div class="card-titles">
              <span class="course">{{ lesson.courseName }}</span>
              <h2 class="lesson-title">{{ lesson.lessonTitle }}</h2>
            </div>
            <div class="when">
              <div>{{ lesson.dateFormatted }}</div>
              <div>{{ lesson.timeSlot }}</div>
            </div>
          </div>

          <!-- 老师的评价 -->
          <section v-if="lesson.personalizedComment" class="letter">
            <div class="letter-head">
              <span class="letter-from">{{ teacherTitle(lesson.teacherName) }}的评价</span>
              <span v-if="lesson.performanceTag" class="tag">{{ lesson.performanceTag }}</span>
            </div>
            <p class="letter-body">{{ lesson.personalizedComment }}</p>
          </section>

          <!-- 老师的语音点评 -->
          <section v-if="lesson.voice" class="block">
            <h3 class="block-title">
              <Mic class="icon" />老师的语音点评 <span class="muted">{{ lesson.voice.durationFormatted }}</span>
            </h3>
            <audio controls preload="none" :src="lesson.voice.audioUrl" class="audio" />
          </section>

          <!-- 照片 -->
          <section v-if="lesson.photos && lesson.photos.length > 0" class="block">
            <h3 class="block-title"><Image class="icon" />课堂照片 <span class="muted">{{ lesson.photos.length }} 张</span></h3>
            <div class="photos" :class="lesson.photos.length === 1 ? 'one' : lesson.photos.length <= 4 ? 'two' : 'three'">
              <el-image
                v-for="photo in lesson.photos"
                :key="photo.id"
                :src="photo.thumbnailUrl"
                :preview-src-list="photo.previewList"
                preview-teleported
                class="photo"
                fit="cover"
                loading="lazy"
              />
            </div>
          </section>

          <!-- 视频：页面内播放，不再跳到新标签页 -->
          <section v-if="lesson.video" class="block">
            <h3 class="block-title"><Video class="icon" />课堂视频</h3>
            <video class="video" controls playsinline preload="none" :src="lesson.video.videoUrl" />
          </section>

          <!-- 本节课学了什么 -->
          <section v-if="lesson.studyContentHtml" class="block">
            <h3 class="block-title">本节课学了什么</h3>
            <div class="content" v-html="lesson.studyContentHtml" />
          </section>

          <!-- 获得的徽章 -->
          <section v-if="lesson.badges && lesson.badges.length > 0" class="badges">
            <span v-for="b in lesson.badges" :key="b.id" class="badge"><Trophy class="icon" />{{ b.title }}</span>
          </section>
        </article>
      </main>

      <footer class="footer">一校云 · 家校共育</footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Lock, WifiOff, Mic, Image, Video, Trophy } from 'lucide-vue-next';
import '@/assets/styles/parent-theme.css';

const route = useRoute();
const loading = ref(true);
const errorMessage = ref('');
const reportData = ref<any>(null);

const token = computed(() => (route.query.token as string) || '');
const scheduleEventId = computed(() => (route.query.scheduleEventId as string) || '');
const isSingleLesson = computed(() => Boolean(scheduleEventId.value));

const headerData = computed(() => {
  if (!reportData.value) {
    return { name: '学员', attendedCount: 0, avatar: '' };
  }
  if (isSingleLesson.value) {
    return {
      name: reportData.value.studentName || '学员',
      attendedCount: 0,
      avatar: reportData.value.avatar || '',
    };
  }
  const summary = reportData.value.studentSummary || {};
  return {
    name: summary.studentName || '学员',
    // 没有数据时不显示上课次数 (以前默认显示「已上 1 次课」)
    attendedCount: Number(summary.totalLessonsAttended) || 0,
    avatar: summary.avatar || '',
  };
});

const lessonList = computed(() => {
  if (!reportData.value) return [];
  if (isSingleLesson.value) {
    return reportData.value.lesson ? [reportData.value.lesson] : [];
  }
  return reportData.value.feed || [];
});

/** 老师称呼：李明 → 李明老师 (已经带「老师」的不重复加) */
function teacherTitle(name?: string | null): string {
  const n = (name || '').trim();
  if (!n) return '老师';
  return n.endsWith('老师') ? n : `${n}老师`;
}

// 区分「链接失效」(只能重新获取链接) 和「网络或服务暂时出错」(可以重新加载)
const linkInvalid = ref(false);

onMounted(() => loadReport());

async function loadReport() {
  errorMessage.value = '';
  linkInvalid.value = false;
  if (!token.value) {
    linkInvalid.value = true;
    errorMessage.value = '链接不完整，请重新从微信通知里打开。';
    loading.value = false;
    return;
  }
  loading.value = true;

  try {
    let url = '';
    if (isSingleLesson.value) {
      url = `/api/educational/public/growth/lesson?token=${encodeURIComponent(token.value)}&scheduleEventId=${encodeURIComponent(scheduleEventId.value)}`;
    } else {
      url = `/api/educational/public/growth/feed?token=${encodeURIComponent(token.value)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        linkInvalid.value = true;
        throw new Error('为保护孩子的隐私，分享链接有有效期，这个链接已经过期。');
      }
      throw new Error('服务暂时出了点问题，请稍后重新加载。');
    }

    const body = await response.json();
    // 接口返回统一包装 { code, message, data }：报告内容在 data 里。
    // 以前直接把整个包装当成报告，页面只显示「学员」和一个空页面
    reportData.value = body && typeof body === 'object' && 'data' in body ? body.data : body;
  } catch (err: any) {
    errorMessage.value = err instanceof TypeError ? '网络连接不稳定，请检查网络后重新加载。' : (err.message || '报告加载失败，请稍后重新加载。');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.report {
  padding-bottom: 48px;
}
.page {
  max-width: 480px;
  margin: 0 auto;
}
.state {
  max-width: 420px;
  margin: 0 auto;
  padding: 96px 24px;
  text-align: center;
}
.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 16px;
  border: 3px solid var(--p-brand-50);
  border-top-color: var(--p-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.state-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-rose-50);
  color: var(--p-rose-ink);
}
.state-icon.warn {
  background: var(--p-amber-50);
  color: var(--p-amber-ink);
}
.icon-lg {
  width: 32px;
  height: 32px;
}
.state-title {
  font-size: var(--p-fs-title);
  font-weight: 600;
}
.state-text {
  margin-top: 8px;
  font-size: var(--p-fs-body);
  line-height: 1.6;
  color: var(--p-ink-3);
}
.state-hint {
  margin-top: 20px;
  font-size: var(--p-fs-small);
  color: var(--p-ink-2);
}
.retry {
  margin-top: 24px;
  min-height: 44px;
  padding: 0 28px;
  border: 0;
  border-radius: 999px;
  background: var(--p-brand);
  color: var(--p-surface);
  font-size: var(--p-fs-body);
  font-weight: 600;
}
.hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 28px 20px 40px;
  background: linear-gradient(135deg, var(--p-brand), var(--p-brand-strong));
  color: var(--p-surface);
  border-radius: 0 0 var(--p-r-card) var(--p-r-card);
}
.avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.8);
  font-size: var(--p-fs-title);
  font-weight: 600;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-name {
  font-size: var(--p-fs-large);
  font-weight: 600;
}
.hero-sub {
  margin-top: 4px;
  font-size: var(--p-fs-body);
  color: rgba(255, 255, 255, 0.9);
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: -20px;
  padding: 0 16px;
}
.card {
  padding: 20px;
  border-radius: var(--p-r-card);
  background: var(--p-surface);
  box-shadow: var(--p-shadow);
}
.card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--p-line);
}
.card-titles {
  min-width: 0;
}
.course {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--p-r-sm);
  background: var(--p-brand-50);
  color: var(--p-brand);
  font-size: var(--p-fs-small);
  font-weight: 600;
}
.lesson-title {
  margin-top: 8px;
  font-size: var(--p-fs-title);
  font-weight: 600;
  line-height: 1.4;
}
.when {
  flex-shrink: 0;
  text-align: right;
  font-size: var(--p-fs-small);
  color: var(--p-ink-3);
  line-height: 1.6;
}
.letter {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: var(--p-r-inner);
  background: var(--p-canvas);
  border-left: 3px solid var(--p-brand);
}
.letter-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.letter-from {
  font-size: var(--p-fs-small);
  font-weight: 600;
  color: var(--p-ink-2);
}
.tag {
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: var(--p-r-sm);
  background: var(--p-mint-50);
  color: var(--p-mint);
  font-size: var(--p-fs-caption);
  font-weight: 600;
}
.letter-body {
  margin-top: 8px;
  font-size: var(--p-fs-subtitle);
  line-height: 1.7;
}
.block {
  margin-top: 18px;
}
.block-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: var(--p-fs-subtitle);
  font-weight: 600;
}
.muted {
  font-weight: 400;
  font-size: var(--p-fs-small);
  color: var(--p-ink-3);
}
.icon {
  width: 18px;
  height: 18px;
  color: var(--p-ink-3);
}
.audio {
  width: 100%;
}
.photos {
  display: grid;
  gap: 6px;
}
.photos.one {
  grid-template-columns: 1fr;
}
.photos.two {
  grid-template-columns: repeat(2, 1fr);
}
.photos.three {
  grid-template-columns: repeat(3, 1fr);
}
.photo {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--p-r-inner);
  cursor: pointer;
}
.video {
  width: 100%;
  border-radius: var(--p-r-inner);
  background: var(--p-ink);
}
.content {
  padding: 14px 16px;
  border-radius: var(--p-r-inner);
  background: var(--p-canvas);
  font-size: var(--p-fs-body);
  line-height: 1.7;
  color: var(--p-ink-2);
}
.content :deep(ul) {
  padding-left: 1.2em;
  list-style: disc;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--p-line);
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--p-amber-50);
  color: var(--p-amber-ink);
  font-size: var(--p-fs-small);
  font-weight: 600;
}
.badge .icon {
  color: var(--p-amber);
}
.footer {
  padding: 28px 0 8px;
  text-align: center;
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2.4s;
  }
}
</style>
