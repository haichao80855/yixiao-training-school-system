<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 48 48"
    role="img"
    :aria-label="name ? `${name}的头像` : '学员头像'"
    class="student-avatar"
  >
    <defs>
      <clipPath :id="clipId">
        <circle cx="24" cy="24" r="24" />
      </clipPath>
    </defs>
    <g :clip-path="`url(#${clipId})`">
      <rect width="48" height="48" :fill="tone.bg" />
      <!-- 肩部 / 校服 -->
      <path d="M8 50c0-9.4 7.2-15 16-15s16 5.6 16 15z" :fill="tone.body" />
      <path d="M20.5 35.6 24 40l3.5-4.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".85" />
      <!-- 长发后层（需画在面部之后层级之下） -->
      <path v-if="variant === 6" d="M14.6 31.5c-1.4-3.4-1.6-8-.7-11.8C15.2 14.3 19.2 11 24 11s8.8 3.3 10.1 8.7c.9 3.8.7 8.4-.7 11.8z" :fill="tone.hair" />
      <!-- 颈部与面部 -->
      <rect x="21" y="27" width="6" height="7" rx="3" :fill="skin" />
      <circle cx="24" cy="21" r="8.5" :fill="skin" />

      <!-- 发型变体 -->
      <path v-if="variant === 0" d="M15.4 20.4c-.3-6 3.8-9.6 8.6-9.6s8.9 3.6 8.6 9.6c-1.6-2.9-4.2-4.3-8.6-4.3s-7 1.4-8.6 4.3z" :fill="tone.hair" />
      <path v-else-if="variant === 1" d="M15.3 21.5c-.6-6.6 3.6-10.7 8.7-10.7 5.4 0 9.4 4 8.7 10.4-2.2-.6-5.4-2.6-7-5.3-1.9 2.8-6 4.9-10.4 5.6z" :fill="tone.hair" />
      <path v-else-if="variant === 2" d="M15.5 27.5c-1.8-2.4-1.9-5.8-1.2-8.6 1-4.9 4.9-8.1 9.7-8.1s8.7 3.2 9.7 8.1c.7 2.8.6 6.2-1.2 8.6l-.2-6.6c-2.2-1.6-4.6-3.9-5.6-6.2-2 2.6-6.5 5.2-11 6.2z" :fill="tone.hair" />
      <g v-else-if="variant === 3">
        <circle cx="24" cy="10.2" r="3.6" :fill="tone.hair" />
        <path d="M15.4 20.8c-.4-6.2 3.7-9.9 8.6-9.9s9 3.7 8.6 9.9c-2.3-2.4-5.2-3.6-8.6-3.6s-6.3 1.2-8.6 3.6z" :fill="tone.hair" />
      </g>
      <g v-else-if="variant === 4">
        <path d="M15.4 20.4c-.3-6 3.8-9.6 8.6-9.6s8.9 3.6 8.6 9.6c-1.6-2.9-4.2-4.3-8.6-4.3s-7 1.4-8.6 4.3z" :fill="tone.hair" />
        <g fill="none" :stroke="tone.ink" stroke-width="1.2">
          <rect x="17.6" y="19.6" width="5.2" height="3.8" rx="1.6" />
          <rect x="25.2" y="19.6" width="5.2" height="3.8" rx="1.6" />
          <path d="M22.8 21.2h2.4" />
        </g>
      </g>
      <g v-else-if="variant === 6">
        <path d="M15.4 21c-.2-5.9 3.9-9.4 8.6-9.4s8.8 3.5 8.6 9.4c-2.7-1.3-5.6-3.4-6.9-5.6-1.6 2.6-5.4 4.6-10.3 5.6z" :fill="tone.hair" />
        <circle cx="30.2" cy="14.6" r="1.7" :fill="tone.body" />
      </g>
      <g v-else-if="variant === 7">
        <path d="M15.5 27.5c-1.8-2.4-1.9-5.8-1.2-8.6 1-4.9 4.9-8.1 9.7-8.1s8.7 3.2 9.7 8.1c.7 2.8.6 6.2-1.2 8.6l-.2-6.6c-2.2-1.6-4.6-3.9-5.6-6.2-2 2.6-6.5 5.2-11 6.2z" :fill="tone.hair" />
        <g fill="none" :stroke="tone.ink" stroke-width="1.2">
          <rect x="17.6" y="19.6" width="5.2" height="3.8" rx="1.6" />
          <rect x="25.2" y="19.6" width="5.2" height="3.8" rx="1.6" />
          <path d="M22.8 21.2h2.4" />
        </g>
      </g>
      <g v-else>
        <path d="M14.6 18.6c1.4-5 5-7.6 9.4-7.6s8 2.6 9.4 7.6z" :fill="tone.body" />
        <path d="M13.2 18.6h21.6" :stroke="tone.ink" stroke-width="1.6" stroke-linecap="round" />
      </g>

      <!-- 五官（眼镜款不再画眼睛） -->
      <g v-if="variant !== 4 && variant !== 7" :fill="tone.ink">
        <circle cx="20.6" cy="21.6" r="1.05" />
        <circle cx="27.4" cy="21.6" r="1.05" />
      </g>
      <path d="M21.8 25.2c1.3 1 3.1 1 4.4 0" fill="none" :stroke="tone.ink" stroke-width="1.1" stroke-linecap="round" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 学员头像：发型按性别分组（男：短发 / 侧分 / 眼镜 / 鸭舌帽；女：波波头 / 丸子头 / 长发发卡 / 波波头眼镜），
 * 组内发型与配色按学员 ID 稳定散列，同一学员始终同一形象
 * 配色限定在学术蓝系（蓝 / 靛 / 青 / 天蓝 / 石板 / 雾紫）
 */
const props = withDefaults(defineProps<{
  seed?: string
  name?: string
  gender?: string
  size?: number
}>(), {
  seed: '',
  name: '',
  gender: '',
  size: 36
})

// 男女发型池；性别未知时在全部发型中取
const MALE_VARIANTS = [0, 1, 4, 5]
const FEMALE_VARIANTS = [2, 3, 6, 7]

const TONES = [
  { bg: '#E6ECFF', body: '#2F54EB', hair: '#1E2A4A', ink: '#1E2A4A' },
  { bg: '#E8EAFB', body: '#4F46E5', hair: '#2A2547', ink: '#2A2547' },
  { bg: '#E3F2F1', body: '#0F766E', hair: '#1F2B2A', ink: '#1F2B2A' },
  { bg: '#E2F1FA', body: '#0369A1', hair: '#3B2A22', ink: '#1E293B' },
  { bg: '#EBEEF3', body: '#475569', hair: '#1E293B', ink: '#1E293B' },
  { bg: '#EFEAF7', body: '#6D5BA8', hair: '#3A2B26', ink: '#2A2340' }
]
const SKINS = ['#F6D7BF', '#F1CBAE', '#EBC09E']

function hash(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const h = computed(() => hash(props.seed || props.name || 'student'))
const tone = computed(() => TONES[h.value % TONES.length])
const variant = computed(() => {
  const pool = props.gender === 'male'
    ? MALE_VARIANTS
    : props.gender === 'female'
      ? FEMALE_VARIANTS
      : [...MALE_VARIANTS, ...FEMALE_VARIANTS]
  return pool[(h.value >>> 3) % pool.length]
})
const skin = computed(() => SKINS[(h.value >>> 7) % SKINS.length])
const clipId = computed(() => `sa-${h.value.toString(36)}`)
</script>

<style scoped>
.student-avatar {
  display: block;
  flex-shrink: 0;
  border-radius: 9999px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.06);
}
</style>
