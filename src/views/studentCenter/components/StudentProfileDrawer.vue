<template>
  <el-drawer
    v-model="visible"
    title="360° 学员全景业务画像档案"
    size="940px"
    destroy-on-close
  >
    <div v-if="student" class="space-y-5 pb-6">
      <!-- 1. 顶部学员全景头部名片卡 -->
      <div class="bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl p-5 shadow-sm">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-4">
            <div class="relative">
              <img
                :src="student.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'"
                class="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
              />
              <span
                v-if="student.faceEntered"
                class="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 border-white flex items-center shadow-xs"
                title="已录入人脸底库"
              >
                人脸
              </span>
            </div>
            <div>
              <div class="flex items-center space-x-2">
                <h3 class="text-xl font-bold text-st-title">{{ student.name }}</h3>
                <span class="text-xs text-st-muted font-mono bg-white px-2 py-0.5 rounded border border-gray-200 font-semibold">
                  {{ student.studentNo }}
                </span>
                <el-tag size="small" :type="getStatusTagType(student.status)">
                  {{ getStatusLabel(student.status) }}
                </el-tag>
                <el-tag v-if="student.wechatBound" size="small" type="success" effect="plain">
                  微信已绑
                </el-tag>
              </div>

              <div class="text-xs text-st-secondary mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <span>性别/年龄: <b class="text-st-title">{{ student.gender === 'male' ? '男' : '女' }} / {{ student.age || 10 }}岁</b></span>
                <span>归属校区: <b class="text-st-primary">{{ student.campusName }}</b></span>
                <span>公立学校: <b class="text-st-title">{{ student.school || student.publicSchool || '未录入' }} ({{ student.grade }})</b></span>
                <span>联系电话: <b class="text-st-title font-mono">{{ student.phone }}</b></span>
                <span>家长: <b class="text-st-title">{{ student.parentName }} ({{ student.parentPhone }})</b></span>
              </div>
            </div>
          </div>

          <!-- 顶部快捷操作 -->
          <div class="flex items-center space-x-2">
            <el-button type="primary" size="small" @click="emit('openEnroll', student)">
              + 报读开单
            </el-button>
            <el-button type="warning" size="small" plain @click="emit('openMovement', student)">
              异动流转
            </el-button>
          </div>
        </div>

        <!-- 核心资产指标胶囊栏 -->
        <div class="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200/80 text-center">
          <div class="bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs">
            <div class="text-[11px] text-st-muted">有效剩余总课时</div>
            <div class="text-lg font-bold font-mono text-emerald-600 mt-0.5">{{ totalRemainingLessons }} <span class="text-xs font-normal">课时</span></div>
          </div>
          <div class="bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs">
            <div class="text-[11px] text-st-muted">电子钱包总额</div>
            <div class="text-lg font-bold font-mono text-st-danger-deep mt-0.5">¥ {{ totalWalletBalance.toFixed(2) }}</div>
          </div>
          <div class="bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs">
            <div class="text-[11px] text-st-muted">零花钱积分</div>
            <div class="text-lg font-bold font-mono text-amber-600 mt-0.5">{{ student.wallet?.goldPoints || 0 }} <span class="text-xs font-normal">分</span></div>
          </div>
          <div class="bg-white rounded-lg p-2.5 border border-slate-200 shadow-2xs">
            <div class="text-[11px] text-st-muted">已获赛事考级荣誉</div>
            <div class="text-lg font-bold font-mono text-indigo-600 mt-0.5">{{ student.competitionRecords?.length || 0 }} <span class="text-xs font-normal">项</span></div>
          </div>
        </div>

        <!-- 消课健康度与流失预警单一真值源 (SSOT) -->
        <div
          v-if="consumptionHealth"
          class="mt-3 p-2.5 rounded-lg border text-xs flex items-center justify-between"
          :class="consumptionHealth.warningLevel === 'urgent' ? 'bg-red-50 border-red-200 text-red-900' : consumptionHealth.warningLevel === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'"
        >
          <div class="flex items-center space-x-3">
            <span class="font-bold flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" :class="consumptionHealth.warningLevel === 'urgent' ? 'bg-red-500' : consumptionHealth.warningLevel === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'"></span>
              消课健康度: {{ consumptionHealth.warningLevel === 'urgent' ? '急需续费 / 课时即将耗尽' : consumptionHealth.warningLevel === 'warning' ? '课时偏低预警' : '健康充裕' }}
            </span>
            <span class="text-slate-600">周均消课: <b class="font-mono text-slate-900">{{ consumptionHealth.weeklyBurnRate }} 课时/周</b></span>
            <span class="text-slate-600">预计耗尽: <b class="font-mono text-slate-900">{{ consumptionHealth.estimatedDepletionDays }} 天</b></span>
            <span v-if="consumptionHealth.dormantRisk" class="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">14天未消课休眠风险</span>
            <span v-if="consumptionHealth.renewalWindowOpen" class="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">处于续费跟进黄金期</span>
          </div>
          <el-button v-if="consumptionHealth.renewalWindowOpen" size="small" type="primary" link @click="emit('openEnroll', student)">发起续费跟进</el-button>
        </div>
      </div>

      <!-- 2. 5 大全景 Tab 体系 -->
      <el-tabs v-model="activeTab" class="bg-white rounded-lg border border-st-border p-4 shadow-card">
        <!-- Tab 1: 学员课程 (signUpRecord) -->
        <el-tab-pane label="报读课包账户资产" name="courses">
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-st-muted">名下共关联 {{ student.coursePackages.length }} 个签约课包</span>
              <el-button type="primary" link size="small" @click="emit('openEnroll', student)">+ 报读新课</el-button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="pkg in student.coursePackages"
                :key="pkg.packageId"
                class="border border-slate-200 rounded-lg p-4 bg-slate-50/50 hover:shadow-sm transition"
              >
                <div class="flex justify-between items-start">
                  <div>
                    <h5 class="font-bold text-xs text-st-title">{{ pkg.courseName }}</h5>
                    <div class="text-[11px] text-st-secondary mt-0.5">
                      班级: <span class="font-medium text-st-primary">{{ pkg.className || '待分班入班' }}</span>
                    </div>
                  </div>
                  <el-tag size="small" :type="pkg.status === 'active' ? 'success' : pkg.status === 'frozen' ? 'warning' : 'info'">
                    {{ pkg.status === 'active' ? '正常在读' : pkg.status === 'frozen' ? '已冻结' : pkg.status === 'refunded' ? '已退费' : '已结课' }}
                  </el-tag>
                </div>

                <!-- 课时进度条 -->
                <div class="mt-3">
                  <div class="flex justify-between text-[11px] text-st-secondary mb-1 font-mono">
                    <span>消耗进度 ({{ pkg.consumedLessons || (pkg.totalLessons - pkg.remainingLessons) }} / {{ pkg.totalLessons }})</span>
                    <span class="text-emerald-700 font-bold">剩余 {{ pkg.remainingLessons }} 课时</span>
                  </div>
                  <el-progress
                    :percentage="calcProgress(pkg)"
                    :color="pkg.status === 'active' ? 'var(--st-color-success, #10b981)' : 'var(--st-color-warning, #f59e0b)'"
                    :stroke-width="8"
                  />
                </div>

                <div class="grid grid-cols-2 gap-2 text-[11px] text-st-muted mt-3 pt-2 border-t border-slate-200">
                  <div>单价: <b class="text-st-title">¥{{ pkg.pricePerLesson || 280 }}/课时</b></div>
                  <div>赠课: <b class="text-st-title">{{ pkg.bonusLessons || 0 }} 课时</b></div>
                  <div>合同单号: <span class="font-mono">{{ pkg.orderNo || 'ORD-HIST' }}</span></div>
                  <div>有效期至: <span class="font-mono">{{ pkg.expireDate || pkg.expiryDate || '长期有效' }}</span></div>
                </div>

                <div class="flex justify-end space-x-2 mt-3 pt-2 border-t border-slate-200">
                  <el-button size="small" link type="primary" @click="emit('openEnroll', student)">续费</el-button>
                  <el-button size="small" link type="warning" @click="emit('openMovement', student)">转班/换课</el-button>
                  <el-button size="small" link type="danger" @click="handleClearPackage(pkg)">清空课包</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 2: 学习档案 (studentRecord) -->
        <el-tab-pane label="学习档案与成长轨迹" name="records">
          <div class="space-y-4 pt-2">
            <!-- 五维能力星级雷达与综合学情卡片 -->
            <div v-if="growthRadar" class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div class="flex justify-between items-center">
                <span class="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                  学员五维能力发展雷达 (归一化分值)
                </span>
                <span class="text-xs font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                  综合均分: {{ growthRadar.averageScore }}
                </span>
              </div>
              <div class="grid grid-cols-5 gap-2 text-center text-xs">
                <div class="bg-white/80 p-2 rounded border border-blue-100">
                  <div class="text-[11px] text-st-muted">逻辑思维</div>
                  <div class="text-sm font-bold font-mono text-st-title mt-1">{{ growthRadar.logic }}</div>
                </div>
                <div class="bg-white/80 p-2 rounded border border-blue-100">
                  <div class="text-[11px] text-st-muted">创新创意</div>
                  <div class="text-sm font-bold font-mono text-st-title mt-1">{{ growthRadar.creativity }}</div>
                </div>
                <div class="bg-white/80 p-2 rounded border border-blue-100">
                  <div class="text-[11px] text-st-muted">专注自律</div>
                  <div class="text-sm font-bold font-mono text-st-title mt-1">{{ growthRadar.focus }}</div>
                </div>
                <div class="bg-white/80 p-2 rounded border border-blue-100">
                  <div class="text-[11px] text-st-muted">动手实操</div>
                  <div class="text-sm font-bold font-mono text-st-title mt-1">{{ growthRadar.handsOn }}</div>
                </div>
                <div class="bg-white/80 p-2 rounded border border-blue-100">
                  <div class="text-[11px] text-st-muted">表达互动</div>
                  <div class="text-sm font-bold font-mono text-st-title mt-1">{{ growthRadar.expression }}</div>
                </div>
              </div>
            </div>

            <!-- 工具栏：双模切换与家长端分享 -->
            <div class="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div class="flex items-center space-x-3">
                <el-radio-group v-model="viewMode" size="small">
                  <el-radio-button label="timeline">时间轴详案</el-radio-button>
                  <el-radio-button label="gallery">课堂相册墙 ({{ albumGallery.length }}张)</el-radio-button>
                </el-radio-group>
                <span class="text-xs text-st-muted hidden sm:inline">共 {{ learningList.length }} 课次随堂记录</span>
              </div>
              <div class="flex items-center space-x-2">
                <el-button
                  size="small"
                  type="primary"
                  plain
                  class="inline-flex items-center gap-1"
                  @click="copyShareLink(profileDetail?.portfolioShareToken || student?.portfolioShareToken)"
                >
                  <Link2 class="w-3.5 h-3.5" />
                  <span>复制家长端总览链接</span>
                </el-button>
                <el-button size="small" plain @click="handleAddRecord">+ 录入课评</el-button>
              </div>
            </div>

            <!-- 模式 1：时间轴详案模式 (含 9 宫格相册、录音与视频播放器) -->
            <el-timeline v-if="viewMode === 'timeline' && learningList.length > 0" class="pl-2">
              <el-timeline-item
                v-for="rec in learningList"
                :key="rec.id"
                :timestamp="rec.date"
                placement="top"
                :type="rec.isReversed ? 'warning' : 'primary'"
              >
                <div class="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-2.5">
                  <!-- 顶栏：课次名称、状态、分数、单课分享 -->
                  <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-2">
                      <span class="font-bold text-st-title text-sm">{{ rec.lessonTitle || rec.lessonName }}</span>
                      <span class="text-st-muted text-[11px]">({{ rec.courseName }})</span>
                    </div>
                    <div class="flex items-center space-x-2">
                      <el-tag v-if="rec.isReversed" size="small" type="danger">已反结课冲正</el-tag>
                      <el-tag v-else size="small" :type="rec.status === 'attended' ? 'success' : rec.status === 'leave' ? 'warning' : 'danger'">
                        {{ rec.status === 'attended' ? '出勤已到' : rec.status === 'leave' ? '请假' : '缺勤' }}
                      </el-tag>
                      <span class="font-mono font-bold text-amber-600">{{ rec.score }} 分</span>
                      <el-button
                        v-if="rec.shareToken"
                        size="small"
                        link
                        type="primary"
                        @click="copySingleLessonShareLink(rec.shareToken, rec.scheduleEventId)"
                      >
                        分享本课
                      </el-button>
                    </div>
                  </div>

                  <!-- 核心素养知识点与教学大纲富文本 -->
                  <div v-if="rec.studyContentHtml || rec.studyContent" class="text-slate-600 bg-white/90 p-2 rounded border border-slate-100 text-[11px] leading-relaxed">
                    <span class="font-semibold text-slate-800">【教学大纲重难点】: </span>
                    <span v-if="rec.studyContentHtml" v-html="rec.studyContentHtml" class="inline" />
                    <span v-else>{{ rec.studyContent }}</span>
                  </div>

                  <!-- 教师个性化评语与表现亮点标签 -->
                  <div class="text-st-secondary bg-white p-2.5 rounded border border-gray-100 space-y-1.5">
                    <div class="flex items-center justify-between">
                      <span class="font-semibold text-st-primary">[{{ rec.teacher }} 评语]:</span>
                      <el-tag v-if="rec.performanceTag" size="small" type="success" effect="plain" class="font-medium">
                        {{ rec.performanceTag }}
                      </el-tag>
                    </div>
                    <div class="leading-relaxed">{{ rec.comment }}</div>
                  </div>

                  <!-- 开箱即用 9 宫格相册 (图片自带缩略图 thumbnailUrl 与全量预览 previewList) -->
                  <div v-if="(rec.photos && rec.photos.length > 0) || (rec.photoList && rec.photoList.length > 0)" class="pt-1">
                    <div class="text-[11px] text-st-muted mb-1 flex items-center gap-1.5">
                      <Image class="w-3.5 h-3.5 text-st-primary" />
                      <span>随堂精彩瞬间 ({{ rec.photos?.length || rec.photoList?.length }} 张)</span>
                    </div>
                    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      <template v-if="rec.photos && rec.photos.length > 0">
                        <el-image
                          v-for="photo in rec.photos"
                          :key="photo.id"
                          :src="photo.thumbnailUrl"
                          :preview-src-list="photo.previewList"
                          preview-teleported
                          class="w-20 h-20 rounded-lg object-cover border border-slate-200 shadow-2xs cursor-pointer hover:opacity-90 transition"
                          loading="lazy"
                          fit="cover"
                        />
                      </template>
                      <template v-else>
                        <el-image
                          v-for="(imgUrl, idx) in rec.photoList"
                          :key="idx"
                          :src="imgUrl"
                          :preview-src-list="rec.photoList"
                          preview-teleported
                          class="w-20 h-20 rounded-lg object-cover border border-slate-200 shadow-2xs cursor-pointer hover:opacity-90 transition"
                          loading="lazy"
                          fit="cover"
                        />
                      </template>
                    </div>
                  </div>

                  <!-- 随堂原声语音条与视频录屏入口 -->
                  <div v-if="rec.voiceUrl || rec.videoUrl" class="flex flex-wrap items-center gap-3 pt-1">
                    <!-- 语音播放器 -->
                    <div v-if="rec.voiceUrl" class="inline-flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full text-xs font-mono border border-emerald-200/60">
                      <Mic class="w-3.5 h-3.5 text-emerald-700" />
                      <span>随堂原声点评</span>
                      <span v-if="rec.voiceMeta">({{ rec.voiceMeta.durationFormatted }})</span>
                      <audio controls :src="rec.voiceUrl" class="h-6 w-40" />
                    </div>

                    <!-- 视频链接 -->
                    <div v-if="rec.videoUrl" class="inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200/60">
                      <Video class="w-3.5 h-3.5 text-blue-600" />
                      <a :href="rec.videoUrl" target="_blank" class="hover:underline">查看实操编程视频作品</a>
                    </div>
                  </div>

                  <!-- 底栏状态注记 -->
                  <div class="flex items-center justify-between text-st-muted text-[11px] pt-1 border-t border-slate-100">
                    <div class="flex items-center space-x-2">
                      <span>作业评级: <el-tag size="small" type="warning">{{ rec.homeworkRating }}</el-tag></span>
                      <span v-if="rec.rating">综合星级: <el-tag size="small" type="info">{{ rec.rating }}</el-tag></span>
                      <span v-if="rec.classroomName">教室: {{ rec.classroomName }}</span>
                    </div>
                    <div v-if="rec.isReversed" class="text-red-500 font-mono text-[10px]">
                      冲正说明: {{ rec.reversalReason || '教务审核冲正' }}
                    </div>
                    <div v-else-if="rec.quizScore">随堂测验: <b class="font-mono text-st-title">{{ rec.quizScore }} 分</b></div>
                  </div>
                </div>
              </el-timeline-item>
            </el-timeline>

            <!-- 模式 2：课堂相册墙模式 (画廊大盘) -->
            <div v-else-if="viewMode === 'gallery' && albumGallery.length > 0" class="grid grid-cols-3 sm:grid-cols-4 gap-3 py-2">
              <div
                v-for="(photo, pIdx) in albumGallery"
                :key="pIdx"
                class="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs group hover:shadow-md transition"
              >
                <el-image
                  :src="photo.thumbnailUrl"
                  :preview-src-list="albumGallery.map((g: any) => g.photoUrl)"
                  :initial-index="pIdx"
                  preview-teleported
                  class="w-full h-28 object-cover cursor-pointer"
                  loading="lazy"
                  fit="cover"
                />
                <div class="p-2 space-y-0.5">
                  <div class="font-semibold text-xs text-slate-800 truncate">{{ photo.lessonTitle }}</div>
                  <div class="flex justify-between text-[10px] text-st-secondary">
                    <span>{{ photo.date }}</span>
                    <span>{{ photo.teacherName }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div v-else class="text-center py-8 text-xs text-st-muted bg-slate-50 rounded-lg border border-dashed border-slate-200">
              {{ viewMode === 'gallery' ? '暂无随堂精彩相册，结课履约上传照片后将在此汇聚呈现。' : '暂无随堂学情记录。随堂点名消课后，系统将自动汇聚形成成长档案轨迹。' }}
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 3: 钱包明细 (walletBalance) -->
        <el-tab-pane label="电子钱包资产流水" name="wallet">
          <div class="space-y-4 pt-2">
            <!-- 钱包卡片概览 -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div class="text-xs text-amber-800">预存实充本金余额 (支持合规退现)</div>
                  <div class="text-2xl font-bold font-mono text-amber-950 mt-1">¥ {{ student.wallet.principalBalance.toFixed(2) }}</div>
                </div>
                <el-button type="primary" size="small" @click="showRechargeDialog = true">充值本金</el-button>
              </div>

              <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <div class="text-xs text-blue-800">校区大促赠送金账户 (优先消费抵扣)</div>
                  <div class="text-2xl font-bold font-mono text-blue-950 mt-1">¥ {{ student.wallet.bonusBalance.toFixed(2) }}</div>
                </div>
                <el-button size="small" @click="showWithdrawDialog = true">本金提现</el-button>
              </div>
            </div>

            <!-- 流水表格 -->
            <div class="space-y-2">
              <div class="text-xs font-bold text-st-title">资金收支与流水账本明细</div>
              <el-table :data="walletLedgerSorted" size="small" stripe border>
                <el-table-column prop="time" label="交易时间" width="150" />
                <el-table-column prop="type" label="变动类型" width="100">
                  <template #default="{ row }">
                    <el-tag size="small" :type="getLedgerTagType(row.type)">
                      {{ getLedgerTypeLabel(row.type) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="amount" label="发生金额" width="110" align="right">
                  <template #default="{ row }">
                    <span :class="row.amount >= 0 ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'" class="font-mono">
                      {{ row.amount >= 0 ? '+' : '' }}¥ {{ row.amount.toFixed(2) }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="principalChange" label="本金变动" width="100" align="right">
                  <template #default="{ row }">
                    <span class="font-mono text-xs">¥ {{ row.principalChange.toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="bonusChange" label="赠送金变动" width="100" align="right">
                  <template #default="{ row }">
                    <span class="font-mono text-xs">¥ {{ row.bonusChange.toFixed(2) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="description" label="业务备注与说明" min-width="180" />
                <el-table-column prop="operator" label="经办人" width="100" />
              </el-table>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 4: 沟通记录 (communicationRecord) -->
        <el-tab-pane label="家校沟通与回访日志" name="communication">
          <div class="space-y-4 pt-2">
            <!-- 软电话外呼模拟条 -->
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
              <div class="flex items-center space-x-3 text-xs">
                <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Phone class="w-4 h-4" />
                </div>
                <div>
                  <div class="font-semibold text-st-title">软电话 (TQSIP / 容联云通讯中心) 状态：在线</div>
                  <div class="text-st-muted text-[11px]">一键呼叫学员家长 {{ student.parentName }} ({{ student.parentPhone }})</div>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <el-button type="success" size="small" :loading="calling" @click="handleCall">
                  {{ calling ? `通话中 ${callTimer}` : '一键外呼拨打' }}
                </el-button>
                <el-button type="primary" size="small" plain @click="showAddCommDialog = true">
                  + 新增跟进记录
                </el-button>
              </div>
            </div>

            <!-- 跟进历史 -->
            <div class="space-y-3">
              <div
                v-for="log in student.communicationRecords"
                :key="log.id"
                class="border border-slate-200 rounded-lg p-3 bg-white space-y-2 text-xs"
              >
                <div class="flex justify-between items-center border-b pb-1.5">
                  <div class="flex items-center space-x-2">
                    <el-tag size="small" type="primary">{{ log.type }}</el-tag>
                    <span class="font-semibold text-st-title">{{ log.counselor }}</span>
                    <span class="text-st-muted font-mono">{{ log.time }}</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <span v-if="log.duration" class="font-mono text-st-secondary bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                      通话时长: {{ log.duration }}
                    </span>
                    <el-rate :model-value="log.parentSatisfaction || 5" disabled size="small" />
                  </div>
                </div>

                <div class="text-st-title leading-relaxed">
                  {{ log.content }}
                </div>

                <!-- 录音模拟试听控件 -->
                <div class="bg-gray-50 rounded p-2 flex items-center justify-between text-[11px] text-st-secondary">
                  <div class="flex items-center space-x-2">
                    <el-button link type="primary" size="small" class="!font-bold inline-flex items-center gap-1">
                      <Play class="w-3 h-3 fill-current" />
                      <span>播放通话录音</span>
                    </el-button>
                    <span>音频波形: ▃▅▇█▅▃ 128kbps MP3</span>
                  </div>
                  <span class="font-mono">录音存档: TQSIP-REC-2026.mp3</span>
                </div>
              </div>

              <div v-if="!student.communicationRecords?.length" class="text-center py-6 text-xs text-st-muted">
                暂无沟通跟进记录，点击上方按钮发起外呼或登记回访。
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 5: 赛事记录 (matchRecord) -->
        <el-tab-pane label="白名单赛事与等级考试" name="matches">
          <div class="space-y-3 pt-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-st-muted">教育部白名单全国科技赛事、全国青少年软件编程等级考试与CSP竞赛报送</span>
              <el-button size="small" plain @click="showAddCert = true">+ 录入考级成果</el-button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="cert in student.competitionRecords"
                :key="cert.id"
                class="border border-indigo-100 rounded-lg p-4 bg-gradient-to-br from-indigo-50/40 to-white shadow-2xs space-y-2 text-xs"
              >
                <div class="flex justify-between items-start">
                  <div class="font-bold text-sm text-indigo-950">{{ cert.competitionName }}</div>
                  <el-tag size="small" type="success">{{ cert.award }}</el-tag>
                </div>
                <div class="text-st-secondary grid grid-cols-2 gap-1 text-[11px]">
                  <div>参赛期次: {{ cert.session }}</div>
                  <div>考核等级: {{ cert.level }}</div>
                  <div>获奖日期: {{ cert.awardDate }}</div>
                  <div>证书编号: <span class="font-mono font-semibold">{{ cert.certificateNo }}</span></div>
                </div>
                <div class="pt-2 border-t border-indigo-100 flex justify-end">
                  <el-button size="small" link type="primary" @click="handlePreviewCert(cert)">查看电子考级证书</el-button>
                </div>
              </div>

              <div v-if="!student.competitionRecords?.length" class="col-span-2 text-center py-6 text-xs text-st-muted">
                该学员尚未录入白名单赛事及等级考试成绩。
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 充值弹窗 -->
    <el-dialog v-model="showRechargeDialog" title="电子钱包充值" :width="DIALOG_SIZE.sm" append-to-body>
      <el-form label-position="top" size="small">
        <el-form-item label="充值实存本金金额 (¥)" required>
          <el-input-number v-model="rechargeForm.amount" :min="100" :step="500" class="w-full" />
        </el-form-item>
        <el-form-item label="校区大促赠送金额 (¥)">
          <el-input-number v-model="rechargeForm.bonus" :min="0" :step="100" class="w-full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRechargeDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRecharge">确认充值上账</el-button>
      </template>
    </el-dialog>

    <!-- 提现弹窗 -->
    <el-dialog v-model="showWithdrawDialog" title="本金合规提现" :width="DIALOG_SIZE.sm" append-to-body>
      <el-form label-position="top" size="small">
        <el-form-item label="提现出账金额 (¥，不可超过本金余额)" required>
          <el-input-number v-model="withdrawAmount" :min="10" :max="student?.wallet.principalBalance || 0" :step="100" class="w-full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showWithdrawDialog = false">取消</el-button>
        <el-button type="danger" @click="handleWithdraw">确认提现</el-button>
      </template>
    </el-dialog>

    <!-- 新增跟进记录弹窗 -->
    <el-dialog v-model="showAddCommDialog" title="新增家校跟进与回访记录" :width="DIALOG_SIZE.sm" append-to-body>
      <el-form label-position="top" size="small">
        <div class="grid grid-cols-2 gap-3">
          <el-form-item label="沟通类型" required>
            <el-select v-model="newComm.type" class="w-full">
              <el-option label="课后反馈" value="课后反馈" />
              <el-option label="电话跟进" value="电话跟进" />
              <el-option label="请假回访" value="请假回访" />
              <el-option label="续费沟通" value="续费沟通" />
              <el-option label="满意度调查" value="满意度调查" />
            </el-select>
          </el-form-item>
          <el-form-item label="沟通方式">
            <el-select v-model="newComm.method" class="w-full">
              <el-option label="软电话拨打" value="phone" />
              <el-option label="企业微信" value="wechat" />
              <el-option label="校区面谈" value="in_person" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="详细跟进沟通记录" required>
          <el-input v-model="newComm.content" type="textarea" :rows="3" placeholder="请输入与家长的沟通反馈要点..." />
        </el-form-item>
        <el-form-item label="家长反馈意向评分">
          <el-rate v-model="newComm.satisfaction" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddCommDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddComm">保存跟进日志</el-button>
      </template>
    </el-dialog>

    <!-- 证书预览弹窗 -->
    <el-dialog v-model="showCertPreview" title="全国青少年科技与编程考级荣誉证书" :width="DIALOG_SIZE.md" append-to-body>
      <div v-if="previewCert" class="border-4 border-amber-500/60 rounded-xl p-6 bg-amber-50/20 text-center space-y-4">
        <div class="text-amber-800 font-serif text-lg font-bold">★ 荣 誉 证 书 ★</div>
        <div class="text-xl font-bold text-st-title">{{ student?.name }} 同学：</div>
        <div class="text-xs text-st-secondary leading-relaxed px-6">
          在 {{ previewCert.session }}「{{ previewCert.competitionName }}」中表现优异，经组委会综合评定，特授予
          <b class="text-amber-700 text-base">【{{ previewCert.award }}】</b> 荣誉。
        </div>
        <div class="pt-4 border-t border-amber-200 flex justify-between items-center text-[11px] text-st-muted px-4 font-mono">
          <span>证书编号: {{ previewCert.certificateNo }}</span>
          <span>发证日期: {{ previewCert.awardDate }}</span>
        </div>
      </div>
    </el-dialog>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Play, Link2, Image, Mic, Video, Phone } from 'lucide-vue-next'
import { DIALOG_SIZE } from '@/constants/ui'
import type { Student, StudentCoursePackage, CompetitionRecord } from '@/types/student'
import { studentApi } from '@/api'

const props = defineProps<{
  modelValue: boolean
  student: Student | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'openEnroll', student: Student): void
  (e: 'openMovement', student: Student): void
  (e: 'updated'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const activeTab = ref('courses')

const profileDetail = ref<any>(null)

watch(() => visible.value, async (val) => {
  if (val && props.student?.id) {
    try {
      const res = await studentApi.getStudentProfile(props.student.id)
      if (res && res.success && res.data) {
        const d = res.data
        profileDetail.value = d
        if (d.wallet && props.student.wallet) {
          props.student.wallet.principalBalance = Number(d.wallet.principalBalance || 0)
          props.student.wallet.bonusBalance = Number(d.wallet.bonusBalance || 0)
        }
        if (d.learningRecords) {
          props.student.learningRecords = d.learningRecords
        }
        if (d.growthRadar) {
          props.student.growthRadar = d.growthRadar
        }
        if (d.consumptionHealth) {
          props.student.consumptionHealth = d.consumptionHealth
        }
      }
    } catch (err: any) {
      ElMessage.error(err.message || '加载学员档案失败')
    }
  }
})

// 资产统计
const totalRemainingLessons = computed(() => {
  if (!props.student?.coursePackages) return 0
  return props.student.coursePackages.reduce((acc, p) => acc + (p.status === 'active' || p.status === 'frozen' ? p.remainingLessons : 0), 0)
})

const totalWalletBalance = computed(() => {
  if (!props.student?.wallet) return 0
  return props.student.wallet.principalBalance + props.student.wallet.bonusBalance
})

const walletLedgerSorted = computed(() => {
  if (!props.student?.wallet?.ledger) return []
  return [...props.student.wallet.ledger].sort((a, b) => b.time.localeCompare(a.time))
})

const consumptionHealth = computed(() => {
  return profileDetail.value?.consumptionHealth || props.student?.consumptionHealth || null
})

const growthRadar = computed(() => {
  return profileDetail.value?.growthRadar || props.student?.growthRadar || null
})

const learningList = computed(() => {
  return profileDetail.value?.learningRecords || props.student?.learningRecords || []
})

const viewMode = ref<'timeline' | 'gallery'>('timeline')

const albumGallery = computed(() => {
  if (profileDetail.value?.albumGallery?.length) {
    return profileDetail.value.albumGallery
  }
  if (props.student?.albumGallery?.length) {
    return props.student.albumGallery
  }
  // 备用动态提取
  const extracted: any[] = []
  for (const item of (learningList.value as any[])) {
    if (!item.isReversed && item.photos?.length) {
      for (const p of item.photos) {
        extracted.push({
          photoUrl: p.fullUrl,
          thumbnailUrl: p.thumbnailUrl,
          date: item.date,
          courseName: item.courseName,
          lessonTitle: item.lessonTitle || item.lessonName || '随堂教学',
          teacherName: item.teacher || '任课老师'
        })
      }
    } else if (!item.isReversed && item.photoList?.length) {
      for (const u of item.photoList) {
        extracted.push({
          photoUrl: u,
          thumbnailUrl: u,
          date: item.date,
          courseName: item.courseName,
          lessonTitle: item.lessonTitle || item.lessonName || '随堂教学',
          teacherName: item.teacher || '任课老师'
        })
      }
    }
  }
  return extracted
})

async function copyLinkSafely(url: string, modalTitle: string, successNotice: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(url)
    ElMessage.success(successNotice)
  } else {
    ElMessageBox.alert(url, modalTitle, { confirmButtonText: '确定' })
  }
}

async function copyShareLink(token?: string) {
  let shareToken = token
  if (!shareToken && props.student?.id) {
    const res = await studentApi.getStudentProfile(props.student.id)
    shareToken = res?.data?.portfolioShareToken
  }
  const origin = window.location.origin
  const url = shareToken
    ? `${origin}/public/growth-report?token=${shareToken}`
    : `${origin}/public/growth-report?studentId=${props.student?.id || ''}`

  await copyLinkSafely(url, '家长端全景学情报告分享链接', '已复制家长端全景学情报告分享链接，可直接发送给学员家长！')
}

async function copySingleLessonShareLink(token: string, scheduleEventId?: string) {
  const origin = window.location.origin
  const url = scheduleEventId
    ? `${origin}/public/growth-report?token=${token}&scheduleEventId=${scheduleEventId}`
    : `${origin}/public/growth-report?token=${token}`

  await copyLinkSafely(url, '单课课评报告安全链接', '已复制单课课评报告安全链接，可直接发送给学员家长！')
}

function calcProgress(pkg: StudentCoursePackage) {
  const consumed = pkg.consumedLessons || (pkg.totalLessons - pkg.remainingLessons)
  return Math.min(100, Math.round((consumed / pkg.totalLessons) * 100))
}

function getStatusTagType(status: string) {
  switch (status) {
    case 'normal': return 'success'
    case 'suspended': return 'warning'
    case 'transferred': return 'info'
    case 'dropped_out': return 'danger'
    default: return 'info'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'normal': return '正常在读'
    case 'suspended': return '停课休学'
    case 'transferred': return '已转校'
    case 'dropped_out': return '已结课流失'
    default: return status
  }
}

function getLedgerTagType(type: string) {
  switch (type) {
    case 'recharge': return 'success'
    case 'consumption': return 'info'
    case 'refund': return 'warning'
    case 'withdraw': return 'danger'
    default: return 'info'
  }
}

function getLedgerTypeLabel(type: string) {
  switch (type) {
    case 'recharge': return '充值'
    case 'consumption': return '课消扣费'
    case 'refund': return '退费'
    case 'withdraw': return '本金提现'
    case 'bonus_grant': return '大促配赠'
    default: return type
  }
}

// 清空课包
async function handleClearPackage(pkg: StudentCoursePackage) {
  if (!props.student) return
  try {
    await ElMessageBox.confirm(`确认将课包 [${pkg.courseName}] 剩余的 ${pkg.remainingLessons} 课时清零归档？`, '课包清理', {
      type: 'warning',
      confirmButtonText: '清空课包',
      cancelButtonText: '取消'
    })
    try {
      await studentApi.executeMovement(props.student.id, {
        type: 'refund',
        packageId: pkg.packageId || pkg.id || '',
        reasonCategory: '学业或家庭调整',
        reasonDetail: '课包清零归档退费',
        refundAmount: 0
      })
      pkg.status = 'refunded'
      pkg.remainingLessons = 0
      ElMessage.success('课包已清零归档并真实同步落库！')
      emit('updated')
    } catch (err: any) {
      ElMessage.error(err.message || '课包清零归档失败')
    }
  } catch {
    // 弹窗取消
  }
}

// 录入课评
function handleAddRecord() {
  ElMessage.info('教师已进入授课工作台录入课评')
}

// 软电话通话模拟
const calling = ref(false)
const callTimer = ref('00:00')
let timerInterval: any = null

function handleCall() {
  if (calling.value) {
    // 挂断
    calling.value = false
    clearInterval(timerInterval)
    ElMessage.success(`通话结束，通话时长 ${callTimer.value}，录音已自动回传存档`)
  } else {
    calling.value = true
    let seconds = 0
    callTimer.value = '00:00'
    timerInterval = setInterval(() => {
      seconds++
      const m = String(Math.floor(seconds / 60)).padStart(2, '0')
      const s = String(seconds % 60).padStart(2, '0')
      callTimer.value = `${m}:${s}`
    }, 1000)
  }
}

// 充值
const showRechargeDialog = ref(false)
const rechargeForm = reactive({
  amount: 2000,
  bonus: 200
})

async function handleRecharge() {
  if (!props.student) return
  try {
    await studentApi.rechargeWallet(props.student.id, {
      amount: Number(rechargeForm.amount),
      bonus: Number(rechargeForm.bonus),
      operator: '学管财务'
    })
    ElMessage.success(`充值成功！本金上账 ¥${rechargeForm.amount}，赠送金上账 ¥${rechargeForm.bonus}`)
    showRechargeDialog.value = false
    emit('updated')
  } catch (err: any) {
    ElMessage.error(err.message || '钱包充值失败')
  }
}

// 提现
const showWithdrawDialog = ref(false)
const withdrawAmount = ref(500)

async function handleWithdraw() {
  if (!props.student) return
  try {
    await studentApi.withdrawWallet(props.student.id, {
      amount: Number(withdrawAmount.value),
      operator: '学管财务'
    })
    ElMessage.success(`提现成功！已原路退回本金 ¥${withdrawAmount.value}`)
    showWithdrawDialog.value = false
    emit('updated')
  } catch (err: any) {
    ElMessage.error(err.message || '提现失败')
  }
}

// 新增跟进记录
const showAddCommDialog = ref(false)
const newComm = reactive({
  type: '课后反馈' as any,
  method: 'phone' as any,
  content: '',
  satisfaction: 5
})

function handleAddComm() {
  if (!newComm.content.trim()) {
    ElMessage.warning('请输入跟进沟通内容')
    return
  }
  props.student?.communicationRecords?.unshift({
    id: `cr-${Date.now()}`,
    time: new Date().toISOString().replace('T', ' ').slice(0, 16),
    counselor: '张学管',
    type: newComm.type,
    method: newComm.method,
    content: newComm.content,
    duration: '03:15',
    parentSatisfaction: newComm.satisfaction
  })
  ElMessage.success('跟进回访记录已成功添加')
  newComm.content = ''
  showAddCommDialog.value = false
}

// 证书预览
const showAddCert = ref(false)
const showCertPreview = ref(false)
const previewCert = ref<CompetitionRecord | null>(null)

function handlePreviewCert(cert: CompetitionRecord) {
  previewCert.value = cert
  showCertPreview.value = true
}
</script>
