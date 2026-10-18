<template>
  <view class="evaluation-page-container">
    <!-- 顶部状态栏与自定义导航 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-left" @click="handleBackClick">
          <text class="back-arrow">‹</text>
          <text class="nav-title">{{ studentName }}学员的课评</text>
          <view v-if="isRevisionMode" class="revision-mode-badge">
            <text class="badge-text">修改中</text>
          </view>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 课堂点评艺术分割线 (对齐截图 017) -->
    <view class="art-divider-row">
      <view class="divider-line"></view>
      <text class="art-title">{{ isRevisionMode ? '修改课堂点评' : '课堂点评' }}</text>
      <view class="divider-line"></view>
    </view>

    <!-- 2. 点评模板选择栏 (对齐截图 017: 点评模板 通用课评模板 ›) -->
    <view class="template-selector-card" @click="handleSwitchTemplate">
      <view class="tpl-left">
        <text class="tpl-tag">点评模板</text>
        <text class="tpl-name">{{ currentTemplateName }}</text>
      </view>
      <text class="chevron">›</text>
    </view>

    <!-- 3. 表单核心内容区 -->
    <view class="form-body-card">
      <!-- 班级行 (对齐截图 017) -->
      <view class="class-info-line">
        <view class="class-title-wrap">
          <view class="notepad-icon">
            <AppIcon name="book-open" size="36rpx" color="#2F54EB" />
          </view>
          <text class="class-name-text">{{ className }}</text>
        </view>
        <view class="edit-icon" @click="handleEditClass">
          <AppIcon name="edit" size="36rpx" color="#64748B" />
        </view>
      </view>

      <view class="field-divider"></view>

      <!-- 核心输入项：学习内容 (对齐截图 017) -->
      <view class="input-block">
        <view class="label-row">
          <text class="required-star">*</text>
          <text class="field-label">学习内容</text>
        </view>
        <textarea
          class="study-content-textarea"
          v-model="studyContent"
          placeholder="请输入学习内容"
          placeholder-class="placeholder-text"
          maxlength="1000"
          @input="hasModified = true"
        ></textarea>
      </view>
    </view>

    <!-- 4. 上传照片/视频区域 (对齐截图 017) -->
    <view class="media-upload-section">
      <text class="upload-section-title">上传照片/视频</text>

      <!-- 上传方块矩阵 -->
      <view class="upload-boxes-grid" v-if="!uploadedVideo || uploadedPhotos.length < 9">
        <!-- 上传视频卡片 (最多允许上传1个视频，上传后自动隐藏) -->
        <view class="upload-box-card" v-if="!uploadedVideo" @click="handleChooseVideo">
          <view class="box-icon-camera">
            <AppIcon name="video" size="56rpx" color="#2F54EB" />
          </view>
          <text class="box-text">上传视频</text>
        </view>

        <!-- 上传照片卡片 -->
        <view class="upload-box-card" v-if="uploadedPhotos.length < 9" @click="handleChoosePhoto">
          <view class="box-icon-photo">
            <AppIcon name="camera" size="56rpx" color="#2F54EB" />
          </view>
          <text class="box-text">上传照片{{ uploadedPhotos.length > 0 ? ` (${uploadedPhotos.length}/9)` : '' }}</text>
        </view>
      </view>

      <!-- 照片视频缩略图预览列表 -->
      <view class="media-preview-grid" v-if="uploadedPhotos.length > 0 || uploadedVideo">
        <!-- 视频预览 -->
        <view class="preview-item video-item" v-if="uploadedVideo">
          <view class="video-mock-box">
            <AppIcon name="video" size="48rpx" color="#FFFFFF" />
            <text class="video-label">实况视频</text>
          </view>
          <view class="delete-badge" @click="removeVideo">
            <AppIcon name="x" size="24rpx" color="#FFFFFF" />
          </view>
        </view>

        <!-- 照片预览 -->
        <view class="preview-item photo-item" v-for="(photo, idx) in uploadedPhotos" :key="idx">
          <image class="preview-img" :src="photo" mode="aspectFill" />
          <view class="delete-badge" @click="removePhoto(idx)">
            <AppIcon name="x" size="24rpx" color="#FFFFFF" />
          </view>
        </view>
      </view>
    </view>

    <!-- 5. 底部固定操作条 (对齐截图 017: [保存] 与 [推送]) -->
    <view class="bottom-action-bar">
      <view class="save-draft-btn" @click="handleSaveDraft">
        <AppIcon name="save" size="36rpx" color="#64748B" />
        <text class="save-text">保存</text>
      </view>
      <button class="push-submit-btn" :class="{ 'revision-btn': isRevisionMode }" :loading="isSubmitting" @click="handleSubmitEvaluation">
        {{ isRevisionMode ? '保存并更新' : '推送' }}
      </button>
    </view>

    <!-- 6. 退出提醒弹窗 (1:1 对齐截图 018: 退出提醒) -->
    <view class="modal-mask" v-if="showExitModal" @click="showExitModal = false">
      <view class="exit-dialog-card" @click.stop>
        <text class="dialog-title">退出提醒</text>
        <text class="dialog-content">点击返回后，已编辑课评不会保存。</text>
        <view class="dialog-divider"></view>
        <view class="dialog-btn-row">
          <view class="confirm-btn" @click="confirmExit">确定</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppIcon from '../../components/AppIcon.vue';
import { eduApi } from '../../api/edu';
import { fulfillmentCoordinator, type StudentEvaluationDraft } from '../../coordinators/fulfillment';
import { learningGrowthProjector } from '../../projectors/learning-growth';
import { mediaPipeline } from '../../services/media-pipeline';


const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

// 上下文参数
const studentId = ref('s-01');
const studentName = ref('董御');
const scheduleId = ref('sch-qmyy-12');
const className = ref('周二18.30周六10.00班-12');
const currentTemplateName = ref('通用课评模板');
const studyContent = ref('');
const uploadedPhotos = ref<string[]>([]);
const uploadedVideo = ref<string>('');

const hasModified = ref(false);
const isSubmitting = ref(false);
const showExitModal = ref(false);
const isRevisionMode = ref(false);

const studentDraft = ref<StudentEvaluationDraft | null>(null);

onMounted(async () => {
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

  // 接收传参
  const pages = getCurrentPages();
  const curPage = pages[pages.length - 1];
  const query = (curPage as any)?.options || {};
  if (query.studentName) studentName.value = decodeURIComponent(query.studentName);
  if (query.studentId) studentId.value = query.studentId;
  if (query.scheduleId) scheduleId.value = query.scheduleId;
  if (query.className) className.value = decodeURIComponent(query.className);
  const isRevisionParam = query.isRevision === '1' || query.isRevision === 'true' || Boolean(query.isRevision);
  if (isRevisionParam) {
    isRevisionMode.value = true;
  }

  try {
    // 1. 随堂课评智能水化 (hydrateStudentDraft)：聚合课纲大纲标准与本地草稿
    const draft = await fulfillmentCoordinator.hydrateStudentDraft(scheduleId.value, studentId.value);
    studentDraft.value = draft;
    if (draft.studentName) studentName.value = draft.studentName;
    if (draft.className) className.value = draft.className;
    if (draft.studyContent) studyContent.value = draft.studyContent;
    if (draft.templateName) currentTemplateName.value = draft.templateName;
    if (draft.photos && draft.photos.length > 0) uploadedPhotos.value = [...draft.photos];
    if (draft.videoUrl) uploadedVideo.value = draft.videoUrl;
    if (draft.isEvaluated || isRevisionParam) {
      isRevisionMode.value = true;
    }
  } catch (e) {
    // 默认大纲预置 (零心智通途兜底)
    studyContent.value = '本节课重点掌握字母拼读规则与自然拼读交互，学员发音精准，课堂表现专注积极！';
  }
});

const handleSwitchTemplate = () => {
  uni.showActionSheet({
    itemList: ['通用课评模板 (推荐)', '少儿编程创客模板', '英语自然拼读模板', '一对一专属评语模板'],
    success: (res) => {
      currentTemplateName.value = ['通用课评模板', '少儿编程创客模板', '英语自然拼读模板', '一对一专属评语模板'][res.tapIndex];
      uni.showToast({ title: `已载入: ${currentTemplateName.value}`, icon: 'none' });
      hasModified.value = true;
      triggerAutoSave();
    },
  });
};

const handleEditClass = () => {
  uni.showToast({ title: '班级归属由教务排课自动锚定', icon: 'none' });
};

const handleChoosePhoto = async () => {
  const remainCount = 9 - uploadedPhotos.value.length;
  if (remainCount <= 0) {
    uni.showToast({ title: '最多支持上传 9 张照片', icon: 'none' });
    return;
  }
  try {
    const urls = await mediaPipeline.captureAndUploadPhotos({
      maxCount: remainCount,
      scheduleId: scheduleId.value,
    });
    if (urls && urls.length > 0) {
      uploadedPhotos.value.push(...urls);
      hasModified.value = true;
      triggerAutoSave();
    }
  } catch (err) {
    // 错误已由 mediaPipeline 抛出并展示
  }
};

const handleChooseVideo = async () => {
  if (uploadedVideo.value) {
    uni.showToast({ title: '最多只能上传一个视频', icon: 'none' });
    return;
  }
  try {
    const videoUrl = await mediaPipeline.captureAndUploadVideo({
      scheduleId: scheduleId.value,
    });
    if (videoUrl) {
      uploadedVideo.value = videoUrl;
      hasModified.value = true;
      triggerAutoSave();
    }
  } catch (err) {
    // 错误已由 mediaPipeline 抛出并展示
  }
};


const removeVideo = () => {
  uploadedVideo.value = '';
  hasModified.value = true;
  triggerAutoSave();
  uni.showToast({ title: '视频已移除', icon: 'none' });
};

const removePhoto = (idx: number) => {
  uploadedPhotos.value.splice(idx, 1);
  hasModified.value = true;
  triggerAutoSave();
};

// 防抖自动暂存
const triggerAutoSave = () => {
  fulfillmentCoordinator.saveStudentDraft(
    scheduleId.value,
    studentId.value,
    {
      studentName: studentName.value,
      className: className.value,
      studyContent: studyContent.value,
      templateName: currentTemplateName.value,
      photos: uploadedPhotos.value,
      videoUrl: uploadedVideo.value,
      rating: 5,
    },
    { debounceMs: 400 }
  );
};

// 广播课评完成状态并同步上一页实例
const emitEvaluationSuccess = (targetStudentId: string, targetScheduleId: string) => {
  // 1. 全局事件广播，通知所有监听页面 (课次详情页与课评管理页)
  uni.$emit('studentEvaluationUpdated', {
    scheduleId: targetScheduleId,
    studentId: targetStudentId,
    evaluated: true,
  });

  // 2. 失效学情卡本地投影缓存，确保再次点击【看学情】时即时呈现最新雷达与评语
  try {
    learningGrowthProjector.evictGrowthCache(targetScheduleId);
  } catch (e) {}

  // 3. 直接同步上一页页面栈实例 (0毫秒即时变绿/变为看学情)
  try {
    const pages = getCurrentPages();
    if (pages.length >= 2) {
      const prevPage = pages[pages.length - 2] as any;
      const vm = prevPage?.$vm || prevPage;
      if (vm && Array.isArray(vm.students)) {
        const item = vm.students.find((s: any) => s.studentId === targetStudentId);
        if (item) {
          item.evaluated = true;
          item.isEvaluated = true;
          item.photos = [...uploadedPhotos.value];
          item.videoUrl = uploadedVideo.value || undefined;
          item.comment = studyContent.value;
        }
      }
      if (vm && Array.isArray(vm.rosterItems)) {
        const item = vm.rosterItems.find((s: any) => s.studentId === targetStudentId);
        if (item) {
          item.isPushed = true;
        }
      }
    }
  } catch (err) {}
};

const handleSaveDraft = async () => {
  await fulfillmentCoordinator.saveStudentDraft(
    scheduleId.value,
    studentId.value,
    {
      studentName: studentName.value,
      className: className.value,
      studyContent: studyContent.value,
      templateName: currentTemplateName.value,
      photos: uploadedPhotos.value,
      videoUrl: uploadedVideo.value,
      rating: 5,
    },
    { immediate: true }
  );
  hasModified.value = false;
  emitEvaluationSuccess(studentId.value, scheduleId.value);
  uni.showToast({ title: '已保存至草稿箱', icon: 'success' });
};

const handleSubmitEvaluation = async () => {
  if (!studyContent.value.trim()) {
    uni.showToast({ title: '请输入学习内容', icon: 'none' });
    return;
  }

  isSubmitting.value = true;
  try {
    // 2. 单学员精准履约出站：差分推导异常学员覆写，模式设为 PUBLISH_EVALUATION，落盘后原子出清本地草稿
    await fulfillmentCoordinator.commitStudentEvaluation(scheduleId.value, studentId.value, {
      studentName: studentName.value,
      className: className.value,
      studyContent: studyContent.value,
      templateName: currentTemplateName.value,
      photos: uploadedPhotos.value,
      videoUrl: uploadedVideo.value,
      rating: 5,
      _baselineToken: studentDraft.value?._baselineToken,
    });

    hasModified.value = false;
    emitEvaluationSuccess(studentId.value, scheduleId.value);
    
    if (isRevisionMode.value) {
      uni.showToast({ title: '课评已更新，已同步学情卡', icon: 'success' });
    } else {
      uni.showToast({ title: '课评推送成功！已下发微信通知', icon: 'success' });
    }

    setTimeout(() => {
      uni.navigateBack();
    }, 800);
  } catch (e: any) {
    uni.showToast({ title: e?.message || '课评提交失败，请重试', icon: 'none' });
  } finally {
    isSubmitting.value = false;
  }
};

const handleBackClick = () => {
  if (hasModified.value) {
    showExitModal.value = true;
  } else {
    uni.navigateBack();
  }
};

const confirmExit = () => {
  showExitModal.value = false;
  hasModified.value = false;
  uni.navigateBack();
};
</script>

<style lang="scss" scoped>
.evaluation-page-container {
  min-height: 100vh;
  background-color: #F8FAFC;
  display: flex;
  flex-direction: column;
  padding-bottom: 160rpx;
}

.nav-bar {
  background: #FFFFFF;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1rpx solid #F3F4F6;

  .nav-inner {
    height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24rpx;

    .nav-left {
      display: flex;
      align-items: center;
      gap: 10rpx;

      .back-arrow {
        font-size: 52rpx;
        color: #1F2937;
        font-weight: 300;
      }

      .nav-title {
        font-size: 32rpx;
        font-weight: 700;
        color: #111827;
      }

      .revision-mode-badge {
        display: inline-flex;
        align-items: center;
        padding: 4rpx 14rpx;
        background: #EFF6FF;
        border: 1rpx solid #BFDBFE;
        border-radius: 8rpx;
        margin-left: 12rpx;

        .badge-text {
          font-size: 20rpx;
          color: #2563EB;
          font-weight: 600;
        }
      }
    }
  }
}

/* 1. 课堂点评艺术分割线 (对齐截图 017) */
.art-divider-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  padding: 32rpx 0 24rpx;

  .divider-line {
    width: 140rpx;
    height: 2rpx;
    background: #FED7AA;
  }

  .art-title {
    font-size: 32rpx;
    font-weight: 800;
    color: #EA580C;
    letter-spacing: 2rpx;
  }
}

/* 2. 点评模板选择栏 (对齐截图 017) */
.template-selector-card {
  margin: 0 24rpx 20rpx;
  background: #FFF7ED;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .tpl-left {
    display: flex;
    align-items: center;
    gap: 16rpx;

    .tpl-tag {
      font-size: 24rpx;
      color: #EA580C;
      font-weight: 600;
    }

    .tpl-name {
      font-size: 26rpx;
      color: #1F2937;
      font-weight: 500;
    }
  }

  .chevron {
    font-size: 34rpx;
    color: #EA580C;
    font-weight: 300;
  }
}

/* 3. 表单核心内容区 (对齐截图 017) */
.form-body-card {
  margin: 0 24rpx 24rpx;
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.02);

  .class-info-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 20rpx;

    .class-title-wrap {
      display: flex;
      align-items: center;
      gap: 12rpx;

      .notepad-icon {
        font-size: 36rpx;
      }

      .class-name-text {
        font-size: 30rpx;
        font-weight: 700;
        color: #111827;
      }
    }

    .edit-icon {
      font-size: 28rpx;
      color: #9CA3AF;
      padding: 6rpx;
    }
  }

  .field-divider {
    height: 1rpx;
    background: #F3F4F6;
    width: 100%;
    margin-bottom: 20rpx;
  }

  .input-block {
    .label-row {
      display: flex;
      align-items: center;
      gap: 6rpx;
      margin-bottom: 16rpx;

      .required-star {
        color: #EF4444;
        font-size: 28rpx;
        font-weight: 700;
      }

      .field-label {
        font-size: 28rpx;
        font-weight: 700;
        color: #111827;
      }
    }

    .study-content-textarea {
      width: 100%;
      height: 220rpx;
      font-size: 26rpx;
      color: #1F2937;
      line-height: 1.5;
    }

    .placeholder-text {
      color: #9CA3AF;
      font-size: 26rpx;
    }
  }
}

/* 4. 上传照片/视频区域 (对齐截图 017) */
.media-upload-section {
  margin: 0 24rpx;
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.02);

  .upload-section-title {
    font-size: 28rpx;
    font-weight: 700;
    color: #111827;
    margin-bottom: 20rpx;
    display: block;
  }

  .upload-boxes-grid {
    display: flex;
    gap: 20rpx;

    .upload-box-card {
      flex: 1;
      height: 180rpx;
      border: 2rpx dashed #D1D5DB;
      border-radius: 16rpx;
      background: #FAFAFA;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12rpx;

      .box-icon-camera,
      .box-icon-photo {
        font-size: 48rpx;
      }

      .box-text {
        font-size: 24rpx;
        color: #6B7280;
      }
    }
  }

  .media-preview-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16rpx;
    margin-top: 24rpx;

    .preview-item {
      position: relative;
      height: 160rpx;
      border-radius: 12rpx;
      overflow: hidden;

      .preview-img {
        width: 100%;
        height: 100%;
      }

      .delete-badge {
        position: absolute;
        top: 6rpx;
        right: 6rpx;
        width: 36rpx;
        height: 36rpx;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        color: #FFFFFF;
        font-size: 22rpx;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      &.video-item {
        .video-mock-box {
          width: 100%;
          height: 100%;
          background: #1E293B;
          color: #FFFFFF;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6rpx;

          .play-icon {
            font-size: 40rpx;
          }

          .video-label {
            font-size: 20rpx;
            color: #94A3B8;
          }
        }
      }
    }
  }
}

/* 5. 底部固定操作条 (对齐截图 017: [保存] 与 [推送]) */
.bottom-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 112rpx;
  background: #FFFFFF;
  border-top: 1rpx solid #F3F4F6;
  display: flex;
  align-items: center;
  padding: 0 28rpx;
  gap: 24rpx;
  z-index: 100;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);

  .save-draft-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 80rpx;

    .save-icon {
      font-size: 34rpx;
    }

    .save-text {
      font-size: 22rpx;
      color: #374151;
      margin-top: 2rpx;
    }
  }

  .push-submit-btn {
    flex: 1;
    height: 84rpx;
    background: #2563EB;
    color: #FFFFFF;
    font-size: 30rpx;
    font-weight: 600;
    border-radius: 42rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    box-shadow: 0 4rpx 16rpx rgba(37, 99, 235, 0.3);

    &.revision-btn {
      background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
      box-shadow: 0 4rpx 16rpx rgba(37, 99, 235, 0.4);
    }
  }
}

/* 6. 退出提醒弹窗 (1:1 对齐截图 018) */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;

  .exit-dialog-card {
    width: 580rpx;
    background: #FFFFFF;
    border-radius: 28rpx;
    padding: 40rpx 36rpx 24rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.15);

    .dialog-title {
      font-size: 34rpx;
      font-weight: 700;
      color: #111827;
      margin-bottom: 24rpx;
    }

    .dialog-content {
      font-size: 26rpx;
      color: #6B7280;
      text-align: center;
      line-height: 1.5;
      margin-bottom: 36rpx;
    }

    .dialog-divider {
      width: 100%;
      height: 1rpx;
      background: #F3F4F6;
    }

    .dialog-btn-row {
      width: 100%;
      height: 88rpx;
      display: flex;
      align-items: center;
      justify-content: center;

      .confirm-btn {
        font-size: 30rpx;
        font-weight: 600;
        color: #2563EB;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }
}
</style>
