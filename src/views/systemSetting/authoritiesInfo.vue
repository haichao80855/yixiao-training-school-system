<template>
  <div class="p-5 space-y-4">
    <!-- 1. 机构头部卡片 -->
    <OrgHeaderCard
      :org-meta="orgMeta"
      v-model:active-tab="activeTab"
      :campus-count="campuses.length"
      :user-count="systemUsers.length"
      @open-transfer-admin="showTransferAdminModal = true"
      @open-edit-org="showEditOrgModal = true"
    />

    <!-- 2. TAB: LOGO 设置与品牌 -->
    <OrgLogoPanel
      v-if="activeTab === 'logo'"
      :org-meta="orgMeta"
      :saving="savingLogo"
      @save="handleSaveLogo"
    />

    <!-- 3. TAB: 授权产品与微服务 -->
    <OrgProductPanel v-else-if="activeTab === 'product'" />

    <!-- 4. TAB: 机构信息与 5 级组织架构主管理视图 -->
    <div v-else class="space-y-4">
      <!-- 4 大统计指标卡片 -->
      <OrgStatCards
        :campus-count="campuses.length"
        :user-count="systemUsers.length"
        :member-limit="orgMeta.memberLimit || 128"
        :subject-count="orgMeta.metrics?.subjectCount || 4"
      />

      <!-- 5 级组织架构树 与 人员列表 左右分栏 -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- 左侧：5 级组织架构层级树 (占 5 列) -->
        <div class="lg:col-span-5">
          <OrgTreePanel
            ref="orgTreePanelRef"
            :org-tree="orgTree"
            :selected-node-id="selectedNode?.id || ''"
            @select-node="handleSelectNode"
            @open-add-node="openAddNodeDialog"
            @delete-node="handleDeleteNode"
          />
        </div>

        <!-- 右侧：校区与部门人员联动列表 (占 7 列) -->
        <div class="lg:col-span-7">
          <EmployeeTablePanel
            :users="systemUsers"
            :campuses="campuses"
            :roles="roles"
            :selected-node="selectedNode"
            @reset-node-selection="resetNodeSelection"
            @open-add-user="showAddUserDialog = true"
            @quick-switch="handleQuickSwitchUser"
            @reset-password="openResetPassword"
            @open-auth="openUserAuthDrawer"
            @toggle-status="handleToggleUserStatus"
            @delete-user="handleDeleteUser"
          />
        </div>
      </div>
    </div>

    <!-- 模态框与抽屉 -->
    <!-- 新增组织节点弹窗 -->
    <OrgNodeCreateDialog
      v-model="showAddNodeDialog"
      :parent="addNodeParent"
      :loading="submittingNode"
      @submit="submitAddNode"
    />

    <!-- 新增员工弹窗 -->
    <EmployeeCreateDialog
      v-model="showAddUserDialog"
      :campuses="campuses"
      :roles="roles"
      :default-campus-id="selectedNode?.level === 3 ? selectedNode.id : ''"
      :loading="submittingUser"
      @submit="submitAddUser"
    />

    <!-- 重置密码弹窗 -->
    <EmployeePasswordDialog
      v-model="showResetPasswordDialog"
      :user="activeUser"
      :loading="submittingPassword"
      @submit="submitResetPassword"
    />

    <!-- 员工权限与数据范围配置抽屉 -->
    <EmployeeAuthDrawer
      v-model="showAuthDrawer"
      :user="activeUser"
      :roles="roles"
      :saving="savingAuth"
      @save="saveUserAuth"
    />

    <!-- 转让超级管理员弹窗 (真实安全密码与事务交接) -->
    <TransferAdminDialog
      v-model="showTransferAdminModal"
      :users="systemUsers"
      :current-admin-user-id="orgMeta.adminUserId"
      :submitting="submittingTransfer"
      @submit="submitTransferAdmin"
    />

    <!-- 编辑机构工商基本信息弹窗 (真实持久化落库) -->
    <OrgEditDialog
      v-model="showEditOrgModal"
      :org-meta="orgMeta"
      :saving="savingOrg"
      @save="saveOrgMeta"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/authStore'
import { systemApi } from '@/api'
import type { OrgNode, SystemUser, RoleItem, CompanyInfo, DataScope } from '@/types/system'

// 子组件引入
import OrgHeaderCard from './components/OrgHeaderCard.vue'
import OrgStatCards from './components/OrgStatCards.vue'
import OrgTreePanel from './components/OrgTreePanel.vue'
import EmployeeTablePanel from './components/EmployeeTablePanel.vue'
import EmployeeAuthDrawer from './components/EmployeeAuthDrawer.vue'
import EmployeeCreateDialog from './components/EmployeeCreateDialog.vue'
import OrgNodeCreateDialog from './components/OrgNodeCreateDialog.vue'
import EmployeePasswordDialog from './components/EmployeePasswordDialog.vue'
import OrgEditDialog from './components/OrgEditDialog.vue'
import TransferAdminDialog from './components/TransferAdminDialog.vue'
import OrgLogoPanel from './components/OrgLogoPanel.vue'
import OrgProductPanel from './components/OrgProductPanel.vue'

const router = useRouter()
const authStore = useAuthStore()

// --- 核心响应式状态 ---
const activeTab = ref<'org' | 'logo' | 'product'>('org')
const orgTreePanelRef = ref()
const selectedNode = ref<OrgNode | null>(null)

// 基础数据集
const orgTree = ref<OrgNode[]>([])
const systemUsers = ref<SystemUser[]>([])
const roles = ref<RoleItem[]>([])
const campuses = ref<any[]>([])

// 机构工商元数据
const orgMeta = reactive<CompanyInfo>({
  id: '',
  code: 'QD2023111500002',
  name: '北京拓视未来教育科技集团股份有限公司',
  stockCode: '002599',
  legalPerson: '贾洪波',
  phone: '010-88880000',
  validUntil: '2028-12-31',
  adminName: '冬海潮',
  childCount: 0,
  campusCount: 5,
  memberLimit: 128,
})

// 弹窗与抽屉状态
const showAddNodeDialog = ref(false)
const addNodeParent = ref<OrgNode | null>(null)
const submittingNode = ref(false)

const showAddUserDialog = ref(false)
const submittingUser = ref(false)

const showResetPasswordDialog = ref(false)
const activeUser = ref<SystemUser | null>(null)
const submittingPassword = ref(false)

const showAuthDrawer = ref(false)
const savingAuth = ref(false)

const showTransferAdminModal = ref(false)
const submittingTransfer = ref(false)

const showEditOrgModal = ref(false)
const savingOrg = ref(false)
const savingLogo = ref(false)

// --- 数据加载编排 ---
async function loadData() {
  try {
    const [treeRes, usersRes, rolesRes, companyRes, campusRes] = await Promise.all([
      systemApi.getOrgTree(),
      systemApi.getUsers({ pageSize: 200 }),
      systemApi.getRoles(),
      systemApi.getCompanyInfo(),
      systemApi.getCampuses(),
    ])

    if (treeRes && treeRes.data && Array.isArray(treeRes.data)) {
      orgTree.value = treeRes.data
    }
    if (usersRes && usersRes.data) {
      systemUsers.value = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data.list || [])
    }
    if (rolesRes && rolesRes.data && Array.isArray(rolesRes.data)) {
      roles.value = rolesRes.data
    }
    if (companyRes && companyRes.data) {
      Object.assign(orgMeta, companyRes.data)
    }
    if (campusRes && campusRes.data && Array.isArray(campusRes.data)) {
      campuses.value = campusRes.data
    }
  } catch (err: any) {
    ElMessage.error(err.message || '加载系统组织与员工数据失败')
  }
}

// --- 组织树节点事件 ---
function handleSelectNode(node: OrgNode | null) {
  selectedNode.value = node
}

function resetNodeSelection() {
  selectedNode.value = null
  if (orgTreePanelRef.value) {
    orgTreePanelRef.value.resetSelection()
  }
}

function openAddNodeDialog(parent: OrgNode | null) {
  addNodeParent.value = parent
  showAddNodeDialog.value = true
}

async function submitAddNode(formData: any) {
  submittingNode.value = true
  try {
    await systemApi.createOrgNode(formData)
    showAddNodeDialog.value = false
    ElMessage.success(
      formData.type === 'campus'
        ? '校区组织节点与物理校区实体已同步建立成功！'
        : '组织节点添加成功！',
    )
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '添加组织节点失败')
  } finally {
    submittingNode.value = false
  }
}

async function handleDeleteNode(node: OrgNode) {
  try {
    await systemApi.deleteOrgNode(node.id)
    if (selectedNode.value?.id === node.id) {
      selectedNode.value = null
    }
    ElMessage.success(`组织节点 [${node.name}] 已成功删除！`)
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '删除组织节点失败')
  }
}

// --- 员工操作事件 ---
async function submitAddUser(formData: any) {
  submittingUser.value = true
  try {
    await systemApi.createUser({
      account: formData.account,
      realName: formData.name,
      phone: formData.phone,
      email: formData.email,
      campusId: formData.campusId,
      orgNodeId: formData.departmentId,
      roleId: formData.roleId,
      dataScope: formData.dataScope,
      password: '123456'
    })
    showAddUserDialog.value = false
    ElMessage.success(`员工 [${formData.name}] 录入成功！支持使用工号 [${formData.account}] 或手机号 [${formData.phone}] 及初始密码 123456 登录系统`)
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '录入员工失败')
  } finally {
    submittingUser.value = false
  }
}

function handleQuickSwitchUser(user: SystemUser) {
  authStore.login(user.account)
  ElMessage.success(`已切换为员工【${user.name}】身份`)
  const isTeacher = user.roleName?.includes('教师') || user.roleName?.includes('老师') || user.roleName?.includes('讲师') || user.roleId === 'r4'
  if (isTeacher) {
    router.push('/educational/workbench')
  } else {
    router.push('/dashboard')
  }
}

function openResetPassword(user: SystemUser) {
  activeUser.value = user
  showResetPasswordDialog.value = true
}

async function submitResetPassword(password: string) {
  if (!activeUser.value) return
  submittingPassword.value = true
  try {
    await systemApi.resetUserPassword(activeUser.value.id, password)
    showResetPasswordDialog.value = false
    ElMessage.success(`员工 [${activeUser.value.name}] 密码已成功重置为：${password}`)
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '重置密码失败')
  } finally {
    submittingPassword.value = false
  }
}

function openUserAuthDrawer(user: SystemUser) {
  activeUser.value = user
  showAuthDrawer.value = true
}

async function saveUserAuth(payload: { userId: string; roleId: string; campusId: string; dataScope: DataScope }) {
  savingAuth.value = true
  try {
    await systemApi.updateUser(payload.userId, {
      roleId: payload.roleId,
      campusId: payload.campusId,
      dataScope: payload.dataScope,
    })
    if (authStore.user?.id === payload.userId) {
      authStore.updateUserDataScope(payload.dataScope)
    }
    showAuthDrawer.value = false
    ElMessage.success('员工角色与数据权限配置已持久化生效！')
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '配置权限失败')
  } finally {
    savingAuth.value = false
  }
}

async function handleToggleUserStatus(user: SystemUser) {
  const nextStatus = user.status === 'active' ? 'disabled' : 'active'
  try {
    await systemApi.toggleUserStatus(user.id, nextStatus)
    ElMessage.success(`员工 [${user.name}] 账号状态已变更为：${nextStatus === 'active' ? '正常启用' : '已锁定'}`)
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '变更账号状态失败')
  }
}

async function handleDeleteUser(user: SystemUser) {
  try {
    await systemApi.deleteUser(user.id)
    ElMessage.success(`员工 [${user.name}] 已成功注销`)
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '注销员工失败')
  }
}

// --- 机构信息与假功能真实持久化闭环 ---
async function saveOrgMeta(updatedMeta: Partial<CompanyInfo>) {
  savingOrg.value = true
  try {
    const res = await systemApi.updateCompanyInfo(updatedMeta)
    if (res && res.data) {
      Object.assign(orgMeta, res.data)
    }
    showEditOrgModal.value = false
    ElMessage.success('机构工商基本信息已成功持久化落盘！')
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '更新机构信息失败')
  } finally {
    savingOrg.value = false
  }
}

async function handleSaveLogo(logoPayload: { logoUrl: string; faviconUrl: string; reportLogoUrl: string }) {
  savingLogo.value = true
  try {
    const res = await systemApi.updateCompanyInfo(logoPayload)
    if (res && res.data) {
      Object.assign(orgMeta, res.data)
    }
    ElMessage.success('机构品牌与报告 LOGO 配置已成功持久化落库！')
  } catch (err: any) {
    ElMessage.error(err.message || '保存品牌配置失败')
  } finally {
    savingLogo.value = false
  }
}

async function submitTransferAdmin(payload: { targetUserId: string; password: string }) {
  submittingTransfer.value = true
  try {
    const res = await systemApi.transferSuperAdmin(payload)
    showTransferAdminModal.value = false
    ElMessage.success(res?.message || '超级管理员最高权限已成功交接生效！')
    await loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '转让超级管理员失败')
  } finally {
    submittingTransfer.value = false
  }
}

onMounted(async () => {
  await loadData()
})
</script>
