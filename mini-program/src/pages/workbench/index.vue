<template>
  <view class="workbench-container">
    <!-- 顶部自定义导航栏 -->
    <CustomNavBar />

    <!-- 1. 常用功能设置卡片 (对应截图 002) -->
    <view class="section-card">
      <view class="section-header">
        <text class="section-title">常用功能 ({{ commonFunctions.length }}/8)</text>
        <view class="setting-btn" @click="handleSetting">
          <text class="setting-icon">⚙️</text>
          <text class="setting-text">设置</text>
        </view>
      </view>
      <view class="grid-box">
        <view
          class="grid-item"
          v-for="item in commonFunctions"
          :key="item.id"
          @click="handleNav(item.path)"
        >
          <view class="icon-avatar" :style="{ background: item.bg }">
            <text class="item-emoji">{{ item.icon }}</text>
          </view>
          <text class="item-name">{{ item.name }}</text>
        </view>
      </view>
    </view>

    <!-- 2. 教研模块 (1项，对应截图 002) -->
    <view class="section-card">
      <view class="section-header">
        <text class="section-title">教研</text>
      </view>
      <view class="grid-box">
        <view class="grid-item" @click="handleNav('/package-edu/lecture/index')">
          <view class="icon-avatar" style="background: #FFF7E6;">
            <text class="item-emoji">📚</text>
          </view>
          <text class="item-name">课程管理</text>
        </view>
      </view>
    </view>

    <!-- 3. 学员模块 (3项，对应截图 002, 049) -->
    <view class="section-card">
      <view class="section-header">
        <text class="section-title">学员</text>
      </view>
      <view class="grid-box">
        <view class="grid-item" @click="handleNav('/package-student/list/index')">
          <view class="icon-avatar" style="background: #FFF2E8;">
            <text class="item-emoji">🧑‍🤝‍🧑</text>
          </view>
          <text class="item-name">全部学员</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-student/list/index?tab=unassigned')">
          <view class="icon-avatar" style="background: #FFF0F6;">
            <text class="item-emoji">⏳</text>
          </view>
          <text class="item-name">待分班学员</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-student/enroll/wizard')">
          <view class="icon-avatar" style="background: #FEFFE6;">
            <text class="item-emoji">📝</text>
          </view>
          <text class="item-name">学员报名</text>
        </view>
      </view>
    </view>

    <!-- 4. 教务中心 (10项，对应截图 049) -->
    <view class="section-card">
      <view class="section-header">
        <text class="section-title">教务</text>
      </view>
      <view class="grid-box">
        <view class="grid-item" @click="handleNav('/package-edu/lecture/index')">
          <view class="icon-avatar" style="background: #FFF0F6;">
            <text class="item-emoji">🎬</text>
          </view>
          <text class="item-name">讲台</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-edu/class/index')">
          <view class="icon-avatar" style="background: #E6F7FF;">
            <text class="item-emoji">🏢</text>
          </view>
          <text class="item-name">班级管理</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-student/list/index')">
          <view class="icon-avatar" style="background: #FFF2E8;">
            <text class="item-emoji">👤</text>
          </view>
          <text class="item-name">我的学员</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-edu/class/index')">
          <view class="icon-avatar" style="background: #E6F7FF;">
            <text class="item-emoji">🏫</text>
          </view>
          <text class="item-name">我的班级</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-edu/lecture/index')">
          <view class="icon-avatar" style="background: #E6F7FF;">
            <text class="item-emoji">➕</text>
          </view>
          <text class="item-name">补课管理</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-edu/lecture/roll-call')">
          <view class="icon-avatar" style="background: #F6FFED;">
            <text class="item-emoji">📋</text>
          </view>
          <text class="item-name">课消记录</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-edu/lecture/roll-call')">
          <view class="icon-avatar" style="background: #F6FFED;">
            <text class="item-emoji">🛡️</text>
          </view>
          <text class="item-name">课消审核</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-edu/evaluation/manage')">
          <view class="icon-avatar" style="background: #FFF0F6;">
            <text class="item-emoji">⭐</text>
          </view>
          <text class="item-name">课评管理</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-edu/warning/index')">
          <view class="icon-avatar" style="background: #FFF1F0;">
            <text class="item-emoji">⚡</text>
          </view>
          <text class="item-name">学员预警</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-edu/lecture/index')">
          <view class="icon-avatar" style="background: #FFF0F6;">
            <text class="item-emoji">🏷️</text>
          </view>
          <text class="item-name">售卖课程</text>
        </view>
      </view>
    </view>

    <!-- 5. 财务模块 (4项，对应截图 035, 049) -->
    <view class="section-card">
      <view class="section-header">
        <text class="section-title">财务</text>
      </view>
      <view class="grid-box">
        <view class="grid-item" @click="handleNav('/package-finance/orders/index')">
          <view class="icon-avatar" style="background: #E6F7FF;">
            <text class="item-emoji">🧾</text>
          </view>
          <text class="item-name">订单管理</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-finance/approval/index')">
          <view class="icon-avatar" style="background: #FEFFE6;">
            <text class="item-emoji">💴</text>
          </view>
          <text class="item-name">收款审批</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-finance/approval/index?type=transfer')">
          <view class="icon-avatar" style="background: #E6F7FF;">
            <text class="item-emoji">🔀</text>
          </view>
          <text class="item-name">异动审批</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-finance/approval/index?type=refund')">
          <view class="icon-avatar" style="background: #FFF1F0;">
            <text class="item-emoji">🔄</text>
          </view>
          <text class="item-name">退费审批</text>
        </view>
      </view>
    </view>

    <!-- 6. CRM模块 (11项，对应截图 035) -->
    <view class="section-card">
      <view class="section-header">
        <text class="section-title">CRM</text>
      </view>
      <view class="grid-box">
        <view class="grid-item" @click="handleNav('/package-student/list/index')">
          <view class="icon-avatar" style="background: #E6F7FF;">
            <text class="item-emoji">📇</text>
          </view>
          <text class="item-name">我的资源</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #F6FFED;">
            <text class="item-emoji">📊</text>
          </view>
          <text class="item-name">成单数据</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #FFF7E6;">
            <text class="item-emoji">👥</text>
          </view>
          <text class="item-name">组内数据</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #FFF0F6;">
            <text class="item-emoji">📥</text>
          </view>
          <text class="item-name">待分配线索</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #E6F7FF;">
            <text class="item-emoji">🎧</text>
          </view>
          <text class="item-name">试听记录</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #FEFFE6;">
            <text class="item-emoji">⏱️</text>
          </view>
          <text class="item-name">工作效率</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #FFF2E8;">
            <text class="item-emoji">📈</text>
          </view>
          <text class="item-name">业绩统计</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #E6F7FF;">
            <text class="item-emoji">🌐</text>
          </view>
          <text class="item-name">渠道统计</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #E6F7FF;">
            <text class="item-emoji">🌊</text>
          </view>
          <text class="item-name">公海线索</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #FFF1F0;">
            <text class="item-emoji">🗑️</text>
          </view>
          <text class="item-name">回收站线索</text>
        </view>
        <view class="grid-item" @click="handleNav('/package-crm/leads/index')">
          <view class="icon-avatar" style="background: #FFF7E6;">
            <text class="item-emoji">🎯</text>
          </view>
          <text class="item-name">全部线索</text>
        </view>
      </view>
    </view>

    <!-- 底部垫高与 TabBar -->
    <view class="tabbar-pad"></view>
    <CustomTabBar currentTab="workbench" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import CustomNavBar from '../../components/CustomNavBar.vue';
import CustomTabBar from '../../components/CustomTabBar.vue';
import {
  QuickActionItem,
  getUserQuickActions,
  WORKBENCH_STORAGE_KEY,
} from '../../api/workbench';

// 常用功能列表 (从持久化缓存动态加载)
const commonFunctions = ref<QuickActionItem[]>(getUserQuickActions());

function reloadQuickActions() {
  commonFunctions.value = getUserQuickActions();
}

onShow(() => {
  reloadQuickActions();
});

onMounted(() => {
  uni.$on('quick-actions-updated', reloadQuickActions);
});

onUnmounted(() => {
  uni.$off('quick-actions-updated', reloadQuickActions);
});

const handleSetting = () => {
  uni.navigateTo({
    url: '/pages/workbench/settings',
    fail: () => {
      // 容灾直接跳转
      uni.redirectTo({ url: '/pages/workbench/settings' });
    },
  });
};

const handleNav = (path: string) => {
  uni.navigateTo({
    url: path,
    fail: () => {
      uni.showToast({ title: `功能准备就绪: ${path.split('/').pop()}`, icon: 'none' });
    },
  });
};
</script>

<style lang="scss" scoped>
.workbench-container {
  min-height: 100vh;
  background-color: #F8FAFC;
  padding-bottom: 20rpx;
}

.section-card {
  margin: 20rpx 24rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.02);

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24rpx;

    .section-title {
      font-size: 30rpx;
      font-weight: 700;
      color: #111827;
    }

    .setting-btn {
      display: flex;
      align-items: center;
      gap: 6rpx;

      .setting-icon {
        font-size: 24rpx;
      }

      .setting-text {
        font-size: 24rpx;
        color: #2F54EB;
      }
    }
  }

  .grid-box {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    row-gap: 28rpx;

    .grid-item {
      display: flex;
      flex-direction: column;
      align-items: center;

      .icon-avatar {
        width: 92rpx;
        height: 92rpx;
        border-radius: 24rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12rpx;

        .item-emoji {
          font-size: 44rpx;
        }
      }

      .item-name {
        font-size: 24rpx;
        color: #374151;
        font-weight: 500;
        text-align: center;
      }
    }
  }
}

.tabbar-pad {
  height: 140rpx;
}
</style>
