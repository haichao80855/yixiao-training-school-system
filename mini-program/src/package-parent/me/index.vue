<template>
  <ParentPage title="我的" tab="me" :show-child-switcher="false">
    <view class="profile">
      <view class="profile-glow" />
      <view class="avatars">
        <view v-for="(child, idx) in parentStore.children.slice(0, 3)" :key="child.studentId" class="stack-avatar">
          <ChildAvatar :name="child.name" :index="idx" size="88rpx" :ring="true" />
        </view>
      </view>
      <view class="profile-text">
        <text class="phone">{{ parentStore.phoneMasked || '家长' }}</text>
        <text class="sub">家长账号 · {{ parentStore.children.length }} 个孩子</text>
      </view>
    </view>

    <text class="group-title">我的孩子</text>
    <view class="group">
      <view
        v-for="(child, idx) in parentStore.children"
        :key="child.studentId"
        class="row pressable"
        @click="selectChild(child.studentId)"
      >
        <ChildAvatar :name="child.name" :index="idx" size="72rpx" />
        <view class="row-main">
          <text class="row-title">{{ child.name }}</text>
          <text class="row-sub">
            {{ child.campusName }}<text v-if="child.access === 'read_only'"> · 已离校，可查看至 {{ dateText(child.readOnlyUntil) }}</text>
          </text>
        </view>
        <view v-if="child.studentId === parentStore.currentStudentId" class="current">
          <AppIcon name="check" size="26rpx" color="#FFFFFF" :stroke-width="3" />
        </view>
      </view>
    </view>

    <text class="group-title">登录设备</text>
    <view class="group">
      <view v-for="s in sessions" :key="s.id" class="row">
        <view class="device-icon">
          <AppIcon name="smartphone" size="32rpx" color="#5C5751" />
        </view>
        <view class="row-main">
          <view class="row-title-line">
            <text class="row-title">{{ s.deviceLabel }}</text>
            <text v-if="s.isCurrent" class="this-device">本机</text>
          </view>
          <text class="row-sub">最近使用 {{ dateTimeText(s.lastSeenAt) }}</text>
        </view>
        <text v-if="!s.isCurrent" class="row-action" @click="revoke(s.id)">退出</text>
      </view>
      <view v-if="sessionsLoading" class="row">
        <text class="row-sub">加载中…</text>
      </view>
    </view>
    <text class="group-note">同一手机号可以供多位家长同时登录。不认识的设备可以在这里让它退出。</text>

    <view class="group spaced">
      <view class="row pressable" @click="showHelp">
        <view class="device-icon">
          <AppIcon name="help-circle" size="32rpx" color="#5C5751" />
        </view>
        <view class="row-main">
          <text class="row-title">账号与登录帮助</text>
        </view>
        <AppIcon name="chevron-right" size="26rpx" color="#958F88" />
      </view>
    </view>

    <view class="logout pressable" @click="logout">
      <text>退出登录</text>
    </view>
  </ParentPage>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import ParentPage from '../components/ParentPage.vue';
import ChildAvatar from '../components/ChildAvatar.vue';
import AppIcon from '../../components/AppIcon.vue';
import { parentApi, type ParentSessionItem } from '../../api/parent';
import { useParentStore } from '../../stores/parentStore';
import { useAuthStore } from '../../stores/authStore';

const parentStore = useParentStore();
const authStore = useAuthStore();
const sessions = ref<ParentSessionItem[]>([]);
const sessionsLoading = ref(false);

async function loadSessions() {
  sessionsLoading.value = sessions.value.length === 0;
  try {
    sessions.value = await parentApi.sessions();
  } catch {
    sessions.value = [];
  } finally {
    sessionsLoading.value = false;
  }
}

onShow(() => {
  parentStore.refresh().catch(() => undefined);
  loadSessions();
});

function selectChild(studentId: string) {
  if (studentId === parentStore.currentStudentId) return;
  parentStore.switchChild(studentId);
  uni.showToast({ title: '已切换', icon: 'none' });
}

function revoke(id: string) {
  uni.showModal({
    title: '让该设备退出登录？',
    content: '该设备上的家长需要重新登录才能继续查看。',
    confirmText: '退出',
    confirmColor: '#D9424A',
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
    title: '账号与登录',
    content: '账号是孩子报名时登记的家长手机号，密码是这个手机号的后 6 位。手机号变更或无法登录时，请联系校区前台。',
    showCancel: false,
  });
}

function logout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号吗？',
    confirmColor: '#D9424A',
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
@import '../styles/tokens.scss';

.pressable {
  @include p-pressable;
}

.profile {
  @include p-card;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 28rpx;
  padding: 36rpx 32rpx;
  animation: p-fade-up 0.4s $p-ease-out both;
}

.profile-glow {
  position: absolute;
  right: -120rpx;
  top: -140rpx;
  width: 360rpx;
  height: 360rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 196, 140, 0.35) 0%, rgba(255, 196, 140, 0) 70%);
}

.avatars {
  display: flex;
  position: relative;
}

.stack-avatar + .stack-avatar {
  margin-left: -28rpx;
}

.profile-text {
  position: relative;
}

.phone {
  @include p-num;
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.sub {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: $p-ink-3;
}

.group-title {
  display: block;
  margin: 44rpx 8rpx 16rpx;
  font-size: 24rpx;
  font-weight: 650;
  color: $p-ink-3;
  letter-spacing: 0.04em;
}

.group {
  @include p-card;
  padding: 0 28rpx;

  &.spaced {
    margin-top: 40rpx;
  }
}

.group-note {
  display: block;
  margin: 14rpx 8rpx 0;
  font-size: 22rpx;
  line-height: 1.6;
  color: $p-ink-3;
}

.row {
  display: flex;
  align-items: center;
  gap: 22rpx;
  min-height: 116rpx;
  border-bottom: 2rpx solid $p-line;

  &:last-child {
    border-bottom: none;
  }
}

.row-main {
  flex: 1;
  min-width: 0;
  padding: 22rpx 0;
}

.row-title-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.row-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
}

.row-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 23rpx;
  color: $p-ink-3;
}

.this-device {
  @include p-chip;
  height: 34rpx;
  padding: 0 12rpx;
  font-size: 19rpx;
  background: $p-brand-50;
  color: $p-brand;
}

.current {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: $p-brand;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pop 0.3s $p-ease-spring both;
}

@keyframes pop {
  from {
    transform: scale(0.6);
  }
  to {
    transform: scale(1);
  }
}

.device-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 22rpx;
  background: $p-canvas;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.row-action {
  padding: 10rpx 20rpx;
  border-radius: 9999rpx;
  background: $p-rose-50;
  font-size: 24rpx;
  font-weight: 600;
  color: $p-rose;
}

.logout {
  margin-top: 48rpx;
  height: 100rpx;
  border-radius: $p-r-card;
  background: $p-surface;
  box-shadow: $p-shadow;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  color: $p-rose;
}
</style>
