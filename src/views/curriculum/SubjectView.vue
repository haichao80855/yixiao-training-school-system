<template>
  <div class="p-5 space-y-4 bg-[#F0F2F5] min-h-[calc(100vh-60px)]">
    <!-- 头部说明条 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex items-center space-x-2">
          <span class="text-xs text-gray-500">教研</span>
          <span class="text-xs text-gray-400">/</span>
          <h2 class="text-base font-bold text-gray-800">科目体系设置 (教研中心)</h2>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          标准化建设少儿软件编程、硬件机器人、科技创新与信息学竞赛科目矩阵，统一集团教案大纲与学段进阶标准。
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <el-button size="small" @click="handleExportSubjects">
          导出科目大纲
        </el-button>
        <el-button type="primary" size="small" class="!px-4 font-medium" @click="openCreateSubjectDialog">
          + 新增科目分类
        </el-button>
      </div>
    </div>

    <!-- 4 大科目分类指标卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="stat in categoryStats"
        :key="stat.key"
        @click="selectedCategory = stat.key"
        :class="[
          'bg-white rounded-lg p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between',
          selectedCategory === stat.key ? 'border-[#1890FF] ring-1 ring-blue-100 bg-blue-50/20' : 'border-gray-200 hover:border-gray-300'
        ]"
      >
        <div class="space-y-1">
          <div class="text-xs text-gray-500 flex items-center space-x-1.5">
            <span class="text-base">{{ stat.icon }}</span>
            <span class="font-medium text-gray-700">{{ stat.title }}</span>
          </div>
          <div class="text-2xl font-bold font-mono text-gray-800">
            {{ stat.count }} <span class="text-xs font-normal text-gray-400">个科目</span>
          </div>
          <div class="text-[11px] text-gray-400">涵盖 {{ stat.courseTotal }} 门标准化课系</div>
        </div>
        <div class="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 text-[#1890FF]">
          <span class="text-lg">{{ stat.badgeIcon }}</span>
        </div>
      </div>
    </div>

    <!-- 主体：分类筛选与科目明细表格 -->
    <div class="bg-white rounded-lg p-5 shadow-sm border border-gray-200/80 space-y-4">
      <!-- 表格上方过滤栏 -->
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div class="flex items-center space-x-2 text-xs">
          <span class="text-gray-500 font-medium">分类过滤：</span>
          <el-radio-group v-model="selectedCategory" size="small">
            <el-radio-button label="all">全部科目 ({{ subjects.length }})</el-radio-button>
            <el-radio-button label="programming">💻 软件编程 (3)</el-radio-button>
            <el-radio-button label="robotics">🤖 硬件机器人 (1)</el-radio-button>
            <el-radio-button label="science">🔬 科学探索 (1)</el-radio-button>
            <el-radio-button label="art">🎨 数智艺术 (1)</el-radio-button>
          </el-radio-group>
        </div>

        <div class="flex items-center space-x-2">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索科目名称、编码或适用学段..."
            size="small"
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
            <span class="font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
              {{ row.code }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="科目名称" min-width="180">
          <template #default="{ row }">
            <div class="font-bold text-gray-800 text-sm hover:text-[#1890FF] transition-colors">
              {{ row.name }}
            </div>
            <div class="text-[11px] text-gray-400 mt-0.5">{{ row.description }}</div>
          </template>
        </el-table-column>

        <el-table-column prop="categoryName" label="所属体系" width="140">
          <template #default="{ row }">
            <span
              :class="[
                'px-2 py-0.5 rounded text-[11px] font-medium border',
                row.category === 'programming' ? 'bg-blue-50 text-[#1890FF] border-blue-200' :
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
            <span class="text-[11px] text-gray-400 ml-0.5">门</span>
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

        <el-table-column label="管理操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditSubjectDialog(row)">
              编辑
            </el-button>
            <el-button link type="primary" size="small" @click="handleViewSyllabus(row)">
              课标大纲
            </el-button>
            <el-button
              link
              :type="row.status === 'active' ? 'danger' : 'success'"
              size="small"
              @click="toggleSubjectStatus(row)"
            >
              {{ row.status === 'active' ? '归档' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增 / 编辑科目弹窗 -->
    <el-dialog
      v-model="subjectDialogVisible"
      :title="isEditSubject ? `编辑科目：${subjectForm.name}` : '新增科目分类体系'"
      width="580px"
      class="rounded-xl"
    >
      <el-form
        ref="subjectFormRef"
        :model="subjectForm"
        :rules="subjectRules"
        label-width="100px"
        size="default"
        class="pr-4 py-2"
      >
        <el-form-item label="科目名称" prop="name">
          <el-input v-model="subjectForm.name" placeholder="例如：少儿图形化编程 (Scratch)" />
        </el-form-item>
        <el-form-item label="科目编码" prop="code">
          <el-input v-model="subjectForm.code" placeholder="例如：SUBJ-PROG-04" />
        </el-form-item>
        <el-form-item label="所属大类" prop="category">
          <el-select v-model="subjectForm.category" placeholder="请选择所属大类" class="w-full">
            <el-option label="软件编程体系" value="programming" />
            <el-option label="硬件创客体系" value="robotics" />
            <el-option label="科学探索体系" value="science" />
            <el-option label="数字艺术体系" value="art" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用学段" prop="targetAges">
          <el-input v-model="subjectForm.targetAges" placeholder="例如：小学 1-3 年级 (6-9岁)" />
        </el-form-item>
        <el-form-item label="课标版本" prop="syllabusVersion">
          <el-input v-model="subjectForm.syllabusVersion" placeholder="例如：v1.0" />
        </el-form-item>
        <el-form-item label="科目描述">
          <el-input
            v-model="subjectForm.description"
            type="textarea"
            :rows="3"
            placeholder="该科目教学目标、学科特色与核心知识点体系..."
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="flex justify-end space-x-2">
          <el-button @click="subjectDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSaveSubject">保存科目</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { curriculumApi } from '@/api'
import { PRESET_SUBJECTS } from '@/constants/curriculum'
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
      icon: '💻',
      title: '软件编程体系',
      badgeIcon: '⌨️',
      count: programming.length,
      courseTotal: programming.reduce((sum, s) => sum + s.courseCount, 0)
    },
    {
      key: 'robotics',
      icon: '🤖',
      title: '硬件创客体系',
      badgeIcon: '⚙️',
      count: robotics.length,
      courseTotal: robotics.reduce((sum, s) => sum + s.courseCount, 0)
    },
    {
      key: 'science',
      icon: '🔬',
      title: '科学探索体系',
      badgeIcon: '🧪',
      count: science.length,
      courseTotal: science.reduce((sum, s) => sum + s.courseCount, 0)
    },
    {
      key: 'art',
      icon: '🎨',
      title: '数智艺术体系',
      badgeIcon: '🖌️',
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

// 弹窗表单状态
const subjectDialogVisible = ref(false)
const isEditSubject = ref(false)
const subjectFormRef = ref<FormInstance>()

const defaultSubjectForm: SubjectItem = {
  id: '',
  code: '',
  name: '',
  targetAges: '',
  category: 'programming',
  categoryName: '软件编程体系',
  courseCount: 0,
  status: 'active',
  syllabusVersion: 'v1.0',
  description: ''
}

const subjectForm = reactive<SubjectItem>({ ...defaultSubjectForm })

const subjectRules: FormRules = {
  name: [{ required: true, message: '请输入科目名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入科目编码', trigger: 'blur' }],
  category: [{ required: true, message: '请选择所属大类', trigger: 'change' }],
  targetAges: [{ required: true, message: '请输入适用学段', trigger: 'blur' }]
}

function openCreateSubjectDialog() {
  isEditSubject.value = false
  Object.assign(subjectForm, defaultSubjectForm)
  subjectForm.id = `subj-${Date.now()}`
  subjectForm.code = `SUBJ-NEW-${Math.floor(Math.random() * 900 + 100)}`
  subjectDialogVisible.value = true
}

function openEditSubjectDialog(row: SubjectItem) {
  isEditSubject.value = true
  Object.assign(subjectForm, JSON.parse(JSON.stringify(row)))
  subjectDialogVisible.value = true
}

async function handleSaveSubject() {
  if (!subjectFormRef.value) return
  await subjectFormRef.value.validate(valid => {
    if (!valid) return
    const categoryNameMap: Record<string, string> = {
      programming: '软件编程体系',
      robotics: '硬件创客体系',
      science: '科学探索体系',
      art: '数字艺术体系'
    }
    subjectForm.categoryName = categoryNameMap[subjectForm.category] || '综合体系'
    subjectForm.updatedAt = new Date().toISOString().split('T')[0]

    const idx = subjects.value.findIndex(s => s.id === subjectForm.id)
    if (idx >= 0) {
      subjects.value[idx] = { ...subjectForm }
      ElMessage.success(`科目「${subjectForm.name}」修改已保存！`)
    } else {
      subjects.value.unshift({ ...subjectForm })
      ElMessage.success(`新增科目「${subjectForm.name}」已成功创建！`)
    }
    subjectDialogVisible.value = false
  })
}

function toggleSubjectStatus(row: SubjectItem) {
  row.status = row.status === 'active' ? 'archived' : 'active'
  row.updatedAt = new Date().toISOString().split('T')[0]
  ElMessage.success(`科目状态已更新为「${row.status === 'active' ? '正常启用' : '已归档'}」`)
}

function handleViewSyllabus(row: SubjectItem) {
  ElMessage.info(`正在载入「${row.name}」官方教学大纲与能力图谱...`)
}

function handleExportSubjects() {
  ElMessage.success('科目体系大纲与学段拓扑图已生成导出任务！')
}
</script>
