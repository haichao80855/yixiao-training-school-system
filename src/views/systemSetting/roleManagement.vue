<template>
  <div class="p-5 space-y-4">
    <!-- 头部横条 -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center space-x-3">
          <h1 class="text-lg font-bold text-st-title">角色管理与 4 级细粒度 RBAC 权限矩阵</h1>
          <span class="px-2.5 py-0.5 text-xs font-mono rounded bg-blue-50 text-st-primary border border-blue-200">
            RBAC 2.0 中台标准
          </span>
        </div>
        <p class="text-xs text-st-secondary mt-1">
          精准控制“系统 > 模块 > 页面 > 按钮”四级操作权限与 4 种跨校区多租户数据透视隔离范围 (all / campus / department / self)
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <el-button type="primary" size="small" @click="showAddRoleModal = true">
          + 新建角色组
        </el-button>
      </div>
    </div>

    <!-- 主工作区：左侧角色列表，右侧权限树与数据范围 -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <!-- 左侧：角色组清单 (4 列) -->
      <div class="lg:col-span-4 bg-white rounded-lg p-4 shadow-card border border-st-border flex flex-col">
        <div class="flex items-center justify-between pb-3 mb-3 border-b border-st-border">
          <h3 class="text-sm font-bold text-st-title">系统角色清单 ({{ roles.length }})</h3>
          <span class="text-[11px] text-st-muted">点击选择进行授权</span>
        </div>

        <div class="space-y-2 flex-1 overflow-y-auto max-h-[660px] pr-1">
          <div
            v-for="role in roles"
            :key="role.id"
            @click="selectRole(role)"
            :class="[
              'p-3.5 rounded-lg cursor-pointer transition-all border text-xs relative flex flex-col justify-between group',
              activeRoleId === role.id
                ? 'bg-blue-50/60 border-st-primary shadow-sm'
                : 'border-slate-200 hover:bg-slate-50/80 hover:border-slate-300'
            ]"
          >
            <!-- 选中高亮左边条 -->
            <div
              v-if="activeRoleId === role.id"
              class="absolute left-0 top-2 bottom-2 w-1 bg-st-primary rounded-r"
            ></div>

            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center space-x-2">
                  <span :class="['font-bold', activeRoleId === role.id ? 'text-st-primary text-sm' : 'text-st-title']">
                    {{ role.name }}
                  </span>
                  <span
                    v-if="role.isSystem"
                    class="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200"
                  >
                    系统内置
                  </span>
                </div>
                <div class="text-[11px] text-st-muted font-mono mt-0.5">
                  编码：{{ role.code }}
                </div>
              </div>
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-100 text-st-primary font-medium">
                {{ role.userCount }} 人
              </span>
            </div>

            <p class="text-[11px] text-st-secondary line-clamp-2 mt-2 leading-relaxed">
              {{ role.description }}
            </p>

            <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px]">
              <span
                :class="[
                  'px-1.5 py-0.5 rounded font-mono',
                  getDataScopeBadgeClass(role.dataScope)
                ]"
              >
                透视范围：{{ getDataScopeLabel(role.dataScope) }}
              </span>

              <div class="space-x-1" v-if="!role.isSystem">
                <el-button
                  link
                  type="danger"
                  size="small"
                  class="!text-xs opacity-0 group-hover:opacity-100 transition"
                  @click.stop="handleDeleteRole(role)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：细粒度权限勾选树 与 数据范围配置 (8 列) -->
      <div class="lg:col-span-8 space-y-4">
        <!-- 权限树卡片 -->
        <div class="bg-white rounded-lg p-5 shadow-card border border-st-border flex flex-col">
          <!-- 角色信息与快速动作栏 -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-st-border gap-3">
            <div>
              <div class="flex items-center space-x-2">
                <h2 class="text-base font-bold text-st-title">
                  {{ currentRole?.name }} - 功能权限授权
                </h2>
                <span class="text-xs font-mono text-st-muted">
                  ({{ currentRole?.code }})
                </span>
                <span
                  v-if="isSuperAdmin"
                  class="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium"
                >
                  * 全通配最高特权 (放行一切操作)
                </span>
              </div>
              <p class="text-xs text-st-secondary mt-1">
                勾选父节点级联全选子树，部分勾选触发自底向上半选联动 (Indeterminate)
              </p>
            </div>

            <div class="flex items-center space-x-2">
              <el-button size="small" @click="handleCheckAll">
                全选子树
              </el-button>
              <el-button size="small" @click="handleUncheckAll">
                全不选
              </el-button>
              <el-button size="small" @click="isExpandAll = !isExpandAll">
                {{ isExpandAll ? '折叠全部' : '展开全部' }}
              </el-button>
            </div>
          </div>

          <!-- 层级图例条 -->
          <div class="py-2.5 px-3 bg-slate-50/80 rounded border border-slate-100 flex flex-wrap items-center gap-4 text-xs text-st-secondary my-3">
            <span class="font-medium text-st-title text-[11px]">4 级层级图例：</span>
            <div class="flex items-center space-x-1">
              <span class="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              <span>1级 系统 (System)</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>2级 业务模块 (Module)</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span>3级 业务页面 (Page)</span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
              <span>4级 按钮控制 (Button)</span>
            </div>
          </div>

          <!-- 4 级细粒度权限勾选树 -->
          <div class="overflow-y-auto max-h-[460px] pr-2">
            <el-tree
              ref="permTreeRef"
              :data="permissionTree"
              node-key="code"
              show-checkbox
              :default-expand-all="isExpandAll"
              :check-strictly="false"
              :props="{ label: 'label', children: 'children' }"
              @check="handleTreeCheck"
              class="st-perm-tree text-xs"
            >
              <template #default="{ data }">
                <div class="flex items-center justify-between w-full py-1">
                  <div class="flex items-center space-x-2">
                    <span
                      :class="[
                        'text-[10px] px-1.5 py-0.2 rounded font-medium',
                        getPermLevelBadge(data.level)
                      ]"
                    >
                      {{ getPermLevelName(data.level) }}
                    </span>
                    <span class="text-xs font-medium text-st-title">{{ data.label }}</span>
                  </div>
                  <span class="text-[10px] font-mono text-st-muted mr-2">{{ data.code }}</span>
                </div>
              </template>
            </el-tree>
          </div>
        </div>

        <!-- 底部数据透视范围配置卡片 -->
        <div class="bg-white rounded-lg p-5 shadow-card border border-st-border space-y-4">
          <div class="border-b border-st-border pb-3 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-bold text-st-title">数据透视隔离范围 (Data Scope Matrix)</h3>
              <p class="text-xs text-st-muted mt-0.5">控制该角色用户在登录系统时，跨校区、跨部门数据的透视与过滤深度</p>
            </div>
            <span class="px-2 py-0.5 text-xs rounded bg-slate-100 font-mono text-st-title font-medium">
              当前选择：{{ getDataScopeLabel(currentDataScope) }}
            </span>
          </div>

          <!-- 4 种数据透视卡片单选组 -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div
              v-for="scope in dataScopeCardList"
              :key="scope.value"
              @click="currentDataScope = scope.value"
              :class="[
                'p-3.5 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between space-y-2 relative',
                currentDataScope === scope.value
                  ? 'border-st-primary bg-blue-50/40 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              ]"
            >
              <div class="flex items-center justify-between">
                <span :class="['font-bold text-xs', currentDataScope === scope.value ? 'text-st-primary' : 'text-st-title']">
                  {{ scope.title }}
                </span>
                <el-radio :value="scope.value" :model-value="currentDataScope" class="!mr-0" />
              </div>
              <p class="text-[11px] text-st-secondary leading-relaxed">
                {{ scope.description }}
              </p>
              <div class="text-[10px] font-mono text-st-muted pt-1 border-t border-slate-200">
                适用：{{ scope.targetRole }}
              </div>
            </div>
          </div>

          <!-- 保存按钮条 -->
          <div class="pt-3 border-t border-st-border flex items-center justify-between">
            <div class="text-xs text-st-muted">
              已选中 <span class="font-bold text-st-primary font-mono">{{ checkedKeysCount }}</span> 项细粒度权限码
            </div>
            <div class="space-x-3">
              <el-button size="small" @click="resetCurrentRolePerms">
                重置修改
              </el-button>
              <el-button type="primary" size="small" @click="handleSaveRoleAuth">
                保存角色授权配置
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗: 新建角色组 -->
    <el-dialog v-model="showAddRoleModal" title="新建系统业务角色组" :width="DIALOG_SIZE.sm" destroy-on-close>
      <el-form :model="newRoleForm" :label-width="FORM_LABEL_WIDTH.md" size="small" class="pt-2">
        <el-form-item label="角色名称" required>
          <el-input v-model="newRoleForm.name" placeholder="如：教务排课助理" />
        </el-form-item>
        <el-form-item label="角色编码" required>
          <el-input v-model="newRoleForm.code" placeholder="英文字符，如：edu_assistant" />
        </el-form-item>
        <el-form-item label="角色描述">
          <el-input
            v-model="newRoleForm.description"
            type="textarea"
            :rows="3"
            placeholder="说明此角色的主要职责与工作职能"
          />
        </el-form-item>
        <el-form-item label="数据范围" required>
          <el-select v-model="newRoleForm.dataScope" class="w-full">
            <el-option label="全部校区 (all)" value="all" />
            <el-option label="本校区 (campus)" value="campus" />
            <el-option label="本部门 (department)" value="department" />
            <el-option label="仅本人 (self)" value="self" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showAddRoleModal = false">取消</el-button>
        <el-button type="primary" size="small" @click="submitAddRole">确认创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DIALOG_SIZE, FORM_LABEL_WIDTH } from '@/constants/ui'
import type { RoleItem, PermissionNode, DataScope } from '@/types/system'
import { systemApi } from '@/api'

// --- 状态数据 ---
const roles = ref<RoleItem[]>([])
const activeRoleId = ref('r1')
const permissionTree = ref<PermissionNode[]>([])
const permTreeRef = ref()
const isExpandAll = ref(true)

async function loadData() {
  try {
    const [rolesRes, permsRes] = await Promise.all([
      systemApi.getRoles(),
      systemApi.getPermissions()
    ])
    if (rolesRes && rolesRes.success && Array.isArray(rolesRes.data) && rolesRes.data.length > 0) {
      roles.value = rolesRes.data
    }
    if (permsRes && permsRes.success && Array.isArray(permsRes.data) && permsRes.data.length > 0) {
      permissionTree.value = permsRes.data
    }
    const current = roles.value.find(r => r.id === activeRoleId.value) || roles.value[0]
    if (current) {
      selectRole(current)
    }
  } catch (err: any) {
    ElMessage.error(err.message || '加载角色与权限数据失败')
  }
}

// 当前角色编辑中的数据范围与勾选权限
const currentDataScope = ref<DataScope>('all')
const checkedPermKeys = ref<string[]>([])

// 弹窗控制
const showAddRoleModal = ref(false)
const newRoleForm = ref({
  name: '',
  code: '',
  description: '',
  dataScope: 'department' as DataScope
})

// 当前选中角色
const currentRole = computed(() => {
  return roles.value.find(r => r.id === activeRoleId.value)
})

const isSuperAdmin = computed(() => {
  return currentRole.value?.code === 'admin' || currentRole.value?.permissions.includes('*')
})

const checkedKeysCount = computed(() => {
  return checkedPermKeys.value.length
})

// 数据透视卡片配置
const dataScopeCardList: { value: DataScope; title: string; description: string; targetRole: string }[] = [
  {
    value: 'all',
    title: '全部校区数据',
    description: '穿透拓视未来教育集团全量直营与加盟校区，透视所有账目、学员与考勤流',
    targetRole: '集团董事长 / 教研总监 / 财务合伙人'
  },
  {
    value: 'campus',
    title: '仅本校区数据',
    description: '严格限制在操作员所属物理实体校区内，杜绝分校之间跨校区越权窥视',
    targetRole: '分校区执行校长 / 校区出纳'
  },
  {
    value: 'department',
    title: '仅本部门数据',
    description: '限制在操作员直属业务科室（如教学部、招生部），不跨部门交叉',
    targetRole: '教务学管主管 / 咨询顾问组长'
  },
  {
    value: 'self',
    title: '仅本人数据',
    description: '仅能查阅并操作自己名下学员画像、考勤签到及个人专属排课表',
    targetRole: '少儿编程讲师 / 个人销售顾问'
  }
]

// --- 角色切换与权限同步 ---
function selectRole(role: RoleItem) {
  activeRoleId.value = role.id
  currentDataScope.value = role.dataScope
  syncRolePermissionsToTree(role)
}

function getAllLeafCodes(nodes: PermissionNode[]): string[] {
  const codes: string[] = []
  function traverse(list: PermissionNode[]) {
    for (const node of list) {
      if (!node.children || node.children.length === 0) {
        codes.push(node.code)
      } else {
        traverse(node.children)
      }
    }
  }
  traverse(nodes)
  return codes
}

function syncRolePermissionsToTree(role: RoleItem) {
  nextTick(() => {
    if (!permTreeRef.value) return

    if (role.permissions.includes('*') || role.permissions.includes('admin:all')) {
      // 超级管理员：全选所有节点
      const allLeafs = getAllLeafCodes(permissionTree.value)
      permTreeRef.value.setCheckedKeys(allLeafs)
      checkedPermKeys.value = allLeafs
    } else {
      // 普通角色：按 permissions 精确勾选叶子节点，让 Element Tree 自动联动计算父级半选
      permTreeRef.value.setCheckedKeys(role.permissions)
      checkedPermKeys.value = [...role.permissions]
    }
  })
}

function handleTreeCheck() {
  if (!permTreeRef.value) return
  // 获取当前勾选的叶子节点与选中节点
  const checked = permTreeRef.value.getCheckedKeys()
  checkedPermKeys.value = checked
}

function handleCheckAll() {
  const allLeafs = getAllLeafCodes(permissionTree.value)
  permTreeRef.value?.setCheckedKeys(allLeafs)
  checkedPermKeys.value = allLeafs
  ElMessage.success('已一键勾选全部功能权限节点')
}

function handleUncheckAll() {
  permTreeRef.value?.setCheckedKeys([])
  checkedPermKeys.value = []
  ElMessage.info('已清空全部勾选权限')
}

function resetCurrentRolePerms() {
  if (currentRole.value) {
    selectRole(currentRole.value)
    ElMessage.info('已恢复为保存前的权限状态')
  }
}

async function handleSaveRoleAuth() {
  if (!currentRole.value) return

  // 获取勾选节点与半选父级节点
  const checkedKeys = permTreeRef.value ? permTreeRef.value.getCheckedKeys() : []
  const halfCheckedKeys = permTreeRef.value ? permTreeRef.value.getHalfCheckedKeys() : []
  const combined = Array.from(new Set([...checkedKeys, ...halfCheckedKeys])).filter(k => k !== '*')
  const savedKeys = isSuperAdmin.value ? ['*'] : combined

  try {
    await Promise.all([
      systemApi.assignRolePermissions(currentRole.value.id, savedKeys),
      systemApi.updateRole(currentRole.value.id, { dataScope: currentDataScope.value })
    ])
    ElMessage.success(`角色 [${currentRole.value.name}] 细粒度权限与数据范围已成功保存并实时生效！`)
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '保存角色权限配置失败')
  }
}

// --- 角色创建与删除 ---
async function submitAddRole() {
  if (!newRoleForm.value.name.trim() || !newRoleForm.value.code.trim()) {
    ElMessage.warning('请输入角色名称与编码')
    return
  }
  try {
    const res = await systemApi.createRole({
      name: newRoleForm.value.name,
      code: newRoleForm.value.code,
      description: newRoleForm.value.description,
      dataScope: newRoleForm.value.dataScope,
      permissionCodes: ['curriculum:view', 'student:view']
    })
    showAddRoleModal.value = false
    ElMessage.success(`角色组 [${newRoleForm.value.name}] 创建成功！`)
    await loadData()
    if (res?.data?.id) {
      activeRoleId.value = res.data.id
    }
  } catch (err: any) {
    ElMessage.error(err.message || '创建角色组失败')
  }
}

function handleDeleteRole(role: RoleItem) {
  ElMessageBox.confirm(
    `确定要删除角色组 [${role.name}] 吗？该操作将解除该角色下所有用户的关联。`,
    '删除角色确认',
    {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await systemApi.deleteRole(role.id)
      ElMessage.success(`角色组 [${role.name}] 已删除`)
      await loadData()
    } catch (err: any) {
      ElMessage.error(err.message || '删除角色组失败')
    }
  }).catch(() => {})
}

// --- 样式与字典方法 ---
function getPermLevelName(level: string): string {
  switch (level) {
    case 'system': return '系统'
    case 'module': return '模块'
    case 'page': return '页面'
    case 'button': return '按钮'
    default: return level
  }
}

function getPermLevelBadge(level: string): string {
  switch (level) {
    case 'system': return 'bg-purple-100 text-purple-700 border border-purple-200'
    case 'module': return 'bg-blue-100 text-blue-700 border border-blue-200'
    case 'page': return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
    case 'button': return 'bg-amber-100 text-amber-700 border border-amber-200'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getDataScopeLabel(scope: DataScope): string {
  switch (scope) {
    case 'all': return '全部校区'
    case 'campus': return '仅本校区'
    case 'department': return '仅本部门'
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

onMounted(async () => {
  await loadData()
})
</script>

<style scoped>
.st-perm-tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 4px;
}
.st-perm-tree :deep(.el-tree-node__content:hover) {
  background-color: var(--st-color-border-light, #f0f7ff);
}
</style>
