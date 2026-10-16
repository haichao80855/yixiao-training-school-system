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
          <text class="search-icon">🔍</text>
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
          <view class="candidate-avatar">👦</view>
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
          <text class="cartoon-emoji">🔎</text>
        </view>
        <text class="guide-text">需要先进行查询学员操作哦~</text>
      </view>
    </view>

    <!-- 2. 已选中学员：报名主体表单 (对齐截图 089 & 093) -->
    <view v-else class="enroll-form-view">
      <!-- 头部选中学员信息卡片 (对齐截图 089) -->
      <view class="student-header-card">
        <view class="student-card-inner">
          <view class="header-avatar-circle">
            <text class="header-avatar-emoji">👦</text>
          </view>
          <view class="header-info-col">
            <view class="header-name-row">
              <text class="header-name">{{ selectedStudent.name }}</text>
              <text class="switch-stu-btn" @click="selectedStudent = null">切换学员</text>
            </view>
            <view class="header-meta-line">
              电话: {{ selectedStudent.phone }}  学号: {{ selectedStudent.studentNo }}
            </view>
            <view class="wallet-badge">钱包余额 0 元</view>
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
            <text class="delete-icon" @click="selectedCourses.splice(idx, 1)">🗑️</text>
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
            <text class="delete-icon" @click="selectedGoods.splice(idx, 1)">🗑️</text>
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
            <text class="delete-icon" @click="selectedClasses.splice(idx, 1)">🗑️</text>
          </view>
        </view>
      </view>

      <!-- 底部固定大按钮 (对齐截图 089 & 093: 已选择 X 个项目，去报名) -->
      <view class="bottom-checkout-bar">
        <button
          class="enroll-submit-big-btn"
          :disabled="totalSelectedItemCount === 0"
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
          <text>🔍</text>
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
          <text>🔍</text>
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
          <text>🔍</text>
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
import { ref, computed, onMounted } from 'vue';
import { useCampusStore } from '../../stores/campusStore';
import { studentApi, StudentListItemModel } from '../../api/student';
import { catalogApi, CourseCatalogItem, GoodsCatalogItem } from '../../api/catalog';
import { classApi, ClassListItemModel } from '../../api/class';

const campusStore = useCampusStore();
const statusBarHeight = ref(20);
const capsuleRightWidth = ref(96);

// 步骤 1 状态
const searchKeyword = ref('');
const searchCandidateList = ref<StudentListItemModel[]>([]);
const selectedStudent = ref<StudentListItemModel | null>(null);

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

const selectedCourses = ref<CourseCatalogItem[]>([]);
const tempSelectedCourses = ref<CourseCatalogItem[]>([]);
const selectedGradeFilter = ref('');
const selectedSubjectFilter = ref('');
let courseSearchTimer: any = null;

const selectedGoods = ref<GoodsCatalogItem[]>([]);
const tempSelectedGoods = ref<GoodsCatalogItem[]>([]);

const selectedClasses = ref<ClassListItemModel[]>([]);
const tempSelectedClasses = ref<ClassListItemModel[]>([]);

const totalSelectedItemCount = computed(() => {
  return selectedCourses.value.length + selectedGoods.value.length + selectedClasses.value.length;
});

const filteredCourses = computed(() => {
  let list = courseCatalogList.value;
  if (courseKeyword.value.trim()) {
    const kw = courseKeyword.value.trim().toLowerCase();
    list = list.filter((c) =>
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

  const pages = getCurrentPages();
  const curPage = pages[pages.length - 1];
  const query = (curPage as any)?.options || {};

  // 如果传了 studentId，动态获取该学员真实档案并选中
  if (query.studentId) {
    try {
      const p = await studentApi.getStudentProfile(query.studentId);
      let st: 'active' | 'graduated' | 'suspended' | 'pending_assignment' | 'lost' = 'active';
      if (p.status === '待分班') st = 'pending_assignment';
      else if (p.status === '停课') st = 'suspended';
      else if (p.status === '已流失') st = 'lost';
      else if (p.status === '已结业') st = 'graduated';

      selectedStudent.value = {
        id: p.id,
        name: p.name,
        studentNo: p.studentNo,
        phone: p.phone,
        status: st,
        statusText: p.status,
        remainingLessons: p.totalRemainingLessons,
        remainingAmount: p.totalRemainingAmount,
        enrolledClassesCount: p.courses.filter((c: any) => c.isEnrolledClass).length,
        campusId: campusStore.currentCampusId,
        campusName: p.campusName || campusStore.currentCampusName,
        isAssignedClass: p.courses.some((c: any) => c.isEnrolledClass),
      };
    } catch {
      selectedStudent.value = {
        id: query.studentId,
        name: query.studentName ? decodeURIComponent(query.studentName) : '学员',
        studentNo: query.studentNo || '',
        phone: '',
        status: 'active',
        statusText: '未报读',
        remainingLessons: 0,
        remainingAmount: 0,
        enrolledClassesCount: 0,
        campusId: campusStore.currentCampusId,
        campusName: campusStore.currentCampusName,
        isAssignedClass: false,
      };
    }
  }

  await fetchCourses();
  await fetchGoods();
  await fetchClasses();
});

const handleSearchStudent = async () => {
  if (!searchKeyword.value.trim()) {
    uni.showToast({ title: '请输入查询关键词', icon: 'none' });
    return;
  }
  const res = await studentApi.getStudents({ keyword: searchKeyword.value });
  searchCandidateList.value = res.list;
  if (res.list.length === 0) {
    uni.showToast({ title: '未查找到学员，可前往录入', icon: 'none' });
  }
};

const selectTargetStudent = (stu: StudentListItemModel) => {
  selectedStudent.value = stu;
};

const handleGoBack = () => {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: '/pages/workbench/index' });
  }
};

// 选课逻辑
const openCourseModal = () => {
  tempSelectedCourses.value = [...selectedCourses.value];
  courseKeyword.value = '';
  selectedGradeFilter.value = '';
  selectedSubjectFilter.value = '';
  fetchCourses();
  showCourseModal.value = true;
};

const openGoodsModal = () => {
  tempSelectedGoods.value = [...selectedGoods.value];
  goodsKeyword.value = '';
  fetchGoods();
  showGoodsModal.value = true;
};

const openClassModal = () => {
  tempSelectedClasses.value = [...selectedClasses.value];
  classKeyword.value = '';
  fetchClasses();
  showClassModal.value = true;
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
  return tempSelectedCourses.value.some((c) => c.id === id);
};

const toggleCourseSelect = (item: CourseCatalogItem) => {
  const idx = tempSelectedCourses.value.findIndex((c) => c.id === item.id);
  if (idx >= 0) {
    tempSelectedCourses.value.splice(idx, 1);
  } else {
    tempSelectedCourses.value.push(item);
  }
};

const toggleAllCourses = () => {
  if (isAllCoursesSelected.value) {
    const filteredIds = new Set(filteredCourses.value.map((c) => c.id));
    tempSelectedCourses.value = tempSelectedCourses.value.filter((c) => !filteredIds.has(c.id));
  } else {
    const map = new Map(tempSelectedCourses.value.map((c) => [c.id, c]));
    filteredCourses.value.forEach((c) => map.set(c.id, c));
    tempSelectedCourses.value = Array.from(map.values());
  }
};

const confirmCourseSelection = () => {
  selectedCourses.value = [...tempSelectedCourses.value];
  showCourseModal.value = false;
};

// 选物逻辑
const fetchGoods = async () => {
  goodsCatalogList.value = await catalogApi.getGoods({ keyword: goodsKeyword.value });
};

const isGoodsSelected = (id: string) => {
  return tempSelectedGoods.value.some((g) => g.id === id);
};

const toggleGoodsSelect = (item: GoodsCatalogItem) => {
  const idx = tempSelectedGoods.value.findIndex((g) => g.id === item.id);
  if (idx >= 0) {
    tempSelectedGoods.value.splice(idx, 1);
  } else {
    tempSelectedGoods.value.push(item);
  }
};

const confirmGoodsSelection = () => {
  selectedGoods.value = [...tempSelectedGoods.value];
  showGoodsModal.value = false;
};

// 选班逻辑
const fetchClasses = async () => {
  classCatalogList.value = await classApi.getClasses({ keyword: classKeyword.value });
};

const isClassSelected = (id: string) => {
  return tempSelectedClasses.value.some((c) => c.id === id);
};

const toggleClassSelect = (item: ClassListItemModel) => {
  const idx = tempSelectedClasses.value.findIndex((c) => c.id === item.id);
  if (idx >= 0) {
    tempSelectedClasses.value.splice(idx, 1);
  } else {
    tempSelectedClasses.value.push(item);
  }
};

const confirmClassSelection = () => {
  selectedClasses.value = [...tempSelectedClasses.value];
  showClassModal.value = false;
};

// 下单结算
const openCheckoutModal = () => {
  if (!selectedStudent.value) return;

  const courseSum = selectedCourses.value.reduce((acc, c) => acc + c.totalPrice, 0);
  const goodsSum = selectedGoods.value.reduce((acc, g) => acc + g.price, 0);
  const totalAmount = courseSum + goodsSum;

  uni.showModal({
    title: '确认报名开单',
    content: `学员: ${selectedStudent.value.name}\n课程: ${selectedCourses.value.map((c) => c.name).join('、') || '无'}\n班级: ${selectedClasses.value.map((c) => c.name).join('、') || '待分配'}\n应收总计: ¥${totalAmount}`,
    confirmText: '确认收款',
    cancelText: '取消',
    success: async (res) => {
      if (res.confirm) {
        try {
          await studentApi.enrollStudent({
            studentId: selectedStudent.value!.id,
            campusId: campusStore.currentCampusId,
            courseId: selectedCourses.value[0]?.id || 'crs-qm',
            courseName: selectedCourses.value[0]?.name || '启蒙英语',
            classId: selectedClasses.value[0]?.id,
            className: selectedClasses.value[0]?.name,
            lessons: selectedCourses.value[0]?.totalLessons || 48,
            amount: totalAmount,
            payMethod: 'wechat',
          });
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
</style>
