<template>
  <view class="evaluation-page-container">
    <!-- 顶部状态栏与自定义导航 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-inner">
        <view class="nav-left" @click="handleBackClick">
          <text class="back-arrow">‹</text>
          <text class="nav-title">{{ studentName }}学员的课评</text>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 课堂点评艺术分割线 (对齐截图 017) -->
    <view class="art-divider-row">
      <view class="divider-line"></view>
      <text class="art-title">课堂点评</text>
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
          <view class="notepad-icon">📒</view>
          <text class="class-name-text">{{ className }}</text>
        </view>
        <text class="edit-icon" @click="handleEditClass">✏️</text>
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
      <view class="upload-boxes-grid">
        <!-- 上传视频卡片 -->
        <view class="upload-box-card" @click="handleChooseVideo">
          <view class="box-icon-camera">📹</view>
          <text class="box-text">上传视频</text>
        </view>

        <!-- 上传照片卡片 -->
        <view class="upload-box-card" @click="handleChoosePhoto">
          <view class="box-icon-photo">📷</view>
          <text class="box-text">上传照片</text>
        </view>
      </view>

      <!-- 照片视频缩略图预览列表 -->
      <view class="media-preview-grid" v-if="uploadedPhotos.length > 0 || uploadedVideo">
        <!-- 视频预览 -->
        <view class="preview-item video-item" v-if="uploadedVideo">
          <view class="video-mock-box">
            <text class="play-icon">▶️</text>
            <text class="video-label">实况视频</text>
          </view>
          <view class="delete-badge" @click="uploadedVideo = ''">✕</view>
        </view>

        <!-- 照片预览 -->
        <view class="preview-item photo-item" v-for="(photo, idx) in uploadedPhotos" :key="idx">
          <image class="preview-img" :src="photo" mode="aspectFill" />
          <view class="delete-badge" @click="removePhoto(idx)">✕</view>
        </view>
      </view>
    </view>

    <!-- 5. 底部固定操作条 (对齐截图 017: [保存] 与 [推送]) -->
    <view class="bottom-action-bar">
      <view class="save-draft-btn" @click="handleSaveDraft">
        <text class="save-icon">💾</text>
        <text class="save-text">保存</text>
      </view>
      <button class="push-submit-btn" :loading="isSubmitting" @click="handleSubmitEvaluation">
        推送
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
import { eduApi } from '../../api/edu';
import { fulfillmentCoordinator, type FulfillmentSession } from '../../coordinators/fulfillment';

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

const fulfillmentSession = ref<FulfillmentSession | null>(null);

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

  try {
    const session = await fulfillmentCoordinator.loadSession(scheduleId.value);
    fulfillmentSession.value = session;
    if (session.evaluation.studyContentHtml) {
      studyContent.value = session.evaluation.studyContentHtml;
    }
    if (session.evaluation.photoList && session.evaluation.photoList.length > 0) {
      uploadedPhotos.value = [...session.evaluation.photoList];
    }
    if (session.evaluation.videoUrl) {
      uploadedVideo.value = session.evaluation.videoUrl;
    }
    if (session.evaluation.templateName) {
      currentTemplateName.value = session.evaluation.templateName;
    }
    const currentStu = session.students.find((s) => s.studentId === studentId.value);
    if (currentStu && currentStu.comment) {
      studyContent.value = currentStu.comment;
    }
  } catch (e) {
    // 检查本地是否有草稿快照
    const draftKey = `eval_draft_${scheduleId.value}_${studentId.value}`;
    const savedDraft = uni.getStorageSync(draftKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        studyContent.value = parsed.studyContent || '';
        uploadedPhotos.value = parsed.uploadedPhotos || [];
        uploadedVideo.value = parsed.uploadedVideo || '';
      } catch (err) {}
    } else {
      // 默认大纲预置 (零心智通途)
      studyContent.value = '本节课重点掌握字母拼读规则与自然拼读交互，学员发音精准，课堂表现专注积极！';
    }
  }
});

const handleSwitchTemplate = () => {
  uni.showActionSheet({
    itemList: ['通用课评模板 (推荐)', '少儿编程创客模板', '英语自然拼读模板', '一对一专属评语模板'],
    success: (res) => {
      currentTemplateName.value = ['通用课评模板', '少儿编程创客模板', '英语自然拼读模板', '一对一专属评语模板'][res.tapIndex];
      uni.showToast({ title: `已载入: ${currentTemplateName.value}`, icon: 'none' });
      hasModified.value = true;
    },
  });
};

const handleEditClass = () => {
  uni.showToast({ title: '班级归属由教务排课自动锚定', icon: 'none' });
};

const handleChoosePhoto = () => {
  uni.chooseImage({
    count: 9 - uploadedPhotos.value.length,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      uni.showLoading({ title: '正在上传照片...' });
      for (const tempPath of res.tempFilePaths) {
        const cdnUrl = await eduApi.uploadPhoto(tempPath, scheduleId.value);
        uploadedPhotos.value.push(cdnUrl);
      }
      uni.hideLoading();
      hasModified.value = true;
      uni.showToast({ title: '照片已上传', icon: 'success' });
    },
  });
};

const handleChooseVideo = () => {
  uni.chooseVideo({
    sourceType: ['album', 'camera'],
    maxDuration: 60,
    camera: 'back',
    success: async (res) => {
      uni.showLoading({ title: '正在上传视频...' });
      const videoCdn = await eduApi.uploadVideo(res.tempFilePath, scheduleId.value);
      uploadedVideo.value = videoCdn;
      uni.hideLoading();
      hasModified.value = true;
      uni.showToast({ title: '课堂视频已就绪', icon: 'success' });
    },
  });
};

const removePhoto = (idx: number) => {
  uploadedPhotos.value.splice(idx, 1);
  hasModified.value = true;
};

const handleSaveDraft = async () => {
  if (fulfillmentSession.value) {
    fulfillmentSession.value.updateEvaluationDraft({
      studyContentHtml: studyContent.value,
      photoList: uploadedPhotos.value,
      videoUrl: uploadedVideo.value,
      templateName: currentTemplateName.value,
    });
    if (studentId.value) {
      fulfillmentSession.value.updatePersonalizedComment(studentId.value, studyContent.value, 5.0);
    }
    await fulfillmentSession.value.saveDraft();
  } else {
    await fulfillmentCoordinator.saveDraft(scheduleId.value, {
      studyContentHtml: studyContent.value,
      photoList: uploadedPhotos.value,
      videoUrl: uploadedVideo.value,
      templateName: currentTemplateName.value,
    });
  }
  const draftKey = `eval_draft_${scheduleId.value}_${studentId.value}`;
  uni.setStorageSync(
    draftKey,
    JSON.stringify({
      studyContent: studyContent.value,
      uploadedPhotos: uploadedPhotos.value,
      uploadedVideo: uploadedVideo.value,
    })
  );
  hasModified.value = false;
  uni.showToast({ title: '已保存至草稿箱', icon: 'success' });
};

const handleSubmitEvaluation = async () => {
  if (!studyContent.value.trim()) {
    uni.showToast({ title: '请输入学习内容', icon: 'none' });
    return;
  }

  isSubmitting.value = true;
  try {
    if (fulfillmentSession.value) {
      fulfillmentSession.value.updateEvaluationDraft({
        studyContentHtml: studyContent.value,
        photoList: uploadedPhotos.value,
        videoUrl: uploadedVideo.value,
        templateName: currentTemplateName.value,
      });
      if (studentId.value) {
        fulfillmentSession.value.updatePersonalizedComment(studentId.value, studyContent.value, 5.0);
      }
      await fulfillmentSession.value.commit({ mode: 'PUBLISH_EVALUATION' });
    } else {
      await eduApi.commitEvaluation({
        scheduleEventId: scheduleId.value,
        studyContent: studyContent.value,
        photoList: uploadedPhotos.value,
        videoUrl: uploadedVideo.value,
        templateName: currentTemplateName.value,
        studentComments: [
          {
            studentId: studentId.value,
            comment: studyContent.value,
            rating: 5.0,
          },
        ],
      });
    }

    // 清除草稿
    const draftKey = `eval_draft_${scheduleId.value}_${studentId.value}`;
    uni.removeStorageSync(draftKey);
    hasModified.value = false;

    uni.showToast({ title: '课评推送成功！已下发微信通知', icon: 'success' });
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
