<template>
  <div class="p-5 space-y-4 bg-st-bg min-h-[calc(100vh-60px)]">
    <!-- 头部说明条 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center space-x-2">
          <h2 class="text-base font-bold text-gray-800">科目体系设置 (教研中心)</h2>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          科目目录为系统预设，关联课程数按课程库实时统计。科目暂不支持在线新增或修改。
        </p>
      </div>
      <el-button @click="handleExportSubjects">导出科目列表</el-button>
    </div>

    <!-- 4 大科目分类指标卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="stat in categoryStats"
        :key="stat.key"
        @click="selectedCategory = stat.key"
        :class="[
          'bg-white rounded-lg p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between',
          selectedCategory === stat.key ? 'border-st-primary ring-1 ring-st-primary/20 bg-st-primary/5' : 'border-gray-200 hover:border-gray-300'
        ]"
      >
        <div class="space-y-1">
          <div class="text-xs text-gray-500 flex items-center space-x-1.5">
            <component :is="stat.icon" class="w-4 h-4 text-st-primary" />
            <span class="font-medium text-gray-700">{{ stat.title }}</span>
          </div>
          <div class="text-2xl font-bold font-mono text-gray-800">
            {{ stat.count }} <span class="text-xs font-normal text-st-secondary">个科目</span>
          </div>
          <div class="text-xs text-st-secondary">涵盖 {{ stat.courseTotal }} 门标准化课系</div>
        </div>
        <div class="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-st-primary">
          <component :is="stat.icon" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- 主体：分类筛选与科目明细表格 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-gray-200/80 space-y-4">
      <!-- 表格上方过滤栏 -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div class="flex items-center space-x-2 text-xs">
          <span class="text-gray-500 font-medium">分类过滤：</span>
          <el-radio-group v-model="selectedCategory">
            <el-radio-button label="all">全部科目 ({{ subjects.length }})</el-radio-button>
            <el-radio-button label="programming">软件编程 (3)</el-radio-button>
            <el-radio-button label="robotics">硬件机器人 (1)</el-radio-button>
            <el-radio-button label="science">科学探索 (1)</el-radio-button>
            <el-radio-button label="art">数智艺术 (1)</el-radio-button>
          </el-radio-group>
        </div>

        <div class="flex items-center space-x-2">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索科目名称、编码或适用学段..."
            clearable
            class="!w-64"
          />
        </div>
      </div>

      <!-- 科目数据表格 -->
      <el-table
        :data="filteredSubjects"
        style="width: 100%"
        stripe
        size="default"
        class="text-xs"
      >
        <el-table-column prop="code" label="科目编码" width="150">
          <template #default="{ row }">
            <span class="font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
              {{ row.code }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="科目名称" min-width="180">
          <template #default="{ row }">
            <div class="font-bold text-gray-800 text-sm hover:text-st-primary transition-colors">
              {{ row.name }}
            </div>
            <div class="text-xs text-st-secondary mt-0.5">{{ row.description }}</div>
          </template>
        </el-table-column>

        <el-table-column prop="categoryName" label="所属体系" width="140">
          <template #default="{ row }">
            <span
              :class="[
                'px-2 py-0.5 rounded text-xs font-medium border',
                row.category === 'programming' ? 'bg-blue-50 text-st-primary border-blue-200' :
                row.category === 'robotics' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                row.category === 'science' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                'bg-emerald-50 text-emerald-700 border-emerald-200'
              ]"
            >
              {{ row.categoryName }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="targetAges" label="适用学段 / 年龄" min-width="150" />

        <el-table-column prop="syllabusVersion" label="课标大纲版本" width="120" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="warning" effect="plain" class="font-mono">
              {{ row.syllabusVersion || 'v1.0' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="courseCount" label="关联课程数" width="120" align="center">
          <template #default="{ row }">
            <span class="font-mono font-bold text-gray-700">{{ row.courseCount }}</span>
            <span class="text-xs text-st-secondary ml-0.5">门</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="运营状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'active' ? 'success' : 'info'"
              size="small"
              class="font-medium"
            >
              {{ row.status === 'active' ? '正常启用' : '已归档' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="updatedAt" label="最近更新" width="120" align="center" />

      </el-table>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Code2, Bot, Microscope, Palette } from 'lucide-vue-next'
import { curriculumApi } from '@/api'
import { PRESET_SUBJECTS } from '@/constants/curriculum'
import { downloadCsv, todayStamp } from '@/utils/csvExport'
import type { SubjectItem } from '@/types/curriculum'

const subjects = ref<SubjectItem[]>([...PRESET_SUBJECTS])
const selectedCategory = ref('all')
const searchKeyword = ref('')

async function loadData() {
  try {
    const res = await curriculumApi.getCourses({})
    if (res && res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.list || [])
      if (Array.isArray(list)) {
        subjects.value.forEach(subj => {
          const matched = list.filter((c: any) =>
            c.subject === subj.id ||
            c.subject === subj.code.toLowerCase() ||
            (c.name && c.name.includes(subj.name))
          )
          subj.courseCount = matched.length
        })
      }
    }
  } catch (err) {
    console.warn('[SubjectView] 课程统计远程拉取失败:', err)
  }
}

onMounted(() => {
  loadData()
})

const categoryStats = computed(() => {
  const programming = subjects.value.filter(s => s.category === 'programming')
  const robotics = subjects.value.filter(s => s.category === 'robotics')
  const science = subjects.value.filter(s => s.category === 'science')
  const art = subjects.value.filter(s => s.category === 'art')

  return [
    {
      key: 'programming',
      icon: Code2,
      title: '软件编程体系',
      count: programming.length,
      courseTotal: programming.reduce((sum, s) => sum + s.courseCount, 0)
    },
    {
      key: 'robotics',
      icon: Bot,
      title: '硬件创客体系',
      count: robotics.length,
      courseTotal: robotics.reduce((sum, s) => sum + s.courseCount, 0)
    },
    {
      key: 'science',
      icon: Microscope,
      title: '科学探索体系',
      count: science.length,
      courseTotal: science.reduce((sum, s) => sum + s.courseCount, 0)
    },
    {
      key: 'art',
      icon: Palette,
      title: '数智艺术体系',
      count: art.length,
      courseTotal: art.reduce((sum, s) => sum + s.courseCount, 0)
    }
  ]
})

const filteredSubjects = computed(() => {
  return subjects.value.filter(s => {
    if (selectedCategory.value !== 'all' && s.category !== selectedCategory.value) {
      return false
    }
    if (searchKeyword.value && searchKeyword.value.trim().length > 0) {
      const kw = searchKeyword.value.trim().toLowerCase()
      const matchName = s.name.toLowerCase().includes(kw)
      const matchCode = s.code.toLowerCase().includes(kw)
      const matchAges = (s.targetAges || '').toLowerCase().includes(kw)
      if (!matchName && !matchCode && !matchAges) return false
    }
    return true
  })
})

function handleExportSubjects() {
  downloadCsv(`科目列表-${todayStamp()}`, [
    { title: '科目编码', value: (s: SubjectItem) => s.code },
    { title: '科目名称', value: (s) => s.name },
    { title: '所属体系', value: (s) => s.categoryName },
    { title: '适用学段', value: (s) => s.targetAges },
    { title: '关联课程数', value: (s) => s.courseCount },
    { title: '状态', value: (s) => (s.status === 'active' ? '启用' : '已归档') },
  ], filteredSubjects.value)
}
</script>
