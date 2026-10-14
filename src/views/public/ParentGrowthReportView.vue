<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 pb-16 font-sans antialiased">
    <!-- 状态 1: 加载中 -->
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div class="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-xs text-slate-400">正在开启学员专属学情档案...</p>
    </div>

    <!-- 状态 2: 错误状态 (令牌过期或签名不合法) -->
    <div v-else-if="errorMessage" class="max-w-md mx-auto p-6 pt-20 text-center space-y-4">
      <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner">
        🔒
      </div>
      <h3 class="text-base font-bold text-slate-800">无法访问该学情报告</h3>
      <p class="text-xs text-slate-500 leading-relaxed px-4">
        {{ errorMessage }}
      </p>
      <div class="pt-4">
        <span class="text-[11px] text-slate-400">如需查看最新随堂成长档案，请联系校区授课老师或教务班主任重新获取分享链接。</span>
      </div>
    </div>

    <!-- 状态 3: 正常数据渲染 -->
    <div v-else class="max-w-md mx-auto">
      <!-- 移动端顶部学员卡片 (渐变温润色系) -->
      <header class="bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 text-white p-6 pb-8 rounded-b-[2rem] shadow-lg relative overflow-hidden">
        <div class="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>

        <div class="flex items-center space-x-4 relative z-10">
          <div class="w-14 h-14 rounded-full border-2 border-white/80 overflow-hidden shadow-md bg-white/20 flex items-center justify-center text-xl font-bold">
            <img v-if="headerData.avatar" :src="headerData.avatar" class="w-full h-full object-cover" />
            <span v-else>🌟</span>
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h2 class="text-lg font-bold tracking-tight">{{ headerData.name }}</h2>
              <span class="text-[10px] bg-white/25 px-2 py-0.5 rounded-full text-white/95">学员专属</span>
            </div>
            <p class="text-blue-100 text-xs mt-1">
              {{ isSingleLesson ? '随堂精彩成果报告' : `已探索 ${headerData.attendedCount} 次课 · 累计获得 5 星好评` }}
            </p>
          </div>
        </div>
      </header>

      <!-- 课评报告卡片流 (负 margin 悬浮质感) -->
      <main class="px-4 -mt-4 space-y-4 relative z-20">
        <div
          v-for="(lesson, idx) in lessonList"
          :key="lesson.lessonId || idx"
          class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 transition"
        >
          <!-- 课次标题与日期 -->
          <div class="flex justify-between items-start border-b border-slate-100 pb-3">
            <div>
              <span class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {{ lesson.courseName }}
              </span>
              <h3 class="text-base font-bold text-slate-900 mt-1.5 leading-snug">
                {{ lesson.lessonTitle }}
              </h3>
            </div>
            <div class="text-right">
              <div class="text-xs font-mono text-slate-400">{{ lesson.dateFormatted }}</div>
              <div class="text-[11px] text-slate-400 mt-0.5">{{ lesson.timeSlot }}</div>
            </div>
          </div>

          <!-- 教师寄语与表现标签 -->
          <div class="bg-gradient-to-r from-blue-50/70 to-indigo-50/40 p-3.5 rounded-xl border border-blue-100/60 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-blue-900 flex items-center gap-1">
                <span>👩‍🏫</span> {{ lesson.teacherName }} 老师随堂寄语
              </span>
              <span v-if="lesson.performanceTag" class="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                {{ lesson.performanceTag }}
              </span>
            </div>
            <p class="text-xs text-slate-700 leading-relaxed">
              {{ lesson.personalizedComment }}
            </p>
          </div>

          <!-- 随堂原声语音条组件 (支持播放与动态波形) -->
          <div
            v-if="lesson.voice"
            class="bg-emerald-500 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-xs"
          >
            <div class="flex items-center space-x-2.5">
              <span class="text-base">🎤</span>
              <div>
                <div class="text-xs font-bold">随堂原声点评</div>
                <div class="text-[10px] text-emerald-100">点击播放老师当堂语音</div>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <audio controls :src="lesson.voice.audioUrl" class="h-7 w-36" />
              <span class="font-mono text-xs font-bold">{{ lesson.voice.durationFormatted }}</span>
            </div>
          </div>

          <!-- 9 宫格精彩照片流 -->
          <div v-if="lesson.photos && lesson.photos.length > 0" class="space-y-1.5">
            <div class="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span>📸</span> 课堂精彩瞬间 ({{ lesson.photos.length }} 张)
            </div>
            <div
              class="grid gap-2"
              :class="lesson.photos.length === 1 ? 'grid-cols-1' : lesson.photos.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'"
            >
              <el-image
                v-for="photo in lesson.photos"
                :key="photo.id"
                :src="photo.thumbnailUrl"
                :preview-src-list="photo.previewList"
                preview-teleported
                class="w-full aspect-square object-cover rounded-xl shadow-2xs border border-slate-100 cursor-pointer"
                fit="cover"
                loading="lazy"
              />
            </div>
          </div>

          <!-- 随堂视频入口 -->
          <div v-if="lesson.video" class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-lg">🎬</span>
              <div>
                <div class="text-xs font-bold text-slate-800">课堂实操编程视频作品</div>
                <div class="text-[10px] text-slate-400">见证孩子亲手实现的编程奇迹</div>
              </div>
            </div>
            <a
              :href="lesson.video.videoUrl"
              target="_blank"
              class="text-xs bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg shadow-xs hover:bg-blue-700 active:scale-95 transition"
            >
              立即播放
            </a>
          </div>

          <!-- 教学重难点大纲富文本 -->
          <div v-if="lesson.studyContentHtml" class="pt-1">
            <div class="text-xs font-bold text-slate-700 mb-1">【本课核心素养知识点】</div>
            <div
              v-html="lesson.studyContentHtml"
              class="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed"
            />
          </div>

          <!-- 激励徽章脚印 -->
          <div v-if="lesson.badges && lesson.badges.length > 0" class="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
            <div
              v-for="b in lesson.badges"
              :key="b.id"
              class="inline-flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-200/60 px-2.5 py-1 rounded-full text-[11px]"
            >
              <span>🏆</span>
              <span class="font-bold">{{ b.title }}</span>
            </div>
          </div>
        </div>
      </main>

      <!-- 底部校区安全标识 -->
      <footer class="text-center py-6 text-[11px] text-slate-400 space-y-1">
        <p>一校教培系统 · 家校共育数字化平台</p>
        <p>教学资产由校区不可变存证链安全护航</p>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const loading = ref(true);
const errorMessage = ref('');
const reportData = ref<any>(null);

const token = computed(() => (route.query.token as string) || '');
const scheduleEventId = computed(() => (route.query.scheduleEventId as string) || '');
const isSingleLesson = computed(() => Boolean(scheduleEventId.value));

const headerData = computed(() => {
  if (!reportData.value) {
    return { name: '学员', attendedCount: 1, avatar: '' };
  }
  if (isSingleLesson.value) {
    return {
      name: reportData.value.studentName || '学员',
      attendedCount: 1,
      avatar: reportData.value.avatar || '',
    };
  }
  const summary = reportData.value.studentSummary || {};
  return {
    name: summary.studentName || '学员',
    attendedCount: summary.totalLessonsAttended || 1,
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

onMounted(async () => {
  if (!token.value) {
    errorMessage.value = '未检测到有效的分享访问令牌 (Missing token)，请重新从微信通知打开。';
    loading.value = false;
    return;
  }

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
        throw new Error('该学情报告分享凭证已过期或签名无效，为保护学员隐私，系统已安全阻断访问。');
      }
      const errJson = await response.json().catch(() => null);
      throw new Error(errJson?.message || `请求失败 (${response.status})`);
    }

    const data = await response.json();
    reportData.value = data;
  } catch (err: any) {
    errorMessage.value = err.message || '加载学情成长报告失败，请稍后刷新重试。';
  } finally {
    loading.value = false;
  }
});
</script>
