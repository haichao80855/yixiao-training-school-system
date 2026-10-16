<template>
  <view class="student-detail-container">
    <!-- 顶部状态栏与自定义导航 (对齐截图 024: < 学员详情) -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-left" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="nav-title">学员详情</text>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 学员核心信息卡片 (对齐截图 024 头部) -->
    <view class="profile-header-card">
      <view class="profile-main-row">
        <!-- 左侧大头像 (带 '启' 蓝色圆标) -->
        <view class="avatar-box">
          <view class="avatar-circle">
            <text class="avatar-emoji">{{ profile.gender === '女' ? '👧' : '👦' }}</text>
          </view>
          <view class="avatar-badge-qi">{{ (profile.name && profile.name[0]) || '启' }}</view>
        </view>

        <!-- 中间学员名字与学号 -->
        <view class="profile-text-col">
          <view class="name-qr-row">
            <text class="profile-name">{{ profile.name || '学员' }}</text>
            <text class="qr-code-icon" @click="handleShowQr">⚏</text>
          </view>
          <text class="profile-student-no">学号: {{ profile.studentNo || '未分配' }}</text>
        </view>

        <!-- 右侧橙色操作按钮 (对齐截图 024 右上角) -->
        <view class="action-cursor-btn" @click="showActionSheet = true">
          <text class="cursor-icon">⮑</text>
          <text class="btn-text">操作</text>
        </view>
      </view>

      <!-- 截止日期与渠道来源 -->
      <view class="sub-info-lines">
        <text class="sub-text">学员截止日期: {{ profile.expireDateText }}</text>
        <text class="sub-text">渠道来源: {{ profile.channelSource }}</text>
      </view>

      <!-- 状态与校区胶囊标签 -->
      <view class="tags-row">
        <view
          class="tag-status-active"
          :class="[
            profile.tagClass,
            {
              'tag-status-unassigned': profile.status === '未报读',
              'tag-status-pending': profile.status === '待分班',
              'tag-status-suspended': profile.status === '停课'
            }
          ]"
        >
          {{ profile.statusText || profile.status }}
        </view>
        <view
          v-if="profile.consumptionRisk && profile.consumptionRisk.warningWindow"
          class="tag-risk"
          :class="profile.consumptionRisk.level === 'URGENT' ? 'tag-risk-urgent' : 'tag-risk-warning'"
        >
          {{ profile.consumptionRisk.label }}
        </view>
        <view class="tag-campus">{{ profile.campusName || '总部校区' }}</view>
      </view>

      <!-- 4 栏数据指标 (对齐截图 024: 78剩余课次 | 4992剩余金额 | 0钱包余额 | 0卡包) -->
      <view class="metrics-grid-row">
        <view class="metric-cell">
          <text class="metric-num">{{ profile.totalRemainingLessons }}</text>
          <text class="metric-label">剩余课次</text>
        </view>
        <view class="metric-divider"></view>
        <view class="metric-cell">
          <text class="metric-num">{{ profile.totalRemainingAmount }}</text>
          <text class="metric-label">剩余金额(元)</text>
        </view>
        <view class="metric-divider"></view>
        <view class="metric-cell">
          <text class="metric-num">{{ profile.walletBalance }}</text>
          <text class="metric-label">钱包余额(元)</text>
        </view>
        <view class="metric-divider"></view>
        <view class="metric-cell">
          <text class="metric-num">{{ profile.cardCount }}</text>
          <text class="metric-label">卡包</text>
        </view>
      </view>

      <!-- 冻结课次蓝色通知条 (对齐截图 024) -->
      <view class="frozen-banner" @click="handleFrozenLessons">
        <view class="frozen-left">
          <text class="lock-icon">🔒</text>
          <text class="frozen-text">冻结课次 {{ profile.frozenLessons }} 次</text>
        </view>
        <text class="chevron">›</text>
      </view>
    </view>

    <!-- 2. 三大核心 Tab (对齐截图 024/025/026: 学员课程 | 上课记录 | 沟通记录) -->
    <view class="detail-tabs-bar">
      <view
        class="dtab-item"
        :class="{ active: currentTab === 'courses' }"
        @click="currentTab = 'courses'"
      >
        <text class="dtab-label">学员课程</text>
        <view class="tab-bottom-line" v-if="currentTab === 'courses'"></view>
      </view>
      <view
        class="dtab-item"
        :class="{ active: currentTab === 'attendance' }"
        @click="currentTab = 'attendance'"
      >
        <text class="dtab-label">上课记录</text>
        <view class="tab-bottom-line" v-if="currentTab === 'attendance'"></view>
      </view>
      <view
        class="dtab-item"
        :class="{ active: currentTab === 'communication' }"
        @click="currentTab = 'communication'"
      >
        <text class="dtab-label">沟通记录</text>
        <view class="tab-bottom-line" v-if="currentTab === 'communication'"></view>
      </view>
    </view>

    <!-- 3. Tab 内容区 -->
    <scroll-view class="tab-content-scroll" scroll-y>
      <!-- ================= Tab 1: 学员课程 (对齐截图 024) ================= -->
      <view v-if="currentTab === 'courses'" class="courses-panel">
        <view class="filter-zero-row" @click="showZero = !showZero" v-if="profile.courses.length > 0">
          <view class="checkbox-box" :class="{ checked: showZero }">
            <text v-if="showZero" class="check-mark">✓</text>
          </view>
          <text class="checkbox-label">显示剩余数量为0的课程</text>
        </view>

        <!-- 课程卡片列表 -->
        <view class="course-cards-flow" v-if="displayedCourses.length > 0">
          <view
            class="course-card-item"
            v-for="crs in displayedCourses"
            :key="crs.id"
          >
            <view class="course-cover-box">
              <view class="cover-gradient">
                <text class="cover-main-title">{{ crs.courseName || '精品课程' }}</text>
                <text class="cover-sub-text">在这里，让我们一起成长</text>
              </view>
            </view>

            <view class="course-info-col">
              <view class="course-title-text">{{ crs.courseName }}</view>
              <view class="course-badges-row">
                <view :class="crs.isEnrolledClass ? 'badge-entered' : 'badge-unassigned'">
                  {{ crs.isEnrolledClass ? '已入班' : '待入班' }}
                </view>
                <view class="badge-gray">剩余{{ crs.remainingLessons }}课次</view>
                <view class="badge-gray">剩余{{ crs.remainingAmount }}元</view>
              </view>
              <view
                class="class-link-row"
                v-if="crs.className"
                @click="handleGoClassDetail(crs.classId)"
              >
                <text class="class-link-text">班级：{{ crs.className }}</text>
                <text class="link-arrow">›</text>
              </view>
              <view class="add-to-class-btn-row">
                <view class="add-class-btn" @click="handleJoinClass(crs)">
                  {{ crs.isEnrolledClass ? '调整班级' : '加入班级' }}
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 空状态：学员尚未报读任何课程 -->
        <view v-else class="empty-courses-box">
          <view class="empty-book-icon">📚</view>
          <view class="empty-title">暂无报读课程</view>
          <view class="empty-desc">该学员当前暂未报名任何课程或课包</view>
          <view class="enroll-action-btn" @click="handleActionItem('enroll')">
            去报名开单
          </view>
        </view>
      </view>

      <!-- ================= Tab 2: 上课记录 (对齐截图 025) ================= -->
      <view v-else-if="currentTab === 'attendance'" class="attendance-panel">
        <!-- 课次数统计横幅 -->
        <view class="lessons-count-card">
          <text class="count-label">课次数</text>
          <text class="count-val">{{ profile.attendances.length }} 次</text>
        </view>

        <!-- 考勤状态胶囊筛选条 -->
        <view class="attendance-filter-pills">
          <view
            class="pill-btn"
            v-for="st in attendanceFilters"
            :key="st.key"
            :class="{ active: currentAttFilter === st.key }"
            @click="currentAttFilter = st.key"
          >
            {{ st.label }}
          </view>
        </view>

        <!-- 上课流水卡片流 -->
        <view class="att-cards-flow">
          <view
            class="att-record-card"
            v-for="rec in filteredAttendances"
            :key="rec.id"
          >
            <view class="rec-tags-row">
              <view class="tag-offline">线下课</view>
              <view class="tag-signed">已签到</view>
              <view class="deduct-badge">扣{{ rec.deductLessons }}课次</view>
            </view>

            <view class="rec-class-title">{{ rec.className }}</view>
            <view class="rec-meta-text">课程：{{ rec.courseName }}</view>
            <view class="rec-meta-text">实际上课时间：{{ rec.timeRangeText }}</view>
          </view>
        </view>
      </view>

      <!-- ================= Tab 3: 沟通记录 (对齐截图 026) ================= -->
      <view v-else class="communication-panel">
        <!-- 筛选与售前售后胶囊 -->
        <view class="comm-filter-bar">
          <view class="comm-dropdowns">
            <view class="comm-drop">
              <text>沟通时间</text>
              <text class="arrow">▼</text>
            </view>
            <view class="comm-drop">
              <text>跟进记录</text>
              <text class="arrow">▼</text>
            </view>
            <view class="comm-drop">
              <text>课程</text>
              <text class="arrow">▼</text>
            </view>
          </view>
          <view class="pre-after-switch">
            <view
              class="switch-btn"
              :class="{ active: commType === 'pre' }"
              @click="commType = 'pre'"
            >
              售前
            </view>
            <view
              class="switch-btn"
              :class="{ active: commType === 'after' }"
              @click="commType = 'after'"
            >
              售后
            </view>
          </view>
        </view>

        <!-- 沟通记录列表 -->
        <view v-if="profile.communications.length > 0" class="comm-list-cards">
          <view
            class="comm-card"
            v-for="comm in profile.communications"
            :key="comm.id"
          >
            <view class="comm-card-header">
              <text class="comm-date">{{ comm.dateText }}</text>
              <text class="comm-method">{{ comm.method }}</text>
            </view>
            <view class="comm-content">{{ comm.content }}</view>
            <view class="comm-footer">跟进人: {{ comm.communicator }}</view>
          </view>
        </view>

        <!-- 空状态 (对齐截图 026: 暂无数据) -->
        <view v-else class="comm-empty-box">
          <text class="sad-emoji">🥺</text>
          <text class="empty-text">暂无数据</text>
        </view>

        <!-- 悬浮添加沟通记录按钮 (对齐截图 026 右下角) -->
        <view class="float-add-comm" @click="handleAddCommunication">
          <text class="plus-icon">＋</text>
        </view>
      </view>

      <view class="bottom-safe-space"></view>
    </scroll-view>

    <!-- 4. 右上角「操作」ActionSheet 弹窗 (1:1 对齐截图 027) -->
    <view class="modal-mask" v-if="showActionSheet" @click="showActionSheet = false">
      <view class="action-sheet-dialog" @click.stop>
        <view class="dialog-item" @click="handleActionItem('edit')">编辑信息</view>
        <view class="dialog-divider"></view>
        <view class="dialog-item" @click="handleActionItem('enroll')">报名</view>
        <view class="dialog-divider"></view>
        <view class="dialog-item" @click="handleActionItem('recharge')">充钱包</view>
        <view class="dialog-divider"></view>
        <view class="dialog-item text-danger" @click="handleActionItem('disable')">禁用学员</view>
        <view class="dialog-gap"></view>
        <view class="dialog-item cancel-item" @click="showActionSheet = false">取消</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { studentApi, type StudentCourseItemModel } from '../../api/student';
import {
  studentProjector,
  computeActionPermissions,
  type StudentDossierView,
} from '../../projectors/student';

const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

const studentId = ref('');
const currentTab = ref<'courses' | 'attendance' | 'communication'>('courses');
const showZero = ref(false);
const showActionSheet = ref(false);

// 考勤筛选
const currentAttFilter = ref('all');
const attendanceFilters = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待签到' },
  { key: 'present', label: '已签到' },
  { key: 'absent', label: '缺席' },
  { key: 'abnormal', label: '异常' },
  { key: 'leave', label: '请假' },
];

// 沟通记录售前售后
const commType = ref<'pre' | 'after'>('after');

// 学员全息档案投影模型
const profile = ref<StudentDossierView>({
  id: '',
  name: '',
  studentNo: '',
  gender: '男',
  phone: '',
  guardianRelation: '家长',
  expireDateText: '无限期',
  channelSource: '',
  status: '未报读',
  normalizedStatus: 'not_enrolled',
  statusText: '未报读',
  tagClass: 'tag-unassigned',
  isAssignedClass: false,
  inPendingAssetPool: false,
  campusName: '',
  totalRemainingLessons: 0,
  activeRemainingLessons: 0,
  totalRemainingAmount: 0,
  walletBalance: 0,
  principalBalance: 0,
  bonusBalance: 0,
  cardCount: 0,
  frozenLessons: 0,
  assets: {
    totalRemainingLessons: 0,
    activeRemainingLessons: 0,
    frozenLessons: 0,
    totalRemainingAmount: 0,
    weightedPricePerLesson: 0,
    walletBalance: 0,
    principalBalance: 0,
    bonusBalance: 0,
    cardCount: 0,
  },
  consumptionRisk: {
    level: 'HEALTHY',
    label: '课消健康',
    isUrgent: false,
    warningWindow: false,
    stars: 3,
    color: '#10B981',
  },
  permissions: {
    canEnroll: true,
    canAdjustClass: false,
    canRecharge: true,
    canDisable: true,
    canRefund: false,
  },
  courses: [],
  attendances: [],
  communications: [],
});

let hasLoaded = false;

onLoad((query: any) => {
  if (query?.studentId) {
    studentId.value = query.studentId;
  }
  hasLoaded = true;
  fetchProfile();
});

onMounted(() => {
  try {
    const info = uni.getSystemInfoSync();
    statusBarHeight.value = info.statusBarHeight || 20;
    // #ifdef MP-WEIXIN
    const btn = uni.getMenuButtonBoundingClientRect();
    if (btn) {
      capsuleRightWidth.value = info.windowWidth - btn.left + 8;
    }
    // #endif
  } catch (e) {}

  if (!hasLoaded) {
    const pages = getCurrentPages();
    const curPage = pages[pages.length - 1];
    const query = (curPage as any)?.options || {};
    if (query?.studentId) studentId.value = query.studentId;
    fetchProfile();
  }
});

const fetchProfile = async () => {
  if (!studentId.value) return;
  const dossier = await studentProjector.projectDossier(studentId.value);
  profile.value = dossier;
};

const displayedCourses = computed(() => {
  if (showZero.value) {
    return profile.value.courses;
  }
  return profile.value.courses.filter((c) => c.remainingLessons > 0);
});

const filteredAttendances = computed(() => {
  if (currentAttFilter.value === 'all') return profile.value.attendances;
  return profile.value.attendances.filter((a) => a.status === currentAttFilter.value);
});

const handleGoBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: '/package-student/list/index' });
  }
};

const handleShowQr = () => {
  uni.showModal({
    title: `${profile.value.name} 的学员二维码`,
    content: `学号: ${profile.value.studentNo}\n已开启考勤扫码核销。`,
    showCancel: false,
  });
};

const handleFrozenLessons = () => {
  uni.showModal({
    title: '冻结课次说明',
    content: `当前共有 ${profile.value.frozenLessons} 节课次因请假或停课处于冻结保护状态，复学后自动恢复。`,
    showCancel: false,
  });
};

const handleGoClassDetail = (classId?: string) => {
  if (!classId) {
    uni.showToast({ title: '暂未分配具体班级', icon: 'none' });
    return;
  }
  uni.navigateTo({
    url: `/package-edu/class/detail?classId=${classId}`,
  });
};

const handleJoinClass = (crs: StudentCourseItemModel) => {
  if (profile.value.permissions && !profile.value.permissions.canAdjustClass) {
    uni.showModal({
      title: '操作受限',
      content: `学员当前学籍状态为【${profile.value.statusText}】，暂不支持调整或加入班级。`,
      showCancel: false,
    });
    return;
  }
  uni.navigateTo({
    url: `/package-student/enroll/wizard?studentId=${profile.value.id}&courseId=${crs.courseId}&step=class`,
  });
};

const handleAddCommunication = () => {
  uni.showModal({
    title: '添加沟通记录',
    editable: true,
    placeholderText: '请输入本次沟通跟进纪要',
    success: (res) => {
      if (res.confirm && res.content) {
        profile.value.communications.unshift({
          id: `com-${Date.now()}`,
          type: 'after_sale',
          dateText: '刚刚',
          communicator: '当前顾问',
          method: '微信沟通',
          content: res.content,
        });
        uni.showToast({ title: '跟进记录已添加', icon: 'success' });
      }
    },
  });
};

const handleActionItem = (type: string) => {
  showActionSheet.value = false;
  if (type === 'edit') {
    uni.navigateTo({
      url: `/package-student/edit/index?studentId=${profile.value.id}`,
    });
  } else if (type === 'enroll') {
    if (profile.value.permissions && !profile.value.permissions.canEnroll) {
      uni.showModal({
        title: '操作受限',
        content: `该学员当前为【${profile.value.statusText}】状态，不可办理报名。`,
        showCancel: false,
      });
      return;
    }
    uni.navigateTo({
      url: `/package-student/enroll/wizard?studentId=${profile.value.id}&studentName=${encodeURIComponent(profile.value.name)}`,
    });
  } else if (type === 'recharge') {
    if (profile.value.permissions && !profile.value.permissions.canRecharge) {
      uni.showModal({
        title: '操作受限',
        content: `该学员当前为【${profile.value.statusText}】状态，不可充值。`,
        showCancel: false,
      });
      return;
    }
    uni.showModal({
      title: '钱包充值',
      editable: true,
      placeholderText: '请输入充值金额(元)',
      success: async (res) => {
        if (res.confirm && res.content) {
          const amt = Number(res.content);
          if (isNaN(amt) || amt <= 0) {
            uni.showToast({ title: '请输入有效充值金额', icon: 'none' });
            return;
          }
          await studentApi.rechargeWallet(profile.value.id, amt);
          studentProjector.invalidateDossier(profile.value.id);
          profile.value.walletBalance += amt;
          profile.value.principalBalance += amt;
          profile.value.assets.walletBalance += amt;
          profile.value.assets.principalBalance += amt;
          profile.value.permissions = computeActionPermissions(
            profile.value.normalizedStatus,
            profile.value.assets
          );
          uni.showToast({ title: `成功充值 ¥${amt}`, icon: 'success' });
        }
      },
    });
  } else if (type === 'disable') {
    if (profile.value.permissions && !profile.value.permissions.canDisable) {
      uni.showModal({
        title: '操作受限',
        content: `该学员当前为【${profile.value.statusText}】状态，无需重复禁用。`,
        showCancel: false,
      });
      return;
    }
    uni.showModal({
      title: '禁用提醒',
      content: `确定要将学员 ${profile.value.name} 设为禁用状态吗？`,
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          profile.value.status = '停课';
          profile.value.statusText = '停课';
          profile.value.normalizedStatus = 'suspended';
          profile.value.tagClass = 'tag-suspended';
          profile.value.permissions = computeActionPermissions('suspended', profile.value.assets);
          studentProjector.invalidateDossier(profile.value.id);
          uni.showToast({ title: '学员已禁用', icon: 'none' });
        }
      },
    });
  }
};
</script>

<style scoped>
.student-detail-container {
  min-height: 100vh;
  background-color: #F8F9FD;
  display: flex;
  flex-direction: column;
}

/* 顶部导航 */
.nav-bar {
  background: #FFFFFF;
}

.nav-inner {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
}

.nav-left {
  display: flex;
  align-items: center;
}

.back-arrow {
  font-size: 52rpx;
  color: #1F2937;
  margin-right: 16rpx;
  line-height: 1;
}

.nav-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

/* 学员卡片头部 */
.profile-header-card {
  background: #FFFFFF;
  padding: 30rpx 32rpx;
  border-bottom: 1rpx solid #F3F4F6;
}

.profile-main-row {
  display: flex;
  align-items: center;
}

.avatar-box {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  margin-right: 24rpx;
}

.avatar-circle {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: #FFF1E6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-emoji {
  font-size: 64rpx;
}

.avatar-badge-qi {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 36rpx;
  height: 36rpx;
  background: #2563EB;
  color: #FFFFFF;
  font-size: 20rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #FFFFFF;
}

.profile-text-col {
  flex: 1;
}

.name-qr-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.profile-name {
  font-size: 38rpx;
  font-weight: 700;
  color: #111827;
}

.qr-code-icon {
  font-size: 36rpx;
  color: #9CA3AF;
}

.profile-student-no {
  font-size: 26rpx;
  color: #6B7280;
  margin-top: 6rpx;
}

.action-cursor-btn {
  display: flex;
  align-items: center;
  background: #F97316;
  padding: 10rpx 28rpx;
  border-radius: 32rpx;
  color: #FFFFFF;
  gap: 8rpx;
}

.cursor-icon {
  font-size: 28rpx;
}

.btn-text {
  font-size: 26rpx;
  font-weight: 600;
}

.sub-info-lines {
  display: flex;
  gap: 36rpx;
  margin-top: 24rpx;
}

.sub-text {
  font-size: 24rpx;
  color: #6B7280;
}

.tags-row {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.tag-status-active {
  font-size: 22rpx;
  background: #E8F7ED;
  color: #10B981;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}

.tag-status-active.tag-status-unassigned,
.tag-status-active.tag-unassigned {
  background: #F3F4F6;
  color: #6B7280;
}

.tag-status-active.tag-status-pending,
.tag-status-active.tag-pending {
  background: #FEF3C7;
  color: #D97706;
}

.tag-status-active.tag-status-suspended,
.tag-status-active.tag-suspended {
  background: #FEE2E2;
  color: #EF4444;
}

.tag-status-active.tag-graduated {
  background: #EDE9FE;
  color: #8B5CF6;
}

.tag-status-active.tag-lost {
  background: #F3F4F6;
  color: #9CA3AF;
}

.tag-status-active.tag-transferred {
  background: #E0E7FF;
  color: #4F46E5;
}

.tag-risk {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  font-weight: 500;
}

.tag-risk-urgent {
  background: #FEE2E2;
  color: #EF4444;
}

.tag-risk-warning {
  background: #FEF3C7;
  color: #D97706;
}

.tag-campus {
  font-size: 22rpx;
  background: #EFF6FF;
  color: #2563EB;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}

/* 4 栏数据指标 */
.metrics-grid-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-top: 36rpx;
  padding-bottom: 24rpx;
}

.metric-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-num {
  font-size: 40rpx;
  font-weight: 700;
  color: #111827;
}

.metric-label {
  font-size: 22rpx;
  color: #6B7280;
  margin-top: 6rpx;
}

.metric-divider {
  width: 1rpx;
  height: 48rpx;
  background: #E5E7EB;
}

/* 冻结课次通知横幅 */
.frozen-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #EFF6FF;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-top: 12rpx;
}

.frozen-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.lock-icon {
  font-size: 28rpx;
}

.frozen-text {
  font-size: 26rpx;
  font-weight: 500;
  color: #1E40AF;
}

.chevron {
  font-size: 32rpx;
  color: #3B82F6;
}

/* 3 大 Tab */
.detail-tabs-bar {
  display: flex;
  background: #FFFFFF;
  padding: 0 32rpx;
  border-bottom: 1rpx solid #F3F4F6;
}

.dtab-item {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 26rpx 0;
}

.dtab-label {
  font-size: 30rpx;
  color: #4B5563;
  font-weight: 500;
}

.dtab-item.active .dtab-label {
  color: #2F6BF4;
  font-weight: 700;
}

.tab-bottom-line {
  position: absolute;
  bottom: 0;
  width: 48rpx;
  height: 6rpx;
  background: #2F6BF4;
  border-radius: 4rpx;
}

/* Tab 滑动区 */
.tab-content-scroll {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}

/* 课程 Tab */
.filter-zero-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.checkbox-box {
  width: 32rpx;
  height: 32rpx;
  border: 2rpx solid #D1D5DB;
  border-radius: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-box.checked {
  background: #2F6BF4;
  border-color: #2F6BF4;
}

.check-mark {
  color: #FFFFFF;
  font-size: 20rpx;
}

.checkbox-label {
  font-size: 24rpx;
  color: #6B7280;
}

.course-card-item {
  background: #FFFFFF;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
  margin-bottom: 24rpx;
}

.course-cover-box {
  height: 150rpx;
  background: linear-gradient(135deg, #A78BFA 0%, #EC4899 50%, #F59E0B 100%);
  padding: 24rpx 32rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.cover-main-title {
  font-size: 40rpx;
  font-weight: 900;
  color: #FFFFFF;
  letter-spacing: 2rpx;
}

.cover-sub-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 6rpx;
}

.course-info-col {
  padding: 24rpx;
}

.course-title-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.course-badges-row {
  display: flex;
  gap: 12rpx;
  margin-top: 14rpx;
}

.badge-entered {
  font-size: 22rpx;
  background: #E8F7ED;
  color: #10B981;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

.badge-unassigned {
  font-size: 22rpx;
  background: #FEF3C7;
  color: #D97706;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

.badge-gray {
  font-size: 22rpx;
  background: #F3F4F6;
  color: #4B5563;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

.class-link-row {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
}

.class-link-text {
  font-size: 26rpx;
  color: #2F6BF4;
  font-weight: 500;
}

.link-arrow {
  color: #2F6BF4;
  margin-left: 6rpx;
  font-size: 28rpx;
}

.add-to-class-btn-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 16rpx;
}

.add-class-btn {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 26rpx;
  font-weight: 600;
  padding: 10rpx 32rpx;
  border-radius: 28rpx;
}

/* 课程空状态 */
.empty-courses-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
  background: #FFFFFF;
  border-radius: 20rpx;
  margin-top: 20rpx;
}

.empty-book-icon {
  font-size: 72rpx;
  margin-bottom: 20rpx;
}

.empty-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: 26rpx;
  color: #9CA3AF;
  text-align: center;
  margin-bottom: 36rpx;
}

.enroll-action-btn {
  background: #2563EB;
  color: #FFFFFF;
  font-size: 28rpx;
  font-weight: 600;
  padding: 16rpx 48rpx;
  border-radius: 36rpx;
  box-shadow: 0 4rpx 12rpx rgba(37, 99, 235, 0.25);
}

/* 上课记录 Tab */
.lessons-count-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #EFF6FF;
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
  margin-bottom: 20rpx;
}

.count-label {
  font-size: 28rpx;
  color: #1E40AF;
  font-weight: 600;
}

.count-val {
  font-size: 32rpx;
  font-weight: 700;
  color: #1E40AF;
}

.attendance-filter-pills {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
  overflow-x: auto;
}

.pill-btn {
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  background: #FFFFFF;
  color: #4B5563;
  white-space: nowrap;
}

.pill-btn.active {
  background: #EFF6FF;
  color: #2563EB;
  font-weight: 600;
}

.att-record-card {
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.02);
}

.rec-tags-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.tag-offline {
  font-size: 22rpx;
  background: #EFF6FF;
  color: #2563EB;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.tag-signed {
  font-size: 22rpx;
  background: #E8F7ED;
  color: #10B981;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.deduct-badge {
  margin-left: auto;
  font-size: 22rpx;
  color: #6B7280;
  background: #F3F4F6;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
}

.rec-class-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 8rpx;
}

.rec-meta-text {
  font-size: 24rpx;
  color: #6B7280;
  margin-top: 4rpx;
}

/* 沟通记录 Tab */
.comm-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.comm-dropdowns {
  display: flex;
  gap: 20rpx;
}

.comm-drop {
  display: flex;
  align-items: center;
  font-size: 24rpx;
  color: #4B5563;
  gap: 6rpx;
}

.pre-after-switch {
  display: flex;
  background: #F3F4F6;
  border-radius: 28rpx;
  padding: 4rpx;
}

.switch-btn {
  font-size: 22rpx;
  padding: 6rpx 20rpx;
  border-radius: 24rpx;
  color: #6B7280;
}

.switch-btn.active {
  background: #FFFFFF;
  color: #2563EB;
  font-weight: 600;
}

.comm-empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.sad-emoji {
  font-size: 72rpx;
  margin-bottom: 16rpx;
}

.float-add-comm {
  position: fixed;
  right: 36rpx;
  bottom: 80rpx;
  width: 96rpx;
  height: 96rpx;
  background: #3B82F6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 18rpx rgba(59, 130, 246, 0.4);
}

.bottom-safe-space {
  height: 120rpx;
}

/* ActionSheet 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}

.action-sheet-dialog {
  width: 100%;
  background: #FFFFFF;
  border-top-left-radius: 32rpx;
  border-top-right-radius: 32rpx;
  overflow: hidden;
}

.dialog-item {
  height: 104rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #111827;
}

.dialog-divider {
  height: 1rpx;
  background: #F3F4F6;
}

.dialog-gap {
  height: 14rpx;
  background: #F3F4F6;
}

.cancel-item {
  color: #6B7280;
}

.text-danger {
  color: #EF4444;
}
</style>
