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

          <view class="icon-avatar">
            <AppIcon :name="item.icon" size="44rpx" color="#2F54EB" />
          </view>
          <text class="item-name">{{ item.name }}</text>

          <!-- 上移下移排序控制器 -->
          <view class="order-arrows-row">
            <view
              class="arrow-btn move-up"
              :class="{ disabled: idx === 0 }"
              @click.stop="moveUp(idx)"
            >
              <AppIcon name="chevron-up" size="20rpx" color="currentColor" />
            </view>
            <view
              class="arrow-btn move-down"
              :class="{ disabled: idx === activeList.length - 1 }"
              @click.stop="moveDown(idx)"
            >
              <AppIcon name="chevron-down" size="20rpx" color="currentColor" />
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
            :style="{ opacity: isAdded(item.id) ? 0.6 : 1 }"
          >
            <AppIcon :name="item.icon" size="44rpx" :color="isAdded(item.id) ? '#94A3B8' : '#2F54EB'" />
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
import AppIcon from '../../components/AppIcon.vue';
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
  background-color: #F6F8FC;
  padding-bottom: 40rpx;
}

.action-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 28rpx;
  background: #FFFFFF;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.02);

  .cancel-btn,
  .save-btn {
    cursor: pointer;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    will-change: transform;

    &:active {
      transform: scale(0.92);
    }
  }

  .top-bar-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #0F172A;
    letter-spacing: 0.2rpx;
  }

  .btn-text {
    font-size: 28rpx;
    color: #64748B;
    font-weight: 500;

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
  background: #EEF2FF;
  border-bottom: 1rpx solid rgba(47, 84, 235, 0.1);

  .tip-text {
    font-size: 22rpx;
    color: #2F54EB;
    font-weight: 500;
  }

  .count-badge {
    background: #DBEAFE;
    padding: 4rpx 16rpx;
    border-radius: 9999rpx;
    border: 1rpx solid rgba(37, 99, 235, 0.2);

    .count-text {
      font-size: 22rpx;
      color: #1D4ED8;
      font-weight: 700;
    }

    &.full-badge {
      background: #FEE2E2;
      border-color: rgba(220, 38, 38, 0.2);
      .count-text {
        color: #DC2626;
      }
    }
  }
}

.settings-card {
  margin: 20rpx 24rpx;
  background: #FFFFFF;
  border-radius: 28rpx;
  padding: 28rpx 24rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 4rpx 20rpx rgba(15, 23, 42, 0.03);

  .card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24rpx;
    padding: 0 6rpx;

    .card-title {
      font-size: 28rpx;
      font-weight: 700;
      color: #0F172A;
      letter-spacing: 0.2rpx;
    }

    .reset-btn {
      font-size: 24rpx;
      color: #2F54EB;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

      &:active {
        transform: scale(0.92);
      }
    }
  }

  .category-header {
    margin-bottom: 20rpx;
    padding: 0 6rpx;

    .category-title {
      font-size: 28rpx;
      font-weight: 700;
      color: #334155;
    }
  }

  .active-functions-grid,
  .pool-functions-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    row-gap: 26rpx;
    column-gap: 16rpx;

    .active-grid-item,
    .pool-grid-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      will-change: transform;

      &.pool-grid-item {
        cursor: pointer;

        &:active {
          transform: scale(0.94);
        }
      }

      .icon-avatar {
        width: 92rpx;
        height: 92rpx;
        border-radius: 26rpx;
        background: linear-gradient(135deg, #EEF2FF 0%, #E0EAFF 100%);
        border: 1rpx solid rgba(47, 84, 235, 0.12);
        box-shadow: 0 4rpx 14rpx rgba(47, 84, 235, 0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin-bottom: 12rpx;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .item-name {
        font-size: 22rpx;
        color: #1E293B;
        font-weight: 500;
        text-align: center;
        width: 100%;
        height: 32rpx;
        line-height: 32rpx;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        letter-spacing: 0.2rpx;

        &.name-muted {
          color: #94A3B8;
        }
      }

      .red-minus-badge {
        position: absolute;
        top: -8rpx;
        right: 18rpx;
        width: 38rpx;
        height: 38rpx;
        border-radius: 50%;
        background-color: #DC2626;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2rpx 8rpx rgba(220, 38, 38, 0.45);
        border: 2rpx solid #FFFFFF;
        z-index: 2;
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

        &:active {
          transform: scale(0.85);
        }

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
        margin-top: 8rpx;

        .arrow-btn {
          width: 36rpx;
          height: 36rpx;
          background: #F1F5F9;
          border-radius: 10rpx;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1rpx solid rgba(15, 23, 42, 0.06);
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.18s ease;

          &:active:not(.disabled) {
            transform: scale(0.88);
            background: #E2E8F0;
          }

          .arrow-icon {
            font-size: 16rpx;
            color: #475569;
          }

          &.disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }
        }
      }

      .item-action-badge {
        position: absolute;
        top: -6rpx;
        right: 18rpx;
        width: 36rpx;
        height: 36rpx;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2rpx solid #FFFFFF;
        z-index: 2;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

        &:active {
          transform: scale(0.85);
        }

        &.badge-add {
          background-color: #2F54EB;
          box-shadow: 0 2rpx 8rpx rgba(47, 84, 235, 0.4);

          .action-symbol {
            color: #FFFFFF;
            font-size: 22rpx;
            font-weight: 900;
            line-height: 1;
          }
        }

        &.badge-added {
          background-color: #E2E8F0;

          .action-symbol {
            color: #94A3B8;
            font-size: 18rpx;
            line-height: 1;
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
