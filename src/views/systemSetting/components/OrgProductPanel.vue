<template>
  <div class="bg-white rounded-lg p-6 shadow-card border border-st-border space-y-4">
    <div class="border-b border-st-border pb-4">
      <h3 class="text-sm font-bold text-st-title">SaaS 授权产品与微服务矩阵</h3>
      <p class="text-xs text-st-muted mt-1">当前机构已激活开通的拓视未来教育教培业务系统产品与硬件协同模块</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
      <div
        v-for="prod in authorizedProducts"
        :key="prod.name"
        class="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-2.5">
            <div class="w-8 h-8 rounded bg-blue-100 text-st-primary flex items-center justify-center font-bold">
              {{ prod.icon }}
            </div>
            <div>
              <h4 class="font-bold text-st-title">{{ prod.name }}</h4>
              <span class="text-[11px] text-st-muted">{{ prod.code }}</span>
            </div>
          </div>
          <el-tag :type="prod.status === 'active' ? 'success' : 'info'" size="small">
            {{ prod.status === 'active' ? '服务生效中' : '未开通' }}
          </el-tag>
        </div>
        <p class="text-st-secondary text-[11px] leading-relaxed">{{ prod.desc }}</p>
        <div class="text-[11px] text-st-muted border-t border-slate-200 pt-2 flex justify-between">
          <span>授权终端：{{ prod.terminal }}</span>
          <span class="font-mono text-emerald-600">至 {{ prod.expire }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const authorizedProducts = [
  { icon: '研', name: '教研标准化课系中心', code: 'PROD-CURR-V5', status: 'active', desc: '支持4级课程大纲、微立体封面、三步向导与跨校区穿梭授权', terminal: 'Web端/iPad', expire: '2028-12-31' },
  { icon: '学', name: '学员全生命周期 CRM', code: 'PROD-STU-V3', status: 'active', desc: '360°画像全景抽屉、签约开单、电子钱包及7分支异动状态机', terminal: 'Web端/顾问端', expire: '2028-12-31' },
  { icon: '务', name: '7×15 智能排课与考勤', code: 'PROD-EDU-V4', status: 'active', desc: '毫秒级三维动态防撞检测、Lane染色多列并列自适应算法与消课冲正', terminal: 'Web端/讲台端', expire: '2028-12-31' },
  { icon: '财', name: '财务流水与多级审批流', code: 'PROD-FIN-V2', status: 'active', desc: '3×8高密度筛选矩阵、小计统计横条、资金营收与退费多级核批', terminal: 'Web端/财务ERP', expire: '2028-12-31' },
  { icon: '脸', name: '点学客户端人脸考勤', code: 'PROD-FACE-AI', status: 'active', desc: '支持校区前台离线/在线活体人脸识别打卡消课', terminal: '安卓/点学一体机', expire: '2027-06-30' },
  { icon: '签', name: '法大大电子签约中心', code: 'PROD-E-PACT', status: 'active', desc: '家长微信在线签署电子培训服务协议与法律存证', terminal: '移动端/微信H5', expire: '2027-12-31' }
]
</script>
