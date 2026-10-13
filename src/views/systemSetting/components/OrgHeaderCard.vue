<template>
  <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
    <!-- 面包屑与顶部操作 -->
    <div class="flex items-center justify-between text-xs text-st-muted pb-3 border-b border-st-border">
      <div class="flex items-center space-x-2">
        <span>机构管理</span>
        <span>/</span>
        <span class="text-st-title font-medium">机构信息</span>
      </div>
      <div class="space-x-2">
        <el-button size="small" @click="$emit('openTransferAdmin')">转让管理员</el-button>
        <el-button type="primary" size="small" @click="$emit('openEditOrg')">编辑机构信息</el-button>
      </div>
    </div>

    <!-- 机构核心信息抬头 -->
    <div class="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center space-x-3">
          <h1 class="text-xl font-bold text-st-title tracking-tight">{{ orgMeta.name }}</h1>
          <span class="px-2.5 py-0.5 text-xs font-mono rounded bg-blue-50 text-st-primary border border-blue-200">
            A股上市代码：{{ orgMeta.stockCode }}
          </span>
        </div>
        <!-- 核心属性一览横条 -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-xs text-st-secondary">
          <div>
            机构编码：<span class="font-mono text-st-title font-medium">{{ orgMeta.code }}</span>
          </div>
          <div>
            子机构数量：<span class="font-medium text-st-title">{{ orgMeta.childCount || 0 }}</span>
          </div>
          <div>
            校区数：<span class="font-medium text-st-title">{{ campusCount }} / 5</span>
          </div>
          <div>
            机构成员数：<span class="font-medium text-st-title">{{ userCount }} / {{ orgMeta.memberLimit || 128 }}</span>
          </div>
          <div>
            系统超级管理员：<span class="font-medium text-st-primary">{{ orgMeta.adminName }}</span>
          </div>
          <div>
            授权有效期至：<span class="font-mono font-medium text-emerald-600">{{ orgMeta.validUntil }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 导航 Tabs -->
    <div class="mt-4 border-t border-st-border pt-2">
      <el-tabs :model-value="activeTab" @update:model-value="$emit('update:activeTab', $event)" class="st-tabs">
        <el-tab-pane label="机构信息与组织架构" name="org" />
        <el-tab-pane label="LOGO设置与品牌" name="logo" />
        <el-tab-pane label="授权产品与微服务" name="product" />
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CompanyInfo } from '@/types/system'

defineProps<{
  orgMeta: CompanyInfo
  activeTab: 'org' | 'logo' | 'product'
  campusCount: number
  userCount: number
}>()

defineEmits<{
  (e: 'update:activeTab', tab: 'org' | 'logo' | 'product'): void
  (e: 'openTransferAdmin'): void
  (e: 'openEditOrg'): void
}>()
</script>

<style scoped>
.st-tabs :deep(.el-tabs__item) {
  font-size: 13px;
  color: #595959;
}
.st-tabs :deep(.el-tabs__item.is-active) {
  color: #1890FF;
  font-weight: bold;
}
.st-tabs :deep(.el-tabs__active-bar) {
  background-color: #1890FF;
}
</style>
