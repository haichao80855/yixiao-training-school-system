<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white p-4 rounded-lg shadow-card border border-st-border flex items-center justify-between">
      <div>
        <div class="text-xs text-st-muted font-medium">直营与加盟校区</div>
        <div class="text-2xl font-bold text-st-title mt-1 font-mono">
          {{ campusCount }} <span class="text-xs font-normal text-st-muted">个实体校区</span>
        </div>
        <div class="text-[11px] text-emerald-600 mt-1">100% 覆盖核心教学商圈</div>
      </div>
      <div class="w-11 h-11 rounded-lg bg-blue-50 text-st-primary flex items-center justify-center text-xl">
        <el-icon><School /></el-icon>
      </div>
    </div>

    <div class="bg-white p-4 rounded-lg shadow-card border border-st-border flex items-center justify-between">
      <div>
        <div class="text-xs text-st-muted font-medium">系统激活员工数</div>
        <div class="text-2xl font-bold text-st-title mt-1 font-mono">
          {{ userCount }} <span class="text-xs font-normal text-st-muted">/ {{ memberLimit }} 人</span>
        </div>
        <div class="text-[11px] text-st-muted mt-1">在职在岗已全量实名</div>
      </div>
      <div class="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
        <el-icon><User /></el-icon>
      </div>
    </div>

    <div class="bg-white p-4 rounded-lg shadow-card border border-st-border flex items-center justify-between">
      <div>
        <div class="text-xs text-st-muted font-medium">教研标准化课系</div>
        <div class="text-2xl font-bold text-st-title mt-1 font-mono">
          {{ subjectCount }} <span class="text-xs font-normal text-st-muted">大科目体系</span>
        </div>
        <div class="text-[11px] text-st-muted mt-1">乐高创客/Scratch/Python/C++</div>
      </div>
      <div class="w-11 h-11 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
        <el-icon><Reading /></el-icon>
      </div>
    </div>

    <div class="bg-white p-4 rounded-lg shadow-card border border-st-border flex items-center justify-between">
      <div>
        <div class="text-xs text-st-muted font-medium">系统集群运维状态</div>
        <div class="text-2xl font-bold text-emerald-600 mt-1 flex items-center space-x-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>正常运行</span>
        </div>
        <div class="text-[11px] text-st-muted mt-1 font-mono">99.99% 高可用服务</div>
      </div>
      <div class="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
        <el-icon><Monitor /></el-icon>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { School, User, Reading, Monitor } from '@element-plus/icons-vue'

withDefaults(
  defineProps<{
    campusCount: number
    userCount: number
    memberLimit?: number
    subjectCount?: number
  }>(),
  {
    memberLimit: 128,
    subjectCount: 4,
  }
)
</script>
