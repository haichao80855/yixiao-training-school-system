<template>
  <view class="login-page-container">
    <view class="status-bar-placeholder" :style="{ height: statusBarHeight + 'px' }"></view>

    <!-- 顶部 Logo 与系统标语 -->
    <view class="login-header">
      <view class="logo-circle">
        <text class="logo-text">一校</text>
      </view>
      <text class="system-title">一校云 · 移动工作台</text>
      <text class="system-subtitle">数字化教培运营与敏捷教学管理</text>
    </view>

    <!-- 登录方式双轨切换 Tab (账号密码登录 / 微信一键授权) -->
    <view class="login-type-tabs">
      <view
        class="tab-item"
        :class="{ active: loginType === 'account' }"
        @click="loginType = 'account'"
      >
        <text class="tab-label">账号密码登录</text>
        <view class="tab-indicator" v-if="loginType === 'account'"></view>
      </view>
      <view
        class="tab-item"
        :class="{ active: loginType === 'wechat' }"
        @click="loginType = 'wechat'"
      >
        <text class="tab-label">微信快捷授权</text>
        <view class="tab-indicator" v-if="loginType === 'wechat'"></view>
      </view>
    </view>

    <!-- 轨道 1: 账号密码安全登录卡片 -->
    <view v-if="loginType === 'account'" class="login-form-card">
      <view class="form-title">员工安全登录</view>

      <!-- 账号/手机号输入框 -->
      <view class="input-item">
        <AppIcon name="user" size="36rpx" color="#64748B" class="input-icon" />
        <input
          class="input-field"
          type="text"
          v-model="account"
          placeholder="请输入工号 / 登录名 / 手机号"
          placeholder-class="placeholder-text"
        />
        <AppIcon name="x" size="28rpx" color="#94A3B8" class="clear-icon" v-if="account" @click="account = ''" />
      </view>

      <!-- 密码输入框 -->
      <view class="input-item">
        <AppIcon name="key" size="36rpx" color="#64748B" class="input-icon" />
        <input
          class="input-field"
          :type="showPassword ? 'text' : 'password'"
          v-model="password"
          placeholder="请输入登录密码"
          placeholder-class="placeholder-text"
        />
        <AppIcon
          :name="showPassword ? 'eye' : 'eye-off'"
          size="36rpx"
          color="#94A3B8"
          class="eye-icon"
          @click="showPassword = !showPassword"
        />
      </view>

      <!-- 记住账号与忘记密码 -->
      <view class="form-options">
        <label class="remember-box" @click="rememberMe = !rememberMe">
          <checkbox :checked="rememberMe" style="transform: scale(0.7);" color="#2F54EB" />
          <text class="remember-label">记住登录账号</text>
        </label>
        <text class="help-link" @click="handleHelp">找回密码</text>
      </view>

      <!-- 登录主按钮 -->
      <button class="login-button" :loading="loading" :disabled="loading" @click="handleLogin">
        {{ loading ? '正在登录中...' : '立即登录' }}
      </button>

      <!-- 快速体验账号预置矩阵 -->
      <view class="demo-accounts-box">
        <view class="demo-header">
          <text class="demo-title">快速切换体验账号：</text>
        </view>
        <view class="demo-pills">
          <view
            class="demo-pill"
            v-for="(demo, idx) in demoUsers"
            :key="idx"
            @click="fillDemoAccount(demo)"
          >
            <text class="demo-role-tag">{{ demo.role }}</text>
            <text class="demo-acc">{{ demo.account }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 轨道 2: 微信一键授权登录卡片 (符合 SPEC 5.1 双轨登录) -->
    <view v-else class="login-form-card wechat-login-card">
      <view class="form-title">微信快捷免密登录</view>

      <view class="wechat-auth-guide">
        <view class="wechat-icon-large">
          <AppIcon name="message-circle" size="72rpx" color="#07C160" class="wechat-glyph" />
        </view>
        <text class="guide-title">已绑定微信服务号员工一键登录</text>
        <text class="guide-desc">授权获取微信绑定手机号，自动匹配机构教职员工档案</text>
      </view>

      <!-- 微信一键授权按钮 -->
      <button class="wechat-auth-btn" :loading="loading" :disabled="loading" @click="handleWechatQuickLogin">
        <AppIcon name="zap" size="36rpx" color="#FFFFFF" class="btn-icon" />
        <text class="btn-text">{{ loading ? '正在授权匹配...' : '微信一键快捷登录' }}</text>
      </button>

      <view class="wechat-policy-hint">
        <text class="policy-txt">登录即代表您已阅读并同意《教职工移动端安全合规协议》</text>
      </view>

      <view class="quick-back-account" @click="loginType = 'account'">
        <text class="back-link">使用工号/密码登录 ›</text>
      </view>
    </view>

    <!-- 底部版权声明 -->
    <view class="login-footer">
      <text class="copyright-text">拓视未来教育「一校教培系统」技术保障</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import AppIcon from '../../components/AppIcon.vue';

const authStore = useAuthStore();
const statusBarHeight = ref(20);
const loginType = ref<'account' | 'wechat'>('account');
const account = ref('');
const password = ref('');
const showPassword = ref(false);
const rememberMe = ref(true);
const loading = ref(false);

const demoUsers = [
  { role: '校长/超管', account: 'donghaichao', pass: '123456' },
  { role: '教务主管', account: 'jiaowu_demo', pass: '123456' },
  { role: '授课讲师', account: 'teacher_demo', pass: '123456' },
];

onMounted(() => {
  try {
    const info = uni.getSystemInfoSync();
    statusBarHeight.value = info.statusBarHeight || 20;
  } catch (e) {}

  const savedAccount = uni.getStorageSync('savedAccount');
  if (savedAccount) {
    account.value = savedAccount;
    password.value = '123456';
  } else {
    account.value = 'donghaichao';
    password.value = '123456';
  }
});

const fillDemoAccount = (demo: typeof demoUsers[0]) => {
  account.value = demo.account;
  password.value = demo.pass;
  uni.showToast({ title: `已填入${demo.role}账号`, icon: 'none' });
};

const handleLogin = async () => {
  const acc = account.value.trim();
  const pwd = password.value.trim();

  if (!acc) {
    uni.showToast({ title: '请输入工号或手机号', icon: 'none' });
    return;
  }
  if (!pwd) {
    uni.showToast({ title: '请输入登录密码', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    await authStore.login(acc, pwd);
    if (rememberMe.value) {
      uni.setStorageSync('savedAccount', acc);
    } else {
      uni.removeStorageSync('savedAccount');
    }
    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/workbench/index' });
    }, 600);
  } catch (err: any) {
    console.error('登录失败:', err);
  } finally {
    loading.value = false;
  }
};

const handleWechatQuickLogin = async () => {
  loading.value = true;
  try {
    uni.showLoading({ title: '微信授权中...' });
    await new Promise<void>((resolve) => {
      uni.login({
        provider: 'weixin',
        success: (res) => {
          console.log('微信授权 code 凭据已获取:', res.code);
          resolve();
        },
        fail: (err) => {
          console.warn('微信授权失败或当前环境未就绪:', err);
          resolve();
        }
      });
    });
    uni.hideLoading();

    uni.showModal({
      title: '环境提示',
      content: '当前为本地开发环境，微信快捷登录需后端配置AppSecret与开放平台，请使用账号密码或体验账号登录',
      confirmText: '去账号登录',
      showCancel: false,
      success: () => {
        loginType.value = 'account';
      }
    });
  } catch (err: any) {
    uni.hideLoading();
    console.error('微信快捷授权失败:', err);
    uni.showToast({ title: err?.message || '授权失败，请重试', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const handleHelp = () => {
  uni.showModal({
    title: '联系系统管理员',
    content: '如遗忘密码，请联系机构系统管理员进行密码重置，或在 PC 端后台联系校长分配临时口令。',
    showCancel: false,
  });
};
</script>

<style lang="scss" scoped>
.login-page-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #EBF2FF 0%, #F8FAFC 400rpx, #F8FAFC 100%);
  padding: 0 40rpx;
  display: flex;
  flex-direction: column;
}

.status-bar-placeholder {
  width: 100%;
}

.login-header {
  padding: 50rpx 0 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;

  .logo-circle {
    width: 140rpx;
    height: 140rpx;
    border-radius: 36rpx;
    background: linear-gradient(135deg, #2F54EB 0%, #1D39C4 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 12rpx 28rpx rgba(47, 84, 235, 0.28);
    margin-bottom: 24rpx;

    .logo-text {
      color: #FFFFFF;
      font-size: 52rpx;
      font-weight: 900;
      font-style: italic;
      letter-spacing: -2rpx;
    }
  }

  .system-title {
    font-size: 38rpx;
    font-weight: 700;
    color: #1F2937;
    margin-bottom: 8rpx;
  }

  .system-subtitle {
    font-size: 24rpx;
    color: #6B7280;
  }
}

/* 双轨 Tab 切换 */
.login-type-tabs {
  display: flex;
  justify-content: center;
  gap: 60rpx;
  margin-bottom: 30rpx;

  .tab-item {
    position: relative;
    padding-bottom: 12rpx;
    display: flex;
    flex-direction: column;
    align-items: center;

    .tab-label {
      font-size: 28rpx;
      font-weight: 500;
      color: #6B7280;
    }

    &.active {
      .tab-label {
        color: #2F54EB;
        font-weight: 700;
      }

      .tab-indicator {
        position: absolute;
        bottom: 0;
        width: 48rpx;
        height: 6rpx;
        background: #2F54EB;
        border-radius: 3rpx;
      }
    }
  }
}

.login-form-card {
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 44rpx 36rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.04);

  .form-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #111827;
    margin-bottom: 36rpx;
    border-left: 8rpx solid #2F54EB;
    padding-left: 16rpx;
  }

  .input-item {
    height: 100rpx;
    background: #F9FAFB;
    border: 1rpx solid #E5E7EB;
    border-radius: 16rpx;
    display: flex;
    align-items: center;
    padding: 0 24rpx;
    margin-bottom: 24rpx;

    .input-icon {
      font-size: 34rpx;
      margin-right: 18rpx;
    }

    .input-field {
      flex: 1;
      height: 100%;
      font-size: 28rpx;
      color: #1F2937;
    }

    .placeholder-text {
      color: #9CA3AF;
      font-size: 26rpx;
    }

    .clear-icon, .eye-icon {
      font-size: 28rpx;
      color: #9CA3AF;
      padding: 10rpx;
    }
  }

  .form-options {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 20rpx 4rpx 40rpx;

    .remember-box {
      display: flex;
      align-items: center;

      .remember-label {
        font-size: 24rpx;
        color: #4B5563;
      }
    }

    .help-link {
      font-size: 24rpx;
      color: #2F54EB;
    }
  }

  .login-button {
    height: 96rpx;
    background: linear-gradient(90deg, #2F54EB 0%, #1D39C4 100%);
    color: #FFFFFF;
    font-size: 32rpx;
    font-weight: 600;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 20rpx rgba(47, 84, 235, 0.25);
    border: none;

    &[disabled] {
      opacity: 0.6;
    }
  }

  .demo-accounts-box {
    margin-top: 36rpx;
    padding-top: 24rpx;
    border-top: 1rpx solid #F3F4F6;

    .demo-header {
      margin-bottom: 16rpx;

      .demo-title {
        font-size: 24rpx;
        color: #6B7280;
        font-weight: 600;
      }
    }

    .demo-pills {
      display: flex;
      flex-direction: column;
      gap: 12rpx;

      .demo-pill {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #F8FAFC;
        border: 1rpx solid #E5E7EB;
        padding: 12rpx 20rpx;
        border-radius: 12rpx;

        .demo-role-tag {
          font-size: 22rpx;
          color: #2F54EB;
          font-weight: 600;
        }

        .demo-acc {
          font-size: 24rpx;
          color: #374151;
        }
      }
    }
  }
}

/* 微信快捷登录专属卡片 */
.wechat-login-card {
  display: flex;
  flex-direction: column;
  align-items: center;

  .form-title {
    width: 100%;
  }

  .wechat-auth-guide {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 30rpx 0 40rpx;

    .wechat-icon-large {
      width: 130rpx;
      height: 130rpx;
      border-radius: 50%;
      background: #07C160;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.25);
      margin-bottom: 24rpx;

      .wechat-glyph {
        font-size: 64rpx;
        color: #FFFFFF;
      }
    }

    .guide-title {
      font-size: 30rpx;
      font-weight: 700;
      color: #1F2937;
      margin-bottom: 12rpx;
    }

    .guide-desc {
      font-size: 24rpx;
      color: #6B7280;
      text-align: center;
      line-height: 1.4;
      padding: 0 30rpx;
    }
  }

  .wechat-auth-btn {
    width: 100%;
    height: 96rpx;
    background: #07C160;
    color: #FFFFFF;
    font-size: 32rpx;
    font-weight: 600;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
    box-shadow: 0 8rpx 20rpx rgba(7, 193, 96, 0.25);
    border: none;

    .btn-icon {
      font-size: 32rpx;
    }
  }

  .wechat-policy-hint {
    margin-top: 32rpx;
    text-align: center;

    .policy-txt {
      font-size: 20rpx;
      color: #9CA3AF;
      line-height: 1.4;
    }
  }

  .quick-back-account {
    margin-top: 24rpx;

    .back-link {
      font-size: 24rpx;
      color: #2F54EB;
    }
  }
}

.login-footer {
  margin-top: auto;
  padding: 40rpx 0 30rpx;
  display: flex;
  justify-content: center;

  .copyright-text {
    font-size: 22rpx;
    color: #9CA3AF;
  }
}
</style>
