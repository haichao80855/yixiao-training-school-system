<template>
  <div class="p-5 space-y-4">
    <!-- 头部横条 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center space-x-3">
          <h1 class="text-lg font-bold text-st-title">业务参数与异动原因数据字典</h1>
          <span class="px-2.5 py-0.5 text-xs font-mono rounded bg-blue-50 text-st-primary border border-blue-200">
            Dictionary Engine
          </span>
        </div>
        <p class="text-xs text-st-secondary mt-1">
          集中维护系统全局业务枚举、学员 7 分支异动原因字典、教务考勤预警阈值及常规上课时长参数
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <el-button type="primary" size="small" @click="openAddDictModal">
          + 新增字典项
        </el-button>
      </div>
    </div>

    <!-- 主卡片 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border space-y-4">
      <!-- 顶部分类 Tabs -->
      <div class="border-b border-st-border pb-1">
        <el-tabs v-model="activeCategoryTab" class="st-dict-tabs" @tab-change="handleTabChange">
          <el-tab-pane label="全部分类字典" name="all" />
          <el-tab-pane label="学员异动原因字典 (7大分支)" name="trans_reason" />
          <el-tab-pane label="学员预警规则与阈值" name="warning_rule" />
          <el-tab-pane label="常用上课标准时长 (min)" name="lesson_duration" />
        </el-tabs>
      </div>

      <!-- 工具筛选栏 -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center space-x-3">
          <el-input
            v-model="searchQuery"
            placeholder="搜索字典键 (Key) 或显示标签 (Label)"
            prefix-icon="Search"
            size="small"
            clearable
            class="!w-64"
          />
          <el-select v-model="filterStatus" placeholder="状态筛选" size="small" clearable class="!w-28">
            <el-option label="全部状态" value="" />
            <el-option label="启用中" :value="true" />
            <el-option label="已停用" :value="false" />
          </el-select>
        </div>

        <div class="text-st-muted text-[11px]">
          共筛选出 <span class="font-bold text-st-primary font-mono">{{ filteredDictList.length }}</span> 个业务字典项
        </div>
      </div>

      <!-- 字典表格 -->
      <el-table
        :data="filteredDictList"
        style="width: 100%"
        stripe
        size="small"
        row-key="id"
        class="st-dict-table text-xs"
      >
        <el-table-column prop="category" label="字典分类" width="160">
          <template #default="{ row }">
            <el-tag size="small" :type="getCategoryTagType(row.category)">
              {{ getCategoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="dictKey" label="字典键值 (Key)" min-width="190">
          <template #default="{ row }">
            <span class="font-mono text-xs font-semibold text-st-title bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {{ row.dictKey }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="label" label="显示标签 (Label)" min-width="200">
          <template #default="{ row }">
            <span class="font-medium text-st-title">{{ row.label }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="order" label="排序权重" width="90" align="center">
          <template #default="{ row }">
            <span class="font-mono px-2 py-0.5 rounded-full bg-slate-100 text-st-title font-medium text-[11px]">
              {{ row.order }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="remark" label="业务说明" min-width="180">
          <template #default="{ row }">
            <span class="text-st-muted text-[11px]">{{ row.remark || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="启用状态" width="110" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              size="small"
              inline-prompt
              active-text="开"
              inactive-text="关"
              @change="handleToggleStatus(row as any)"
            />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditModal(row as any)">
              编辑
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row as any)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 弹窗: 新增/编辑字典项 -->
    <el-dialog
      v-model="showDictModal"
      :title="isEditMode ? '编辑字典项' : '新增业务字典项'"
      :width="DIALOG_SIZE.sm"
      destroy-on-close
    >
      <el-form :model="dictForm" :label-width="FORM_LABEL_WIDTH.md" size="small" class="pt-2">
        <el-form-item label="字典分类" required>
          <el-select v-model="dictForm.category" class="w-full" :disabled="isEditMode">
            <el-option label="学员异动原因字典 (trans_reason)" value="trans_reason" />
            <el-option label="学员预警规则阈值 (warning_rule)" value="warning_rule" />
            <el-option label="常用上课时长标准 (lesson_duration)" value="lesson_duration" />
          </el-select>
        </el-form-item>

        <el-form-item label="字典键值" required>
          <el-input
            v-model="dictForm.dictKey"
            placeholder="全大写下划线格式，如：TRANS_REASON_TIME"
            :disabled="isEditMode"
          />
        </el-form-item>

        <el-form-item label="显示标签" required>
          <el-input v-model="dictForm.label" placeholder="前端界面下拉展示文案" />
        </el-form-item>

        <el-form-item label="排序权重" required>
          <el-input-number v-model="dictForm.order" :min="1" :max="99" class="!w-32" />
        </el-form-item>

        <el-form-item label="初始状态">
          <el-radio-group v-model="dictForm.enabled">
            <el-radio :value="true">立即启用</el-radio>
            <el-radio :value="false">暂不启用</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="业务备注">
          <el-input v-model="dictForm.remark" type="textarea" :rows="2" placeholder="应用场景说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showDictModal = false">取消</el-button>
        <el-button type="primary" size="small" @click="submitDictForm">
          {{ isEditMode ? '保存修改' : '确认新增' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DIALOG_SIZE, FORM_LABEL_WIDTH } from '@/constants/ui'
import type { DictItem } from '@/types/system'
import { systemApi } from '@/api'

// --- 状态数据 ---
const activeCategoryTab = ref('all')
const searchQuery = ref('')
const filterStatus = ref<boolean | ''>('')
const dictList = ref<DictItem[]>([])

async function loadData() {
  try {
    const res = await systemApi.getDictItems()
    if (res && res.data && Array.isArray(res.data)) {
      dictList.value = res.data
    }
  } catch (err: any) {
    ElMessage.error(err.message || '获取字典项失败')
  }
}

// 弹窗表单状态
const showDictModal = ref(false)
const isEditMode = ref(false)
const editingId = ref('')
const dictForm = ref({
  category: 'trans_reason',
  dictKey: '',
  label: '',
  order: 1,
  enabled: true,
  remark: ''
})

// --- 计算属性: 过滤字典列表 ---
const filteredDictList = computed(() => {
  let list = [...dictList.value]

  // 1. 分类 Tab 过滤
  if (activeCategoryTab.value !== 'all') {
    list = list.filter(d => d.category === activeCategoryTab.value)
  }

  // 2. 状态过滤
  if (filterStatus.value !== '') {
    list = list.filter(d => d.enabled === filterStatus.value)
  }

  // 3. 模糊搜索
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(
      d => d.dictKey.toLowerCase().includes(q) || d.label.toLowerCase().includes(q) || (d.remark && d.remark.toLowerCase().includes(q))
    )
  }

  // 按排序权重正序排列
  return list.sort((a, b) => a.order - b.order)
})

function handleTabChange() {
  // Tab 切换时保留检索条件
}

// --- 辅助映射 ---
function getCategoryLabel(cat: string): string {
  switch (cat) {
    case 'trans_reason': return '学员异动原因'
    case 'warning_rule': return '学员预警规则'
    case 'lesson_duration': return '常用上课时长'
    default: return cat
  }
}

function getCategoryTagType(cat: string): 'primary' | 'success' | 'warning' | 'info' {
  switch (cat) {
    case 'trans_reason': return 'primary'
    case 'warning_rule': return 'warning'
    case 'lesson_duration': return 'success'
    default: return 'info'
  }
}

// --- 增删改查动作 ---
function openAddDictModal() {
  isEditMode.value = false
  editingId.value = ''
  dictForm.value = {
    category: activeCategoryTab.value !== 'all' ? activeCategoryTab.value : 'trans_reason',
    dictKey: `KEY_${Date.now()}`,
    label: '',
    order: dictList.value.length + 1,
    enabled: true,
    remark: ''
  }
  showDictModal.value = true
}

function openEditModal(item: DictItem) {
  isEditMode.value = true
  editingId.value = item.id
  dictForm.value = {
    category: item.category,
    dictKey: item.dictKey,
    label: item.label,
    order: item.order,
    enabled: item.enabled,
    remark: item.remark || ''
  }
  showDictModal.value = true
}

async function submitDictForm() {
  if (!dictForm.value.dictKey.trim() || !dictForm.value.label.trim()) {
    ElMessage.warning('请补全字典键值 (Key) 和显示标签 (Label)')
    return
  }

  try {
    if (isEditMode.value) {
      await systemApi.updateDictItem(editingId.value, {
        label: dictForm.value.label,
        order: dictForm.value.order,
        enabled: dictForm.value.enabled,
        remark: dictForm.value.remark
      })
      ElMessage.success(`字典项 [${dictForm.value.dictKey}] 修改成功！`)
    } else {
      await systemApi.createDictItem({
        category: dictForm.value.category,
        dictKey: dictForm.value.dictKey,
        label: dictForm.value.label,
        order: dictForm.value.order,
        enabled: dictForm.value.enabled,
        remark: dictForm.value.remark
      })
      ElMessage.success(`字典项 [${dictForm.value.dictKey}] 创建成功！`)
    }
    showDictModal.value = false
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '保存字典项失败')
  }
}

async function handleToggleStatus(item: DictItem) {
  const nextEnabled = !item.enabled
  try {
    await systemApi.toggleDictItemStatus(item.id, nextEnabled)
    item.enabled = nextEnabled
    ElMessage.success(`字典项 [${item.dictKey}] 已变更为：${nextEnabled ? '启用中' : '已停用'}`)
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '切换字典状态失败')
  }
}

function handleDelete(item: DictItem) {
  ElMessageBox.confirm(
    `确定要永久删除字典项 [${item.dictKey}] (${item.label}) 吗？此操作不可逆。`,
    '删除字典确认',
    {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await systemApi.deleteDictItem(item.id)
      ElMessage.success(`字典项 [${item.dictKey}] 已成功删除`)
      await loadData()
    } catch (err: any) {
      ElMessage.error(err.message || '删除字典项失败')
    }
  }).catch(() => {})
}

onMounted(async () => {
  await loadData()
})
</script>

<style scoped>
.st-dict-tabs :deep(.el-tabs__item) {
  font-size: 13px;
  color: var(--st-color-text-secondary, #64748B);
}
.st-dict-tabs :deep(.el-tabs__item.is-active) {
  color: var(--st-color-primary, #3B82F6);
  font-weight: bold;
}
.st-dict-tabs :deep(.el-tabs__active-bar) {
  background-color: var(--st-color-primary, #3B82F6);
}

.st-dict-table :deep(.el-table__header th) {
  background-color: var(--st-color-bg, #F8FAFC);
  color: var(--st-color-text-title, #0F172A);
  font-weight: 600;
}
</style>
