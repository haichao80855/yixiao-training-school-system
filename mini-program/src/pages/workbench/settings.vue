<template>
  <view class="workbench-settings-container">
    <CustomNavBar />

    <!-- 顶部操作条: 取消 | 标题 | 完成 (对应截图 088) -->
    <view class="action-top-bar">
      <view class="cancel-btn" @click="handleCancel">
        <text class="btn-text">取消</text>
      </view>
      <text class="top-bar-title">常用功能 ({{ activeList.length }}/8)</text>
      <view class="save-btn" @click="handleSave">
        <text class="btn-text highlight">完成</text>
      </view>
    </view>

    <!-- 提示与计数条 -->
    <view class="header-tip-strip">
      <text class="tip-text">点击红减号移除，点击上下箭头调整排序</text>
      <view class="count-badge" :class="{ 'full-badge': activeList.length === 8 }">
        <text class="count-text">{{ activeList.length }}/8</text>
      </view>
    </view>

    <!-- 1. 当前激活的常用功能区 (Active Grid) -->
    <view class="settings-card active-card">
      <view class="card-title-row">
        <text class="card-title">我的常用功能 (最多8个)</text>
        <text class="reset-btn" @click="handleReset">恢复默认</text>
      </view>

      <view class="active-functions-grid">
        <view class="active-grid-item" v-for="(item, idx) in activeList" :key="item.id">
          <!-- 红减号删除按钮 -->
          <view class="red-minus-badge red-minus" @click.stop="handleRemove(idx)">
            <text class="minus-symbol">－</text>
          </view>

          <view class="icon-avatar" :style="{ background: item.bg }">
            <text class="item-emoji">{{ item.icon }}</text>
          </view>
          <text class="item-name">{{ item.name }}</text>

          <!-- 上移下移排序控制器 -->
          <view class="order-arrows-row">
            <view
              class="arrow-btn move-up"
              :class="{ disabled: idx === 0 }"
              @click.stop="moveUp(idx)"
            >
              <text class="arrow-icon">▲</text>
            </view>
            <view
              class="arrow-btn move-down"
              :class="{ disabled: idx === activeList.length - 1 }"
              @click.stop="moveDown(idx)"
            >
              <text class="arrow-icon">▼</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 2. 可选业务功能库 (按大类分组) -->
    <view
      class="settings-card pool-card"
      v-for="group in availableGroups"
      :key="group.category"
    >
      <view class="category-header">
        <text class="category-title">{{ group.title }}</text>
      </view>

      <view class="pool-functions-grid">
        <view
          class="pool-grid-item"
          v-for="item in group.items"
          :key="item.id"
          @click="handleAdd(item)"
        >
          <!-- 状态徽章: 蓝加号 或 置灰已添加 -->
          <view
            class="item-action-badge"
            :class="isAdded(item.id) ? 'badge-added' : 'badge-add'"
          >
            <text class="action-symbol">{{ isAdded(item.id) ? '✓' : '＋' }}</text>
          </view>

          <view
            class="icon-avatar"
            :style="{ background: item.bg, opacity: isAdded(item.id) ? 0.6 : 1 }"
          >
            <text class="item-emoji">{{ item.icon }}</text>
          </view>
          <text class="item-name" :class="{ 'name-muted': isAdded(item.id) }">
            {{ item.name }}
          </text>
        </view>
      </view>
    </view>

    <view class="bottom-pad"></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CustomNavBar from '../../components/CustomNavBar.vue';
import {
  QuickActionItem,
  DEFAULT_QUICK_ACTIONS,
  getAllAvailableActions,
  getUserQuickActions,
  saveUserQuickActions,
} from '../../api/workbench';

const activeList = ref<QuickActionItem[]>(getUserQuickActions());
const availableGroups = getAllAvailableActions();

function isAdded(id: string): boolean {
  return activeList.value.some((a) => a.id === id);
}

function handleAdd(item: QuickActionItem) {
  if (isAdded(item.id)) {
    uni.showToast({ title: '该功能已在常用列表中', icon: 'none' });
    return;
  }
  if (activeList.value.length >= 8) {
    uni.showToast({ title: '最多只能添加8个常用功能', icon: 'none' });
    return;
  }
  activeList.value.push({ ...item });
}

function handleRemove(idx: number) {
  if (activeList.value.length <= 1) {
    uni.showToast({ title: '至少保留1个常用功能，不能全部清空', icon: 'none' });
    return;
  }
  activeList.value.splice(idx, 1);
}

function moveUp(idx: number) {
  if (idx <= 0) return;
  const temp = activeList.value[idx];
  activeList.value[idx] = activeList.value[idx - 1];
  activeList.value[idx - 1] = temp;
}

function moveDown(idx: number) {
  if (idx >= activeList.value.length - 1) return;
  const temp = activeList.value[idx];
  activeList.value[idx] = activeList.value[idx + 1];
  activeList.value[idx + 1] = temp;
}

function handleReset() {
  activeList.value = [...DEFAULT_QUICK_ACTIONS];
  uni.showToast({ title: '已恢复默认8宫格', icon: 'none' });
}

function handleCancel() {
  uni.navigateBack();
}

function handleSave() {
  const res = saveUserQuickActions(activeList.value);
  if (!res.success) {
    uni.showToast({ title: res.message || '保存失败', icon: 'none' });
    return;
  }
  uni.$emit('quick-actions-updated');
  uni.showToast({ title: '常用功能设置已保存', icon: 'success' });
  setTimeout(() => {
    uni.navigateBack();
  }, 350);
}
</script>

<style lang="scss" scoped>
.workbench-settings-container {
  min-height: 100vh;
  background-color: #F8FAFC;
  padding-bottom: 40rpx;
}

.action-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 28rpx;
  background: #FFFFFF;
  border-bottom: 1rpx solid #E5E7EB;

  .top-bar-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #111827;
  }

  .btn-text {
    font-size: 28rpx;
    color: #6B7280;

    &.highlight {
      color: #2F54EB;
      font-weight: 700;
    }
  }
}

.header-tip-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 28rpx;
  background: #EFF6FF;

  .tip-text {
    font-size: 22rpx;
    color: #2F54EB;
  }

  .count-badge {
    background: #DBEAFE;
    padding: 2rpx 14rpx;
    border-radius: 20rpx;

    .count-text {
      font-size: 22rpx;
      color: #1D4ED8;
      font-weight: 700;
    }

    &.full-badge {
      background: #FEE2E2;
      .count-text {
        color: #DC2626;
      }
    }
  }
}

.settings-card {
  margin: 20rpx 24rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.02);

  .card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24rpx;

    .card-title {
      font-size: 28rpx;
      font-weight: 700;
      color: #111827;
    }

    .reset-btn {
      font-size: 24rpx;
      color: #2F54EB;
    }
  }

  .category-header {
    margin-bottom: 20rpx;
    .category-title {
      font-size: 28rpx;
      font-weight: 700;
      color: #374151;
    }
  }

  .active-functions-grid,
  .pool-functions-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    row-gap: 24rpx;
    column-gap: 16rpx;

    .active-grid-item,
    .pool-grid-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;

      .icon-avatar {
        width: 88rpx;
        height: 88rpx;
        border-radius: 24rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 8rpx;

        .item-emoji {
          font-size: 40rpx;
        }
      }

      .item-name {
        font-size: 22rpx;
        color: #374151;
        font-weight: 500;
        text-align: center;

        &.name-muted {
          color: #9CA3AF;
        }
      }

      .red-minus-badge {
        position: absolute;
        top: -8rpx;
        right: 18rpx;
        width: 36rpx;
        height: 36rpx;
        border-radius: 50%;
        background-color: #FF4D4F;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2rpx 8rpx rgba(255, 77, 79, 0.4);
        z-index: 2;

        .minus-symbol {
          color: #FFFFFF;
          font-size: 22rpx;
          font-weight: 900;
          line-height: 1;
        }
      }

      .order-arrows-row {
        display: flex;
        align-items: center;
        gap: 12rpx;
        margin-top: 6rpx;

        .arrow-btn {
          width: 32rpx;
          height: 32rpx;
          background: #F3F4F6;
          border-radius: 8rpx;
          display: flex;
          align-items: center;
          justify-content: center;

          .arrow-icon {
            font-size: 16rpx;
            color: #4B5563;
          }

          &.disabled {
            opacity: 0.3;
          }
        }
      }

      .item-action-badge {
        position: absolute;
        top: -6rpx;
        right: 18rpx;
        width: 32rpx;
        height: 32rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;

        &.badge-add {
          background-color: #2F54EB;
          .action-symbol {
            color: #FFFFFF;
            font-size: 20rpx;
            font-weight: 900;
          }
        }

        &.badge-added {
          background-color: #E5E7EB;
          .action-symbol {
            color: #9CA3AF;
            font-size: 18rpx;
          }
        }
      }
    }
  }
}

.bottom-pad {
  height: 60rpx;
}
</style>
