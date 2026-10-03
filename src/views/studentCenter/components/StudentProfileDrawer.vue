<template>
  <el-drawer
    v-model="visible"
    title="360° 学员全景业务画像档案"
    size="940px"
    destroy-on-close
  >
    <div v-if="student" class="space-y-5 pb-6">
      <!-- 1. 顶部学员全景头部名片卡 -->
      <div class="bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl p-5 shadow-sm">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-4">
            <div class="relative">
              <img
                :src="student.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'"
                class="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
              />
              <span
                v-if="student.faceEntered"
                class="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 border-white flex items-center shadow-xs"
                title="已录入人脸底库"
              >
                人脸
              </span>
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <h3 class="text-xl font-bold text-st-title">{{ student.name }}</h3>
                <span class="text-xs text-st-muted font-mono bg-white px-2 py-0.5 rounded border border-gray-200 font-semibold">
                  {{ student.studentNo }}
                </span>
                <el-tag size="small" :type="getStatusTagType(student.status)">
                  {{ getStatusLabel(student.status) }}
                </el-tag>
                <el-tag v-if="student.wechatBound" size="small" type="success" effect="plain">
                  微信已绑
                </el-tag>
              </div>

              <div class="text-xs text-st-secondary mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <span>性别/年龄: <b class="text-st-title">{{ student.gender === 'male' ? '男' : '女' }} / {{ student.age || 10 }}岁</b></span>
                <span>归属校区: <b class="text-st-primary">{{ student.campusName }}</b></span>
                <span>公立学校: <b class="text-st-title">{{ student.school || student.publicSchool || '未录入' }} ({{ student.grade }})</b></span>
                <span>联系电话: <b class="text-st-title font-mono">{{ student.phone }}</b></span>
                <span>家长: <b class="text-st-title">{{ student.parentName }} ({{ student.parentPhone }})</b></span>
              </div>
            </div>
          </div>

          <!-- 顶部快捷操作 -->
          <div class="flex items-center space-x-2">
            <el-button type="primary" size="small" @click="emit('openEnroll', student)">
              + 报读开单
            </el-button>
            <el-button type="warning" size="small" plain @click="emit('openMovement', student)">
              异动流转
            </el-button>
          </div>
        </div>

        <!-- 核心资产指标胶囊栏 -->
        <div class="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200/80 text-center">
          <div class="bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs">
            <div class="text-[11px] text-st-muted">有效剩余总课时</div>
            <div class="text-lg font-bold font-mono text-emerald-600 mt-0.5">{{ totalRemainingLessons }} <span class="text-xs font-normal">课时</span></div>
          </div>
          <div class="bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs">
            <div class="text-[11px] text-st-muted">电子钱包总额</div>
            <div class="text-lg font-bold font-mono text-st-danger-deep mt-0.5">¥ {{ totalWalletBalance.toFixed(2) }}</div>
          </div>
          <div class="bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs">
            <div class="text-[11px] text-st-muted">零花钱积分</div>
            <div class="text-lg font-bold font-mono text-amber-600 mt-0.5">{{ student.wallet.goldPoints || 0 }} <span class="text-xs font-normal">分</span></div>
          </div>
          <div class="bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs">
            <div class="text-[11px] text-st-muted">已获赛事考级荣誉</div>
            <div class="text-lg font-bold font-mono text-indigo-600 mt-0.5">{{ student.competitionRecords?.length || 0 }} <span class="text-xs font-normal">项</span></div>
          </div>
        </div>
      </div>

      <!-- 2. 5 大全景 Tab 体系 -->
      <el-tabs v-model="activeTab" class="bg-white rounded-lg border border-st-border p-4 shadow-card">
        <!-- Tab 1: 学员课程 (signUpRecord) -->
        <el-tab-pane label="报读课包账户资产" name="courses">
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-st-muted">名下共关联 {{ student.coursePackages.length }} 个签约课包</span>
              <el-button type="primary" link size="small" @click="emit('openEnroll', student)">+ 报读新课</el-button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="pkg in student.coursePackages"
                :key="pkg.packageId"
                class="border border-slate-200 rounded-lg p-4 bg-slate-50/50 hover:shadow-sm transition"
              >
                <div class="flex justify-between items-start">
                  <div>
                    <h5 class="font-bold text-xs text-st-title">{{ pkg.courseName }}</h5>
                    <div class="text-[11px] text-st-secondary mt-0.5">
                      班级: <span class="font-medium text-st-primary">{{ pkg.className || '待分班入班' }}</span>
                    </div>
                  </div>
                  <el-tag size="small" :type="pkg.status === 'active' ? 'success' : pkg.status === 'frozen' ? 'warning' : 'info'">
                    {{ pkg.status === 'active' ? '正常在读' : pkg.status === 'frozen' ? '已冻结' : pkg.status === 'refunded' ? '已退费' : '已结课' }}
                  </el-tag>
                </div>

                <!-- 课时进度条 -->
                <div class="mt-3">
                  <div class="flex justify-between text-[11px] text-st-secondary mb-1 font-mono">
                    <span>消耗进度 ({{ pkg.consumedLessons || (pkg.totalLessons - pkg.remainingLessons) }} / {{ pkg.totalLessons }})</span>
                    <span class="text-emerald-700 font-bold">剩余 {{ pkg.remainingLessons }} 课时</span>
                  </div>
                  <el-progress
                    :percentage="calcProgress(pkg)"
                    :color="pkg.status === 'active' ? '#10b981' : '#f59e0b'"
                    :stroke-width="8"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2 text-[11px] text-st-muted mt-3 pt-2 border-t border-slate-200">
                  <div>单价: <b class="text-st-title">¥{{ pkg.pricePerLesson || 280 }}/课时</b></div>
                  <div>赠课: <b class="text-st-title">{{ pkg.bonusLessons || 0 }} 课时</b></div>
                  <div>合同单号: <span class="font-mono">{{ pkg.orderNo || 'ORD-HIST' }}</span></div>
                  <div>有效期至: <span class="font-mono">{{ pkg.expireDate || pkg.expiryDate || '长期有效' }}</span></div>
                </div>

                <div class="flex justify-end space-x-2 mt-3 pt-2 border-t border-slate-200">
                  <el-button size="small" link type="primary" @click="emit('openEnroll', student)">续费</el-button>
                  <el-button size="small" link type="warning" @click="emit('openMovement', student)">转班/换课</el-button>
                  <el-button size="small" link type="danger" @click="handleClearPackage(pkg)">清空课包</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 2: 学习档案 (studentRecord) -->
        <el-tab-pane label="学习档案与成长轨迹" name="records">
          <div class="space-y-4 pt-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-st-muted">出勤签到记录、随堂表现星级、作业评级与作品集</span>
              <el-button size="small" plain @click="handleAddRecord">+ 录入课评</el-button>
            </div>

            <el-timeline class="pl-2">
              <el-timeline-item
                v-for="rec in learningList"
                :key="rec.id"
                :timestamp="rec.date"
                placement="top"
                type="primary"
              >
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="font-bold text-st-title">{{ rec.lessonName }} ({{ rec.courseName }})</span>
                    <div class="flex items-center space-x-2">
                      <el-tag size="small" type="success">出勤已到</el-tag>
                      <span class="font-mono font-bold text-amber-600">{{ rec.score }} 分</span>
                    </div>
                  </div>
                  <div class="text-st-secondary bg-white p-2 rounded border border-gray-100">
                    <span class="font-semibold text-st-primary">[{{ rec.teacher }} 评语]:</span>
                    {{ rec.comment }}
                  </div>
                  <div class="flex items-center justify-between text-st-muted text-[11px]">
                    <div>作业评级: <el-tag size="small" type="warning">{{ rec.homeworkRating }}</el-tag></div>
                    <div v-if="rec.quizScore">随堂测验: <b class="font-mono text-st-title">{{ rec.quizScore }} 分</b></div>
                  </div>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-tab-pane>

        <!-- Tab 3: 钱包明细 (walletBalance) -->
        <el-tab-pane label="电子钱包资产流水" name="wallet">
          <div class="space-y-4 pt-2">
            <!-- 钱包卡片概览 -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div class="text-xs text-amber-800">预存实充本金余额 (支持合规退现)</div>
                  <div class="text-2xl font-bold font-mono text-amber-950 mt-1">¥ {{ student.wallet.principalBalance.toFixed(2) }}</div>
                </div>
                <el-button type="primary" size="small" @click="showRechargeDialog = true">充值本金</el-button>
              </div>

              <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div class="text-xs text-blue-800">校区大促赠送金账户 (优先消费抵扣)</div>
                  <div class="text-2xl font-bold font-mono text-blue-950 mt-1">¥ {{ student.wallet.bonusBalance.toFixed(2) }}</div>
                </div>
                <el-button size="small" @click="showWithdrawDialog = true">本金提现</el-button>
              </div>
            </div>

            <!-- 流水表格 -->
            <div class="space-y-2">
              <div class="text-xs font-bold text-st-title">资金收支与流水账本明细</div>
              <el-table :data="walletLedgerSorted" size="small" stripe border>
                <el-table-column prop="time" label="交易时间" width="150" />
                <el-table-column prop="type" label="变动类型" width="100">
                  <template #default="{ row }">
                    <el-tag size="small" :type="getLedgerTagType(row.type)">
                      {{ getLedgerTypeLabel(row.type) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="amount" label="发生金额" width="110" align="right">
                  <template #default="{ row }">
                    <span :class="row.amount >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'" class="font-mono">
                      {{ row.amount >= 0 ? '+' : '' }}¥ {{ row.amount.toFixed(2) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="principalChange" label="本金变动" width="100" align="right">
                  <template #default="{ row }">
                    <span class="font-mono text-xs">¥ {{ row.principalChange.toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="bonusChange" label="赠送金变动" width="100" align="right">
                  <template #default="{ row }">
                    <span class="font-mono text-xs">¥ {{ row.bonusChange.toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="业务备注与说明" min-width="180" />
                <el-table-column prop="operator" label="经办人" width="100" />
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 4: 沟通记录 (communicationRecord) -->
        <el-tab-pane label="家校沟通与回访日志" name="communication">
          <div class="space-y-4 pt-2">
            <!-- 软电话外呼模拟条 -->
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
              <div class="flex items-center space-x-3 text-xs">
                <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  ☎
                </div>
                <div>
                  <div class="font-semibold text-st-title">软电话 (TQSIP / 容联云通讯中心) 状态：在线</div>
                  <div class="text-st-muted text-[11px]">一键呼叫学员家长 {{ student.parentName }} ({{ student.parentPhone }})</div>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <el-button type="success" size="small" :loading="calling" @click="handleCall">
                  {{ calling ? `通话中 ${callTimer}` : '一键外呼拨打' }}
                </el-button>
                <el-button type="primary" size="small" plain @click="showAddCommDialog = true">
                  + 新增跟进记录
                </el-button>
              </div>
            </div>

            <!-- 跟进历史 -->
            <div class="space-y-3">
              <div
                v-for="log in student.communicationRecords"
                :key="log.id"
                class="border border-slate-200 rounded-lg p-3 bg-white space-y-2 text-xs"
              >
                <div class="flex justify-between items-center border-b pb-1.5">
                  <div class="flex items-center space-x-2">
                    <el-tag size="small" type="primary">{{ log.type }}</el-tag>
                    <span class="font-semibold text-st-title">{{ log.counselor }}</span>
                    <span class="text-st-muted font-mono">{{ log.time }}</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <span v-if="log.duration" class="font-mono text-st-secondary bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                      通话时长: {{ log.duration }}
                    </span>
                    <el-rate :model-value="log.parentSatisfaction || 5" disabled size="small" />
                  </div>
                </div>

                <div class="text-st-title leading-relaxed">
                  {{ log.content }}
                </div>

                <!-- 录音模拟试听控件 -->
                <div class="bg-gray-50 rounded p-2 flex items-center justify-between text-[11px] text-st-secondary">
                  <div class="flex items-center space-x-2">
                    <button class="text-st-primary hover:underline font-bold">▶ 播放通话录音</button>
                    <span>音频波形: ▃▅▇█▅▃ 128kbps MP3</span>
                  </div>
                  <span class="font-mono">录音存档: TQSIP-REC-2026.mp3</span>
                </div>
              </div>

              <div v-if="!student.communicationRecords?.length" class="text-center py-6 text-xs text-st-muted">
                暂无沟通跟进记录，点击上方按钮发起外呼或登记回访。
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 5: 赛事记录 (matchRecord) -->
        <el-tab-pane label="白名单赛事与等级考试" name="matches">
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-st-muted">教育部白名单全国科技赛事、全国青少年软件编程等级考试与CSP竞赛报送</span>
              <el-button size="small" plain @click="showAddCert = true">+ 录入考级成果</el-button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="cert in student.competitionRecords"
                :key="cert.id"
                class="border border-indigo-100 rounded-lg p-4 bg-gradient-to-br from-indigo-50/40 to-white shadow-2xs space-y-2 text-xs"
              >
                <div class="flex justify-between items-start">
                  <div class="font-bold text-sm text-indigo-950">{{ cert.competitionName }}</div>
                  <el-tag size="small" type="success">{{ cert.award }}</el-tag>
                </div>
                <div class="text-st-secondary grid grid-cols-2 gap-1 text-[11px]">
                  <div>参赛期次: {{ cert.session }}</div>
                  <div>考核等级: {{ cert.level }}</div>
                  <div>获奖日期: {{ cert.awardDate }}</div>
                  <div>证书编号: <span class="font-mono font-semibold">{{ cert.certificateNo }}</span></div>
                </div>
                <div class="pt-2 border-t border-indigo-100 flex justify-end">
                  <el-button size="small" link type="primary" @click="handlePreviewCert(cert)">查看电子考级证书</el-button>
                </div>
              </div>

              <div v-if="!student.competitionRecords?.length" class="col-span-2 text-center py-6 text-xs text-st-muted">
                该学员尚未录入白名单赛事及等级考试成绩。
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 充值弹窗 -->
    <el-dialog v-model="showRechargeDialog" title="电子钱包充值" width="400px" append-to-body>
      <el-form label-position="top" size="small">
        <el-form-item label="充值实存本金金额 (¥)" required>
          <el-input-number v-model="rechargeForm.amount" :min="100" :step="500" class="w-full" />
        </el-form-item>
        <el-form-item label="校区大促赠送金额 (¥)">
          <el-input-number v-model="rechargeForm.bonus" :min="0" :step="100" class="w-full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRechargeDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRecharge">确认充值上账</el-button>
      </template>
    </el-dialog>

    <!-- 提现弹窗 -->
    <el-dialog v-model="showWithdrawDialog" title="本金合规提现" width="400px" append-to-body>
      <el-form label-position="top" size="small">
        <el-form-item label="提现出账金额 (¥，不可超过本金余额)" required>
          <el-input-number v-model="withdrawAmount" :min="10" :max="student?.wallet.principalBalance || 0" :step="100" class="w-full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showWithdrawDialog = false">取消</el-button>
        <el-button type="danger" @click="handleWithdraw">确认提现</el-button>
      </template>
    </el-dialog>

    <!-- 新增跟进记录弹窗 -->
    <el-dialog v-model="showAddCommDialog" title="新增家校跟进与回访记录" width="500px" append-to-body>
      <el-form label-position="top" size="small">
        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="沟通类型" required>
            <el-select v-model="newComm.type" class="w-full">
              <el-option label="课后反馈" value="课后反馈" />
              <el-option label="电话跟进" value="电话跟进" />
              <el-option label="请假回访" value="请假回访" />
              <el-option label="续费沟通" value="续费沟通" />
              <el-option label="满意度调查" value="满意度调查" />
            </el-select>
          </el-form-item>
          <el-form-item label="沟通方式">
            <el-select v-model="newComm.method" class="w-full">
              <el-option label="软电话拨打" value="phone" />
              <el-option label="企业微信" value="wechat" />
              <el-option label="校区面谈" value="in_person" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="详细跟进沟通记录" required>
          <el-input v-model="newComm.content" type="textarea" :rows="3" placeholder="请输入与家长的沟通反馈要点..." />
        </el-form-item>
        <el-form-item label="家长反馈意向评分">
          <el-rate v-model="newComm.satisfaction" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddCommDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddComm">保存跟进日志</el-button>
      </template>
    </el-dialog>

    <!-- 证书预览弹窗 -->
    <el-dialog v-model="showCertPreview" title="全国青少年科技与编程考级荣誉证书" width="550px" append-to-body>
      <div v-if="previewCert" class="border-4 border-amber-500/60 rounded-xl p-6 bg-amber-50/20 text-center space-y-4">
        <div class="text-amber-800 font-serif text-lg font-bold">★ 荣 誉 证 书 ★</div>
        <div class="text-xl font-bold text-st-title">{{ student?.name }} 同学：</div>
        <div class="text-xs text-st-secondary leading-relaxed px-6">
          在 {{ previewCert.session }}「{{ previewCert.competitionName }}」中表现优异，经组委会综合评定，特授予
          <b class="text-amber-700 text-base">【{{ previewCert.award }}】</b> 荣誉。
        </div>
        <div class="pt-4 border-t border-amber-200 flex justify-between items-center text-[11px] text-st-muted px-4 font-mono">
          <span>证书编号: {{ previewCert.certificateNo }}</span>
          <span>发证日期: {{ previewCert.awardDate }}</span>
        </div>
      </div>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Student, StudentCoursePackage, CompetitionRecord } from '@/types/student'
import { studentApi } from '@/api'
import { rechargeWallet, withdrawWallet } from '@/mocks'

const props = defineProps<{
  modelValue: boolean
  student: Student | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'openEnroll', student: Student): void
  (e: 'openMovement', student: Student): void
  (e: 'updated'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const activeTab = ref('courses')

watch(() => visible.value, async (val) => {
  if (val && props.student?.id) {
    try {
      const res = await studentApi.getStudentProfile(props.student.id)
      if (res && res.success && res.data) {
        const d = res.data
        if (d.wallet && props.student.wallet) {
          props.student.wallet.principalBalance = Number(d.wallet.principalBalance || 0)
          props.student.wallet.bonusBalance = Number(d.wallet.bonusBalance || 0)
        }
      }
    } catch {
      // dual-track fallback
    }
  }
})

// 资产统计
const totalRemainingLessons = computed(() => {
  if (!props.student?.coursePackages) return 0
  return props.student.coursePackages.reduce((acc, p) => acc + (p.status === 'active' || p.status === 'frozen' ? p.remainingLessons : 0), 0)
})

const totalWalletBalance = computed(() => {
  if (!props.student?.wallet) return 0
  return props.student.wallet.principalBalance + props.student.wallet.bonusBalance
})

const walletLedgerSorted = computed(() => {
  if (!props.student?.wallet?.ledger) return []
  return [...props.student.wallet.ledger].sort((a, b) => b.time.localeCompare(a.time))
})

const learningList = computed(() => {
  return props.student?.learningRecords || [
    { id: '1', date: '2026-09-12', lessonName: '第16讲：多角色协同与广播机制', courseName: 'Scratch创意图形编程', teacher: '张老师', status: 'attended', score: 95, comment: '逻辑严谨，出色完成海底世界场景。', homeworkRating: 'A+', quizScore: 96 },
    { id: '2', date: '2026-09-05', lessonName: '第15讲：变量与分数计算系统', courseName: 'Scratch创意图形编程', teacher: '张老师', status: 'attended', score: 92, comment: '计算公式设计合理，已熟练掌握记分板功能。', homeworkRating: 'A', quizScore: 90 }
  ]
})

function calcProgress(pkg: StudentCoursePackage) {
  const consumed = pkg.consumedLessons || (pkg.totalLessons - pkg.remainingLessons)
  return Math.min(100, Math.round((consumed / pkg.totalLessons) * 100))
}

function getStatusTagType(status: string) {
  switch (status) {
    case 'normal': return 'success'
    case 'suspended': return 'warning'
    case 'transferred': return 'info'
    case 'dropped_out': return 'danger'
    default: return 'info'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'normal': return '正常在读'
    case 'suspended': return '停课休学'
    case 'transferred': return '已转校'
    case 'dropped_out': return '已结课流失'
    default: return status
  }
}

function getLedgerTagType(type: string) {
  switch (type) {
    case 'recharge': return 'success'
    case 'consumption': return 'info'
    case 'refund': return 'warning'
    case 'withdraw': return 'danger'
    default: return 'info'
  }
}

function getLedgerTypeLabel(type: string) {
  switch (type) {
    case 'recharge': return '充值'
    case 'consumption': return '课消扣费'
    case 'refund': return '退费'
    case 'withdraw': return '本金提现'
    case 'bonus_grant': return '大促配赠'
    default: return type
  }
}

// 清空课包
async function handleClearPackage(pkg: StudentCoursePackage) {
  try {
    await ElMessageBox.confirm(`确认将课包 [${pkg.courseName}] 剩余的 ${pkg.remainingLessons} 课时清零归档？`, '课包清理', {
      type: 'warning',
      confirmButtonText: '清空课包',
      cancelButtonText: '取消'
    })
    pkg.status = 'completed'
    pkg.remainingLessons = 0
    ElMessage.success('课包已清理归档')
    emit('updated')
  } catch {
    // cancelled
  }
}

// 录入课评
function handleAddRecord() {
  ElMessage.info('教师已进入授课工作台录入课评')
}

// 软电话通话模拟
const calling = ref(false)
const callTimer = ref('00:00')
let timerInterval: any = null

function handleCall() {
  if (calling.value) {
    // 挂断
    calling.value = false
    clearInterval(timerInterval)
    ElMessage.success(`通话结束，通话时长 ${callTimer.value}，录音已自动回传存档`)
  } else {
    calling.value = true
    let seconds = 0
    callTimer.value = '00:00'
    timerInterval = setInterval(() => {
      seconds++
      const m = String(Math.floor(seconds / 60)).padStart(2, '0')
      const s = String(seconds % 60).padStart(2, '0')
      callTimer.value = `${m}:${s}`
    }, 1000)
  }
}

// 充值
const showRechargeDialog = ref(false)
const rechargeForm = reactive({
  amount: 2000,
  bonus: 200
})

function handleRecharge() {
  if (!props.student) return
  rechargeWallet(props.student.id, rechargeForm.amount, rechargeForm.bonus, '学管财务')
  ElMessage.success(`充值成功！本金上账 ¥${rechargeForm.amount}，赠送金上账 ¥${rechargeForm.bonus}`)
  showRechargeDialog.value = false
  emit('updated')
}

// 提现
const showWithdrawDialog = ref(false)
const withdrawAmount = ref(500)

function handleWithdraw() {
  if (!props.student) return
  const res = withdrawWallet(props.student.id, withdrawAmount.value)
  if (res.success) {
    ElMessage.success(res.message)
    showWithdrawDialog.value = false
    emit('updated')
  } else {
    ElMessage.error(res.message)
  }
}

// 新增跟进记录
const showAddCommDialog = ref(false)
const newComm = reactive({
  type: '课后反馈' as any,
  method: 'phone' as any,
  content: '',
  satisfaction: 5
})

function handleAddComm() {
  if (!newComm.content.trim()) {
    ElMessage.warning('请输入跟进沟通内容')
    return
  }
  props.student?.communicationRecords?.unshift({
    id: `cr-${Date.now()}`,
    time: new Date().toISOString().replace('T', ' ').slice(0, 16),
    counselor: '张学管',
    type: newComm.type,
    method: newComm.method,
    content: newComm.content,
    duration: '03:15',
    parentSatisfaction: newComm.satisfaction
  })
  ElMessage.success('跟进回访记录已成功添加')
  newComm.content = ''
  showAddCommDialog.value = false
}

// 证书预览
const showAddCert = ref(false)
const showCertPreview = ref(false)
const previewCert = ref<CompetitionRecord | null>(null)

function handlePreviewCert(cert: CompetitionRecord) {
  previewCert.value = cert
  showCertPreview.value = true
}
</script>
