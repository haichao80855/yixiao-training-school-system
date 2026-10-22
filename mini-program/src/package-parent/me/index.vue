<template>
  <ParentPage title="我的" tab="me" :show-child-switcher="false">
    <view class="account-card">
      <view class="avatar">
        <AppIcon name="user" size="48rpx" color="#2F54EB" />
      </view>
      <view>
        <text class="phone">{{ parentStore.phoneMasked || '家长' }}</text>
        <text class="sub">家长账号</text>
      </view>
    </view>

    <text class="group-title">我的孩子</text>
    <view class="group">
      <view
        v-for="child in parentStore.children"
        :key="child.studentId"
        class="row"
        @click="selectChild(child.studentId)"
      >
        <view class="child-avatar">{{ child.name.slice(-1) }}</view>
        <view class="row-main">
          <text class="row-title">{{ child.name }}</text>
          <text class="row-sub">
            {{ child.campusName }}<text v-if="child.access === 'read_only'"> · 已离校，只读至 {{ dateText(child.readOnlyUntil) }}</text>
          </text>
        </view>
        <AppIcon v-if="child.studentId === parentStore.currentStudentId" name="check" size="32rpx" color="#2F54EB" />
      </view>
    </view>

    <text class="group-title">登录设备</text>
    <view class="group">
      <view v-for="s in sessions" :key="s.id" class="row">
        <view class="row-main">
          <text class="row-title">{{ s.deviceLabel }}<text v-if="s.isCurrent" class="current-tag">本机</text></text>
          <text class="row-sub">最近使用 {{ dateTimeText(s.lastSeenAt) }}</text>
        </view>
        <text v-if="!s.isCurrent" class="row-action" @click="revoke(s.id)">退出</text>
      </view>
      <view v-if="sessions.length === 0" class="row">
        <text class="row-sub">加载中…</text>
      </view>
    </view>
    <text class="group-note">同一手机号可供多位家长同时登录，在这里可以让其他设备退出登录。</text>

    <view class="group">
      <view class="row" @click="showHelp">
        <view class="row-main">
          <text class="row-title">登录与账号帮助</text>
        </view>
        <AppIcon name="chevron-right" size="28rpx" color="#94A3B8" />
      </view>
    </view>

    <button class="logout-btn" @click="logout">退出登录</button>
  </ParentPage>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, type ParentSessionItem } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { useAuthStore } from '../../stores/authStore';

const parentStore = useParentStore();
const authStore = useAuthStore();
const sessions = ref<ParentSessionItem[]>([]);

async function loadSessions() {
  try {
    sessions.value = await parentApi.sessions();
  } catch {
    sessions.value = [];
  }
}

onShow(() => {
  parentStore.refresh().catch(() => undefined);
  loadSessions();
});

function selectChild(studentId: string) {
  parentStore.switchChild(studentId);
  uni.showToast({ title: '已切换', icon: 'none' });
}

function revoke(id: string) {
  uni.showModal({
    title: '退出该设备',
    content: '该设备上的家长需要重新登录才能继续查看。',
    confirmText: '退出',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await parentApi.revokeSession(id);
        await loadSessions();
      } catch {}
    },
  });
}

function showHelp() {
  uni.showModal({
    title: '账号帮助',
    content: '账号为孩子报名时登记的家长手机号，密码为该手机号后 6 位。手机号变更或无法登录，请联系校区前台。',
    showCancel: false,
  });
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号吗？',
    success: (res) => {
      if (res.confirm) authStore.logout();
    },
  });
}

function dateText(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function dateTimeText(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
</script>

<style lang="scss" scoped>
.account-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx 28rpx;
  background: #FFFFFF;
  border-radius: 24rpx;

  .avatar {
    width: 96rpx;
    height: 96rpx;
    border-radius: 50%;
    background: #EEF2FF;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .phone {
    display: block;
    font-size: 36rpx;
    font-weight: 700;
    color: #0F172A;
    font-variant-numeric: tabular-nums;
  }

  .sub {
    display: block;
    margin-top: 4rpx;
    font-size: 24rpx;
    color: #64748B;
  }
}

.group-title {
  display: block;
  margin: 40rpx 8rpx 16rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #64748B;
}

.group {
  margin-top: 24rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 0 28rpx;
}

.group-title + .group {
  margin-top: 0;
}

.group-note {
  display: block;
  margin: 12rpx 8rpx 0;
  font-size: 22rpx;
  line-height: 1.6;
  color: #94A3B8;
}

.row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-height: 112rpx;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);

  &:last-child {
    border-bottom: none;
  }
}

.child-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #EEF2FF;
  color: #2F54EB;
  font-size: 28rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.row-main {
  flex: 1;
  min-width: 0;
  padding: 20rpx 0;

  .row-title {
    display: block;
    font-size: 30rpx;
    color: #0F172A;
  }

  .row-sub {
    display: block;
    margin-top: 4rpx;
    font-size: 24rpx;
    color: #64748B;
  }
}

.current-tag {
  margin-left: 12rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: #EEF2FF;
  color: #2F54EB;
  font-size: 20rpx;
}

.row-action {
  font-size: 26rpx;
  color: #DC2626;
}

.logout-btn {
  margin-top: 48rpx;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 24rpx;
  background: #FFFFFF;
  color: #DC2626;
  font-size: 30rpx;

  &::after {
    border: none;
  }
}
</style>
