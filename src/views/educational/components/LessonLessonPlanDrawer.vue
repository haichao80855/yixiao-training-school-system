<template>
  <el-drawer
    v-model="visible"
    title="教师随堂备课工作台与教案指引"
    size="540px"
    destroy-on-close
  >
    <div v-if="lesson" class="space-y-4 text-xs">
      <!-- 课程元数据 -->
      <div class="bg-blue-50/70 p-3.5 rounded-lg border border-blue-100 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-sm text-st-title">{{ lesson.lessonTitle || lesson.className }}</span>
          <el-tag size="small" type="primary">{{ lesson.campusName || '总部校区' }}</el-tag>
        </div>
        <div class="text-st-muted flex items-center gap-3">
          <span>所属班级: {{ lesson.className }}</span>
          <span>固定教室: {{ lesson.classroomName }}</span>
        </div>
        <div class="text-st-secondary">
          上课时间: {{ lesson.date }} {{ lesson.startTime }}-{{ lesson.endTime }}
        </div>
      </div>

      <!-- 教学目标与核心素养 -->
      <div class="border rounded-lg p-3 bg-white space-y-2">
        <div class="font-bold text-st-title flex items-center gap-1.5">
          <span>🎯</span>
          <span>本课教学目标与知识图谱</span>
        </div>
        <ul class="list-disc list-inside space-y-1 text-st-secondary pl-1 leading-relaxed">
          <li><b>认知目标</b>：深入理解传感器与单片机 I/O 引脚的电气工作原理；</li>
          <li><b>技能目标</b>：能够自主完成红外循迹传感器的硬件搭线与灵敏度电位器微调；</li>
          <li><b>思维目标</b>：培养双分支选择结构与闭环控制算法的逻辑拆解能力。</li>
        </ul>
      </div>

      <!-- 硬件材料与教具清单 -->
      <div class="border rounded-lg p-3 bg-white space-y-2">
        <div class="font-bold text-st-title flex items-center gap-1.5">
          <span>🧰</span>
          <span>随堂教具与器材调配清单</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-gray-50 p-2 rounded border border-gray-100">
            <div class="text-st-muted text-[11px]">编程主控板</div>
            <div class="font-medium text-st-title mt-0.5">Micro:bit V2.2 主板 × {{ lesson.totalStudents }} 套</div>
          </div>
          <div class="bg-gray-50 p-2 rounded border border-gray-100">
            <div class="text-st-muted text-[11px]">传感器组件</div>
            <div class="font-medium text-st-title mt-0.5">红外避障光电模块 × {{ lesson.totalStudents * 2 }} 个</div>
          </div>
          <div class="bg-gray-50 p-2 rounded border border-gray-100">
            <div class="text-st-muted text-[11px]">动力执行套件</div>
            <div class="font-medium text-st-title mt-0.5">双减速电机小车底盘 × {{ lesson.totalStudents }} 套</div>
          </div>
          <div class="bg-gray-50 p-2 rounded border border-gray-100">
            <div class="text-st-muted text-[11px]">电源与杜邦线</div>
            <div class="font-medium text-st-title mt-0.5">18650锂电池组 + 杜邦线包</div>
          </div>
        </div>
      </div>

      <!-- 教学步骤大纲与时间分配 -->
      <div class="border rounded-lg p-3 bg-white space-y-2">
        <div class="font-bold text-st-title flex items-center gap-1.5">
          <span>⏱️</span>
          <span>90分钟教学时间流规划</span>
        </div>
        <el-timeline class="!pl-1 pt-1">
          <el-timeline-item timestamp="前 10 分钟" type="primary" size="small">
            <div class="font-semibold text-st-title">情境导入与任务发布</div>
            <div class="text-st-muted text-[11px]">播放自动驾驶避障小车实测视频，引出红外测距核心命题。</div>
          </el-timeline-item>
          <el-timeline-item timestamp="第 10-35 分钟" type="primary" size="small">
            <div class="font-semibold text-st-title">硬件连线与原理探究</div>
            <div class="text-st-muted text-[11px]">分步指导学员插接 VCC、GND 及数字信号输出 Pin 端口。</div>
          </el-timeline-item>
          <el-timeline-item timestamp="第 35-70 分钟" type="warning" size="small">
            <div class="font-semibold text-st-title">算法编写与现场实车跑测</div>
            <div class="text-st-muted text-[11px]">编写条件判断：当检测到前方障碍物时，左轮正转右轮反转实现原地掉头。</div>
          </el-timeline-item>
          <el-timeline-item timestamp="最后 20 分钟" type="success" size="small">
            <div class="font-semibold text-st-title">随堂点评、课评相册拍摄与下课收纳</div>
            <div class="text-st-muted text-[11px]">拍照记录学员现场成果，呼出课评工作台填写点评。</div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { WorkbenchLessonCard } from '@/types/educational'

const visible = ref(false)
const lesson = ref<WorkbenchLessonCard | null>(null)

function open(targetLesson: WorkbenchLessonCard) {
  lesson.value = targetLesson
  visible.value = true
}

defineExpose({ open })
</script>
