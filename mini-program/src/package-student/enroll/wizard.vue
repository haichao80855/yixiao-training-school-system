<template>
  <view class="enroll-wizard-container">
    <!-- 顶部导航 (对齐截图 034: < 学员报名 | 总部校区 ▼) -->
    <view class="custom-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-inner">
        <view class="left-nav" @click="handleGoBack">
          <text class="back-arrow">‹</text>
          <text class="page-title">学员报名</text>
          <view class="campus-selector" v-if="!selectedStudent">
            <text class="campus-name">{{ campusStore.currentCampusName }}</text>
            <text class="arrow">▼</text>
          </view>
        </view>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>
    </view>

    <!-- 1. 未选中学员状态：搜索输入框与空状态引导 (对齐截图 034) -->
    <view v-if="!selectedStudent" class="search-step-view">
      <view class="search-input-wrap">
        <view class="search-input-box">
          <AppIcon name="search" size="32rpx" color="#94A3B8" />
          <input
            class="input-field"
            type="text"
            v-model="searchKeyword"
            placeholder="输入学员姓名/学号/手机号查询"
            placeholder-class="placeholder-text"
            @confirm="handleSearchStudent"
          />
          <text class="search-action-btn" @click="handleSearchStudent">搜索</text>
        </view>
      </view>

      <!-- 搜索结果弹层/列表 -->
      <view class="search-results-list" v-if="searchCandidateList.length > 0">
        <view
          class="candidate-card"
          v-for="stu in searchCandidateList"
          :key="stu.id"
          @click="selectTargetStudent(stu)"
        >
          <view class="candidate-avatar">
            <AppIcon name="user" size="40rpx" color="#2F54EB" />
          </view>
          <view class="candidate-info">
            <text class="candidate-name">{{ stu.name }}</text>
            <text class="candidate-meta">电话: {{ stu.phone }} | 学号: {{ stu.studentNo }}</text>
          </view>
          <view class="select-pill-btn">选择</view>
        </view>
      </view>

      <!-- 插画与空状态 (1:1 对齐截图 034) -->
      <view v-else class="empty-guide-box">
        <view class="cartoon-glass-box">
          <AppIcon name="search" size="96rpx" color="#CBD5E1" />
        </view>
        <text class="guide-text">需要先进行查询学员操作哦~</text>
      </view>
    </view>

    <!-- 2. 已选中学员：报名主体表单 (对齐截图 089 & 093) -->
    <view v-else class="enroll-form-view">
      <!-- 续费决策草案直通提示横幅 -->
      <view v-if="currentRenewalDraft" class="renewal-draft-banner">
        <view class="draft-tag-badge">老学员一键续费决策流</view>
        <view class="draft-tip-line">
          原签约单价 ¥{{ currentRenewalDraft.quote.pricePerLesson }}/课时 已自动继承，赠送 {{ currentRenewalDraft.quote.bonusLessons }} 课时
        </view>
        <view v-if="currentRenewalDraft.validation.fallbackUnassigned" class="draft-warning-pill">
          <AppIcon name="alert-triangle" size="28rpx" color="#F59E0B" />
          <text>原在读班级已满员，已自动安全置位待分班资产池</text>
        </view>
      </view>

      <!-- 头部选中学员信息卡片 (对齐截图 089) -->
      <view class="student-header-card">
        <view class="student-card-inner">
          <view class="header-avatar-circle">
            <AppIcon name="user" size="48rpx" color="#2F54EB" />
          </view>
          <view class="header-info-col">
            <view class="header-name-row">
              <text class="header-name">{{ selectedStudent.name }}</text>
              <text class="switch-stu-btn" @click="handleSwitchStudent">切换学员</text>
            </view>
            <view class="header-meta-line">
              电话: {{ selectedStudent.phone }}  学号: {{ selectedStudent.studentNo }}
            </view>
            <view class="wallet-badge">钱包余额 {{ session.financialSummary.walletBalance }} 元</view>
          </view>
        </view>
      </view>

      <!-- 报名内容选择项 -->
      <view class="section-container-card">
        <view class="section-title-label">报名内容</view>

        <!-- 选择课程行 -->
        <view class="picker-row-item">
          <view class="picker-left-label">选择课程</view>
          <view class="picker-right-action" @click="openCourseModal">
            <text class="count-text">已选择{{ selectedCourses.length }}个课程，更改</text>
            <text class="chevron">›</text>
          </view>
        </view>
        <!-- 已选课程卡片展开 (对齐截图 093) -->
        <view class="selected-items-wrapper" v-if="selectedCourses.length > 0">
          <view
            class="selected-item-card"
            v-for="(crs, idx) in selectedCourses"
            :key="crs.id"
          >
            <view class="item-tag-name">
              <view class="item-tag-blue">课程</view>
              <text class="item-name-text">{{ crs.name }} (¥{{ crs.totalPrice }})</text>
            </view>
            <view class="delete-icon" @click="removeCourse(crs)">
              <AppIcon name="trash-2" size="32rpx" color="#EF4444" />
            </view>
          </view>
        </view>

        <view class="row-divider"></view>

        <!-- 选择物品行 -->
        <view class="picker-row-item">
          <view class="picker-left-label">选择物品</view>
          <view class="picker-right-action" @click="openGoodsModal">
            <text class="count-text">已选择{{ selectedGoods.length }}个物品，更改</text>
            <text class="chevron">›</text>
          </view>
        </view>
        <!-- 已选物品展开 -->
        <view class="selected-items-wrapper" v-if="selectedGoods.length > 0">
          <view
            class="selected-item-card"
            v-for="(g, idx) in selectedGoods"
            :key="g.id"
          >
            <view class="item-tag-name">
              <view class="item-tag-purple">物品</view>
              <text class="item-name-text">{{ g.name }} (¥{{ g.price }})</text>
            </view>
            <view class="delete-icon" @click="removeGoods(g)">
              <AppIcon name="trash-2" size="32rpx" color="#EF4444" />
            </view>
          </view>
        </view>

        <view class="row-divider"></view>

        <!-- 选择班级行 -->
        <view class="picker-row-item">
          <view class="picker-left-label">选择班级</view>
          <view class="picker-right-action" @click="openClassModal">
            <text class="count-text">已选择{{ selectedClasses.length }}个班级，更改</text>
            <text class="chevron">›</text>
          </view>
        </view>
        <!-- 已选班级展开 -->
        <view class="selected-items-wrapper" v-if="selectedClasses.length > 0">
          <view
            class="selected-item-card"
            v-for="(cls, idx) in selectedClasses"
            :key="cls.id"
          >
            <view class="item-tag-name">
              <view class="item-tag-green">班级</view>
              <text class="item-name-text">{{ cls.name }}</text>
            </view>
            <view class="delete-icon" @click="removeClass(cls)">
              <AppIcon name="trash-2" size="32rpx" color="#EF4444" />
            </view>
          </view>
        </view>
      </view>

      <!-- 底部固定大按钮 (对齐截图 089 & 093: 已选择 X 个项目，去报名) -->
      <view class="bottom-checkout-bar">
        <button
          class="enroll-submit-big-btn"
          :disabled="session.isSubmitting || totalSelectedItemCount === 0"
          @click="openCheckoutModal"
        >
          已选择{{ totalSelectedItemCount }}个项目，去报名
        </button>
      </view>
    </view>

    <!-- ================= 3. 选择课程弹窗 (1:1 对齐截图 090) ================= -->
    <view class="fullscreen-picker-modal" v-if="showCourseModal">
      <view class="modal-nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="header-back" @click="showCourseModal = false">‹</view>
        <text class="modal-nav-title">选择课程</text>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>

      <view class="picker-search-bar">
        <view class="search-box">
          <AppIcon name="search" size="32rpx" color="#94A3B8" />
          <input
            class="search-input"
            type="text"
            v-model="courseKeyword"
            placeholder="输入课程名称查询"
            @input="handleCourseSearchInput"
          />
        </view>
      </view>

      <view class="picker-dropdown-filter">
        <view class="drop-item" @click="handleFilterGrade">
          <text>{{ selectedGradeFilter || '年级' }}</text>
          <text class="arrow">▼</text>
        </view>
        <view class="drop-item" @click="handleFilterSubject">
          <text>{{ selectedSubjectFilter || '科目' }}</text>
          <text class="arrow">▼</text>
        </view>
      </view>

      <scroll-view class="picker-scroll-list" scroll-y>
        <view v-if="filteredCourses.length > 0">
          <view
            class="course-select-card"
            v-for="item in filteredCourses"
            :key="item.id"
            @click="toggleCourseSelect(item)"
          >
            <view class="custom-checkbox" :class="{ checked: isCourseSelected(item.id) }">
              <text v-if="isCourseSelected(item.id)">✓</text>
            </view>
            <view class="mini-cover-box">
              <text class="mini-cover-title">精品课程</text>
            </view>
            <view class="card-right-desc">
              <text class="course-main-name">{{ item.name }}</text>
              <view class="subject-pill">科目：{{ item.subjectName }}</view>
              <view class="price-bottom-right">
                <text class="unit-price-text">¥{{ item.pricePerLesson }}</text>
                <text class="per-lesson">/次</text>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="empty-list-hint">
          <text class="empty-hint-text">未找到符合条件的课程</text>
        </view>
      </scroll-view>

      <!-- 底部确定栏 (对齐截图 090) -->
      <view class="picker-footer-bar">
        <view class="select-all-btn" @click="toggleAllCourses">
          <view class="custom-checkbox" :class="{ checked: isAllCoursesSelected }">
            <text v-if="isAllCoursesSelected">✓</text>
          </view>
          <text class="all-text">全选</text>
          <text class="chosen-count">已选择{{ tempSelectedCourses.length }}个</text>
        </view>
        <view class="confirm-btn" @click="confirmCourseSelection">确认</view>
      </view>
    </view>

    <!-- ================= 4. 选择物品弹窗 (1:1 对齐截图 091) ================= -->
    <view class="fullscreen-picker-modal" v-if="showGoodsModal">
      <view class="modal-nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="header-back" @click="showGoodsModal = false">‹</view>
        <text class="modal-nav-title">选择物品</text>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>

      <view class="picker-search-bar">
        <view class="search-box">
          <AppIcon name="search" size="32rpx" color="#94A3B8" />
          <input
            class="search-input"
            type="text"
            v-model="goodsKeyword"
            placeholder="输入物品名称查询"
            @input="fetchGoods"
          />
        </view>
      </view>

      <view class="picker-dropdown-filter">
        <view class="drop-item"><text>物品类别</text><text class="arrow">▼</text></view>
      </view>

      <scroll-view class="picker-scroll-list" scroll-y>
        <view
          class="course-select-card"
          v-for="item in goodsCatalogList"
          :key="item.id"
          @click="toggleGoodsSelect(item)"
        >
          <view class="custom-checkbox" :class="{ checked: isGoodsSelected(item.id) }">
            <text v-if="isGoodsSelected(item.id)">✓</text>
          </view>
          <view class="card-right-desc">
            <text class="course-main-name">{{ item.name }}</text>
            <view class="subject-pill">分类：{{ item.category }}</view>
            <view class="price-bottom-right">
              <text class="unit-price-text">¥{{ item.price }}</text>
              <text class="per-lesson">/{{ item.unit }}</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="picker-footer-bar">
        <view class="select-all-btn" @click="tempSelectedGoods = goodsCatalogList.slice()">
          <text class="all-text">全选</text>
          <text class="chosen-count">已选择{{ tempSelectedGoods.length }}个</text>
        </view>
        <view class="confirm-btn" @click="confirmGoodsSelection">确认</view>
      </view>
    </view>

    <!-- ================= 5. 选择班级弹窗 (1:1 对齐截图 092) ================= -->
    <view class="fullscreen-picker-modal" v-if="showClassModal">
      <view class="modal-nav-header" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="header-back" @click="showClassModal = false">‹</view>
        <text class="modal-nav-title">选择班级</text>
        <view class="capsule-placeholder" :style="{ width: capsuleRightWidth + 'px' }"></view>
      </view>

      <view class="picker-search-bar">
        <view class="search-box">
          <AppIcon name="search" size="32rpx" color="#94A3B8" />
          <input
            class="search-input"
            type="text"
            v-model="classKeyword"
            placeholder="输入班级名称查询"
            @input="fetchClasses"
          />
        </view>
      </view>

      <view class="class-type-capsules">
        <view class="type-pill active">小班课</view>
        <view class="type-pill">大班课</view>
        <view class="type-pill">一对一</view>
      </view>

      <scroll-view class="picker-scroll-list" scroll-y>
        <view
          class="class-select-card"
          v-for="item in classCatalogList"
          :key="item.id"
          @click="toggleClassSelect(item)"
        >
          <view class="custom-checkbox" :class="{ checked: isClassSelected(item.id) }">
            <text v-if="isClassSelected(item.id)">✓</text>
          </view>
          <view class="class-card-body">
            <text class="cls-name-title">{{ item.name }}</text>
            <view class="cls-badges-line">
              <view class="badge-ratio">学员/班容: {{ item.currentStudentCount }}/{{ item.capacity }}</view>
              <view class="badge-teacher">讲师: {{ item.teacherName }}</view>
            </view>
            <view class="cls-meta-line">课程: {{ item.courseName }}</view>
            <view class="cls-meta-line">开班时间: {{ item.startDateText }}</view>
            <view class="cls-meta-line">上课时间: {{ item.schedulePatternText }}</view>
          </view>
        </view>
      </scroll-view>

      <view class="picker-footer-bar">
        <view class="select-all-btn">
          <text class="chosen-count">已选择{{ tempSelectedClasses.length }}个班级</text>
        </view>
        <view class="confirm-btn" @click="confirmClassSelection">确认</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import AppIcon from '../../components/AppIcon.vue';
import { useCampusStore } from '../../stores/campusStore';
import { catalogApi, CourseCatalogItem, GoodsCatalogItem } from '../../api/catalog';
import { classApi, ClassListItemModel } from '../../api/class';
import { studentProjector, type RosterItemView, type StudentDossierView } from '../../projectors/student';
import { startSession, enrollmentCoordinator, type EnrollmentDraftSession } from '../../coordinators/enrollment';
import { renewalCoordinator, type RenewalOrderDraft } from '../../coordinators/renewal';

void enrollmentCoordinator;
void renewalCoordinator;

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

// 步骤 1 状态
const searchKeyword = ref('');
const searchCandidateList = ref<RosterItemView[]>([]);
const selectedStudent = ref<StudentDossierView | any | null>(null);
const currentRenewalDraft = ref<RenewalOrderDraft | null>(null);

// 协调器 Session 事实来源 (SSOT)
const session = ref<EnrollmentDraftSession>(
  enrollmentCoordinator.startSession(null, {
    campusId: campusStore.currentCampusId,
    campusName: campusStore.currentCampusName,
  })
);

watch(selectedStudent, (val, oldVal) => {
  session.value.setStudent(val);
  // 如果当前存在生效的续费草案且与当前学员一致，严禁清空刚刚灌装的续费课程与班级
  if (
    currentRenewalDraft.value &&
    val &&
    (String(currentRenewalDraft.value.studentId) === String(val.id) ||
      String(currentRenewalDraft.value.studentId) === String(val.studentId))
  ) {
    return;
  }
  if (!val || (oldVal && val && oldVal.id !== val.id)) {
    session.value.clear();
    tempSelectedCourses.value = [];
    tempSelectedGoods.value = [];
    tempSelectedClasses.value = [];
  }
});

// 派生响应式只读视图
const selectedCourses = computed(() => session.value.selectedCourses);
const selectedGoods = computed(() => session.value.selectedGoods);
const selectedClasses = computed(() => session.value.selectedClasses);
const totalSelectedItemCount = computed(() => session.value.totalItemsCount);

// 步骤 2 报名内容与弹窗
const showCourseModal = ref(false);
const showGoodsModal = ref(false);
const showClassModal = ref(false);

const courseCatalogList = ref<CourseCatalogItem[]>([]);
const goodsCatalogList = ref<GoodsCatalogItem[]>([]);
const classCatalogList = ref<ClassListItemModel[]>([]);

const courseKeyword = ref('');
const goodsKeyword = ref('');
const classKeyword = ref('');

const tempSelectedCourses = ref<CourseCatalogItem[]>([]);
const tempSelectedGoods = ref<GoodsCatalogItem[]>([]);
const tempSelectedClasses = ref<ClassListItemModel[]>([]);

const selectedGradeFilter = ref('');
const selectedSubjectFilter = ref('');
let courseSearchTimer: any = null;

const filteredCourses = computed(() => {
  let list = courseCatalogList.value;
  if (courseKeyword.value.trim()) {
    const kw = courseKeyword.value.trim().toLowerCase();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(kw) ||
        (c.subjectName && c.subjectName.toLowerCase().includes(kw))
    );
  }
  if (selectedGradeFilter.value && selectedGradeFilter.value !== '全部年级') {
    list = list.filter((c) => c.gradeName === selectedGradeFilter.value);
  }
  if (selectedSubjectFilter.value && selectedSubjectFilter.value !== '全部科目') {
    list = list.filter((c) => c.subjectName === selectedSubjectFilter.value);
  }
  return list;
});

const isAllCoursesSelected = computed(() => {
  if (filteredCourses.value.length === 0) return false;
  return filteredCourses.value.every((c) => tempSelectedCourses.value.some((t) => t.id === c.id));
});

let hasLoadedWizard = false;

const loadStudentById = async (studentId: string, studentName?: string, studentNo?: string) => {
  try {
    const dossier = await studentProjector.projectDossier(studentId);
    selectedStudent.value = dossier;
  } catch (e) {
    console.warn('[wizard] 获取学员详情兜底:', e);
    selectedStudent.value = {
      id: studentId,
      name: studentName ? decodeURIComponent(studentName) : '学员',
      studentNo: studentNo || '',
      phone: '',
      status: '未报读',
      normalizedStatus: 'not_enrolled',
      statusText: '未报读',
      remainingLessons: 0,
      remainingAmount: 0,
      walletBalance: 0,
      enrolledClassesCount: 0,
      campusId: campusStore.currentCampusId,
      campusName: campusStore.currentCampusName,
      isAssignedClass: false,
    };
  }
};

const handleSwitchStudent = () => {
  if (currentRenewalDraft.value) {
    renewalCoordinator.clearStagedDraft(currentRenewalDraft.value.draftId);
    currentRenewalDraft.value = null;
  }
  if (typeof (session.value as any)?.setChannel === 'function') {
    (session.value as any).setChannel(undefined);
  }
  selectedStudent.value = null;
  session.value.clear();
  tempSelectedCourses.value = [];
  tempSelectedGoods.value = [];
  tempSelectedClasses.value = [];
};

/**
 * 续费决策草案自动灌装意图流水线 (ADR-0006 Zero Glue to Enroll)
 */
const applyRenewalDraft = async (draftId?: string, query?: any) => {
  if (!draftId) return;
  try {
    let draft = renewalCoordinator.getStagedDraft(draftId);
    if (!draft) {
      try {
        const stored = uni.getStorageSync(`renewal_draft_${draftId}`);
        if (stored) {
          draft = typeof stored === 'string' ? JSON.parse(stored) : stored;
        }
      } catch (err) {
        console.warn('[wizard] 读取暂存续费草案缓存异常:', err);
      }
    }

    // 防御校验：若指定了草案 ID，必须严格匹配 draftId，严禁错漏或串用他人草案
    if (draft && draft.draftId && draft.draftId !== draftId) {
      draft = null;
    }

    if (!draft) {
      currentRenewalDraft.value = null;
      if (query?.studentId) {
        await loadStudentById(query.studentId, query.studentName, query.studentNo);
      }
      return;
    }

    currentRenewalDraft.value = draft;

    // 1. 设置学员全息档案
    let studentObj: any = null;
    try {
      studentObj = await studentProjector.projectDossier(draft.studentId);
    } catch {
      studentObj = {
        id: draft.studentId,
        name: draft.studentName,
        studentNo: draft.studentNo,
        phone: draft.studentPhone || (draft as any).phone || (draft as any).studentPhone || '',
        status: '在读',
        normalizedStatus: 'in_class',
        statusText: '在读',
        remainingLessons: 0,
        remainingAmount: 0,
        walletBalance: draft.quote.walletPrincipalBalance || 0,
        enrolledClassesCount: 1,
        campusId: draft.campusId || campusStore.currentCampusId,
        campusName: draft.campusName || campusStore.currentCampusName,
        isAssignedClass: !draft.validation.fallbackUnassigned && !!draft.quote.classId,
      };
    }

    selectedStudent.value = studentObj;

    // 校区状态对齐同步
    if (draft.campusId && draft.campusId !== campusStore.currentCampusId) {
      campusStore.setCampus({
        id: draft.campusId,
        name: draft.campusName || campusStore.currentCampusName,
        code: draft.campusId,
      });
    }

    // 2. 重新初始化 session，保持 SSOT 权威同步
    session.value = enrollmentCoordinator.startSession(studentObj, {
      campusId: draft.campusId || campusStore.currentCampusId,
      campusName: draft.campusName || campusStore.currentCampusName,
      defaultPaymentMethod: (draft.quote.paymentMethod as any) || 'wechat',
      channel: draft.enrollCommand?.channel || 'renewal',
    });

    // 3. 灌装老学员原单价、课程规格与实际应付金额
    const actualPayAmount = draft.quote.actualPayAmount !== undefined
      ? draft.quote.actualPayAmount
      : Math.max(0, draft.quote.pricePerLesson * draft.quote.totalLessons - draft.quote.suggestedDiscount);

    const renewalCourseItem = {
      id: draft.quote.courseId,
      name: draft.quote.courseName || '老学员续约课程',
      totalLessons: draft.quote.totalLessons || 48,
      bonusLessons: draft.quote.bonusLessons || 0,
      discountAmount: draft.quote.suggestedDiscount || 0,
      pricePerLesson: draft.quote.pricePerLesson || 200,
      totalPrice: actualPayAmount,
      subjectName: '常规科目',
      gradeName: '在读年级',
    };

    // 4. 目标班级 / 待分班标记处理 (班容超限自动回退待分班资产池)
    let targetClassItem: any = null;
    if (!draft.validation.fallbackUnassigned && draft.quote.classId) {
      targetClassItem = {
        id: draft.quote.classId,
        name: draft.quote.className || '在读原班',
        courseId: draft.quote.courseId,
        courseName: draft.quote.courseName,
      };
      tempSelectedClasses.value = [targetClassItem];
    } else {
      // 原班满员或未指定班级：安全回退待分班标记
      tempSelectedClasses.value = [];
    }

    session.value.toggleCourse(renewalCourseItem, targetClassItem);
    tempSelectedCourses.value = [renewalCourseItem as any];

    // 5. 提示用户灌装结果与降级说明
    if (draft.validation.fallbackUnassigned || draft.validation.isClassFull) {
      uni.showToast({
        title: draft.validation.warningMessage || '原班满员，已置为待分班',
        icon: 'none',
        duration: 3000,
      });
    } else {
      uni.showToast({
        title: `已灌装续费草案：单价¥${draft.quote.pricePerLesson}/课时`,
        icon: 'none',
        duration: 2500,
      });
    }
  } catch (e) {
    console.warn('[wizard] 灌装续费决策草案异常:', e);
  }
};

onLoad(async (query: any) => {
  hasLoadedWizard = true;
  if (query?.renewalDraftId) {
    await applyRenewalDraft(query.renewalDraftId, query);
  } else if (query?.studentId) {
    await loadStudentById(query.studentId, query.studentName, query.studentNo);
  }
  if (query?.step === 'class') {
    openClassModal();
  }
});

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
  } catch (e) {
    console.warn('[wizard] 读取胶囊布局信息警告:', e);
  }

  if (!hasLoadedWizard) {
    const pages = getCurrentPages();
    const curPage = pages[pages.length - 1];
    const query = (curPage as any)?.options || {};
    if (query?.renewalDraftId) {
      await applyRenewalDraft(query.renewalDraftId, query);
    } else if (query?.studentId) {
      await loadStudentById(query.studentId, query.studentName, query.studentNo);
    }
    if (query?.step === 'class') {
      openClassModal();
    }
  }

  await fetchCourses();
  await fetchGoods();
  await fetchClasses();
});

const cleanupWizardSession = () => {
  if (courseSearchTimer) {
    clearTimeout(courseSearchTimer);
    courseSearchTimer = null;
  }
  if (currentRenewalDraft.value) {
    renewalCoordinator.clearStagedDraft(currentRenewalDraft.value.draftId);
  }
  currentRenewalDraft.value = null;
  if (typeof (session.value as any)?.setChannel === 'function') {
    (session.value as any).setChannel(undefined);
  }
  session.value.clear();
  searchCandidateList.value = [];
  tempSelectedCourses.value = [];
  tempSelectedGoods.value = [];
  tempSelectedClasses.value = [];
};

onUnload(() => {
  cleanupWizardSession();
});

onUnmounted(() => {
  cleanupWizardSession();
});

const handleSearchStudent = async () => {
  if (!searchKeyword.value.trim()) {
    uni.showToast({ title: '请输入查询关键词', icon: 'none' });
    return;
  }
  const res = await studentProjector.projectRoster({ keyword: searchKeyword.value });
  searchCandidateList.value = res.list;
  if (res.list.length === 0) {
    uni.showToast({ title: '未查找到学员，可前往录入', icon: 'none' });
  }
};

const selectTargetStudent = async (stu: RosterItemView) => {
  try {
    const dossier = await studentProjector.projectDossier(stu.id);
    selectedStudent.value = dossier;
  } catch (e) {
    console.warn('[wizard] 选取学员详情失败兜底:', e);
    selectedStudent.value = stu;
  }
};

const handleGoBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: '/pages/workbench/index' });
  }
};

// 选课业务
const openCourseModal = () => {
  tempSelectedCourses.value = [...selectedCourses.value] as any;
  courseKeyword.value = '';
  selectedGradeFilter.value = '';
  selectedSubjectFilter.value = '';
  fetchCourses();
  showCourseModal.value = true;
};

const fetchCourses = async () => {
  try {
    const list = await catalogApi.getCourses({
      pageSize: 200,
      keyword: courseKeyword.value.trim() || undefined,
    });
    courseCatalogList.value = list;
  } catch (e) {
    console.warn('[wizard] 获取课程目录失败:', e);
  }
};

const handleCourseSearchInput = () => {
  clearTimeout(courseSearchTimer);
  courseSearchTimer = setTimeout(() => {
    fetchCourses();
  }, 300);
};

const handleFilterGrade = () => {
  const grades = ['全部年级', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'];
  uni.showActionSheet({
    itemList: grades,
    success: (res) => {
      selectedGradeFilter.value = res.tapIndex === 0 ? '' : grades[res.tapIndex];
    },
  });
};

const handleFilterSubject = () => {
  const subjectSet = new Set<string>();
  courseCatalogList.value.forEach((c) => {
    if (c.subjectName) subjectSet.add(c.subjectName);
  });
  const subjects = ['全部科目', ...Array.from(subjectSet).slice(0, 5)];
  uni.showActionSheet({
    itemList: subjects,
    success: (res) => {
      selectedSubjectFilter.value = res.tapIndex === 0 ? '' : subjects[res.tapIndex];
    },
  });
};

const isCourseSelected = (id: string) => {
  return tempSelectedCourses.value.some((c) => String(c.id) === String(id));
};

const toggleCourseSelect = (item: CourseCatalogItem) => {
  const idx = tempSelectedCourses.value.findIndex((c) => String(c.id) === String(item.id));
  if (idx >= 0) {
    tempSelectedCourses.value.splice(idx, 1);
  } else {
    tempSelectedCourses.value.push(item);
  }
};

const toggleAllCourses = () => {
  if (isAllCoursesSelected.value) {
    const filteredIds = new Set(filteredCourses.value.map((c) => String(c.id)));
    tempSelectedCourses.value = tempSelectedCourses.value.filter((c) => !filteredIds.has(String(c.id)));
  } else {
    const map = new Map(tempSelectedCourses.value.map((c) => [String(c.id), c]));
    filteredCourses.value.forEach((c) => map.set(String(c.id), c));
    tempSelectedCourses.value = Array.from(map.values());
  }
};

const confirmCourseSelection = () => {
  if (
    currentRenewalDraft.value &&
    !tempSelectedCourses.value.some(
      (c) => String(c.id) === String(currentRenewalDraft.value?.quote.courseId)
    )
  ) {
    renewalCoordinator.clearStagedDraft(currentRenewalDraft.value.draftId);
    currentRenewalDraft.value = null;
    if (typeof (session.value as any)?.setChannel === 'function') {
      (session.value as any).setChannel(undefined);
    }
  }

  // 如果保留了续费草案课程，确保其继承原签约单价与赠课优惠，杜绝弹窗重选覆盖为普通售价
  if (currentRenewalDraft.value) {
    for (const c of tempSelectedCourses.value) {
      if (String(c.id) === String(currentRenewalDraft.value.quote.courseId)) {
        c.pricePerLesson = currentRenewalDraft.value.quote.pricePerLesson;
        c.bonusLessons = currentRenewalDraft.value.quote.bonusLessons;
        c.discountAmount = currentRenewalDraft.value.quote.suggestedDiscount;
        c.totalPrice = currentRenewalDraft.value.quote.actualPayAmount;
      }
    }
  }

  session.value.setCourses(tempSelectedCourses.value);
  showCourseModal.value = false;
};

const removeCourse = (course: any) => {
  const cid = String(course?.id || '');
  if (
    currentRenewalDraft.value &&
    cid === String(currentRenewalDraft.value.quote.courseId)
  ) {
    renewalCoordinator.clearStagedDraft(currentRenewalDraft.value.draftId);
    currentRenewalDraft.value = null;
    if (typeof (session.value as any)?.setChannel === 'function') {
      (session.value as any).setChannel(undefined);
    }
  }
  session.value.toggleCourse(course);
  tempSelectedCourses.value = tempSelectedCourses.value.filter((c) => String(c.id) !== cid);
  tempSelectedClasses.value = tempSelectedClasses.value.filter((cls: any) => String(cls.courseId) !== cid);
};

// 选物业务
const openGoodsModal = () => {
  tempSelectedGoods.value = [...selectedGoods.value] as any;
  goodsKeyword.value = '';
  fetchGoods();
  showGoodsModal.value = true;
};

const fetchGoods = async () => {
  try {
    goodsCatalogList.value = await catalogApi.getGoods({ keyword: goodsKeyword.value });
  } catch (e) {
    console.warn('[wizard] 获取物品目录失败:', e);
  }
};

const isGoodsSelected = (id: string) => {
  return tempSelectedGoods.value.some((g) => String(g.id) === String(id));
};

const toggleGoodsSelect = (item: GoodsCatalogItem) => {
  const idx = tempSelectedGoods.value.findIndex((g) => String(g.id) === String(item.id));
  if (idx >= 0) {
    tempSelectedGoods.value.splice(idx, 1);
  } else {
    tempSelectedGoods.value.push(item);
  }
};

const confirmGoodsSelection = () => {
  session.value.setGoods(tempSelectedGoods.value);
  showGoodsModal.value = false;
};

const removeGoods = (goods: any) => {
  session.value.toggleGoods(goods, 0);
};

// 选班业务
const openClassModal = () => {
  tempSelectedClasses.value = [...selectedClasses.value] as any;
  classKeyword.value = '';
  fetchClasses();
  showClassModal.value = true;
};

const fetchClasses = async () => {
  try {
    classCatalogList.value = await classApi.getClasses({ keyword: classKeyword.value });
  } catch (e) {
    console.warn('[wizard] 获取班级列表失败:', e);
  }
};

const isClassSelected = (id: string) => {
  return tempSelectedClasses.value.some((c) => String(c.id) === String(id));
};

const toggleClassSelect = (item: ClassListItemModel) => {
  const idx = tempSelectedClasses.value.findIndex((c) => String(c.id) === String(item.id));
  if (idx >= 0) {
    tempSelectedClasses.value.splice(idx, 1);
  } else {
    tempSelectedClasses.value.push(item);
  }
};

const confirmClassSelection = () => {
  try {
    for (const cls of tempSelectedClasses.value) {
      if (cls.capacity && cls.currentStudentCount !== undefined && cls.currentStudentCount >= cls.capacity) {
        throw new Error(`班级「${cls.name}」已满员 (${cls.currentStudentCount}/${cls.capacity}人)，请选择其他未满员班级`);
      }
    }
    session.value.setClasses(tempSelectedClasses.value);
    showClassModal.value = false;
  } catch (err: any) {
    uni.showToast({ title: err?.message || '班级分配失败', icon: 'none' });
  }
};

const removeClass = (cls: any) => {
  session.value.removeClass(cls.courseId, cls.id);
};

// 下单结算与风控校验
const openCheckoutModal = () => {
  if (!selectedStudent.value) return;

  // 1. 委托协调器执行权威学籍风控与钱包预检
  const report = session.value.validationReport;
  if (!report.canEnroll) {
    uni.showModal({
      title: '学籍风控拦截',
      content: report.riskReason || report.errors[0] || '学员学籍异常，无法办理报名',
      showCancel: false,
    });
    return;
  }

  if (!report.isValid) {
    uni.showToast({
      title: report.errors[0] || '报名校验未通过',
      icon: 'none',
    });
    return;
  }

  const summary = session.value.financialSummary;
  const coursesText = selectedCourses.value.map((c) => c.name).join('、') || '无';
  const classesText = selectedClasses.value.map((c) => c.name).join('、') || '待分配';

  uni.showModal({
    title: '确认报名开单',
    content: `学员: ${selectedStudent.value.name}\n课程: ${coursesText}\n班级: ${classesText}\n应收总计: ¥${summary.totalAmount}`,
    confirmText: '确认收款',
    cancelText: '取消',
    success: async (res) => {
      if (res.confirm) {
        if (session.value.isSubmitting) return;
        try {
          // 2. 委托协调器执行开单意图履约，彻底杜绝单课截断与物品丢失缺陷
          await session.value.submit();
          if (currentRenewalDraft.value) {
            renewalCoordinator.clearStagedDraft(currentRenewalDraft.value.draftId);
            currentRenewalDraft.value = null;
          }
          if (typeof (session.value as any)?.setChannel === 'function') {
            (session.value as any).setChannel(undefined);
          }
          session.value.clear();
          tempSelectedCourses.value = [];
          tempSelectedGoods.value = [];
          tempSelectedClasses.value = [];
          uni.showToast({ title: '报名开单成功！', icon: 'success' });
          setTimeout(() => {
            uni.navigateBack();
          }, 1200);
        } catch (e: any) {
          uni.showToast({ title: e?.message || '报名开单失败，请重试', icon: 'none' });
        }
      }
    },
  });
};
</script>

<style scoped>
.enroll-wizard-container {
  min-height: 100vh;
  background-color: #F8F9FD;
  display: flex;
  flex-direction: column;
}

/* 顶部导航 */
.custom-header {
  background: #FFFFFF;
}

.header-inner {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
}

.left-nav {
  display: flex;
  align-items: center;
}

.back-arrow {
  font-size: 52rpx;
  color: #1F2937;
  margin-right: 16rpx;
  line-height: 1;
}

.page-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
  margin-right: 16rpx;
}

.campus-selector {
  display: flex;
  align-items: center;
  background: #F4F6F9;
  padding: 6rpx 16rpx;
  border-radius: 24rpx;
}

.campus-name {
  font-size: 26rpx;
  font-weight: 600;
  color: #1F2937;
  margin-right: 6rpx;
}

.arrow {
  font-size: 20rpx;
  color: #8C9BAB;
}

/* 步骤 1: 搜索学员 */
.search-step-view {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.search-input-wrap {
  background: #FFFFFF;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid #F3F4F6;
}

.search-input-box {
  display: flex;
  align-items: center;
  background: #F4F6FA;
  border-radius: 36rpx;
  padding: 12rpx 24rpx;
}

.search-icon {
  font-size: 28rpx;
  margin-right: 12rpx;
}

.input-field {
  flex: 1;
  font-size: 26rpx;
  color: #111827;
}

.search-action-btn {
  font-size: 26rpx;
  color: #2F6BF4;
  font-weight: 600;
  padding-left: 16rpx;
}

.empty-guide-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.cartoon-glass-box {
  width: 140rpx;
  height: 140rpx;
  background: #EFF6FF;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24rpx;
}

.cartoon-emoji {
  font-size: 68rpx;
}

.guide-text {
  font-size: 28rpx;
  color: #4B5563;
}

.search-results-list {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.candidate-card {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
}

.candidate-avatar {
  font-size: 52rpx;
  margin-right: 20rpx;
}

.candidate-info {
  flex: 1;
}

.candidate-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.candidate-meta {
  font-size: 24rpx;
  color: #6B7280;
  margin-top: 4rpx;
}

.select-pill-btn {
  background: #2F6BF4;
  color: #FFFFFF;
  font-size: 26rpx;
  padding: 10rpx 28rpx;
  border-radius: 28rpx;
}

/* 步骤 2: 报名主体表单 */
.enroll-form-view {
  display: flex;
  flex-direction: column;
  padding: 24rpx;
  box-sizing: border-box;
}

.student-header-card {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
  margin-bottom: 24rpx;
}

.student-card-inner {
  display: flex;
  align-items: center;
}

.header-avatar-circle {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  background: #FFF1E6;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.header-avatar-emoji {
  font-size: 56rpx;
}

.header-info-col {
  flex: 1;
}

.header-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

.switch-stu-btn {
  font-size: 24rpx;
  color: #2F6BF4;
}

.header-meta-line {
  font-size: 24rpx;
  color: #6B7280;
  margin-top: 6rpx;
}

.wallet-badge {
  display: inline-block;
  background: #FFF7ED;
  color: #EA580C;
  font-size: 22rpx;
  padding: 2rpx 14rpx;
  border-radius: 8rpx;
  margin-top: 10rpx;
}

/* 报名内容容器 */
.section-container-card {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
}

.section-title-label {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 24rpx;
}

.picker-row-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
}

.picker-left-label {
  font-size: 28rpx;
  color: #374151;
  font-weight: 500;
}

.picker-right-action {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.count-text {
  font-size: 26rpx;
  color: #9CA3AF;
}

.chevron {
  font-size: 32rpx;
  color: #9CA3AF;
}

.row-divider {
  height: 1rpx;
  background: #F3F4F6;
  margin: 8rpx 0;
}

.selected-items-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.selected-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F8FAFC;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}

.item-tag-name {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.item-tag-blue {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.item-tag-purple {
  background: #F5F3FF;
  color: #7C3AED;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.item-tag-green {
  background: #ECFDF5;
  color: #059669;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.item-name-text {
  font-size: 26rpx;
  color: #1F2937;
  font-weight: 500;
}

.delete-icon {
  font-size: 28rpx;
}

/* 底部结算大按钮 */
.bottom-checkout-bar {
  margin-top: 60rpx;
}

.enroll-submit-big-btn {
  background: #3B82F6;
  color: #FFFFFF;
  font-size: 32rpx;
  font-weight: 600;
  border-radius: 48rpx;
  height: 96rpx;
  line-height: 96rpx;
  box-shadow: 0 8rpx 24rpx rgba(59, 130, 246, 0.35);
}

.enroll-submit-big-btn[disabled] {
  background: #93C5FD;
  color: #EFF6FF;
}

/* 全屏模态弹窗 (选课/选物/选班) */
.fullscreen-picker-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: #F9FAFB;
  z-index: 999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

.modal-nav-header {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #F3F4F6;
  background: #FFFFFF;
  flex-shrink: 0;
  box-sizing: content-box;
}

.header-back {
  font-size: 52rpx;
  color: #1F2937;
  line-height: 1;
}

.modal-nav-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
}

.picker-search-bar {
  padding: 16rpx 24rpx;
  background: #FFFFFF;
  flex-shrink: 0;
}

.picker-dropdown-filter,
.class-type-capsules {
  display: flex;
  gap: 24rpx;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #F3F4F6;
  background: #FFFFFF;
  flex-shrink: 0;
}

.drop-item {
  display: flex;
  align-items: center;
  font-size: 26rpx;
  color: #4B5563;
  gap: 8rpx;
  background: #F3F4F6;
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}

.type-pill {
  font-size: 24rpx;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  background: #F3F4F6;
  color: #4B5563;
}

.type-pill.active {
  background: #EFF6FF;
  color: #2563EB;
  font-weight: 600;
}

.picker-scroll-list {
  flex: 1;
  height: 0;
  min-height: 0;
  padding: 24rpx;
  box-sizing: border-box;
  overflow-y: hidden;
}

.empty-list-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
}

.empty-hint-text {
  font-size: 26rpx;
  color: #9CA3AF;
}

.course-select-card,
.class-select-card {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  border-radius: 16rpx;
  border: 1rpx solid #F3F4F6;
  padding: 24rpx;
  margin-bottom: 18rpx;
}

.custom-checkbox {
  width: 38rpx;
  height: 38rpx;
  border: 2rpx solid #D1D5DB;
  border-radius: 8rpx;
  margin-right: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #FFFFFF;
}

.custom-checkbox.checked {
  background: #3B82F6;
  border-color: #3B82F6;
}

.mini-cover-box {
  width: 140rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #A78BFA 0%, #EC4899 100%);
  border-radius: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.mini-cover-title {
  color: #FFFFFF;
  font-size: 24rpx;
  font-weight: 700;
}

.card-right-desc {
  flex: 1;
}

.course-main-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.subject-pill {
  display: inline-block;
  background: #EFF6FF;
  color: #2563EB;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  margin-top: 8rpx;
}

.price-bottom-right {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
}

.unit-price-text {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

.per-lesson {
  font-size: 22rpx;
  color: #6B7280;
}

.class-card-body {
  flex: 1;
}

.cls-name-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.cls-badges-line {
  display: flex;
  gap: 12rpx;
  margin-top: 8rpx;
}

.badge-ratio {
  background: #EFF6FF;
  color: #2563EB;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.badge-teacher {
  background: #F3F4F6;
  color: #4B5563;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.cls-meta-line {
  font-size: 22rpx;
  color: #6B7280;
  margin-top: 4rpx;
}

.picker-footer-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #E5E7EB;
  background: #FFFFFF;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.08);
  z-index: 1000;
}

.select-all-btn {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.all-text {
  font-size: 28rpx;
  color: #111827;
  font-weight: 500;
}

.chosen-count {
  font-size: 24rpx;
  color: #6B7280;
}

.confirm-btn {
  background: #2563EB;
  color: #FFFFFF;
  font-size: 30rpx;
  font-weight: 600;
  padding: 16rpx 56rpx;
  border-radius: 40rpx;
  box-shadow: 0 4rpx 14rpx rgba(37, 99, 235, 0.3);
}

.confirm-btn:active {
  opacity: 0.85;
}

.renewal-draft-banner {
  background: #EFF6FF;
  border: 1rpx solid #BFDBFE;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;

  .draft-tag-badge {
    align-self: flex-start;
    background: #2563EB;
    color: #FFFFFF;
    font-size: 20rpx;
    font-weight: 600;
    padding: 2rpx 12rpx;
    border-radius: 6rpx;
  }

  .draft-tip-line {
    font-size: 24rpx;
    color: #1E40AF;
    line-height: 1.4;
  }

  .draft-warning-pill {
    align-self: flex-start;
    font-size: 22rpx;
    color: #DC2626;
    background: #FEE2E2;
    padding: 4rpx 12rpx;
    border-radius: 6rpx;
    margin-top: 4rpx;
  }
}
</style>
