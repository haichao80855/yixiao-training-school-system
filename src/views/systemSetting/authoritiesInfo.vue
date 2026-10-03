<template>
  <div class="p-5 space-y-4">
    <!-- 1. 机构头部卡片 (严格对照 systemSetting_authoritiesInfo.png) -->
    <div class="bg-white rounded-lg p-5 shadow-card border border-st-border">
      <!-- 面包屑与顶部操作 -->
      <div class="flex items-center justify-between text-xs text-st-muted pb-3 border-b border-st-border">
        <div class="flex items-center space-x-2">
          <span>机构管理</span>
          <span>/</span>
          <span class="text-st-title font-medium">机构信息</span>
        </div>
        <div class="space-x-2">
          <el-button size="small" @click="showTransferAdminModal = true">转让管理员</el-button>
          <el-button type="primary" size="small" @click="showEditOrgModal = true">编辑机构信息</el-button>
        </div>
      </div>

      <!-- 机构核心信息抬头 -->
      <div class="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center space-x-3">
            <h1 class="text-xl font-bold text-st-title tracking-tight">{{ orgMeta.name }}</h1>
            <span class="px-2.5 py-0.5 text-xs font-mono rounded bg-blue-50 text-st-primary border border-blue-200">
              A股上市代码：{{ orgMeta.stockCode }}
            </span>
          </div>
          <!-- 核心属性一览横条 -->
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-xs text-st-secondary">
            <div>
              机构编码：<span class="font-mono text-st-title font-medium">{{ orgMeta.code }}</span>
            </div>
            <div>
              子机构数量：<span class="font-medium text-st-title">{{ orgMeta.childCount }}</span>
            </div>
            <div>
              校区数：<span class="font-medium text-st-title">{{ orgMeta.campusCount }} / 5</span>
            </div>
            <div>
              机构成员数：<span class="font-medium text-st-title">{{ systemUsers.length }} / {{ orgMeta.memberLimit }}</span>
            </div>
            <div>
              系统超级管理员：<span class="font-medium text-st-primary">{{ orgMeta.adminName }}</span>
            </div>
            <div>
              授权有效期至：<span class="font-mono font-medium text-emerald-600">{{ orgMeta.validUntil }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 导航 Tabs (对照设计稿与截图：机构架构、LOGO设置、授权产品) -->
      <div class="mt-4 border-t border-st-border pt-2">
        <el-tabs v-model="activeTab" class="st-tabs">
          <el-tab-pane label="机构信息与组织架构" name="org" />
          <el-tab-pane label="LOGO设置与品牌" name="logo" />
          <el-tab-pane label="授权产品与微服务" name="product" />
        </el-tabs>
      </div>
    </div>

    <!-- 2. TAB: LOGO 设置与品牌 (还原截图专属界面) -->
    <div v-if="activeTab === 'logo'" class="bg-white rounded-lg p-6 shadow-card border border-st-border space-y-6">
      <div class="border-b border-st-border pb-4">
        <h3 class="text-sm font-bold text-st-title">机构品牌 LOGO 配置</h3>
        <p class="text-xs text-st-muted mt-1">配置一校教培系统各端系统顶栏、移动端App及学员专属纸质评测报告的品牌 LOGO</p>
      </div>

      <div class="space-y-6 max-w-2xl">
        <!-- 上传系统LOGO -->
        <div>
          <label class="block text-xs font-medium text-st-title mb-2">
            <span class="text-rose-500 mr-1">*</span>系统顶栏 LOGO (浅色背景)
          </label>
          <div class="flex items-center space-x-4">
            <div class="w-48 h-16 border-2 border-dashed border-st-border rounded-lg flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/50 hover:border-st-primary transition cursor-pointer">
              <el-icon class="text-xl text-st-muted"><Plus /></el-icon>
              <span class="text-[11px] text-st-muted mt-1">点击上传 LOGO</span>
            </div>
            <div class="text-xs text-st-muted leading-relaxed">
              <p>建议上传图片尺寸为 <span class="font-mono text-st-title">200*66</span> 像素，大小不超过 1MB。</p>
              <p>格式限定为 <span class="font-mono text-st-title">png、jpg</span> 格式，建议透明底 PNG 获得最佳展示效果。</p>
            </div>
          </div>
        </div>

        <!-- 小图标 LOGO -->
        <div>
          <label class="block text-xs font-medium text-st-title mb-2">
            浏览器 Favicon 与收起态微图标
          </label>
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 border-2 border-dashed border-st-border rounded-lg flex items-center justify-center bg-slate-50 hover:bg-blue-50/50 hover:border-st-primary transition cursor-pointer">
              <el-icon class="text-base text-st-muted"><Plus /></el-icon>
            </div>
            <div class="text-xs text-st-muted leading-relaxed">
              <p>建议上传图片尺寸为 <span class="font-mono text-st-title">30*30</span> 像素，大小不超过 1MB，限定 png/jpg 格式。</p>
            </div>
          </div>
        </div>

        <!-- 用户报告LOGO -->
        <div>
          <label class="block text-xs font-medium text-st-title mb-2">
            <span class="text-rose-500 mr-1">*</span>学员测评与学习报告专属 LOGO
          </label>
          <div class="flex items-center space-x-4">
            <div class="w-64 h-20 border-2 border-dashed border-st-border rounded-lg flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/50 hover:border-st-primary transition cursor-pointer">
              <el-icon class="text-xl text-st-muted"><Plus /></el-icon>
              <span class="text-[11px] text-st-muted mt-1">点击上传报告抬头 LOGO</span>
            </div>
            <div class="text-xs text-st-muted leading-relaxed">
              <p>建议上传图片尺寸为 <span class="font-mono text-st-title">302*94</span> 像素，大小不超过 1MB。</p>
              <p>打印输出至 A4 测评报告抬头，格式限定为 png、jpg 格式。</p>
            </div>
          </div>
        </div>

        <div class="pt-4">
          <el-button type="primary" size="small" @click="saveLogoConfig">保存品牌配置</el-button>
        </div>
      </div>
    </div>

    <!-- 3. TAB: 授权产品与微服务 -->
    <div v-else-if="activeTab === 'product'" class="bg-white rounded-lg p-6 shadow-card border border-st-border space-y-4">
      <div class="border-b border-st-border pb-4">
        <h3 class="text-sm font-bold text-st-title">SaaS 授权产品与微服务矩阵</h3>
        <p class="text-xs text-st-muted mt-1">当前机构已激活开通的拓视未来教育教培业务系统产品与硬件协同模块</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div
          v-for="prod in authorizedProducts"
          :key="prod.name"
          class="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded bg-blue-100 text-st-primary flex items-center justify-center font-bold">
                {{ prod.icon }}
              </div>
              <div>
                <h4 class="font-bold text-st-title">{{ prod.name }}</h4>
                <span class="text-[11px] text-st-muted">{{ prod.code }}</span>
              </div>
            </div>
            <el-tag :type="prod.status === 'active' ? 'success' : 'info'" size="small">
              {{ prod.status === 'active' ? '服务生效中' : '未开通' }}
            </el-tag>
          </div>
          <p class="text-st-secondary text-[11px] leading-relaxed">{{ prod.desc }}</p>
          <div class="text-[11px] text-st-muted border-t border-slate-200 pt-2 flex justify-between">
            <span>授权终端：{{ prod.terminal }}</span>
            <span class="font-mono text-emerald-600">至 {{ prod.expire }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. TAB: 机构信息与 5 级组织架构主管理视图 -->
    <div v-else class="space-y-4">
      <!-- 4 大统计指标卡片 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded-lg shadow-card border border-st-border flex items-center justify-between">
          <div>
            <div class="text-xs text-st-muted font-medium">直营与加盟校区</div>
            <div class="text-2xl font-bold text-st-title mt-1 font-mono">
              5 <span class="text-xs font-normal text-st-muted">个实体校区</span>
            </div>
            <div class="text-[11px] text-emerald-600 mt-1">100% 覆盖北京重点商圈</div>
          </div>
          <div class="w-11 h-11 rounded-lg bg-blue-50 text-st-primary flex items-center justify-center text-xl">
            <el-icon><School /></el-icon>
          </div>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-card border border-st-border flex items-center justify-between">
          <div>
            <div class="text-xs text-st-muted font-medium">系统激活员工数</div>
            <div class="text-2xl font-bold text-st-title mt-1 font-mono">
              {{ systemUsers.length }} <span class="text-xs font-normal text-st-muted">/ 128 人</span>
            </div>
            <div class="text-[11px] text-st-muted mt-1">在职在岗已全量实名</div>
          </div>
          <div class="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <el-icon><User /></el-icon>
          </div>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-card border border-st-border flex items-center justify-between">
          <div>
            <div class="text-xs text-st-muted font-medium">教研标准化课系</div>
            <div class="text-2xl font-bold text-st-title mt-1 font-mono">
              4 <span class="text-xs font-normal text-st-muted">大科目体系</span>
            </div>
            <div class="text-[11px] text-st-muted mt-1">乐高创客/Scratch/Python/C++</div>
          </div>
          <div class="w-11 h-11 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
            <el-icon><Reading /></el-icon>
          </div>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-card border border-st-border flex items-center justify-between">
          <div>
            <div class="text-xs text-st-muted font-medium">系统集群运维状态</div>
            <div class="text-2xl font-bold text-emerald-600 mt-1 flex items-center space-x-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>正常运行</span>
            </div>
            <div class="text-[11px] text-st-muted mt-1 font-mono">99.99% 高可用服务</div>
          </div>
          <div class="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            <el-icon><Monitor /></el-icon>
          </div>
        </div>
      </div>

      <!-- 5 级组织架构树 与 人员列表 左右分栏 -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- 左侧：5 级组织架构层级树 (占 5 列) -->
        <div class="lg:col-span-5 bg-white rounded-lg p-4 shadow-card border border-st-border flex flex-col">
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-st-border">
            <div>
              <h3 class="text-sm font-bold text-st-title">5 级组织架构树</h3>
              <p class="text-[11px] text-st-muted mt-0.5">集团 > 大区 > 校区 > 部门 > 岗位职务</p>
            </div>
            <div class="space-x-1">
              <el-button link type="primary" size="small" @click="expandAll = !expandAll">
                {{ expandAll ? '全部折叠' : '全部展开' }}
              </el-button>
              <el-button type="primary" size="small" @click="openAddNodeDialog(null)">
                + 新增节点
              </el-button>
            </div>
          </div>

          <!-- 树形结构展示 -->
          <div class="flex-1 overflow-y-auto max-h-[640px] pr-1">
            <el-tree
              ref="orgTreeRef"
              :data="orgTree"
              node-key="id"
              :default-expand-all="expandAll"
              :expand-on-click-node="false"
              highlight-current
              :props="{ label: 'name', children: 'children' }"
              @node-click="handleNodeClick"
              class="st-org-tree text-xs"
            >
              <template #default="{ data }">
                <div class="flex items-center justify-between w-full py-1 pr-2 group">
                  <div class="flex items-center space-x-1.5 overflow-hidden">
                    <!-- 层级 Badge -->
                    <span
                      :class="[
                        'text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0',
                        getLevelTagClass(data.level)
                      ]"
                    >
                      {{ getLevelName(data.level) }}
                    </span>
                    <!-- 节点名称 -->
                    <span
                      :class="[
                        'truncate text-xs',
                        selectedNodeId === data.id ? 'font-bold text-st-primary' : 'text-st-title'
                      ]"
                      :title="data.name"
                    >
                      {{ data.name }}
                    </span>
                  </div>

                  <!-- 右侧信息与操作按钮组 -->
                  <div class="flex items-center space-x-1.5 shrink-0 ml-2">
                    <span
                      class="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-st-muted group-hover:hidden"
                      :title="`在职员工数：${data.boundUserCount || 0}`"
                    >
                      {{ data.boundUserCount || 0 }}人
                    </span>

                    <!-- Hover 时展示操作动作 -->
                    <div class="hidden group-hover:flex items-center space-x-1">
                      <el-button
                        v-if="data.level < 5"
                        link
                        type="primary"
                        size="small"
                        class="!text-xs !p-0.5"
                        title="添加下级子节点"
                        @click.stop="openAddNodeDialog(data)"
                      >
                        <el-icon><Plus /></el-icon>
                      </el-button>
                      <el-button
                        v-if="data.level > 1"
                        link
                        type="danger"
                        size="small"
                        class="!text-xs !p-0.5"
                        title="删除该节点 (触发风控校验)"
                        @click.stop="handleDeleteNode(data)"
                      >
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </div>
                </div>
              </template>
            </el-tree>
          </div>

          <!-- 底部提示 -->
          <div class="mt-3 pt-2 border-t border-slate-100 text-[11px] text-st-muted flex items-center justify-between">
            <span>点击节点联动右侧人员</span>
            <span class="text-amber-600 font-medium">根节点/含下级/含在职员工严禁删除</span>
          </div>
        </div>

        <!-- 右侧：校区与部门人员联动列表 (占 7 列) -->
        <div class="lg:col-span-7 bg-white rounded-lg p-4 shadow-card border border-st-border flex flex-col space-y-3">
          <!-- 头部标题与统计 -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-st-border gap-2">
            <div>
              <div class="flex items-center space-x-2">
                <h3 class="text-sm font-bold text-st-title">
                  {{ selectedNode ? selectedNode.name : '全集团' }} - 人员管理
                </h3>
                <span class="px-2 py-0.5 text-xs rounded bg-blue-50 text-st-primary font-medium">
                  共 {{ filteredUsers.length }} 名员工
                </span>
              </div>
              <p class="text-[11px] text-st-muted mt-0.5">
                当前筛选范围：{{ selectedNode ? `${getLevelName(selectedNode.level)} [${selectedNode.name}] 及其直属岗位人员` : '全集团在职人员' }}
              </p>
            </div>
            <div class="flex items-center space-x-2">
              <el-button v-if="selectedNode" size="small" @click="resetNodeSelection">
                重置查看全员
              </el-button>
              <el-button type="primary" size="small" @click="openAddUserDialog">
                + 新增员工
              </el-button>
            </div>
          </div>

          <!-- 筛选工具栏 -->
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索姓名、账号或手机号"
              prefix-icon="Search"
              size="small"
              clearable
              class="!w-48"
            />
            <el-select v-model="filterCampusId" placeholder="管辖校区" size="small" clearable class="!w-32">
              <el-option label="全部校区" value="" />
              <el-option label="总部校区" value="campus-bj-hq" />
              <el-option label="远洋校区" value="campus-bj-yy" />
              <el-option label="朝阳校区" value="campus-bj-cy" />
              <el-option label="海淀分校" value="campus-bj-hd" />
              <el-option label="望京校区" value="campus-bj-wj" />
            </el-select>
            <el-select v-model="filterRoleId" placeholder="角色组" size="small" clearable class="!w-32">
              <el-option label="全部角色" value="" />
              <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
            </el-select>
            <el-select v-model="filterStatus" placeholder="账号状态" size="small" clearable class="!w-24">
              <el-option label="全部" value="" />
              <el-option label="正常" value="active" />
              <el-option label="锁定" value="locked" />
            </el-select>
          </div>

          <!-- 人员表格 -->
          <div class="flex-1 overflow-x-auto">
            <el-table
              :data="filteredUsers"
              style="width: 100%"
              stripe
              size="small"
              row-key="id"
              class="st-staff-table text-xs"
            >
              <el-table-column prop="name" label="姓名" width="95">
                <template #default="{ row }">
                  <div class="font-medium text-st-title">{{ row.name }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="account" label="登录账号" width="105" font-mono />
              <el-table-column prop="phone" label="手机号码" width="115" font-mono />
              <el-table-column prop="campusName" label="管辖校区" width="100">
                <template #default="{ row }">
                  <el-tag size="small" type="info" effect="plain">{{ row.campusName }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="roleName" label="归属角色组" min-width="130">
                <template #default="{ row }">
                  <span class="text-st-regular">{{ row.roleName }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="postName" label="岗位职务" min-width="120">
                <template #default="{ row }">
                  <span class="text-st-secondary text-[11px]">{{ row.departmentName }} / {{ row.postName }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="dataScope" label="数据范围" width="85">
                <template #default="{ row }">
                  <span
                    :class="[
                      'text-[10px] px-1.5 py-0.5 rounded font-mono',
                      getDataScopeBadgeClass(row.dataScope)
                    ]"
                  >
                    {{ getDataScopeLabel(row.dataScope) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="75">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
                    {{ row.status === 'active' ? '正常' : '锁定' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="220" fixed="right">
                <template #default="{ row }">
                  <el-button link type="success" size="small" @click="handleQuickSwitchUser(row)" title="以该员工身份快速登录体验">
                    体验
                  </el-button>
                  <el-button link type="primary" size="small" @click="openResetPassword(row)">
                    改密
                  </el-button>
                  <el-button link type="primary" size="small" @click="openUserAuthDrawer(row)">
                    权限
                  </el-button>
                  <el-button
                    link
                    :type="row.status === 'active' ? 'warning' : 'success'"
                    size="small"
                    @click="handleToggleUserStatus(row)"
                  >
                    {{ row.status === 'active' ? '锁定' : '启用' }}
                  </el-button>
                  <el-button link type="danger" size="small" @click="handleDeleteUser(row)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. 弹窗: 新增组织节点 -->
    <el-dialog
      v-model="showAddNodeDialog"
      :title="addNodeParent ? `在 [${addNodeParent.name}] 下新建下级节点` : '新建组织架构节点'"
      width="480px"
      destroy-on-close
    >
      <el-form :model="nodeForm" label-width="95px" size="small" class="pt-2">
        <el-form-item label="上级节点">
          <el-input :value="addNodeParent ? addNodeParent.name : '集团总部 (顶级)'" disabled />
        </el-form-item>
        <el-form-item label="节点层级">
          <el-tag size="small" :class="getLevelTagClass(computedNewNodeLevel)">
            第 {{ computedNewNodeLevel }} 级 - {{ getLevelName(computedNewNodeLevel) }}
          </el-tag>
        </el-form-item>
        <el-form-item label="节点名称" required>
          <el-input v-model="nodeForm.name" placeholder="如：少儿编程创新教研室" />
        </el-form-item>
        <el-form-item label="组织编码" required>
          <el-input v-model="nodeForm.code" placeholder="如：HQ-EDU-DEV01" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="nodeForm.leader" placeholder="填写节点负责人姓名" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="nodeForm.phone" placeholder="负责人工作电话" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showAddNodeDialog = false">取消</el-button>
        <el-button type="primary" size="small" @click="submitAddNode">确定新建</el-button>
      </template>
    </el-dialog>

    <!-- 6. 弹窗: 新增系统员工 -->
    <el-dialog v-model="showAddUserDialog" title="新增系统在职员工" width="540px" destroy-on-close>
      <el-form :model="userForm" label-width="95px" size="small" class="pt-2">
        <div class="grid grid-cols-2 gap-x-3">
          <el-form-item label="员工姓名" required>
            <el-input v-model="userForm.name" placeholder="真实姓名" />
          </el-form-item>
          <el-form-item label="登录账号" required>
            <el-input v-model="userForm.account" placeholder="英文字符登录账号" />
          </el-form-item>
        </div>
        <div class="grid grid-cols-2 gap-x-3">
          <el-form-item label="手机号码" required>
            <el-input v-model="userForm.phone" placeholder="11位手机号码" />
          </el-form-item>
          <el-form-item label="电子邮箱">
            <el-input v-model="userForm.email" placeholder="工作邮箱" />
          </el-form-item>
        </div>
        <div class="grid grid-cols-2 gap-x-3">
          <el-form-item label="管辖校区" required>
            <el-select v-model="userForm.campusId" class="w-full" @change="onCampusChangeInForm">
              <el-option label="总部校区" value="campus-bj-hq" />
              <el-option label="远洋校区" value="campus-bj-yy" />
              <el-option label="朝阳校区" value="campus-bj-cy" />
              <el-option label="海淀分校" value="campus-bj-hd" />
              <el-option label="望京校区" value="campus-bj-wj" />
            </el-select>
          </el-form-item>
          <el-form-item label="归属部门" required>
            <el-input v-model="userForm.departmentName" placeholder="如：教务教学部" />
          </el-form-item>
        </div>
        <div class="grid grid-cols-2 gap-x-3">
          <el-form-item label="岗位职务" required>
            <el-input v-model="userForm.postName" placeholder="如：少儿编程讲师" />
          </el-form-item>
          <el-form-item label="分配角色" required>
            <el-select v-model="userForm.roleId" class="w-full" @change="onRoleChangeInForm">
              <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="数据透视范围" required>
          <el-radio-group v-model="userForm.dataScope">
            <el-radio value="all">全校区 (all)</el-radio>
            <el-radio value="campus">本校区 (campus)</el-radio>
            <el-radio value="department">本部门 (dept)</el-radio>
            <el-radio value="self">仅本人 (self)</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showAddUserDialog = false">取消</el-button>
        <el-button type="primary" size="small" @click="submitAddUser">确认录入</el-button>
      </template>
    </el-dialog>

    <!-- 7. 弹窗: 重置密码 -->
    <el-dialog v-model="showResetPasswordDialog" title="重置员工密码" width="400px">
      <div class="text-xs space-y-3 pt-2">
        <p class="text-st-title">
          正在为员工 <span class="font-bold text-st-primary">{{ activeUser?.name }}</span> ({{ activeUser?.account }}) 重置密码：
        </p>
        <el-input v-model="newPassword" type="password" show-password placeholder="请输入重置后的密码" size="small" />
        <p class="text-[11px] text-st-muted">建议设置包含英文字母与数字的高安全性密码，员工下次登录须强制改密。</p>
      </div>
      <template #footer>
        <el-button size="small" @click="showResetPasswordDialog = false">取消</el-button>
        <el-button type="primary" size="small" @click="submitResetPassword">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- 8. 抽屉: 用户权限与数据范围配置 -->
    <el-drawer v-model="showAuthDrawer" title="员工角色与数据权限配置" size="420px">
      <div v-if="activeUser" class="space-y-4 text-xs">
        <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div class="font-bold text-st-title text-sm">{{ activeUser.name }}</div>
          <div class="text-st-muted mt-1 font-mono text-[11px]">
            账号：{{ activeUser.account }} | 手机：{{ activeUser.phone }}
          </div>
          <div class="text-st-secondary mt-1">
            归属：{{ activeUser.campusName }} · {{ activeUser.departmentName }} · {{ activeUser.postName }}
          </div>
        </div>

        <div>
          <label class="block font-medium text-st-title mb-2">绑定系统角色组</label>
          <el-select v-model="activeUser.roleId" class="w-full" size="small" @change="onAuthDrawerRoleChange">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </div>

        <div>
          <label class="block font-medium text-st-title mb-2">数据透视隔离范围 (Data Scope)</label>
          <div class="space-y-2">
            <div
              v-for="scope in dataScopeOptions"
              :key="scope.value"
              @click="activeUser.dataScope = scope.value"
              :class="[
                'p-2.5 rounded border cursor-pointer transition flex items-start space-x-2.5',
                activeUser.dataScope === scope.value
                  ? 'border-st-primary bg-blue-50/50 text-st-primary'
                  : 'border-slate-200 hover:bg-slate-50 text-st-title'
              ]"
            >
              <el-radio :value="scope.value" :model-value="activeUser.dataScope" class="!mr-0 mt-0.5" />
              <div>
                <div class="font-bold text-xs">{{ scope.label }}</div>
                <div class="text-[11px] text-st-muted mt-0.5">{{ scope.desc }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="pt-4 border-t border-slate-100 flex justify-end space-x-2">
          <el-button size="small" @click="showAuthDrawer = false">取消</el-button>
          <el-button type="primary" size="small" @click="saveUserAuth">保存配置</el-button>
        </div>
      </div>
    </el-drawer>

    <!-- 9. 弹窗: 转让超级管理员 -->
    <el-dialog v-model="showTransferAdminModal" title="转让超级管理员最高权限" width="460px">
      <div class="text-xs space-y-3 pt-2">
        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 flex items-start space-x-2">
          <el-icon class="text-base text-amber-600 shrink-0 mt-0.5"><WarningFilled /></el-icon>
          <div class="text-[11px] leading-relaxed">
            <strong>风险警告：</strong>转让超级管理员后，您的账号将自动降级为普通校长角色，接收方员工将获得集团全量业务审批与组织根节点控制权！
          </div>
        </div>
        <div>
          <label class="block font-medium text-st-title mb-1">选择接收转让的在职员工</label>
          <el-select v-model="transferTargetUserId" placeholder="请选择员工" class="w-full" size="small">
            <el-option
              v-for="u in systemUsers.filter(u => u.account !== 'donghaichao')"
              :key="u.id"
              :label="`${u.name} (${u.account} - ${u.campusName})`"
              :value="u.id"
            />
          </el-select>
        </div>
        <div>
          <label class="block font-medium text-st-title mb-1">请输入当前超管密码确认</label>
          <el-input v-model="transferConfirmPassword" type="password" placeholder="验证当前登录密码" size="small" />
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="showTransferAdminModal = false">取消</el-button>
        <el-button type="danger" size="small" @click="submitTransferAdmin">确认转让</el-button>
      </template>
    </el-dialog>

    <!-- 10. 弹窗: 编辑机构基本信息 -->
    <el-dialog v-model="showEditOrgModal" title="编辑机构工商与授权信息" width="500px">
      <el-form :model="orgMeta" label-width="95px" size="small" class="pt-2">
        <el-form-item label="机构全称" required>
          <el-input v-model="orgMeta.name" />
        </el-form-item>
        <el-form-item label="上市代码">
          <el-input v-model="orgMeta.stockCode" />
        </el-form-item>
        <el-form-item label="机构编码">
          <el-input v-model="orgMeta.code" disabled />
        </el-form-item>
        <el-form-item label="法人代表">
          <el-input v-model="orgMeta.legalPerson" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="orgMeta.phone" />
        </el-form-item>
        <el-form-item label="授权有效期">
          <el-input v-model="orgMeta.validUntil" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="showEditOrgModal = false">取消</el-button>
        <el-button type="primary" size="small" @click="saveOrgMeta">保存修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/authStore'
import { systemApi } from '@/api'
import {
  School,
  User,
  Reading,
  Monitor,
  Plus,
  Delete,
  WarningFilled
} from '@element-plus/icons-vue'
import type { OrgNode, SystemUser, DataScope } from '@/types/system'
import {
  MOCK_ORG_NODES,
  MOCK_SYSTEM_USER_LIST,
  MOCK_ROLES_LIST,
  RBACEngine,
  addOrgNode,
  deleteOrgNode,
  addSystemUser,
  deleteSystemUser,
  resetUserPassword,
  toggleUserStatus,
  updateSystemUser,
  restoreSystemUsersFromStorage
} from '@/mocks/system'

// --- 状态定义 ---
const router = useRouter()
const authStore = useAuthStore()
const activeTab = ref<'org' | 'logo' | 'product'>('org')
const expandAll = ref(true)
const orgTreeRef = ref()
// 机构元数据
const orgMeta = reactive({
  name: '北京拓视未来教育科技集团股份有限公司',
  code: 'QD2023111500002',
  stockCode: '002599',
  childCount: 0,
  campusCount: 5,
  memberLimit: 128,
  adminName: '冬海潮',
  validUntil: '2028-12-31',
  legalPerson: '贾洪波',
  phone: '010-88880000'
})

// 组织架构树与员工数据 (响应式内存状态)
const orgTree = ref<OrgNode[]>(MOCK_ORG_NODES)
const systemUsers = ref<SystemUser[]>(MOCK_SYSTEM_USER_LIST)
const roles = ref(MOCK_ROLES_LIST)

async function loadData() {
  try {
    const [treeRes, usersRes, rolesRes, companyRes] = await Promise.all([
      systemApi.getOrgTree(MOCK_ORG_NODES),
      systemApi.getUsers({}, MOCK_SYSTEM_USER_LIST),
      systemApi.getRoles(MOCK_ROLES_LIST),
      systemApi.getCompanyInfo(orgMeta)
    ])
    if (treeRes && treeRes.success && Array.isArray(treeRes.data) && treeRes.data.length > 0) {
      orgTree.value = treeRes.data
    }
    if (usersRes && usersRes.success && Array.isArray(usersRes.data) && usersRes.data.length > 0) {
      systemUsers.value = usersRes.data
    }
    if (rolesRes && rolesRes.success && Array.isArray(rolesRes.data) && rolesRes.data.length > 0) {
      roles.value = rolesRes.data
    }
    if (companyRes && companyRes.success && companyRes.data) {
      Object.assign(orgMeta, companyRes.data)
    }
  } catch (err) {
    console.warn('[AuthoritiesInfo] 远程接口未就绪，使用本地双轨模式:', err)
  }
}

// 当前选中组织树节点
const selectedNode = ref<OrgNode | null>(null)
const selectedNodeId = computed(() => selectedNode.value?.id || '')

// 筛选字段
const searchKeyword = ref('')
const filterCampusId = ref('')
const filterRoleId = ref('')
const filterStatus = ref('')

// 弹窗与抽屉控制
const showAddNodeDialog = ref(false)
const addNodeParent = ref<OrgNode | null>(null)
const nodeForm = reactive({
  name: '',
  code: '',
  leader: '',
  phone: ''
})

const showAddUserDialog = ref(false)
const userForm = reactive({
  name: '',
  account: '',
  phone: '',
  email: '',
  campusId: 'campus-bj-hq',
  campusName: '总部校区',
  departmentId: 'dept-hq-edu',
  departmentName: '教务教学部',
  postId: 'post-hq-teacher',
  postName: '少儿编程金牌讲师',
  roleId: 'r4',
  roleName: '少儿编程专职主讲教师',
  dataScope: 'self' as DataScope
})

const showResetPasswordDialog = ref(false)
const activeUser = ref<SystemUser | null>(null)
const newPassword = ref('123456')

const showAuthDrawer = ref(false)
const showTransferAdminModal = ref(false)
const transferTargetUserId = ref('')
const transferConfirmPassword = ref('')

const showEditOrgModal = ref(false)

// 数据范围选项
const dataScopeOptions: { value: DataScope; label: string; desc: string }[] = [
  { value: 'all', label: '全部校区数据 (all)', desc: '穿透全集团所有 5 所校区数据，集团管理层专属' },
  { value: 'campus', label: '仅本校区数据 (campus)', desc: '仅透视所属实体校区内全部业务数据，分校校长专属' },
  { value: 'department', label: '仅本部门数据 (department)', desc: '限制在所属业务部门与教研组范围内，主管级专属' },
  { value: 'self', label: '仅本人数据 (self)', desc: '严格隔离仅可查阅自己名下的学员与考勤排课，专职教师专属' }
]

// 授权产品列表
const authorizedProducts = [
  { icon: '研', name: '教研标准化课系中心', code: 'PROD-CURR-V5', status: 'active', desc: '支持4级课程大纲、微立体封面、三步向导与跨校区穿梭授权', terminal: 'Web端/iPad', expire: '2028-12-31' },
  { icon: '学', name: '学员全生命周期 CRM', code: 'PROD-STU-V3', status: 'active', desc: '360°画像全景抽屉、签约开单、电子钱包及7分支异动状态机', terminal: 'Web端/顾问端', expire: '2028-12-31' },
  { icon: '务', name: '7×15 智能排课与考勤', code: 'PROD-EDU-V4', status: 'active', desc: '毫秒级三维动态防撞检测、Lane染色多列并列自适应算法与消课冲正', terminal: 'Web端/讲台端', expire: '2028-12-31' },
  { icon: '财', name: '财务流水与多级审批流', code: 'PROD-FIN-V2', status: 'active', desc: '3×8高密度筛选矩阵、小计统计横条、资金营收与退费多级核批', terminal: 'Web端/财务ERP', expire: '2028-12-31' },
  { icon: '脸', name: '点学客户端人脸考勤', code: 'PROD-FACE-AI', status: 'active', desc: '支持校区前台离线/在线活体人脸识别打卡消课', terminal: '安卓/点学一体机', expire: '2027-06-30' },
  { icon: '签', name: '法大大电子签约中心', code: 'PROD-E-PACT', status: 'active', desc: '家长微信在线签署电子培训服务协议与法律存证', terminal: '移动端/微信H5', expire: '2027-12-31' }
]

// --- 辅助方法 ---
function getLevelName(level: number): string {
  switch (level) {
    case 1: return '集团'
    case 2: return '大区'
    case 3: return '校区'
    case 4: return '部门'
    case 5: return '岗位'
    default: return '单元'
  }
}

function getLevelTagClass(level: number): string {
  switch (level) {
    case 1: return 'bg-purple-100 text-purple-700'
    case 2: return 'bg-blue-100 text-blue-700'
    case 3: return 'bg-emerald-100 text-emerald-700'
    case 4: return 'bg-amber-100 text-amber-700'
    case 5: return 'bg-slate-100 text-slate-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getDataScopeLabel(scope: DataScope): string {
  switch (scope) {
    case 'all': return '全部校区'
    case 'campus': return '本校区'
    case 'department': return '本部门'
    case 'self': return '仅本人'
    default: return scope
  }
}

function getDataScopeBadgeClass(scope: DataScope): string {
  switch (scope) {
    case 'all': return 'bg-purple-50 text-purple-600 border border-purple-200'
    case 'campus': return 'bg-blue-50 text-st-primary border border-blue-200'
    case 'department': return 'bg-amber-50 text-amber-600 border border-amber-200'
    case 'self': return 'bg-slate-100 text-slate-600 border border-slate-200'
    default: return 'bg-gray-50 text-gray-600'
  }
}

const computedNewNodeLevel = computed(() => {
  return addNodeParent.value ? addNodeParent.value.level + 1 : 2
})

// --- 人员过滤计算属性 ---
const filteredUsers = computed(() => {
  let list = [...systemUsers.value]

  // 1. 组织树节点联动过滤
  if (selectedNode.value) {
    const node = selectedNode.value
    if (node.level === 3) {
      // 选中了校区
      list = list.filter(u => u.campusId === node.id || node.name.includes(u.campusName))
    } else if (node.level === 4) {
      // 选中了部门
      list = list.filter(u => u.departmentId === node.id || node.name.includes(u.departmentName))
    } else if (node.level === 5) {
      // 选中了岗位
      list = list.filter(u => u.postId === node.id || node.name.includes(u.postName))
    }
    // level 1, 2 显示全量或大区
  }

  // 2. 校区下拉框过滤
  if (filterCampusId.value) {
    list = list.filter(u => u.campusId === filterCampusId.value)
  }

  // 3. 角色下拉框过滤
  if (filterRoleId.value) {
    list = list.filter(u => u.roleId === filterRoleId.value)
  }

  // 4. 账号状态过滤
  if (filterStatus.value) {
    list = list.filter(u => u.status === filterStatus.value)
  }

  // 5. 关键词搜索
  if (searchKeyword.value) {
    const kw = searchKeyword.value.toLowerCase().trim()
    list = list.filter(
      u => u.name.toLowerCase().includes(kw) || u.account.toLowerCase().includes(kw) || u.phone.includes(kw)
    )
  }

  return list
})

// --- 组织树交互逻辑 ---
function handleNodeClick(data: OrgNode) {
  selectedNode.value = data
}

function resetNodeSelection() {
  selectedNode.value = null
  if (orgTreeRef.value) {
    orgTreeRef.value.setCurrentKey(null)
  }
}

function openAddNodeDialog(parent: OrgNode | null) {
  addNodeParent.value = parent
  nodeForm.name = ''
  nodeForm.code = `NODE-${Math.floor(Math.random() * 9000 + 1000)}`
  nodeForm.leader = ''
  nodeForm.phone = ''
  showAddNodeDialog.value = true
}

async function submitAddNode() {
  if (!nodeForm.name.trim()) {
    ElMessage.warning('请输入组织节点名称')
    return
  }
  const parentId = addNodeParent.value ? addNodeParent.value.id : orgTree.value[0]?.id
  try {
    await systemApi.createOrgNode({
      name: nodeForm.name,
      code: nodeForm.code,
      leader: nodeForm.leader,
      phone: nodeForm.phone,
      type: 'department',
      level: computedNewNodeLevel.value,
      parentId
    })
  } catch {
    addOrgNode(parentId, {
      name: nodeForm.name,
      code: nodeForm.code,
      leader: nodeForm.leader,
      phone: nodeForm.phone
    })
  }
  showAddNodeDialog.value = false
  ElMessage.success('组织节点添加成功！')
  await loadData()
}

// 删除节点前置风控拦截 (严格调用 RBACEngine.validateNodeDeletion)
function handleDeleteNode(node: OrgNode) {
  try {
    // 1. 调用 RBACEngine 核心风控校验
    RBACEngine.validateNodeDeletion(orgTree.value, node.id)

    // 2. 校验通过（叶子节点且 0 绑定员工），弹出确认对话框
    ElMessageBox.confirm(
      `确定要删除组织节点 [${node.name}] (${node.code}) 吗？此操作不可逆。`,
      '合规删除确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(async () => {
      try {
        await systemApi.deleteOrgNode(node.id)
      } catch {
        deleteOrgNode(node.id)
      }
      if (selectedNode.value?.id === node.id) {
        selectedNode.value = null
      }
      ElMessage.success(`组织节点 [${node.name}] 已成功删除！`)
      await loadData()
    }).catch(() => {})
  } catch (err: any) {
    // 3. 校验失败，触发前置风控拦截提示！
    ElMessage.error(`【风控拦截】${err.message}`)
  }
}

// --- 员工操作逻辑 ---
function openAddUserDialog() {
  userForm.name = ''
  userForm.account = `user_${Math.floor(Math.random() * 9000 + 1000)}`
  userForm.phone = '138' + Math.floor(Math.random() * 90000000 + 10000000)
  userForm.email = ''
  userForm.campusId = selectedNode.value?.level === 3 ? selectedNode.value.id : 'campus-bj-hq'
  onCampusChangeInForm(userForm.campusId)
  userForm.roleId = 'r4'
  onRoleChangeInForm(userForm.roleId)
  userForm.dataScope = 'self'
  showAddUserDialog.value = true
}

const campusNames: Record<string, string> = {
  'campus-bj-hq': '总部校区',
  'campus-bj-yy': '远洋校区',
  'campus-bj-cy': '朝阳校区',
  'campus-bj-hd': '海淀分校',
  'campus-bj-wj': '望京校区'
}

function onCampusChangeInForm(cId: string) {
  userForm.campusName = campusNames[cId] || '总部校区'
}

function onRoleChangeInForm(rId: string) {
  const role = roles.value.find(r => r.id === rId)
  if (role) {
    userForm.roleName = role.name
    userForm.dataScope = role.dataScope
  }
}

async function submitAddUser() {
  if (!userForm.name.trim() || !userForm.account.trim() || !userForm.phone.trim()) {
    ElMessage.warning('请补全员工姓名、账号和手机号')
    return
  }
  try {
    await systemApi.createUser({
      account: userForm.account,
      realName: userForm.name,
      phone: userForm.phone,
      email: userForm.email,
      campusId: userForm.campusId,
      orgNodeId: userForm.departmentId,
      roleId: userForm.roleId,
      password: '123456'
    })
  } catch {
    addSystemUser({
      ...userForm,
      dataScope: userForm.dataScope || 'self',
      postId: 'post-hq-teacher',
      departmentId: 'dept-hq-edu'
    })
  }
  showAddUserDialog.value = false
  ElMessage.success(`员工 [${userForm.name}] 已成功录入系统！默认初始密码为 123456`)
  await loadData()
}

function handleQuickSwitchUser(user: SystemUser) {
  authStore.login(user.account)
  ElMessage.success(`已切换为员工【${user.name}】(${getDataScopeLabel(user.dataScope)}) 身份`)
  const isTeacher = user.roleName?.includes('教师') || user.roleName?.includes('老师') || user.roleName?.includes('讲师') || user.roleId === 'r4'
  if (isTeacher) {
    router.push('/educational/workbench')
  } else {
    router.push('/dashboard')
  }
}

function openResetPassword(user: SystemUser) {
  activeUser.value = user
  newPassword.value = '123456'
  showResetPasswordDialog.value = true
}

async function submitResetPassword() {
  if (!activeUser.value) return
  try {
    await systemApi.resetUserPassword(activeUser.value.id, newPassword.value)
  } catch {
    resetUserPassword(activeUser.value.id, newPassword.value)
  }
  showResetPasswordDialog.value = false
  ElMessage.success(`员工 [${activeUser.value.name}] 密码已成功重置为：${newPassword.value}`)
  await loadData()
}

function openUserAuthDrawer(user: SystemUser) {
  activeUser.value = user
  showAuthDrawer.value = true
}

function onAuthDrawerRoleChange(rId: string) {
  if (!activeUser.value) return
  const role = roles.value.find(r => r.id === rId)
  if (role) {
    activeUser.value.roleName = role.name
    activeUser.value.dataScope = role.dataScope
  }
}

async function saveUserAuth() {
  if (!activeUser.value) return
  try {
    await systemApi.updateUser(activeUser.value.id, {
      roleId: activeUser.value.roleId,
      campusId: activeUser.value.campusId
    })
  } catch {
    updateSystemUser(activeUser.value.id, {
      roleId: activeUser.value.roleId,
      roleName: activeUser.value.roleName,
      dataScope: activeUser.value.dataScope
    })
  }
  if (authStore.user?.id === activeUser.value.id || authStore.user?.account === activeUser.value.account) {
    authStore.updateUserDataScope(activeUser.value.dataScope)
  }
  showAuthDrawer.value = false
  ElMessage.success(`员工 [${activeUser.value.name}] 角色与数据权限配置已生效！`)
  await loadData()
}

async function handleToggleUserStatus(user: SystemUser) {
  const nextStatus = user.status === 'active' ? 'disabled' : 'active'
  try {
    await systemApi.toggleUserStatus(user.id, nextStatus)
  } catch {
    toggleUserStatus(user.id)
  }
  ElMessage.success(`员工 [${user.name}] 账号状态已变更为：${nextStatus === 'active' ? '正常启用' : '已锁定'}`)
  await loadData()
}

function handleDeleteUser(user: SystemUser) {
  ElMessageBox.confirm(
    `确定要注销员工 [${user.name}] (${user.account}) 吗？注销后该账号将无法再登录系统。`,
    '注销员工确认',
    {
      confirmButtonText: '确认注销',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await systemApi.deleteUser(user.id)
    } catch {
      deleteSystemUser(user.id)
    }
    ElMessage.success(`员工 [${user.name}] 已成功注销`)
    await loadData()
  }).catch(() => {})
}

function submitTransferAdmin() {
  if (!transferTargetUserId.value) {
    ElMessage.warning('请选择接收转让的在职员工')
    return
  }
  if (!transferConfirmPassword.value) {
    ElMessage.warning('请输入密码进行安全校验')
    return
  }
  const target = systemUsers.value.find(u => u.id === transferTargetUserId.value)
  if (target) {
    orgMeta.adminName = target.name
    showTransferAdminModal.value = false
    transferConfirmPassword.value = ''
    ElMessage.success(`超级管理员权限已成功移交至：${target.name}！`)
  }
}

function saveLogoConfig() {
  ElMessage.success('机构品牌与报告 LOGO 配置已成功保存！')
}

function saveOrgMeta() {
  showEditOrgModal.value = false
  ElMessage.success('机构基本信息已成功更新！')
}

onMounted(async () => {
  restoreSystemUsersFromStorage()
  systemUsers.value = [...MOCK_SYSTEM_USER_LIST]
  await loadData()
})
</script>

<style scoped>
.st-tabs :deep(.el-tabs__item) {
  font-size: 13px;
  color: #595959;
}
.st-tabs :deep(.el-tabs__item.is-active) {
  color: #1890FF;
  font-weight: bold;
}
.st-tabs :deep(.el-tabs__active-bar) {
  background-color: #1890FF;
}

.st-org-tree :deep(.el-tree-node__content) {
  height: 34px;
  border-radius: 4px;
}
.st-org-tree :deep(.el-tree-node__content:hover) {
  background-color: #f0f7ff;
}
.st-org-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: #e6f7ff;
}

.st-staff-table :deep(.el-table__header th) {
  background-color: #fafafa;
  color: #262626;
  font-weight: 600;
}
</style>
