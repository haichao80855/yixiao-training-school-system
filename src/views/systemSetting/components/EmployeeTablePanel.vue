<template>
  <div class="bg-white rounded-lg p-4 shadow-card border border-st-border flex flex-col space-y-3 h-full">
    <!-- 头部标题与统计 -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-st-border gap-2">
      <div>
        <div class="flex items-center space-x-2">
          <h3 class="text-sm font-bold text-st-title">
            {{ selectedNode ? selectedNode.name : '全集团' }} - 人员管理
          </h3>
          <span class="px-2 py-0.5 text-xs rounded bg-blue-50 text-st-primary font-medium">
            共 {{ filteredUsers.length }} 名员工
          </span>
        </div>
        <p class="text-[11px] text-st-muted mt-0.5">
          当前筛选范围：{{ selectedNode ? `${getLevelName(selectedNode.level)} [${selectedNode.name}] 及其直属岗位人员` : '全集团在职人员' }}
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <el-button v-if="selectedNode" size="small" @click="$emit('resetNodeSelection')">
          重置查看全员
        </el-button>
        <el-button type="primary" size="small" @click="$emit('openAddUser')">
          + 新增员工
        </el-button>
      </div>
    </div>

    <!-- 筛选工具栏 (动态绑定 campuses，消除硬编码) -->
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索姓名、账号或手机号"
        prefix-icon="Search"
        size="small"
        clearable
        class="!w-48"
      />
      <el-select v-model="filterCampusId" placeholder="管辖校区" size="small" clearable class="!w-36">
        <el-option label="全部校区" value="" />
        <el-option
          v-for="c in campuses"
          :key="c.id || c.code"
          :label="c.name"
          :value="c.id || c.code"
        />
      </el-select>
      <el-select v-model="filterRoleId" placeholder="角色组" size="small" clearable class="!w-32">
        <el-option label="全部角色" value="" />
        <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="账号状态" size="small" clearable class="!w-24">
        <el-option label="全部" value="" />
        <el-option label="正常" value="active" />
        <el-option label="锁定" value="locked" />
      </el-select>
    </div>

    <!-- 人员表格 -->
    <div class="flex-1 overflow-x-auto">
      <el-table
        :data="filteredUsers"
        style="width: 100%"
        stripe
        size="small"
        row-key="id"
        class="st-staff-table text-xs"
      >
        <el-table-column prop="name" label="姓名" width="95">
          <template #default="{ row }">
            <div class="font-medium text-st-title">{{ row.name }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="account" label="登录账号" width="105" />
        <el-table-column prop="phone" label="手机号码" width="115" />
        <el-table-column prop="campusName" label="管辖校区" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.campusName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="roleName" label="归属角色组" min-width="130">
          <template #default="{ row }">
            <span class="text-st-regular">{{ row.roleName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="postName" label="岗位职务" min-width="120">
          <template #default="{ row }">
            <span class="text-st-secondary text-[11px]">{{ row.departmentName }} / {{ row.postName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="dataScope" label="数据范围" width="85">
          <template #default="{ row }">
            <span
              :class="[
                'text-[10px] px-1.5 py-0.5 rounded font-mono',
                getDataScopeBadgeClass(row.dataScope)
              ]"
            >
              {{ getDataScopeLabel(row.dataScope) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="75">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '正常' : '锁定' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="success" size="small" @click="$emit('quickSwitch', row as any)" title="以该员工身份快速登录体验">
              体验
            </el-button>
            <el-button link type="primary" size="small" @click="$emit('resetPassword', row as any)">
              改密
            </el-button>
            <el-button link type="primary" size="small" @click="$emit('openAuth', row as any)">
              权限
            </el-button>
            <el-button
              link
              :type="row.status === 'active' ? 'warning' : 'success'"
              size="small"
              @click="$emit('toggleStatus', row as any)"
            >
              {{ row.status === 'active' ? '锁定' : '启用' }}
            </el-button>
            <el-button link type="danger" size="small" @click="$emit('deleteUser', row as any)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SystemUser, OrgNode, RoleItem, DataScope } from '@/types/system'

const props = defineProps<{
  users: SystemUser[]
  campuses: any[]
  roles: RoleItem[]
  selectedNode: OrgNode | null
}>()

defineEmits<{
  resetNodeSelection: []
  openAddUser: []
  quickSwitch: [user: SystemUser]
  resetPassword: [user: SystemUser]
  openAuth: [user: SystemUser]
  toggleStatus: [user: SystemUser]
  deleteUser: [user: SystemUser]
}>()

const searchKeyword = ref('')
const filterCampusId = ref('')
const filterRoleId = ref('')
const filterStatus = ref('')

function getLevelName(level: number): string {
  switch (level) {
    case 1: return '集团'
    case 2: return '大区'
    case 3: return '校区'
    case 4: return '部门'
    case 5: return '岗位'
    default: return '单元'
  }
}

function getDataScopeLabel(scope: DataScope): string {
  switch (scope) {
    case 'all': return '全部校区'
    case 'campus': return '本校区'
    case 'department': return '本部门'
    case 'self': return '仅本人'
    default: return scope
  }
}

function getDataScopeBadgeClass(scope: DataScope): string {
  switch (scope) {
    case 'all': return 'bg-purple-50 text-purple-600 border border-purple-200'
    case 'campus': return 'bg-blue-50 text-st-primary border border-blue-200'
    case 'department': return 'bg-amber-50 text-amber-600 border border-amber-200'
    case 'self': return 'bg-slate-100 text-slate-600 border border-slate-200'
    default: return 'bg-gray-50 text-gray-600'
  }
}

const filteredUsers = computed(() => {
  let list = [...props.users]

  // 1. 组织树节点联动过滤 (基于子树 descendantIds 集合精确匹配)
  if (props.selectedNode) {
    const node = props.selectedNode
    if (node.level > 1) {
      const descendantSet = new Set(node.descendantIds || [node.id])
      const targetCampusId = node.campusId || (node.level === 3 ? node.id : '')

      list = list.filter((u) => {
        const nodeMatch = (u as any).orgNodeId && descendantSet.has((u as any).orgNodeId)
        const deptMatch = u.departmentId && descendantSet.has(u.departmentId)
        const postMatch = u.postId && descendantSet.has(u.postId)
        const campusMatch = targetCampusId && u.campusId === targetCampusId
        return nodeMatch || deptMatch || postMatch || campusMatch
      })
    }
  }

  // 2. 校区下拉过滤
  if (filterCampusId.value) {
    list = list.filter((u) => u.campusId === filterCampusId.value)
  }

  // 3. 角色组过滤
  if (filterRoleId.value) {
    list = list.filter((u) => u.roleId === filterRoleId.value)
  }

  // 4. 状态过滤
  if (filterStatus.value) {
    list = list.filter((u) => u.status === filterStatus.value)
  }

  // 5. 关键词搜索
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase().trim()
    list = list.filter(
      (u) =>
        u.name.toLowerCase().includes(kw) ||
        u.account.toLowerCase().includes(kw) ||
        u.phone.includes(kw),
    )
  }

  return list
})
</script>

<style scoped>
.st-staff-table :deep(.el-table__header th) {
  background-color: var(--st-color-bg, #fafafa);
  color: var(--st-color-text-title, #262626);
  font-weight: 600;
}
</style>
