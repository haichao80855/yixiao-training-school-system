<template>
  <view class="my-page-container">
    <!-- 顶部状态栏安全占位 -->
    <view class="status-bar-placeholder" :style="{ height: statusBarHeight + 'px' }"></view>

    <!-- 用户信息卡片 (对齐截图 068) -->
    <view class="user-profile-header">
      <view class="avatar-box">
        <view class="default-avatar">
          <text class="avatar-glyph">👨‍💼</text>
        </view>
      </view>

      <view class="info-content">
        <view class="name-phone-row">
          <text class="real-name">{{ user?.realName || '冬海潮' }}</text>
          <view class="phone-tag">
            <text class="phone-icon">📱</text>
            <text class="phone-number">{{ user?.phone || '17630176850' }}</text>
          </view>
        </view>

        <!-- 多重角色身份徽章横排展示 -->
        <view class="roles-badge-row">
          <view
            class="role-pill"
            :class="{ active: role === activeRole }"
            v-for="(role, idx) in displayRoles"
            :key="idx"
            @click="activeRole = role"
          >
            {{ role }}
          </view>
        </view>
      </view>
    </view>

    <!-- 我的机构卡片 (对齐截图 068) -->
    <view class="organization-card">
      <view class="org-header" @click="handleSwitchCampus">
        <view class="org-title-row">
          <text class="pin-icon">📍</text>
          <text class="org-label">我的机构</text>
        </view>
        <view class="org-select-row">
          <text class="org-name">{{ campusStore.currentCampusName || '河南新乡原阳乐博学习中心' }}</text>
          <text class="arrow-icon">▼</text>
        </view>
      </view>

      <view class="org-content-menu">
        <!-- 修改密码 -->
        <view class="menu-item" @click="openPasswordModal">
          <view class="item-left">
            <text class="item-icon">🔒</text>
            <text class="item-title">修改密码</text>
          </view>
          <text class="chevron">›</text>
        </view>

        <view class="divider"></view>

        <!-- 绑定公众号 -->
        <view class="menu-item" @click="openOfficialAccountModal">
          <view class="item-left">
            <text class="item-icon">🛡️</text>
            <text class="item-title">绑定公众号</text>
          </view>
          <view class="item-right">
            <view class="focus-pill">立即关注</view>
            <text class="chevron">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 独立居中退出登录按钮卡片 (对齐截图 068) -->
    <view class="logout-card" @click="handleLogout">
      <text class="logout-text">退出登录</text>
    </view>

    <!-- 底部 TabBar 垫高与组件 -->
    <view class="tabbar-pad"></view>
    <CustomTabBar currentTab="my" />

    <!-- 069_我的_修改密码表单 全息弹层视图 -->
    <view v-if="showPasswordModal" class="full-modal-overlay">
      <view class="modal-status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="modal-nav-bar">
        <view class="nav-back-btn" @click="closePasswordModal">
          <text class="back-arrow">‹</text>
          <text class="back-text">返回</text>
        </view>
        <text class="nav-title">登录密码设置</text>
        <view class="nav-placeholder"></view>
      </view>

      <view class="password-form-body">
        <text class="form-hero-title">请输入新的登录密码</text>
        <text class="form-hero-desc">请输入8-20位密码，包含大小写字母和数字</text>

        <!-- 原密码输入 -->
        <view class="pill-input-item">
          <input
            class="pill-input"
            :type="showOldPwd ? 'text' : 'password'"
            v-model="oldPassword"
            placeholder="请输入原登录密码"
            placeholder-class="input-placeholder"
          />
          <text class="eye-toggle" @click="showOldPwd = !showOldPwd">
            {{ showOldPwd ? '👁️' : '🔒' }}
          </text>
        </view>

        <!-- 新密码输入 -->
        <view class="pill-input-item">
          <input
            class="pill-input"
            :type="showNewPwd ? 'text' : 'password'"
            v-model="newPassword"
            placeholder="请输入新的登录密码"
            placeholder-class="input-placeholder"
          />
          <text class="eye-toggle" @click="showNewPwd = !showNewPwd">
            {{ showNewPwd ? '👁️' : '🔒' }}
          </text>
        </view>

        <!-- 确认新密码输入 -->
        <view class="pill-input-item">
          <input
            class="pill-input"
            :type="showConfirmPwd ? 'text' : 'password'"
            v-model="confirmPassword"
            placeholder="请再次输入新密码"
            placeholder-class="input-placeholder"
          />
          <text class="eye-toggle" @click="showConfirmPwd = !showConfirmPwd">
            {{ showConfirmPwd ? '👁️' : '🔒' }}
          </text>
        </view>

        <!-- 校验规则指示器 -->
        <view class="rule-hint-box">
          <view class="rule-item" :class="{ met: isLengthValid }">
            <text class="rule-dot">•</text>
            <text class="rule-text">长度在 8-20 位字符</text>
          </view>
          <view class="rule-item" :class="{ met: isComplexityValid }">
            <text class="rule-dot">•</text>
            <text class="rule-text">必须同时包含大写字母、小写字母和数字</text>
          </view>
          <view class="rule-item" :class="{ met: isMatchValid }">
            <text class="rule-dot">•</text>
            <text class="rule-text">两次输入密码一致</text>
          </view>
        </view>

        <!-- 提交按钮 -->
        <button
          class="pill-action-btn"
          :class="{ enabled: isPasswordFormValid }"
          :disabled="!isPasswordFormValid || passwordSubmitting"
          :loading="passwordSubmitting"
          @click="submitPasswordChange"
        >
          {{ passwordSubmitting ? '正在提交...' : '下一步' }}
        </button>
      </view>
    </view>

    <!-- 070_我的_绑定公众号 全息展示弹层视图 -->
    <view v-if="showOfficialAccountModal" class="full-modal-overlay">
      <view class="modal-status-bar" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="modal-nav-bar light-nav">
        <view class="nav-back-btn" @click="closeOfficialAccountModal">
          <text class="back-arrow">‹</text>
          <text class="back-text">返回</text>
        </view>
        <text class="nav-title">绑定公众号</text>
        <view class="nav-placeholder"></view>
      </view>

      <scroll-view scroll-y class="official-account-body">
        <!-- 蓝紫渐变横幅与3D喇叭宣传区 -->
        <view class="hero-banner-purple">
          <view class="banner-texts">
            <text class="banner-title">关注公众号</text>
            <text class="banner-subtitle">重要信息不错过</text>
          </view>
          <view class="banner-horn-box">
            <text class="horn-icon">📢</text>
          </view>
        </view>

        <!-- 双层白卡容器 -->
        <view class="outer-wrap-card">
          <view class="inner-qr-card">
            <!-- 气泡提示 -->
            <view class="callout-bubble">
              <text class="bubble-text">关注公众号 实时接收重要信息！</text>
              <view class="bubble-arrow"></view>
            </view>

            <!-- 二维码展示区 -->
            <view class="qr-code-area">
              <view class="qr-code-frame">
                <!-- 高保真矩阵图案与中间校标 -->
                <view class="qr-pattern-grid">
                  <view class="qr-corner top-left"></view>
                  <view class="qr-corner top-right"></view>
                  <view class="qr-corner bottom-left"></view>
                  <view class="qr-center-logo">
                    <text class="logo-txt">一校</text>
                  </view>
                  <view class="qr-dots-simulation"></view>
                </view>
              </view>
              <text class="qr-main-tip">长按识别二维码，关注公众号</text>
              <text class="qr-sub-tip">微信版本较低可能导致识别失败可<br />截图本页面后扫码关注</text>
            </view>

            <!-- 模板消息授权清单 -->
            <view class="message-auth-section">
              <view class="auth-section-title">消息接收服务权限</view>
              <view class="auth-item">
                <view class="auth-info">
                  <text class="auth-icon">🔔</text>
                  <text class="auth-name">随堂考勤签到提醒</text>
                </view>
                <text class="auth-status active">已开启</text>
              </view>
              <view class="auth-item">
                <view class="auth-info">
                  <text class="auth-icon">📝</text>
                  <text class="auth-name">随堂教学课评通知</text>
                </view>
                <text class="auth-status active">已开启</text>
              </view>
              <view class="auth-item">
                <view class="auth-info">
                  <text class="auth-icon">💰</text>
                  <text class="auth-name">学费结转与课耗变动提醒</text>
                </view>
                <text class="auth-status active">已开启</text>
              </view>
            </view>

            <!-- 底部技术支持署名 -->
            <view class="tech-support-row">
              <text class="tech-support-text">一校 提供技术支持</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import { useCampusStore } from '../../stores/campusStore';
import { request } from '../../utils/request';
import CustomTabBar from '../../components/CustomTabBar.vue';

const authStore = useAuthStore();
const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const activeRole = ref('讲师');

const user = computed(() => authStore.user);

// 核心契约保留: displayRoles
const displayRoles = computed(() => {
  if (user.value?.roles && user.value.roles.length > 0) {
    return user.value.roles.map((r) => r.name.replace(/专职讲师|讲师/, '讲师').replace(/超级管理员|管理员/, '校区主管'));
  }
  return ['教务', '讲师', '校长', '销售', '市场'];
});

onMounted(() => {
  try {
    const info = uni.getSystemInfoSync();
    statusBarHeight.value = info.statusBarHeight || 20;
  } catch (e) {}
  campusStore.fetchCampuses();
});

// 核心契约保留: handleSwitchCampus
const handleSwitchCampus = () => {
  const options = campusStore.campuses.length > 0
    ? campusStore.campuses.map(c => c.name)
    : ['河南新乡原阳乐博学习中心', '总部乐博旗舰校区', '远洋校区'];

  uni.showActionSheet({
    itemList: options,
    success: (res) => {
      if (campusStore.campuses[res.tapIndex]) {
        campusStore.setCampus(campusStore.campuses[res.tapIndex]);
      } else {
        campusStore.currentCampusName = options[res.tapIndex];
      }
      uni.showToast({ title: '已切换至 ' + options[res.tapIndex], icon: 'success' });
    }
  });
};

// 退出登录
const handleLogout = () => {
  uni.showModal({
    title: '提示',
    content: '确定要退出当前登录账号吗？',
    confirmColor: '#F5222D',
    confirmText: '退出登录',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        authStore.logout();
      }
    }
  });
};

// ==========================================
// 截图 069: 修改密码表单状态与逻辑
// ==========================================
const showPasswordModal = ref(false);
const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showOldPwd = ref(false);
const showNewPwd = ref(false);
const showConfirmPwd = ref(false);
const passwordSubmitting = ref(false);

const isLengthValid = computed(() => {
  const len = newPassword.value.length;
  return len >= 8 && len <= 20;
});

const isComplexityValid = computed(() => {
  // 必须同时包含大写字母、小写字母和数字
  const val = newPassword.value;
  const hasUpper = /[A-Z]/.test(val);
  const hasLower = /[a-z]/.test(val);
  const hasNum = /\d/.test(val);
  return hasUpper && hasLower && hasNum;
});

const isMatchValid = computed(() => {
  return newPassword.value.length > 0 && newPassword.value === confirmPassword.value;
});

const isPasswordFormValid = computed(() => {
  return oldPassword.value.trim().length > 0 && isLengthValid.value && isComplexityValid.value && isMatchValid.value;
});

const openPasswordModal = () => {
  oldPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  showPasswordModal.value = true;
};

const closePasswordModal = () => {
  showPasswordModal.value = false;
};

const submitPasswordChange = async () => {
  if (!isPasswordFormValid.value) return;

  const userId = authStore.user?.id;
  if (!userId) {
    uni.showToast({ title: '登录凭证已失效，请重新登录', icon: 'none' });
    return;
  }

  passwordSubmitting.value = true;
  try {
    await request({
      url: `/api/system/users/${userId}/password`,
      method: 'PATCH',
      data: {
        password: newPassword.value.trim(),
      },
    });

    uni.showToast({ title: '密码修改成功，请重新登录', icon: 'success' });
    setTimeout(() => {
      showPasswordModal.value = false;
      authStore.logout();
    }, 1200);
  } catch (err: any) {
    console.warn('修改密码端点异常:', err);
    uni.showToast({ title: err?.message || '密码修改失败，请重试', icon: 'none' });
  } finally {
    passwordSubmitting.value = false;
  }
};

// ==========================================
// 截图 070: 绑定公众号展示状态与逻辑
// ==========================================
const showOfficialAccountModal = ref(false);

const openOfficialAccountModal = () => {
  showOfficialAccountModal.value = true;
};

const closeOfficialAccountModal = () => {
  showOfficialAccountModal.value = false;
};
</script>

<style lang="scss" scoped>
.my-page-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #EAF2FF 0%, #F4F6F9 260rpx, #F4F6F9 100%);
  padding: 0 32rpx;
  box-sizing: border-box;
}

.status-bar-placeholder {
  width: 100%;
}

/* 顶部个人卡片 (068) */
.user-profile-header {
  padding: 40rpx 8rpx 36rpx;
  display: flex;
  align-items: center;
  gap: 28rpx;

  .avatar-box {
    width: 140rpx;
    height: 140rpx;
    border-radius: 50%;
    background: #E1EAF8;
    border: 4rpx solid #FFFFFF;
    box-shadow: 0 4rpx 12rpx rgba(47, 84, 235, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;

    .avatar-glyph {
      font-size: 80rpx;
    }
  }

  .info-content {
    flex: 1;

    .name-phone-row {
      display: flex;
      flex-direction: column;
      gap: 8rpx;

      .real-name {
        font-size: 40rpx;
        font-weight: 700;
        color: #1F2937;
        letter-spacing: 0.5rpx;
      }

      .phone-tag {
        display: flex;
        align-items: center;
        gap: 8rpx;

        .phone-icon {
          font-size: 26rpx;
        }

        .phone-number {
          font-size: 28rpx;
          color: #4B5563;
          font-weight: 500;
        }
      }
    }

    .roles-badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12rpx;
      margin-top: 18rpx;

      .role-pill {
        padding: 4rpx 16rpx;
        border-radius: 8rpx;
        font-size: 22rpx;
        font-weight: 500;
        background-color: #FFF0F0;
        color: #F5222D;
        border: 1rpx solid rgba(245, 34, 45, 0.15);
        transition: all 0.2s ease;

        &.active {
          background-color: #2F54EB;
          color: #FFFFFF;
          border-color: #2F54EB;
          box-shadow: 0 2rpx 8rpx rgba(47, 84, 235, 0.25);
        }
      }
    }
  }
}

/* 我的机构卡片 (068) */
.organization-card {
  margin-top: 20rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);
  overflow: hidden;

  .org-header {
    background: linear-gradient(90deg, #DFEBFF 0%, #EDF3FE 100%);
    padding: 24rpx 28rpx;
    border-top-left-radius: 24rpx;
    border-top-right-radius: 24rpx;

    .org-title-row {
      display: flex;
      align-items: center;
      gap: 10rpx;

      .pin-icon {
        font-size: 26rpx;
      }

      .org-label {
        font-size: 26rpx;
        font-weight: 600;
        color: #374151;
      }
    }

    .org-select-row {
      margin-top: 12rpx;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .org-name {
        font-size: 28rpx;
        font-weight: 600;
        color: #1F2937;
      }

      .arrow-icon {
        font-size: 20rpx;
        color: #6B7280;
      }
    }
  }

  .org-content-menu {
    padding: 0 28rpx;

    .menu-item {
      height: 108rpx;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .item-left {
        display: flex;
        align-items: center;
        gap: 16rpx;

        .item-icon {
          font-size: 32rpx;
        }

        .item-title {
          font-size: 30rpx;
          color: #1F2937;
          font-weight: 500;
        }
      }

      .item-right {
        display: flex;
        align-items: center;
        gap: 12rpx;

        .focus-pill {
          background: #E8F0FE;
          color: #1890FF;
          font-size: 22rpx;
          padding: 6rpx 16rpx;
          border-radius: 20rpx;
          font-weight: 500;
        }
      }

      .chevron {
        font-size: 38rpx;
        color: #9CA3AF;
        font-weight: 300;
      }
    }

    .divider {
      height: 1rpx;
      background: #F3F4F6;
      width: 100%;
    }
  }
}

/* 退出登录卡片 (068) */
.logout-card {
  margin-top: 36rpx;
  height: 96rpx;
  background: #FFFFFF;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.03);

  .logout-text {
    font-size: 30rpx;
    font-weight: 600;
    color: #F5222D;
  }
}

.tabbar-pad {
  height: 140rpx;
}

/* ============================================================== */
/* 全屏全息弹层公用遮罩 */
/* ============================================================== */
.full-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #FFFFFF;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.modal-status-bar {
  width: 100%;
  background: #FFFFFF;
}

.modal-nav-bar {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  background: #FFFFFF;
  border-bottom: 1rpx solid #F3F4F6;

  .nav-back-btn {
    display: flex;
    align-items: center;
    gap: 4rpx;
    color: #1F2937;
    font-size: 30rpx;

    .back-arrow {
      font-size: 44rpx;
      line-height: 1;
    }
  }

  .nav-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #111827;
  }

  .nav-placeholder {
    width: 80rpx;
  }
}

/* 069 修改密码样式 */
.password-form-body {
  padding: 48rpx 40rpx;
  display: flex;
  flex-direction: column;

  .form-hero-title {
    font-size: 42rpx;
    font-weight: 700;
    color: #111827;
    margin-bottom: 16rpx;
  }

  .form-hero-desc {
    font-size: 26rpx;
    color: #8C8C8C;
    line-height: 1.5;
    margin-bottom: 48rpx;
  }

  .pill-input-item {
    height: 96rpx;
    background: #F4F6FA;
    border-radius: 48rpx;
    padding: 0 36rpx;
    display: flex;
    align-items: center;
    margin-bottom: 24rpx;

    .pill-input {
      flex: 1;
      height: 100%;
      font-size: 28rpx;
      color: #1F2937;
    }

    .input-placeholder {
      color: #B0B7C3;
      font-size: 26rpx;
    }

    .eye-toggle {
      font-size: 30rpx;
      color: #9CA3AF;
      padding: 10rpx;
    }
  }

  .rule-hint-box {
    margin: 16rpx 8rpx 48rpx;
    display: flex;
    flex-direction: column;
    gap: 8rpx;

    .rule-item {
      display: flex;
      align-items: center;
      gap: 12rpx;
      font-size: 24rpx;
      color: #9CA3AF;

      .rule-dot {
        font-size: 28rpx;
      }

      &.met {
        color: #52C41A;
      }
    }
  }

  .pill-action-btn {
    height: 96rpx;
    border-radius: 48rpx;
    background: #C6D8FF;
    color: #FFFFFF;
    font-size: 32rpx;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    transition: all 0.2s ease;

    &.enabled {
      background: #2F54EB;
      box-shadow: 0 8rpx 20rpx rgba(47, 84, 235, 0.28);
    }
  }
}

/* 070 绑定公众号样式 */
.official-account-body {
  flex: 1;
  background: #F4F6F9;
}

.hero-banner-purple {
  background: linear-gradient(135deg, #4E7BF6 0%, #7664F8 100%);
  padding: 44rpx 40rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .banner-texts {
    display: flex;
    flex-direction: column;
    gap: 8rpx;

    .banner-title {
      font-size: 44rpx;
      font-weight: 700;
      color: #FFFFFF;
      text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
    }

    .banner-subtitle {
      font-size: 28rpx;
      color: rgba(255, 255, 255, 0.9);
    }
  }

  .banner-horn-box {
    width: 110rpx;
    height: 110rpx;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    .horn-icon {
      font-size: 56rpx;
    }
  }
}

.outer-wrap-card {
  margin: -24rpx 28rpx 40rpx;
  background: #ECEBFE;
  border-radius: 36rpx;
  padding: 16rpx;

  .inner-qr-card {
    background: #FFFFFF;
    border-radius: 28rpx;
    padding: 36rpx 28rpx;
    display: flex;
    flex-direction: column;
    align-items: center;

    .callout-bubble {
      position: relative;
      background: #FFF0F0;
      border: 1rpx solid #FFDCD9;
      border-radius: 20rpx;
      padding: 12rpx 24rpx;
      margin-bottom: 32rpx;

      .bubble-text {
        font-size: 24rpx;
        color: #FF4D4F;
        font-weight: 600;
      }

      .bubble-arrow {
        position: absolute;
        bottom: -10rpx;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 10rpx solid transparent;
        border-right: 10rpx solid transparent;
        border-top: 10rpx solid #FFF0F0;
      }
    }

    .qr-code-area {
      display: flex;
      flex-direction: column;
      align-items: center;

      .qr-code-frame {
        width: 380rpx;
        height: 380rpx;
        background: #F9FAFC;
        border: 2rpx solid #E5E7EB;
        border-radius: 24rpx;
        padding: 24rpx;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;

        .qr-pattern-grid {
          position: relative;
          width: 100%;
          height: 100%;
          background: #FFFFFF;
          border: 4rpx solid #1F2937;
          border-radius: 12rpx;
          display: flex;
          align-items: center;
          justify-content: center;

          .qr-corner {
            position: absolute;
            width: 50rpx;
            height: 50rpx;
            border: 8rpx solid #1F2937;

            &.top-left { top: 12rpx; left: 12rpx; }
            &.top-right { top: 12rpx; right: 12rpx; }
            &.bottom-left { bottom: 12rpx; left: 12rpx; }
          }

          .qr-center-logo {
            width: 72rpx;
            height: 72rpx;
            background: #2F54EB;
            border-radius: 16rpx;
            display: flex;
            align-items: center;
            justify-content: center;

            .logo-txt {
              color: #FFFFFF;
              font-size: 26rpx;
              font-weight: 800;
            }
          }
        }
      }

      .qr-main-tip {
        margin-top: 28rpx;
        font-size: 30rpx;
        font-weight: 600;
        color: #1F2937;
      }

      .qr-sub-tip {
        margin-top: 10rpx;
        font-size: 22rpx;
        color: #9EA0BA;
        text-align: center;
        line-height: 1.4;
      }
    }

    .message-auth-section {
      width: 100%;
      margin-top: 40rpx;
      border-top: 1rpx solid #F3F4F6;
      padding-top: 24rpx;

      .auth-section-title {
        font-size: 26rpx;
        font-weight: 600;
        color: #4B5563;
        margin-bottom: 16rpx;
      }

      .auth-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12rpx 0;

        .auth-info {
          display: flex;
          align-items: center;
          gap: 12rpx;

          .auth-icon {
            font-size: 28rpx;
          }

          .auth-name {
            font-size: 26rpx;
            color: #1F2937;
          }
        }

        .auth-status {
          font-size: 22rpx;
          color: #52C41A;
          background: #F6FFED;
          border: 1rpx solid #B7EB8F;
          padding: 2rpx 12rpx;
          border-radius: 8rpx;
        }
      }
    }

    .tech-support-row {
      margin-top: 36rpx;

      .tech-support-text {
        font-size: 22rpx;
        color: #C0C4CC;
      }
    }
  }
}
</style>
