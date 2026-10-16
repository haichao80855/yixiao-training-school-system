<template>
  <view class="todo-page-container">
    <CustomNavBar />

    <view class="page-title-card">
      <view class="title-row">
        <text class="title-text">本月待办与预警</text>
        <view class="count-pill">7 项待处理</view>
      </view>
      <text class="desc-text">汇聚校区订单审核、教务未分班、今日待结课与消课考勤待办</text>
    </view>

    <!-- 待办任务清单 -->
    <view class="todo-list">
      <view class="todo-card" v-for="item in todoItems" :key="item.id" @click="handleAction(item)">
        <view class="badge-tag" :class="item.typeClass">{{ item.type }}</view>
        <view class="todo-body">
          <text class="todo-text">{{ item.title }}</text>
          <text class="todo-time">{{ item.time }}</text>
        </view>
        <view class="action-btn">
          <text class="btn-text">立即处理</text>
          <text class="chevron">›</text>
        </view>
      </view>
    </view>

    <view class="tabbar-pad"></view>
    <CustomTabBar currentTab="todo" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CustomNavBar from '../../components/CustomNavBar.vue';
import CustomTabBar from '../../components/CustomTabBar.vue';

const todoItems = ref([
  { id: 1, type: '审核', typeClass: 'badge-audit', title: '您有 3 个订单的收款审核尚未确认', time: '今日 09:30' },
  { id: 2, type: '学员', typeClass: 'badge-student', title: '有 5 个新报名学员尚未进行分班', time: '今日 10:15' },
  { id: 3, type: '课次', typeClass: 'badge-schedule', title: '您今日有 19 门待上课程排期', time: '全天' },
  { id: 4, type: '考勤', typeClass: 'badge-attendance', title: '您今日有 158 个学员尚未点名签到', time: '今日 18:30' },
]);

const handleAction = (item: any) => {
  uni.showToast({ title: `进入处理: ${item.type}`, icon: 'none' });
};
</script>

<style lang="scss" scoped>
.todo-page-container {
  min-height: 100vh;
  background-color: #F6F8FC;
}

.page-title-card {
  margin: 20rpx 24rpx;
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 28rpx 32rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 4rpx 20rpx rgba(15, 23, 42, 0.03);

  .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10rpx;

    .title-text {
      font-size: 32rpx;
      font-weight: 700;
      color: #0F172A;
      letter-spacing: 0.2rpx;
    }

    .count-pill {
      background: #FEE2E2;
      color: #DC2626;
      font-size: 22rpx;
      padding: 4rpx 18rpx;
      border-radius: 9999rpx;
      font-weight: 700;
      border: 1rpx solid rgba(220, 38, 38, 0.2);
    }
  }

  .desc-text {
    font-size: 24rpx;
    color: #64748B;
    line-height: 1.5;
  }
}

.todo-list {
  padding: 0 24rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;

  .todo-card {
    background: #FFFFFF;
    border-radius: 28rpx;
    padding: 26rpx 28rpx;
    display: flex;
    align-items: center;
    gap: 18rpx;
    border: 1rpx solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 4rpx 20rpx rgba(15, 23, 42, 0.03);
    cursor: pointer;
    transition: transform 0.22s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.22s cubic-bezier(0.2, 0, 0, 1);
    will-change: transform;

    &:active {
      transform: scale(0.985);
      box-shadow: 0 2rpx 10rpx rgba(15, 23, 42, 0.02);
    }

    .badge-tag {
      padding: 6rpx 16rpx;
      border-radius: 8rpx;
      font-size: 22rpx;
      font-weight: 600;
      white-space: nowrap;

      &.badge-audit { background: #FFFBEB; color: #B45309; border: 1rpx solid rgba(217, 119, 6, 0.2); }
      &.badge-student { background: #EEF2FF; color: #2F54EB; border: 1rpx solid rgba(47, 84, 235, 0.2); }
      &.badge-schedule { background: #FAF5FF; color: #7E22CE; border: 1rpx solid rgba(126, 34, 206, 0.2); }
      &.badge-attendance { background: #F0FDF4; color: #15803D; border: 1rpx solid rgba(22, 163, 74, 0.2); }
    }

    .todo-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6rpx;

      .todo-text {
        font-size: 26rpx;
        color: #0F172A;
        font-weight: 500;
        line-height: 1.45;
      }

      .todo-time {
        font-size: 20rpx;
        color: #94A3B8;
        font-weight: 500;
      }
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 4rpx;

      .btn-text {
        font-size: 24rpx;
        color: #2F54EB;
        font-weight: 600;
      }

      .chevron {
        font-size: 32rpx;
        color: #2F54EB;
      }
    }
  }
}

.tabbar-pad {
  height: calc(140rpx + constant(safe-area-inset-bottom));
  height: calc(140rpx + env(safe-area-inset-bottom));
}
</style>
