<template>
  <div class="bg-white rounded-lg p-4 shadow-card border border-st-border flex flex-col h-full">
    <div class="flex items-center justify-between mb-3 pb-2 border-b border-st-border">
      <div>
        <h3 class="text-sm font-bold text-st-title">5 级组织架构树</h3>
        <p class="text-[11px] text-st-muted mt-0.5">集团 > 大区 > 校区 > 部门 > 岗位职务</p>
      </div>
      <div class="space-x-1">
        <el-button link type="primary" size="small" @click="expandAll = !expandAll">
          {{ expandAll ? '全部折叠' : '全部展开' }}
        </el-button>
        <el-button type="primary" size="small" @click="$emit('openAddNode', null)">
          + 新增节点
        </el-button>
      </div>
    </div>

    <!-- 树形结构展示 -->
    <div class="flex-1 overflow-y-auto max-h-[640px] pr-1">
      <el-tree
        ref="treeRef"
        :data="orgTree"
        node-key="id"
        :default-expand-all="expandAll"
        :expand-on-click-node="false"
        highlight-current
        :props="{ label: 'name', children: 'children' }"
        @node-click="handleNodeClick"
        class="st-org-tree text-xs"
      >
        <template #default="{ data }">
          <div class="flex items-center justify-between w-full py-1 pr-2 group">
            <div class="flex items-center space-x-1.5 overflow-hidden">
              <!-- 层级 Badge -->
              <span
                :class="[
                  'text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0',
                  getLevelTagClass(data.level)
                ]"
              >
                {{ getLevelName(data.level) }}
              </span>
              <!-- 节点名称 -->
              <span
                :class="[
                  'truncate text-xs',
                  selectedNodeId === data.id ? 'font-bold text-st-primary' : 'text-st-title'
                ]"
                :title="data.name"
              >
                {{ data.name }}
              </span>
            </div>

            <!-- 右侧信息与操作按钮组 -->
            <div class="flex items-center space-x-1.5 shrink-0 ml-2">
              <span
                class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-st-muted group-hover:hidden"
                :title="`在职员工：直属 ${data.boundUserCount || 0}人 / 全子树 ${data.subtreeUserCount || data.boundUserCount || 0}人`"
              >
                {{ data.subtreeUserCount || data.boundUserCount || 0 }}人
              </span>

              <!-- Hover 时展示操作动作 -->
              <div class="hidden group-hover:flex items-center space-x-1">
                <el-button
                  v-if="data.level < 5"
                  link
                  type="primary"
                  size="small"
                  class="!text-xs !p-0.5"
                  title="添加下级子节点"
                  @click.stop="$emit('openAddNode', data)"
                >
                  <el-icon><Plus /></el-icon>
                </el-button>
                <el-button
                  v-if="data.level > 1"
                  link
                  type="danger"
                  size="small"
                  class="!text-xs !p-0.5"
                  title="删除该节点 (触发风控校验)"
                  @click.stop="handleDeleteNode(data)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </template>
      </el-tree>
    </div>

    <!-- 底部提示 -->
    <div class="mt-3 pt-2 border-t border-slate-100 text-[11px] text-st-muted flex items-center justify-between">
      <span>点击节点联动右侧人员</span>
      <span class="text-amber-600 font-medium">根节点/含下级/含在职员工严禁删除</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import type { OrgNode } from '@/types/system'
import { RBACEngine } from '@/utils/rbacEngine'

const props = defineProps<{
  orgTree: OrgNode[]
  selectedNodeId: string
}>()

const emit = defineEmits<{
  (e: 'selectNode', node: OrgNode | null): void
  (e: 'openAddNode', parent: OrgNode | null): void
  (e: 'deleteNode', node: OrgNode): void
}>()

const treeRef = ref()
const expandAll = ref(true)

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

function getLevelTagClass(level: number): string {
  switch (level) {
    case 1: return 'bg-purple-100 text-purple-700'
    case 2: return 'bg-blue-100 text-blue-700'
    case 3: return 'bg-emerald-100 text-emerald-700'
    case 4: return 'bg-amber-100 text-amber-700'
    case 5: return 'bg-slate-100 text-slate-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function handleNodeClick(data: OrgNode) {
  emit('selectNode', data)
}

function handleDeleteNode(node: OrgNode) {
  try {
    // 1. 调用 RBACEngine 核心风控校验
    RBACEngine.validateNodeDeletion(props.orgTree, node.id)

    // 2. 校验通过，弹出二次确认
    ElMessageBox.confirm(
      `确定要删除组织节点 [${node.name}] (${node.code}) 吗？此操作不可逆。`,
      '合规删除确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(() => {
      emit('deleteNode', node)
    }).catch(() => {})
  } catch (err: any) {
    ElMessage.error(`【风控拦截】${err.message}`)
  }
}

defineExpose({
  resetSelection: () => {
    if (treeRef.value) {
      treeRef.value.setCurrentKey(null)
    }
  }
})
</script>

<style scoped>
.st-org-tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 4px;
}
.st-org-tree :deep(.el-tree-node__content:hover) {
  background-color: #f0f7ff;
}
.st-org-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: #e6f7ff;
}
</style>
