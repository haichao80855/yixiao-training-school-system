<template>
  <view class="dashboard-page-container">
    <CustomNavBar />

    <!-- 角色视角标签切换栏 (对应截图 001: 管理员 | 教学教务 | 财务 | 销售) -->
    <RoleTabBar v-model="currentRoleTab" @change="handleRoleTabChange" />

    <!-- 下拉刷新状态指示器 -->
    <view class="refresh-loading" v-if="loading">
      <text class="loading-text">正在加载 {{ currentRoleName }} 统计数据...</text>
    </view>

    <!-- ========================================================================= -->
    <!-- 1. 管理员视角 (Admin Dashboard) 对应截图 001, 071~074                     -->
    <!-- ========================================================================= -->
    <view class="role-dashboard-view" v-if="currentRoleTab === 'admin'">
      <!-- 课耗金额统计卡片 -->
      <StatCard
        title="课耗金额(元)"
        helpText="统计周期内学员已上课次的消课金额核算汇总"
        :value="adminData.lessonConsumptionAmount"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        :subCards="[
          { label: '常规课', value: adminData.lessonConsumptionRegular.toFixed(2), icon: 'book-open', type: 'regular' },
          { label: '扩科', value: adminData.lessonConsumptionExpand.toFixed(2), icon: 'book-open', type: 'expand' },
          { label: '其他', value: adminData.lessonConsumptionOther.toFixed(2), icon: 'trending-up', type: 'other' }
        ]"
        footerLabel="课耗数量"
        :footerValue="adminData.lessonConsumptionCount"
      >
        <view class="chart-box">
          <view class="chart-unit">单位:元</view>
          <MpChart
            type="line"
            :data="adminData.consumptionTrend"
            unit="元"
            color="#2F54EB"
            fillColor="rgba(47, 84, 235, 0.12)"
          />
        </view>
      </StatCard>

      <!-- 招生人数卡片 -->
      <StatCard
        title="招生人数(人)"
        helpText="统计周期内新签约与续费入读学员总人数"
        :value="adminData.enrollmentStudentCount"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        :subCards="[
          { label: '常规课', value: adminData.enrollmentRegularCount, icon: 'book-open', type: 'regular' },
          { label: '扩科', value: adminData.enrollmentExpandCount, icon: 'book-open', type: 'expand' }
        ]"
        footerLabel="招生转化率"
        footerValue="78.5%"
      >
        <view class="funnel-box">
          <MpChart type="funnel" :data="adminData.enrollmentFunnel" />
        </view>
      </StatCard>

      <!-- 预收数据卡片 (截图 071) -->
      <StatCard
        title="预收数据(元)"
        helpText="统计周期内收取的课程学费、物品及钱包充值资产总额"
        :value="adminData.advanceReceiptAmount"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        :subCards="[
          { label: '常规课', value: adminData.advanceCourseAmount.toFixed(2), icon: 'credit-card', type: 'regular' },
          { label: '物品预收', value: adminData.advanceGoodsAmount.toFixed(2), icon: 'package', type: 'expand' },
          { label: '预存钱包', value: adminData.advanceWalletAmount.toFixed(2), icon: 'wallet', type: 'wallet' },
          { label: '其他', value: '0.00', icon: 'file-text', type: 'other' }
        ]"
        footerLabel="退费金额"
        footerValue="¥0.00"
      />

      <!-- 流失学员卡片 (截图 073, 074) -->
      <StatCard
        title="流失学员数量(人)"
        helpText="统计周期内停课、退费或到期未续费的学员流失情况"
        :value="adminData.churnRiskStudentCount"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        footerLabel="流失原因占比最高"
        footerValue="未填写"
      >
        <view class="chart-box">
          <view class="chart-unit">流失率: {{ adminData.churnRate }}</view>
          <MpChart
            type="line"
            :data="churnTrendData"
            unit="人"
            color="#FF4D4F"
            fillColor="rgba(255, 77, 79, 0.12)"
          />
        </view>
      </StatCard>
    </view>

    <!-- ========================================================================= -->
    <!-- 2. 教学教务视角 (Edu Dashboard) 对应截图 075~078                           -->
    <!-- ========================================================================= -->
    <view class="role-dashboard-view" v-else-if="currentRoleTab === 'edu'">
      <!-- 在籍学员概况手风琴磁贴 (截图 075, 076) -->
      <StatCard
        title="在籍学员概况"
        helpText="在籍学员涵盖当期正常在读、预存未排课、阶段性停课及到期学员全口径状态。"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        @help-click="handleEduRosterHelp"
      >
        <!-- 4 行手风琴项 -->
        <view class="accordion-list">
          <!-- 1. 本月初在籍 -->
          <view
            class="accordion-item"
            :class="{ expanded: isExpanded('start') }"
            @click="toggleAccordion('start')"
          >
            <view class="accordion-main-row">
              <text class="acc-label">本月初在籍学员</text>
              <view class="acc-right">
                <text class="acc-val">{{ eduData.monthStartCount }}</text>
                <AppIcon :name="isExpanded('start') ? 'chevron-up' : 'chevron-down'" size="24rpx" color="#64748B" />
              </view>
            </view>
            <!-- 细分展开子面板 (对应截图 076) -->
            <view class="accordion-sub-panel" v-if="isExpanded('start')" @click.stop>
              <view class="sub-pill">
                <text class="pill-label">预存</text>
                <text class="pill-val">{{ eduData.studentBreakdown.trial }}</text>
              </view>
              <view class="sub-pill">
                <text class="pill-label">在读</text>
                <text class="pill-val">{{ eduData.studentBreakdown.regular }}</text>
              </view>
              <view class="sub-pill">
                <text class="pill-label">停课</text>
                <text class="pill-val">{{ eduData.studentBreakdown.suspended }}</text>
              </view>
              <view class="sub-pill">
                <text class="pill-label">已到期</text>
                <text class="pill-val">{{ eduData.studentBreakdown.churned }}</text>
              </view>
            </view>
          </view>

          <!-- 2. 本期增加 -->
          <view class="accordion-item" @click="toggleAccordion('add')">
            <view class="accordion-main-row">
              <text class="acc-label">本期增加</text>
              <view class="acc-right">
                <text class="acc-val plus-val">+{{ eduData.currentAddedCount }}</text>
                <AppIcon :name="isExpanded('add') ? 'chevron-up' : 'chevron-down'" size="24rpx" color="#64748B" />
              </view>
            </view>
            <view class="accordion-sub-panel" v-if="isExpanded('add')" @click.stop>
              <view class="sub-pill">
                <text class="pill-label">新招</text>
                <text class="pill-val">{{ Math.round(eduData.currentAddedCount * 0.7) }}</text>
              </view>
              <view class="sub-pill">
                <text class="pill-label">续费</text>
                <text class="pill-val">{{ Math.round(eduData.currentAddedCount * 0.3) }}</text>
              </view>
            </view>
          </view>

          <!-- 3. 本期减少 -->
          <view class="accordion-item" @click="toggleAccordion('reduce')">
            <view class="accordion-main-row">
              <text class="acc-label">本期减少</text>
              <view class="acc-right">
                <text class="acc-val minus-val">-{{ eduData.currentReducedCount }}</text>
                <AppIcon :name="isExpanded('reduce') ? 'chevron-up' : 'chevron-down'" size="24rpx" color="#64748B" />
              </view>
            </view>
            <view class="accordion-sub-panel" v-if="isExpanded('reduce')" @click.stop>
              <view class="sub-pill">
                <text class="pill-label">结业</text>
                <text class="pill-val">{{ Math.round(eduData.currentReducedCount * 0.6) }}</text>
              </view>
              <view class="sub-pill">
                <text class="pill-label">退费</text>
                <text class="pill-val">{{ Math.round(eduData.currentReducedCount * 0.4) }}</text>
              </view>
            </view>
          </view>

          <!-- 4. 本月末在籍 -->
          <view class="accordion-item ending-item">
            <view class="accordion-main-row">
              <text class="acc-label bold">本月末在籍学员</text>
              <view class="acc-right">
                <text class="acc-val bold primary">{{ eduData.monthEndCount }}</text>
              </view>
            </view>
          </view>
        </view>
      </StatCard>

      <!-- 课评数据 4 宫格与三线走势折线图 (截图 075, 077) -->
      <StatCard
        title="本月课评数据"
        helpText="教师课评随堂推送率、家长查看率与回评互动率分析"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        :subCards="[
          { label: '发送率', value: eduData.evaluationSendRate, icon: 'send', type: 'regular' },
          { label: '查看率', value: eduData.evaluationViewRate, icon: 'eye', type: 'expand' },
          { label: '回评率', value: eduData.evaluationFeedbackRate, icon: 'message-square', type: 'other' },
          { label: '人均课次', value: '3.5', icon: 'timer', type: 'wallet' }
        ]"
      >
        <view class="chart-box">
          <view class="chart-unit">课评率趋势(%)</view>
          <MpChart
            type="line"
            :data="eduData.attendanceTrend"
            unit="%"
            color="#13C2C2"
            fillColor="rgba(19, 194, 194, 0.12)"
          />
        </view>
      </StatCard>

      <!-- 出勤率走势 (截图 077) -->
      <StatCard
        title="出勤率"
        helpText="统计周期内学员应到与实到上课考勤比率"
        :value="eduData.attendanceRate"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        :subCards="[
          { label: '请假率', value: eduData.attendanceLeaveRate, icon: 'moon', type: 'expand' },
          { label: '缺席率', value: eduData.attendanceAbsenceRate, icon: 'x', type: 'warning' }
        ]"
        footerLabel="平均出勤健康度"
        footerValue="优秀"
      >
        <view class="chart-box">
          <MpChart
            type="line"
            :data="eduData.attendanceTrend"
            unit="%"
            color="#52C41A"
            fillColor="rgba(82, 196, 26, 0.12)"
          />
        </view>
      </StatCard>

      <!-- 班容与学员活跃数据 (截图 078) -->
      <StatCard
        title="班容与活跃数据"
        helpText="全校班级平均人数规模与满班率统计"
        :value="eduData.averageClassSize"
        unit="人/班"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        :subCards="[
          { label: '满班率', value: eduData.classFullRate, icon: 'trending-up', type: 'regular' },
          { label: '在籍学员', value: eduData.registeredTotal, icon: 'graduation-cap', type: 'other' }
        ]"
      >
        <view class="chart-box">
          <MpChart type="bar" :data="classCapacityBars" unit="人" />
        </view>
      </StatCard>
    </view>

    <!-- ========================================================================= -->
    <!-- 3. 财务视角 (Finance Dashboard) 对应截图 079~081                           -->
    <!-- ========================================================================= -->
    <view class="role-dashboard-view" v-else-if="currentRoleTab === 'finance'">
      <!-- 预收数据卡片 (截图 079) -->
      <StatCard
        title="预收数据(元)"
        helpText="全校预收学费存量资产核算"
        :value="financeData.advanceTotalAmount"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        :subCards="[
          { label: '课程预收', value: financeData.advanceCourseAmount.toFixed(2), icon: 'credit-card', type: 'regular' },
          { label: '物品预收', value: financeData.advanceGoodsAmount.toFixed(2), icon: 'package', type: 'expand' },
          { label: '钱包充值', value: financeData.advanceWalletAmount.toFixed(2), icon: 'wallet', type: 'wallet' },
          { label: '其他', value: '0.00', icon: 'file-text', type: 'other' }
        ]"
        footerLabel="已确认退费"
        :footerValue="'¥' + financeData.refundTotalAmount.toFixed(2)"
      />

      <!-- 营收占比 Donut 环形饼图 (截图 080) -->
      <StatCard
        title="营收占比"
        helpText="统计周期内不同预收业务类别的占比结构"
        :value="financeData.confirmedRevenue"
        unit="元 总营收"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
      >
        <view class="donut-chart-box">
          <MpChart
            type="donut"
            :data="financeData.advanceSlices"
            centerTitle="课程预收"
            :centerValue="financeData.advanceCourseAmount.toLocaleString()"
          />
        </view>
      </StatCard>

      <!-- 退费占比 Donut 环形饼图 (截图 081) -->
      <StatCard
        title="退费占比"
        helpText="退费金额分类构成与退费风险监控"
        :value="financeData.refundTotalAmount"
        unit="元 总退费"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        footerLabel="综合退费率"
        :footerValue="financeData.refundRate"
      >
        <view class="donut-chart-box">
          <MpChart
            type="donut"
            :data="financeData.refundSlices"
            centerTitle="课时退费"
            :centerValue="financeData.refundTotalAmount.toLocaleString()"
          />
        </view>
      </StatCard>
    </view>

    <!-- ========================================================================= -->
    <!-- 4. 销售视角 (Sales Dashboard)                                             -->
    <!-- ========================================================================= -->
    <view class="role-dashboard-view" v-else-if="currentRoleTab === 'sales'">
      <!-- 销售签约总额 KPI -->
      <StatCard
        title="销售签约业绩(元)"
        helpText="销售顾问本期签约成单实付业绩总和与目标完成度"
        :value="salesData.achievedRevenue"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
        :subCards="[
          { label: '目标业绩', value: '¥' + salesData.targetRevenue.toLocaleString(), icon: 'target', type: 'regular' },
          { label: '达成率', value: salesData.achievementRate, icon: 'trophy', type: 'expand' },
          { label: '成单数量', value: salesData.dealsSignedCount + '单', icon: 'pen-tool', type: 'other' }
        ]"
        footerLabel="今日新增线索"
        :footerValue="salesData.leadsTodayAdded + ' 人'"
      />

      <!-- 客户转化漏斗 -->
      <StatCard
        title="CRM 销售转化漏斗"
        helpText="从线索录入到试听、到访、正式签单的全链路转化"
        :value="salesData.conversionOverallRate"
        unit="整体转化率"
        :period="currentPeriod"
        @period-change="handlePeriodChange"
      >
        <view class="funnel-box">
          <MpChart type="funnel" :data="salesData.conversionFunnel" />
        </view>
      </StatCard>
    </view>

    <!-- 底部垫高与 TabBar -->
    <view class="tabbar-pad"></view>
    <CustomTabBar currentTab="home" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onPullDownRefresh } from '@dcloudio/uni-app';
import CustomNavBar from '../../components/CustomNavBar.vue';
import CustomTabBar from '../../components/CustomTabBar.vue';
import RoleTabBar from '../../components/RoleTabBar.vue';
import StatCard from '../../components/StatCard.vue';
import MpChart from '../../components/MpChart.vue';
import AppIcon from '../../components/AppIcon.vue';
import { useCampusStore } from '../../stores/campusStore';
import {
  statsApi,
  DashboardOverviewModel,
  EduStatsModel,
  FinanceStatsModel,
  SalesStatsModel,
  normalizeDashboardOverview,
  normalizeEduStats,
  normalizeFinanceStats,
  normalizeSalesStats,
} from '../../api/stats';

const campusStore = useCampusStore();

// 角色视角列表
const roleTabs = [
  { id: 'admin', name: '管理员' },
  { id: 'edu', name: '教学教务' },
  { id: 'finance', name: '财务' },
  { id: 'sales', name: '销售' },
];

const currentRoleTab = ref('admin');
const currentPeriod = ref('10月');
const loading = ref(false);

const currentRoleName = computed(() => {
  const match = roleTabs.find((r) => r.id === currentRoleTab.value);
  return match ? match.name : '管理员';
});

// 数据模型（默认以真实 0 基线初始化）
const zeroDashboard = {
  lessonConsumptionAmount: 0,
  lessonConsumptionRegular: 0,
  lessonConsumptionExpand: 0,
  lessonConsumptionOther: 0,
  lessonConsumptionCount: 0,
  enrollmentStudentCount: 0,
  enrollmentRegularCount: 0,
  enrollmentExpandCount: 0,
  advanceReceiptAmount: 0,
  advanceCourseAmount: 0,
  advanceGoodsAmount: 0,
  advanceWalletAmount: 0,
  churnRiskStudentCount: 0,
  churnRate: '0.0%',
  consumptionTrend: [
    { label: '10-01', value: 0 },
    { label: '10-02', value: 0 },
    { label: '10-03', value: 0 },
    { label: '10-04', value: 0 },
    { label: '10-05', value: 0 },
    { label: '10-06', value: 0 },
    { label: '10-07', value: 0 },
  ],
  enrollmentFunnel: [
    { step: '线索咨询', value: 0 },
    { step: '试听邀约', value: 0 },
    { step: '到访体验', value: 0 },
    { step: '新签成单', value: 0 },
  ],
};

const adminData = ref<DashboardOverviewModel>(normalizeDashboardOverview(zeroDashboard));
const eduData = ref<EduStatsModel>(normalizeEduStats({
  registeredTotal: 0,
  monthStartCount: 0,
  currentAddedCount: 0,
  currentReducedCount: 0,
  monthEndCount: 0,
  studentBreakdown: { trial: 0, regular: 0, suspended: 0, churned: 0 },
  attendanceRate: '0.0%',
  attendanceLeaveRate: '0.0%',
  attendanceAbsenceRate: '0.0%',
  attendanceTrend: [
    { label: '第1周', value: 0 },
    { label: '第2周', value: 0 },
    { label: '第3周', value: 0 },
    { label: '第4周', value: 0 },
  ],
  evaluationSendRate: '0.0%',
  evaluationViewRate: '0.0%',
  evaluationFeedbackRate: '0.0%',
  averageClassSize: 0,
  classFullRate: '0.0%',
}));
const financeData = ref<FinanceStatsModel>(normalizeFinanceStats({
  advanceTotalAmount: 0,
  advanceCourseAmount: 0,
  advanceGoodsAmount: 0,
  advanceWalletAmount: 0,
  advanceSlices: [
    { label: '课程预收', value: 0, color: '#2F54EB' },
    { label: '教具物品', value: 0, color: '#13C2C2' },
    { label: '钱包充值', value: 0, color: '#FAAD14' },
  ],
  confirmedRevenue: 0,
  lessonTuitionRevenue: 0,
  materialRevenue: 0,
  refundTotalAmount: 0,
  refundRate: '0.0%',
  refundSlices: [
    { label: '课时退费', value: 0, color: '#FF4D4F' },
    { label: '物品退款', value: 0, color: '#FAAD14' },
    { label: '钱包提现', value: 0, color: '#722ED1' },
  ],
}));
const salesData = ref<SalesStatsModel>(normalizeSalesStats({
  leadsTotal: 0,
  leadsTodayAdded: 0,
  auditionInvitedCount: 0,
  auditionAttendedCount: 0,
  dealsSignedCount: 0,
  conversionOverallRate: '0.0%',
  conversionFunnel: [
    { step: '线索获取', value: 0, color: '#2F54EB' },
    { step: '试听邀约', value: 0, color: '#1890FF' },
    { step: '到场体验', value: 0, color: '#13C2C2' },
    { step: '签单缴费', value: 0, color: '#52C41A' },
  ],
  targetRevenue: 100000.0,
  achievedRevenue: 0,
  achievementRate: '0.0%',
}));

// 手风琴折叠状态集合
const expandedSections = ref<Set<string>>(new Set(['start']));
function isExpanded(key: string): boolean {
  return expandedSections.value.has(key);
}
function toggleAccordion(key: string) {
  if (expandedSections.value.has(key)) {
    expandedSections.value.delete(key);
  } else {
    expandedSections.value.add(key);
  }
}

// 模拟流失趋势
const churnTrendData = [
  { label: '10-01', value: 0 },
  { label: '10-02', value: 0 },
  { label: '10-03', value: 0 },
  { label: '10-04', value: 0 },
  { label: '10-05', value: 0 },
  { label: '10-06', value: 0 },
  { label: '10-07', value: 0 },
];

// 班容柱形
const classCapacityBars = computed(() => {
  const avg = eduData.value.averageClassSize || 0;
  return [
    { label: '启蒙A', value: avg, color: '#2F54EB' },
    { label: '乐高B', value: avg, color: '#13C2C2' },
    { label: '编程C', value: avg, color: '#FAAD14' },
    { label: '竞赛D', value: avg, color: '#722ED1' },
  ];
});

async function loadDashboardData() {
  loading.value = true;
  const cid = campusStore.currentCampusId;
  const p = currentPeriod.value;

  try {
    if (currentRoleTab.value === 'admin') {
      adminData.value = await statsApi.getDashboardOverview(cid, p);
    } else if (currentRoleTab.value === 'edu') {
      eduData.value = await statsApi.getEduStats(cid, p);
    } else if (currentRoleTab.value === 'finance') {
      financeData.value = await statsApi.getFinanceStats(cid, p);
    } else if (currentRoleTab.value === 'sales') {
      salesData.value = await statsApi.getSalesStats(cid, p);
    }
  } catch (e) {
    console.warn('拉取看板数据异常:', e);
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

function handleRoleTabChange(roleId: string) {
  currentRoleTab.value = roleId;
  loadDashboardData();
}

function handlePeriodChange(p: string) {
  currentPeriod.value = p;
  loadDashboardData();
}

function handlePeriodClick() {
  uni.showActionSheet({
    itemList: ['10月', '今日', '本周', '本月', '上月', '本年'],
    success: (res) => {
      const selected = ['10月', '今日', '本周', '本月', '上月', '本年'][res.tapIndex];
      handlePeriodChange(selected);
    },
  });
}

function handleEduRosterHelp() {
  uni.showModal({
    title: '在籍学员概况',
    content: '在籍学员涵盖当期正常在读、预存未排课、阶段性停课及到期学员全口径状态。',
    showCancel: false,
    confirmColor: '#2F54EB',
  });
}

onMounted(() => {
  loadDashboardData();
  uni.$on('campus-changed', loadDashboardData);
});

onUnmounted(() => {
  uni.$off('campus-changed', loadDashboardData);
});

onPullDownRefresh(() => {
  loadDashboardData();
});
</script>

<style lang="scss" scoped>
.dashboard-page-container {
  min-height: 100vh;
  background-color: #F6F8FC;
}

.refresh-loading {
  padding: 12rpx 24rpx;
  background: #EEF2FF;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1rpx solid rgba(47, 84, 235, 0.12);

  .loading-text {
    font-size: 22rpx;
    color: #2F54EB;
    font-weight: 500;
  }
}

.role-dashboard-view {
  padding-bottom: 20rpx;
}

.chart-box {
  margin-top: 14rpx;
  position: relative;

  .chart-unit {
    font-size: 20rpx;
    color: #94A3B8;
    margin-bottom: 8rpx;
    font-weight: 500;
  }
}

.funnel-box {
  margin-top: 14rpx;
}

.donut-chart-box {
  margin-top: 14rpx;
  height: 280rpx;
}

.accordion-list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;

    .accordion-item {
      background: #F8FAFC;
      border-radius: 20rpx;
      padding: 22rpx 26rpx;
      border: 1rpx solid rgba(15, 23, 42, 0.05);
      cursor: pointer;
      transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease;
      will-change: transform;

      &:active {
        transform: scale(0.98);
        background: #F1F5F9;
      }

      .accordion-main-row {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .acc-label {
          font-size: 26rpx;
          color: #334155;
          font-weight: 500;

          &.bold {
            font-weight: 700;
            color: #0F172A;
          }
        }

        .acc-right {
          display: flex;
          align-items: center;
          gap: 12rpx;

          .acc-val {
            font-size: 30rpx;
            font-weight: 700;
            color: #0F172A;

            &.plus-val {
              color: #16A34A;
            }

            &.minus-val {
              color: #DC2626;
            }

            &.primary {
              color: #2F54EB;
              font-size: 34rpx;
            }
          }

          .acc-arrow {
            font-size: 20rpx;
            color: #94A3B8;
            transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
          }
        }
      }

      .accordion-sub-panel {
        margin-top: 18rpx;
        padding-top: 18rpx;
        border-top: 1rpx dashed rgba(15, 23, 42, 0.08);
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12rpx;
        width: 100%;
        box-sizing: border-box;
        overflow: hidden;

        .sub-pill {
          min-width: 0;
          box-sizing: border-box;
          overflow: hidden;
          background: #FFFFFF;
          border-radius: 14rpx;
          padding: 14rpx 12rpx;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1rpx solid rgba(15, 23, 42, 0.04);
          box-shadow: 0 2rpx 6rpx rgba(15, 23, 42, 0.02);

          .pill-label {
            font-size: 20rpx;
            color: #64748B;
            margin-bottom: 4rpx;
            white-space: nowrap;
          }

          .pill-val {
            font-size: 24rpx;
            font-weight: 700;
            color: #0F172A;
            white-space: nowrap;
          }
        }
      }

      &.ending-item {
        background: #EEF2FF;
        border-color: rgba(47, 84, 235, 0.12);
      }
    }
  }

.tabbar-pad {
  height: calc(140rpx + constant(safe-area-inset-bottom));
  height: calc(140rpx + env(safe-area-inset-bottom));
}
</style>
