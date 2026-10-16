<template>
  <view class="student-edit-container">
    <!-- 顶部自定义导航 -->
    <view class="nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="back-btn" @click="handleGoBack">‹</view>
        <text class="nav-title">{{ isNew ? '录入学员' : '编辑学员' }}</text>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <scroll-view class="form-scroll-body" scroll-y>
      <!-- 基本信息分组 (对齐截图 028) -->
      <view class="section-group-title">基本信息</view>
      <view class="form-card">
        <!-- 所属校区 -->
        <picker mode="selector" :range="selectableCampusNames" @change="onCampusChange">
          <view class="form-row">
            <view class="row-label"><text class="required-star">*</text>所属校区</view>
            <view class="picker-value-box">
              <text class="val-text">{{ selectedCampusName }}</text>
              <text class="arrow">›</text>
            </view>
          </view>
        </picker>

        <view class="divider-line"></view>

        <!-- 学员姓名 -->
        <view class="form-row">
          <view class="row-label"><text class="required-star">*</text>学员姓名</view>
          <input
            class="row-input"
            type="text"
            v-model="formData.name"
            placeholder="请输入学员姓名"
            placeholder-class="placeholder-text"
          />
        </view>

        <view class="divider-line"></view>

        <!-- 性别 -->
        <picker mode="selector" :range="genderOptions" @change="onGenderChange">
          <view class="form-row">
            <view class="row-label"><text class="required-star">*</text>性别</view>
            <view class="picker-value-box">
              <text class="val-text">{{ formData.gender }}</text>
              <text class="arrow">›</text>
            </view>
          </view>
        </picker>

        <view class="divider-line"></view>

        <!-- 联系电话 -->
        <view class="form-row">
          <view class="row-label"><text class="required-star">*</text>联系电话</view>
          <input
            class="row-input"
            type="number"
            v-model="formData.phone"
            maxlength="11"
            placeholder="请输入11位手机号码"
            placeholder-class="placeholder-text"
          />
        </view>

        <view class="divider-line"></view>

        <!-- 出生日期 (原生 Date Picker) -->
        <picker
          mode="date"
          :value="formData.birthday"
          start="1990-01-01"
          :end="todayStr"
          @change="onBirthdayChange"
        >
          <view class="form-row">
            <view class="row-label"><text class="required-star">*</text>出生日期</view>
            <view class="picker-value-box">
              <text class="val-text" :class="{ 'text-gray': !formData.birthday }">
                {{ formData.birthday || '请选择出生日期' }}
              </text>
              <text class="arrow">›</text>
            </view>
          </view>
        </picker>

        <view class="divider-line"></view>

        <!-- 年龄 (根据出生日期自动联动) -->
        <view class="form-row">
          <view class="row-label">年龄</view>
          <text class="readonly-val">{{ formData.age ? formData.age + ' 岁' : '--' }}</text>
        </view>

        <view class="divider-line"></view>

        <!-- 绑定家校 -->
        <view class="form-row" @click="handleBindNotice">
          <view class="row-label">绑定家校</view>
          <view class="picker-value-box">
            <text class="val-text text-gray">未绑定</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>

      <!-- 录入信息分组 (对齐截图 028) -->
      <view class="section-group-title">录入信息</view>
      <view class="form-card">
        <!-- 渠道来源 -->
        <view class="form-row">
          <view class="row-label">渠道来源</view>
          <text class="readonly-val">{{ formData.channelSource }}</text>
        </view>

        <view class="divider-line"></view>

        <!-- 录入日期 -->
        <view class="form-row">
          <view class="row-label">录入日期</view>
          <text class="readonly-val">{{ formData.createDate }}</text>
        </view>

        <view class="divider-line"></view>

        <!-- 招生来源 (原生 Selector Picker) -->
        <picker mode="selector" :range="channelOptions" @change="onChannelChange">
          <view class="form-row">
            <view class="row-label"><text class="required-star">*</text>招生来源</view>
            <view class="picker-value-box">
              <text class="val-text" :class="{ 'text-gray': !formData.channelSource }">
                {{ formData.channelSource || '请选择招生来源' }}
              </text>
              <text class="arrow">›</text>
            </view>
          </view>
        </picker>

        <view class="divider-line"></view>

        <!-- 学员类别 (原生 Selector Picker) -->
        <picker mode="selector" :range="categoryOptions" @change="onCategoryChange">
          <view class="form-row">
            <view class="row-label">学员类别</view>
            <view class="picker-value-box">
              <text class="val-text">{{ formData.studentCategory }}</text>
              <text class="arrow">›</text>
            </view>
          </view>
        </picker>
      </view>

      <view class="bottom-submit-wrap">
        <button class="confirm-submit-btn" :loading="isSubmitting" @click="handleSubmit">
          确定
        </button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { studentApi } from '../../api/student';
import { useCampusStore } from '../../stores/campusStore';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);
const isNew = ref(false);
const isSubmitting = ref(false);
const studentId = ref('');

// 选项库
const genderOptions = ['男', '女', '未知'];
const channelOptions = [
  '地推/活动派单',
  '转介绍(老带新)',
  '美团/大众点评',
  '线上咨询(微信/抖音/小红书)',
  '自然到访/门市',
  '外部合作渠道',
  '其他渠道',
];
const categoryOptions = [
  '常规在读学员',
  '体验试听学员',
  'VIP定制学员',
  '竞赛集训学员',
];

// 计算今日日期 YYYY-MM-DD
const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

// 校区选择
const selectedCampusId = ref('campus-bj-hq');
const selectableCampuses = computed(() => {
  return campusStore.availableCampuses.filter((c) => c.id !== 'all');
});
const selectableCampusNames = computed(() => {
  return selectableCampuses.value.map((c) => c.name);
});
const selectedCampusName = computed(() => {
  const match = selectableCampuses.value.find((c) => c.id === selectedCampusId.value);
  return match ? match.name : '拓视未来-原阳校区';
});

// 表单数据
const formData = ref({
  name: '',
  gender: '男',
  phone: '',
  birthday: '2018-09-01',
  age: '8',
  channelSource: '地推/活动派单',
  studentCategory: '常规在读学员',
  createDate: todayStr,
});

// 计算年龄
function calculateAge(dateStr: string) {
  if (!dateStr) {
    formData.value.age = '';
    return;
  }
  const birth = new Date(dateStr);
  const now = new Date();
  let a = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    a--;
  }
  formData.value.age = String(Math.max(0, a));
}

// 变更日期
function onBirthdayChange(e: any) {
  formData.value.birthday = e.detail.value;
  calculateAge(e.detail.value);
}

// 变更招生来源
function onChannelChange(e: any) {
  const idx = Number(e.detail.value);
  if (channelOptions[idx]) {
    formData.value.channelSource = channelOptions[idx];
  }
}

// 变更性别
function onGenderChange(e: any) {
  const idx = Number(e.detail.value);
  if (genderOptions[idx]) {
    formData.value.gender = genderOptions[idx];
  }
}

// 变更学员类别
function onCategoryChange(e: any) {
  const idx = Number(e.detail.value);
  if (categoryOptions[idx]) {
    formData.value.studentCategory = categoryOptions[idx];
  }
}

// 变更校区
function onCampusChange(e: any) {
  const idx = Number(e.detail.value);
  if (selectableCampuses.value[idx]) {
    selectedCampusId.value = selectableCampuses.value[idx].id;
  }
}

// 绑定家校提示
function handleBindNotice() {
  uni.showModal({
    title: '绑定家校',
    content: '录入学员后，系统将自动生成家校互联码，家长关注公众号即可完成绑定。',
    showCancel: false,
    confirmColor: '#2F54EB',
  });
}

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

  campusStore.fetchCampuses();

  // 初始校区
  if (campusStore.currentCampusId && campusStore.currentCampusId !== 'all') {
    selectedCampusId.value = campusStore.currentCampusId;
  } else if (selectableCampuses.value.length > 0) {
    selectedCampusId.value = selectableCampuses.value[0].id;
  }

  calculateAge(formData.value.birthday);

  const pages = getCurrentPages();
  const curPage = pages[pages.length - 1];
  const query = (curPage as any)?.options || {};
  if (query.studentId) {
    studentId.value = query.studentId;
    isNew.value = false;
    loadStudentDetail(query.studentId);
  } else {
    isNew.value = true;
    formData.value.name = '';
    formData.value.phone = '';
  }
});

async function loadStudentDetail(id: string) {
  try {
    const p = await studentApi.getStudentProfile(id);
    if (p) {
      formData.value.name = p.name;
      formData.value.phone = p.phone;
      formData.value.gender = p.gender || '男';
      formData.value.channelSource = p.channelSource || '地推/活动派单';
    }
  } catch (e) {}
}

const handleGoBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: '/package-student/list/index' });
  }
};

const handleSubmit = async () => {
  if (!formData.value.name.trim()) {
    uni.showToast({ title: '请输入学员姓名', icon: 'none' });
    return;
  }
  if (!formData.value.phone.trim() || formData.value.phone.trim().length !== 11) {
    uni.showToast({ title: '请输入正确的11位联系电话', icon: 'none' });
    return;
  }
  if (!formData.value.birthday) {
    uni.showToast({ title: '请选择出生日期', icon: 'none' });
    return;
  }

  isSubmitting.value = true;
  try {
    if (isNew.value) {
      await studentApi.createStudent({
        name: formData.value.name.trim(),
        phone: formData.value.phone.trim(),
        gender: formData.value.gender,
        birthday: formData.value.birthday,
        campusId: selectedCampusId.value,
        remark: `招生来源: ${formData.value.channelSource} | 类别: ${formData.value.studentCategory}`,
      });
      uni.showToast({ title: '学员录入成功', icon: 'success' });
    } else {
      await studentApi.updateStudent(studentId.value, {
        name: formData.value.name.trim(),
        phone: formData.value.phone.trim(),
        gender: formData.value.gender,
        birthday: formData.value.birthday,
      });
      uni.showToast({ title: '学员修改成功', icon: 'success' });
    }
    setTimeout(() => {
      uni.navigateBack();
    }, 800);
  } catch (e: any) {
    uni.showToast({ title: e?.message || '保存失败，请检查输入', icon: 'none' });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.student-edit-container {
  min-height: 100vh;
  background-color: #F8F9FD;
  display: flex;
  flex-direction: column;
}

.nav-header {
  background: #FFFFFF;
  border-bottom: 1rpx solid #F3F4F6;
}

.nav-inner {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
}

.back-btn {
  font-size: 52rpx;
  color: #1F2937;
  line-height: 1;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.form-scroll-body {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}

.section-group-title {
  font-size: 28rpx;
  color: #8C9BAB;
  margin-bottom: 16rpx;
  margin-top: 10rpx;
}

.form-card {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 10rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.02);
  margin-bottom: 24rpx;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 96rpx;
}

.row-label {
  font-size: 28rpx;
  color: #374151;
  display: flex;
  align-items: center;
}

.required-star {
  color: #FF4D4F;
  margin-right: 6rpx;
}

.row-input {
  flex: 1;
  text-align: right;
  font-size: 28rpx;
  color: #111827;
}

.placeholder-text {
  color: #9CA3AF;
  font-size: 28rpx;
}

.picker-value-box {
  display: flex;
  align-items: center;
}

.val-text {
  font-size: 28rpx;
  color: #111827;
  margin-right: 8rpx;
}

.text-gray {
  color: #9CA3AF;
}

.arrow {
  font-size: 32rpx;
  color: #9CA3AF;
  line-height: 1;
}

.readonly-val {
  font-size: 28rpx;
  color: #6B7280;
}

.divider-line {
  height: 1rpx;
  background-color: #F3F4F6;
}

.bottom-submit-wrap {
  margin-top: 48rpx;
  margin-bottom: 60rpx;
  padding: 0 12rpx;
}

.confirm-submit-btn {
  background-color: #2F54EB;
  color: #FFFFFF;
  font-size: 32rpx;
  font-weight: 600;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  box-shadow: 0 8rpx 20rpx rgba(47, 84, 235, 0.25);
}

.confirm-submit-btn::after {
  border: none;
}
</style>
