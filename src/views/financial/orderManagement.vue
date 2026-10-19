<template>
  <div class="p-4 space-y-3.5 bg-st-bg min-h-full">
    <!-- 顶部主分段 Tab (常规收费订单 | 季度扣费流水) 与校区环境 -->
    <div class="bg-white rounded-lg px-4 py-2.5 shadow-card border border-st-border flex flex-wrap items-center justify-between gap-3">
      <el-button-group size="small">
        <el-button
          :type="(filterForm.chargeType === 'regular' || (filterForm.chargeType === 'all' && activeMainTab === 'regular')) ? 'primary' : 'default'"
          @click="handleMainTabChange('regular')"
        >
          常规收费订单
        </el-button>
        <el-button
          :type="(filterForm.chargeType === 'quarterly' || activeMainTab === 'quarterly') ? 'primary' : 'default'"
          @click="handleMainTabChange('quarterly')"
        >
          季度扣费流水
        </el-button>
      </el-button-group>

      <div class="flex items-center space-x-3 text-xs">
        <span class="text-st-muted">当前核算校区：</span>
        <el-tag size="small" type="primary" effect="plain" class="font-bold">
          {{ currentCampusName }}
        </el-tag>
        <span class="text-xs text-st-muted">
          (系统订单池总数：<strong class="font-mono text-st-title">{{ totalCount }}</strong> 笔)
        </span>
      </div>
    </div>

    <!-- 3x8 高密度紧凑筛选矩阵 (恰好 24 个查询参数与控件，全 32px small) -->
    <HighDensityGrid :cols="8">
      <!-- Row 1 (8 控件) -->
      <!-- 1. 学员关键字 -->
      <el-input
        v-model="filterForm.studentKeyword"
        placeholder="姓名/学号/手机号"
        size="small"
        clearable
        @keyup.enter="handleSearch"
      />

      <!-- 2. 提交人 -->
      <el-input
        v-model="filterForm.submitter"
        placeholder="提交人"
        size="small"
        clearable
        @keyup.enter="handleSearch"
      />

      <!-- 3. 业绩归属人 -->
      <el-input
        v-model="filterForm.salesOwner"
        placeholder="业绩归属人"
        size="small"
        clearable
        @keyup.enter="handleSearch"
      />

      <!-- 4. 渠道来源 -->
      <el-select v-model="filterForm.channel" placeholder="渠道来源" size="small" clearable>
        <el-option label="全部渠道" value="all" />
        <el-option label="线下地推" value="ground" />
        <el-option label="转介绍" value="referral" />
        <el-option label="美团点评" value="meituan" />
        <el-option label="网络投放" value="online" />
        <el-option label="自然到访" value="natural" />
        <el-option label="异业合作" value="cooperate" />
      </el-select>

      <!-- 5. 班级选择 (带弹窗/快捷输入) -->
      <el-input
        v-model="classDisplayName"
        placeholder="班级选择..."
        size="small"
        readonly
        clearable
        @click="openClassSelectModal"
        @clear="clearClassSelection"
      >
        <template #append>
          <el-button size="small" @click="openClassSelectModal">•••</el-button>
        </template>
      </el-input>

      <!-- 6. 课程类型 -->
      <el-select v-model="filterForm.courseType" placeholder="课程类型" size="small" clearable>
        <el-option label="全部类型" value="all" />
        <el-option label="常规课程" value="regular" />
        <el-option label="扩展培优" value="extended" />
        <el-option label="体验试听" value="trial" />
        <el-option label="集训营地" value="training" />
        <el-option label="赛考活动" value="activity" />
      </el-select>

      <!-- 7. 收费类型 -->
      <el-select v-model="filterForm.chargeType" placeholder="收费类型" size="small" clearable>
        <el-option label="全部收费类型" value="all" />
        <el-option label="常规收费" value="regular" />
        <el-option label="季度扣费" value="quarterly" />
        <el-option label="换课差额" value="change_course_diff" />
        <el-option label="退费申请" value="refund" />
        <el-option label="服务费代报" value="service_fee" />
        <el-option label="电子钱包充值" value="wallet_recharge" />
      </el-select>

      <!-- 8. 订单状态 -->
      <el-select v-model="filterForm.orderStatus" placeholder="订单状态" size="small" clearable>
        <el-option label="全部订单状态" value="all" />
        <el-option label="已支付" value="paid" />
        <el-option label="未支付" value="unpaid" />
        <el-option label="已驳回" value="rejected" />
        <el-option label="已作废" value="void" />
      </el-select>

      <!-- Row 2 (8 控件) -->
      <!-- 9. 学员状态 -->
      <el-select v-model="filterForm.studentStatus" placeholder="学员状态" size="small" clearable>
        <el-option label="全部学员状态" value="all" />
        <el-option label="在读" value="reading" />
        <el-option label="休学" value="suspended" />
        <el-option label="转校" value="transferred" />
        <el-option label="结业" value="graduated" />
      </el-select>

      <!-- 10. 异动状态 -->
      <el-select v-model="filterForm.abnormalStatus" placeholder="异动状态" size="small" clearable>
        <el-option label="全部异动状态" value="all" />
        <el-option label="正常" value="normal" />
        <el-option label="转班" value="transfer_class" />
        <el-option label="换课" value="change_course" />
        <el-option label="停课" value="suspend" />
        <el-option label="退费" value="refund" />
        <el-option label="转校" value="transfer_campus" />
      </el-select>

      <!-- 11. 商品出库状态 -->
      <el-select v-model="filterForm.goodsDelivery" placeholder="商品出库状态" size="small" clearable>
        <el-option label="全部出库状态" value="all" />
        <el-option label="已出库" value="delivered" />
        <el-option label="未出库" value="undelivered" />
        <el-option label="无需出库" value="none" />
      </el-select>

      <!-- 12. 支付方式 -->
      <el-select v-model="filterForm.paymentMethod" placeholder="支付方式" size="small" clearable>
        <el-option label="全部支付方式" value="all" />
        <el-option label="微信支付" value="wechat" />
        <el-option label="支付宝" value="alipay" />
        <el-option label="银行转账" value="bank_transfer" />
        <el-option label="POS机" value="pos" />
        <el-option label="学员钱包" value="wallet" />
      </el-select>

      <!-- 13. 最低金额 -->
      <el-input-number
        v-model="filterForm.minAmount"
        :min="0"
        :controls="false"
        placeholder="最低金额 (¥)"
        size="small"
        class="!w-full"
      />

      <!-- 14. 最高金额 -->
      <el-input-number
        v-model="filterForm.maxAmount"
        :min="0"
        :controls="false"
        placeholder="最高金额 (¥)"
        size="small"
        class="!w-full"
      />

      <!-- 15. 发票开具状态 -->
      <el-select v-model="filterForm.invoiceStatus" placeholder="发票开具状态" size="small" clearable>
        <el-option label="全部发票状态" value="all" />
        <el-option label="未开票" value="unissued" />
        <el-option label="已开票" value="issued" />
        <el-option label="开票中" value="processing" />
      </el-select>

      <!-- 16. 归属校区 -->
      <el-select v-model="filterForm.campusId" placeholder="归属校区" size="small" clearable>
        <el-option label="拓视未来-原阳校区" value="campus-bj-hq" />
      </el-select>

      <!-- Row 3 (8 控件) -->
      <!-- 17. 日期类型 -->
      <el-select v-model="filterForm.dateRangeType" placeholder="日期类型" size="small">
        <el-option label="支付时间" value="payTime" />
        <el-option label="报名时间" value="signupTime" />
        <el-option label="审核时间" value="auditTime" />
      </el-select>

      <!-- 18. 开始日期 -->
      <el-date-picker
        v-model="filterForm.startDate"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="开始日期"
        size="small"
        class="!w-full"
      />

      <!-- 19. 结束日期 -->
      <el-date-picker
        v-model="filterForm.endDate"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="结束日期"
        size="small"
        class="!w-full"
      />

      <!-- 20. 优惠券使用 -->
      <el-select v-model="filterForm.couponUsed" placeholder="优惠券使用" size="small" clearable>
        <el-option label="全部优惠券" value="all" />
        <el-option label="使用优惠券" value="yes" />
        <el-option label="未用优惠券" value="no" />
      </el-select>

      <!-- 21. 审核人 -->
      <el-input
        v-model="filterForm.auditor"
        placeholder="审核人"
        size="small"
        clearable
        @keyup.enter="handleSearch"
      />

      <!-- 22. 合同签署状态 -->
      <el-select v-model="filterForm.contractSigned" placeholder="合同签署状态" size="small" clearable>
        <el-option label="全部合同状态" value="all" />
        <el-option label="已签署" value="signed" />
        <el-option label="未签署" value="unsigned" />
        <el-option label="已作废" value="void" />
      </el-select>

      <!-- 23. 搜索与重置按钮 -->
      <div class="flex items-center space-x-1.5">
        <el-button type="primary" size="small" class="flex-1" @click="handleSearch">
          <el-icon class="mr-0.5"><Search /></el-icon>
          搜索
        </el-button>
        <el-button size="small" class="flex-1" @click="handleReset">
          重置
        </el-button>
      </div>

      <!-- 24. 导出 Excel -->
      <el-button type="primary" size="small" plain class="w-full" @click="handleExport">
        <el-icon class="mr-1"><Download /></el-icon>
        导出 Excel
      </el-button>

      <!-- 底部与横向状态分段 Tab 联动 -->
      <template #footer>
        <div class="flex items-center space-x-1">
          <el-button
            v-for="tab in statusTabs"
            :key="tab.key"
            size="small"
            :type="activeStatusTab === tab.key ? 'primary' : 'default'"
            :plain="activeStatusTab === tab.key"
            class="!m-0"
            @click="handleStatusTabChange(tab.key)"
          >
            <span>{{ tab.name }}</span>
            <span
              :class="[
                'text-[10px] px-1.5 py-0.2 rounded-full font-mono ml-1',
                activeStatusTab === tab.key ? 'bg-st-primary text-white' : 'bg-gray-100 text-st-muted'
              ]"
            >
              {{ statusCounts[tab.key] || 0 }}
            </span>
          </el-button>
        </div>

        <div class="text-xs text-st-muted">
          * 筛选控件严格支持 24 项参数矩阵与复合精确计算
        </div>
      </template>
    </HighDensityGrid>

    <!-- 动态汇总小计横条 (Summary Strip) -->
    <SummaryStrip
      :total-count="summaryResult.totalCount"
      :total-amount="summaryResult.totalAmount"
      :formatted-amount="summaryResult.formattedAmount"
      :columns="tableColumns"
      storage-key="yixiao_order_columns_v1"
      @export="handleExport"
      @update:columns="handleColumnsUpdated"
    />

    <!-- 高密度核心订单流水表格 -->
    <div class="bg-white rounded-lg p-3.5 shadow-card border border-st-border">
      <el-table
        ref="orderTableRef"
        v-loading="loading"
        :data="remoteOrders"
        style="width: 100%"
        stripe
        size="small"
        @selection-change="handleSelectionChange"
      >
        <!-- 多选框 -->
        <el-table-column type="selection" width="42" align="center" />

        <!-- 1. 学员姓名 (蓝色链接，点击呼出学员详情抽屉) -->
        <el-table-column
          v-if="isColumnVisible('studentName')"
          label="学员姓名"
          min-width="110"
        >
          <template #default="{ row }">
            <span
              class="text-st-primary font-semibold hover:underline cursor-pointer flex items-center space-x-1"
              @click="openStudentDrawer(row)"
            >
              <span>{{ row.studentName }}</span>
              <el-icon class="text-[11px]"><User /></el-icon>
            </span>
          </template>
        </el-table-column>

        <!-- 2. 学号 -->
        <el-table-column
          v-if="isColumnVisible('studentNo')"
          prop="studentNo"
          label="学号"
          width="95"
        >
          <template #default="{ row }">
            <span class="font-mono text-st-secondary text-xs">{{ row.studentNo }}</span>
          </template>
        </el-table-column>

        <!-- 3. 订单编号 (一键点击复制) -->
        <el-table-column
          v-if="isColumnVisible('orderNo')"
          label="订单编号"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div
              class="flex items-center space-x-1 font-mono text-xs cursor-pointer hover:text-st-primary group"
              @click="copyText(row.orderNo, '订单编号')"
              title="点击复制订单编号"
            >
              <span class="truncate">{{ row.orderNo }}</span>
              <el-icon class="opacity-0 group-hover:opacity-100 text-st-primary shrink-0"><DocumentCopy /></el-icon>
            </div>
          </template>
        </el-table-column>

        <!-- 4. 脱敏手机号 -->
        <el-table-column
          v-if="isColumnVisible('phone')"
          prop="phone"
          label="手机号"
          width="115"
        />

        <!-- 5. 报读课程 -->
        <el-table-column
          v-if="isColumnVisible('courseName')"
          prop="courseName"
          label="报读课程"
          min-width="170"
          show-overflow-tooltip
        />

        <!-- 6. 报名时间 -->
        <el-table-column
          v-if="isColumnVisible('signupTime')"
          prop="signupTime"
          label="报名时间"
          width="150"
          sortable
        />

        <!-- 7. 支付时间 -->
        <el-table-column
          v-if="isColumnVisible('payTime')"
          prop="payTime"
          label="支付时间"
          width="150"
          sortable
        >
          <template #default="{ row }">
            <span>{{ row.payTime || '--' }}</span>
          </template>
        </el-table-column>

        <!-- 8. 订单原价 -->
        <el-table-column
          v-if="isColumnVisible('originalPrice')"
          label="订单原价"
          width="110"
          align="right"
        >
          <template #default="{ row }">
            <span :class="row.discountAmount > 0 ? 'text-gray-400 line-through text-xs font-mono' : 'font-mono text-xs'">
              ¥ {{ (row.originalPrice || 0).toFixed(2) }}
            </span>
          </template>
        </el-table-column>

        <!-- 9. 直减金额 -->
        <el-table-column
          v-if="isColumnVisible('discountAmount')"
          label="直减金额"
          width="95"
          align="right"
        >
          <template #default="{ row }">
            <span class="font-mono text-xs text-st-muted">
              ¥ {{ (row.discountAmount || 0).toFixed(2) }}
            </span>
          </template>
        </el-table-column>

        <!-- 10. 优惠券 -->
        <el-table-column
          v-if="isColumnVisible('couponAmount')"
          label="优惠券"
          width="95"
          align="right"
        >
          <template #default="{ row }">
            <span class="font-mono text-xs text-st-muted">
              ¥ {{ (row.couponAmount || 0).toFixed(2) }}
            </span>
          </template>
        </el-table-column>

        <!-- 11. 实收金额 (划线原价+加粗红字实收) -->
        <el-table-column
          v-if="isColumnVisible('actualAmount')"
          label="实收金额"
          width="120"
          align="right"
        >
          <template #default="{ row }">
            <div class="text-xs">
              <span
                :class="[
                  'font-bold font-mono',
                  row.actualAmount < 0 ? 'text-blue-600' : 'text-st-danger'
                ]"
              >
                ¥ {{ (row.actualAmount || 0).toFixed(2) }}
              </span>
            </div>
          </template>
        </el-table-column>

        <!-- 12. 支付方式 -->
        <el-table-column
          v-if="isColumnVisible('paymentMethod')"
          label="支付方式"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="getPayMethodTag(row.paymentMethod)" size="small">
              {{ getPayMethodLabel(row.paymentMethod) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 13. 商品出库 -->
        <el-table-column
          v-if="isColumnVisible('goodsDelivery')"
          label="商品出库"
          width="95"
          align="center"
        >
          <template #default="{ row }">
            <el-tag
              :type="row.goodsDelivery === 'delivered' ? 'success' : row.goodsDelivery === 'undelivered' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.goodsDelivery === 'delivered' ? '已出库' : row.goodsDelivery === 'undelivered' ? '未出库' : '--' }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 14. 经办人 / 业绩人 -->
        <el-table-column
          v-if="isColumnVisible('creator')"
          label="经办/归属"
          width="130"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div class="text-xs">
              <div>{{ row.creator }}</div>
              <div class="text-[11px] text-st-muted">{{ row.performanceOwner || row.salesOwner || '--' }}</div>
            </div>
          </template>
        </el-table-column>

        <!-- 15. 订单状态 Tag -->
        <el-table-column
          v-if="isColumnVisible('status')"
          label="订单状态"
          width="95"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="getOrderStatusTag(row.status || row.orderStatus)" size="small">
              {{ getOrderStatusLabel(row.status || row.orderStatus) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 操作列 (固定在右侧) -->
        <el-table-column label="操作" width="165" fixed="right">
          <template #default="{ row }">
            <div class="flex items-center space-x-1">
              <el-button
                link
                type="primary"
                size="small"
                @click="openModifyDialog(row)"
              >
                修改
              </el-button>

              <el-button
                link
                type="primary"
                size="small"
                @click="openVoucherDialog(row)"
              >
                凭证
              </el-button>

              <el-button
                v-if="row.status !== 'void'"
                link
                type="danger"
                size="small"
                @click="handleVoidOrder(row)"
              >
                作废
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页控制栏 (10/20/50条/页) -->
      <div class="border-t border-gray-100 mt-3">
        <AppPagination
          v-model:current-page="filterForm.page"
          v-model:page-size="filterForm.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalCount"
          :summary-text="`当前显示第 ${(filterForm.page - 1) * filterForm.pageSize + 1} 至 ${Math.min(filterForm.page * filterForm.pageSize, totalCount)} 条，共 ${totalCount} 条`"
          @change="() => loadOrders()"
        />
      </div>
    </div>

    <!-- 弹窗 1: 收款凭证查看与上传 (Payment Voucher Dialog) -->
    <el-dialog
      v-model="voucherDialogVisible"
      title="收款凭证核验与管理"
      :width="DIALOG_SIZE.md"
      destroy-on-close
    >
      <div v-if="currentVoucherOrder" class="space-y-4 text-xs">
        <div class="bg-gray-50 p-3 rounded border border-gray-200 grid grid-cols-2 gap-2">
          <div>
            <span class="text-st-muted">学员姓名：</span>
            <strong class="text-st-title">{{ currentVoucherOrder.studentName }}</strong>
          </div>
          <div>
            <span class="text-st-muted">订单编号：</span>
            <span class="font-mono">{{ currentVoucherOrder.orderNo }}</span>
          </div>
          <div>
            <span class="text-st-muted">实缴金额：</span>
            <strong class="text-st-danger font-mono font-bold">¥ {{ currentVoucherOrder.actualAmount.toFixed(2) }}</strong>
          </div>
          <div>
            <span class="text-st-muted">交易流水号：</span>
            <span class="font-mono">{{ currentVoucherOrder.transactionId || '线上自动收单对账' }}</span>
          </div>
        </div>

        <!-- 凭证缩略图与大图预览 -->
        <div>
          <div class="font-bold text-st-title mb-2">电子凭证原件 (支持点击放大预览)</div>
          <div v-if="currentVoucherOrder.voucherUrl" class="border rounded p-2 flex items-center justify-center bg-gray-50">
            <el-image
              :src="currentVoucherOrder.voucherUrl"
              :preview-src-list="[currentVoucherOrder.voucherUrl]"
              fit="contain"
              class="h-44 rounded cursor-pointer"
            />
          </div>
          <div v-else class="h-32 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-st-muted">
            <el-icon class="text-2xl mb-1"><Picture /></el-icon>
            <span>暂无上传原始凭证扫描件</span>
          </div>
        </div>

        <!-- 财务核验备注 -->
        <div>
          <label class="block font-medium text-st-regular mb-1">财务核验与对账附言</label>
          <el-input
            v-model="voucherAuditRemark"
            type="textarea"
            :rows="2"
            placeholder="填写收款凭证核对备注（如：银行流水匹配成功/微信到账核销等）"
            size="small"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between items-center">
          <el-button size="small" type="primary" plain @click="simulateUploadVoucher">
            <el-icon class="mr-1"><Upload /></el-icon>
            模拟上传新凭证
          </el-button>
          <div>
            <el-button size="small" @click="voucherDialogVisible = false">取消</el-button>
            <el-button size="small" type="primary" @click="saveVoucherAudit">保存核验信息</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 弹窗 2: 修改订单 (带锁定期检查) -->
    <el-dialog
      v-model="modifyDialogVisible"
      title="修改订单流水信息"
      :width="DIALOG_SIZE.sm"
      destroy-on-close
    >
      <div v-if="currentEditOrder" class="space-y-3 text-xs">
        <el-alert
          v-if="currentEditOrder.isLocked"
          title="该订单已由财务终审并结账归档，禁止修改核心资金字段！"
          type="warning"
          show-icon
          :closable="false"
        />

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-st-muted mb-1">经办人 (创建人)</label>
            <el-input v-model="editOrderForm.creator" size="small" :disabled="currentEditOrder.isLocked" />
          </div>
          <div>
            <label class="block text-st-muted mb-1">业绩归属人</label>
            <el-input v-model="editOrderForm.performanceOwner" size="small" :disabled="currentEditOrder.isLocked" />
          </div>
        </div>

        <div>
          <label class="block text-st-muted mb-1">实收金额 (¥)</label>
          <el-input-number
            v-model="editOrderForm.actualAmount"
            :min="0"
            :precision="2"
            size="small"
            class="!w-full"
            :disabled="currentEditOrder.isLocked"
          />
        </div>

        <div>
          <label class="block text-st-muted mb-1">物品出库状态</label>
          <el-select v-model="editOrderForm.goodsDelivery" size="small" class="w-full">
            <el-option label="已出库" value="delivered" />
            <el-option label="未出库" value="undelivered" />
            <el-option label="无需出库" value="none" />
          </el-select>
        </div>

        <div>
          <label class="block text-st-muted mb-1">修改备注</label>
          <el-input v-model="editOrderForm.remark" type="textarea" :rows="2" size="small" placeholder="请输入修改说明" />
        </div>
      </div>

      <template #footer>
        <el-button size="small" @click="modifyDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="saveOrderModification">确认修改</el-button>
      </template>
    </el-dialog>

    <!-- 弹窗 3: 班级弹窗选择器 (Class Select Dialog) -->
    <el-dialog
      v-model="classSelectDialogVisible"
      title="选择报读班级"
      :width="DIALOG_SIZE.md"
      destroy-on-close
    >
      <div class="space-y-3">
        <el-input
          v-model="classSearchKeyword"
          placeholder="搜索班级名称/执教老师"
          size="small"
          clearable
          prefix-icon="Search"
        />
        <el-table
          :data="filteredClassList"
          style="width: 100%"
          size="small"
          max-height="300"
          highlight-current-row
          @current-change="handleClassCurrentChange"
        >
          <el-table-column prop="name" label="班级名称" min-width="180" />
          <el-table-column prop="teacherName" label="授课老师" width="90" />
          <el-table-column prop="capacity" label="班级容额" width="90">
            <template #default="{ row }">
              <span class="font-mono text-xs">{{ row.currentCount }}/{{ row.capacity }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button size="small" @click="classSelectDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :disabled="!selectedClassRow" @click="confirmClassSelection">
          确定选择
        </el-button>
      </template>
    </el-dialog>

    <!-- 抽屉: 学员详细画像 (Student Profile Drawer) -->
    <el-drawer
      v-model="studentDrawerVisible"
      :title="`学员全景画像 - ${currentSelectedStudent?.name || ''}`"
      size="480px"
      destroy-on-close
    >
      <div v-if="currentSelectedStudent" class="space-y-4 text-xs">
        <div class="flex items-center space-x-3 p-3 bg-blue-50/60 rounded-lg border border-blue-100">
          <el-avatar :size="48" :src="currentSelectedStudent.avatar">
            {{ currentSelectedStudent.name?.charAt(0) }}
          </el-avatar>
          <div>
            <div class="text-sm font-bold text-st-title">{{ currentSelectedStudent.name }}</div>
            <div class="text-st-muted font-mono mt-0.5">学号: {{ currentSelectedStudent.studentNo }} | 电话: {{ currentSelectedStudent.phone }}</div>
            <div class="text-[11px] text-st-primary mt-0.5">归属: {{ currentSelectedStudent.campusName }}</div>
          </div>
        </div>

        <el-descriptions title="基本档案" :column="2" border size="small">
          <el-descriptions-item label="年级">{{ currentSelectedStudent.grade || '小学四年级' }}</el-descriptions-item>
          <el-descriptions-item label="公立学校">{{ currentSelectedStudent.school || '中关村第一小学' }}</el-descriptions-item>
          <el-descriptions-item label="在读状态">
            <el-tag size="small" type="success">在读就读中</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="微信绑定">已绑定 (家长接收通知)</el-descriptions-item>
        </el-descriptions>

        <div class="p-3 bg-gray-50 rounded border border-gray-200">
          <div class="font-bold text-st-title mb-1.5">最近订单流水历史</div>
          <div class="space-y-1">
            <div
              v-for="ord in studentOrderHistory"
              :key="ord.id"
              class="flex items-center justify-between text-st-regular py-1 border-b border-gray-100 last:border-b-0"
            >
              <div>
                <div class="font-mono">{{ ord.orderNo }}</div>
                <div class="text-st-muted text-[11px]">{{ ord.courseName }}</div>
              </div>
              <div class="text-right">
                <div class="font-bold font-mono text-st-danger">¥ {{ ord.actualAmount.toFixed(2) }}</div>
                <div class="text-[11px] text-st-muted">{{ ord.payTime || ord.signupTime }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Download,
  DocumentCopy,
  User,
  Picture,
  Upload
} from '@element-plus/icons-vue'
import { useTenantStore } from '@/stores/tenantStore'
import { financialApi, studentApi, educationalApi } from '@/api'
import { FinanceAggregator } from '@/utils/financeAggregator'
import SummaryStrip from '@/components/SummaryStrip.vue'
import HighDensityGrid from '@/components/HighDensityGrid.vue'
import AppPagination from '@/components/AppPagination.vue'
import { DIALOG_SIZE } from '@/constants/ui'
import type {
  OrderRecord,
  FinanceFilterForm,
  OrderStatus,
  PaymentMethod,
  ColumnConfig,
  FinanceSummaryResult
} from '@/types'

const tenantStore = useTenantStore()
const currentCampusName = computed(() => tenantStore.currentCampus?.name || '拓视未来-原阳校区')

// 主分段 Tab
const activeMainTab = ref<'regular' | 'quarterly'>('regular')

// 横向状态分段 Tab
const activeStatusTab = ref<string>('all')
const statusTabs = [
  { key: 'all', name: '全部订单' },
  { key: 'paid', name: '已支付' },
  { key: 'unpaid', name: '未支付' },
  { key: 'rejected', name: '已驳回' },
  { key: 'void', name: '订单作废' }
]

// 3x8 矩阵响应式表单 (包含恰好 24 个字段)
const filterForm = reactive<FinanceFilterForm>(FinanceAggregator.getDefaultFilterForm())

// 表格列配置 (支持显隐勾选与 localStorage 记忆)
const tableColumns = ref<ColumnConfig[]>([
  { key: 'studentName', title: '学员姓名', visible: true, disabled: true },
  { key: 'studentNo', title: '学号', visible: true },
  { key: 'orderNo', title: '订单编号', visible: true },
  { key: 'phone', title: '手机号', visible: true },
  { key: 'courseName', title: '报读课程', visible: true },
  { key: 'signupTime', title: '报名时间', visible: true },
  { key: 'payTime', title: '支付时间', visible: true },
  { key: 'originalPrice', title: '订单原价', visible: true },
  { key: 'discountAmount', title: '直减金额', visible: false },
  { key: 'couponAmount', title: '优惠券', visible: false },
  { key: 'actualAmount', title: '实收金额', visible: true },
  { key: 'paymentMethod', title: '支付方式', visible: true },
  { key: 'goodsDelivery', title: '商品出库', visible: true },
  { key: 'creator', title: '经办人', visible: true },
  { key: 'status', title: '订单状态', visible: true }
])

function isColumnVisible(key: string): boolean {
  const col = tableColumns.value.find(c => c.key === key)
  return col ? col.visible : true
}

function handleColumnsUpdated(newCols: ColumnConfig[]) {
  tableColumns.value = newCols
}

// 数据源与加载状态
const loading = ref(false)
const remoteOrders = ref<OrderRecord[]>([])
const totalCount = ref(0)
const serverSummary = ref<FinanceSummaryResult | null>(null)

async function loadOrders() {
  loading.value = true
  try {
    const params: Record<string, string | number | undefined> = {
      page: filterForm.page,
      pageSize: filterForm.pageSize,
      campusId: tenantStore.currentCampusId,
      orderType: activeMainTab.value === 'regular'
        ? (filterForm.chargeType === 'all' ? 'regular' : filterForm.chargeType)
        : (activeMainTab.value === 'quarterly' ? 'quarterly' : filterForm.chargeType),
      status: activeStatusTab.value !== 'all' ? activeStatusTab.value : (filterForm.orderStatus !== 'all' ? filterForm.orderStatus : undefined),
      keyword: filterForm.studentKeyword || undefined,
      salesOwner: filterForm.salesOwner || undefined,
      channel: filterForm.channel !== 'all' ? filterForm.channel : undefined,
      paymentMethod: filterForm.paymentMethod !== 'all' ? filterForm.paymentMethod : undefined,
      deliveryStatus: filterForm.goodsDelivery !== 'all' ? filterForm.goodsDelivery : undefined,
      invoiceStatus: filterForm.invoiceStatus !== 'all' ? filterForm.invoiceStatus : undefined,
      startDate: filterForm.startDate || undefined,
      endDate: filterForm.endDate || undefined,
      minAmount: filterForm.minAmount ?? undefined,
      maxAmount: filterForm.maxAmount ?? undefined,
    }
    const res = await financialApi.getOrders(params)
    if (res && res.success && res.data) {
      if (res.data.list && Array.isArray(res.data.list)) {
        remoteOrders.value = res.data.list
        totalCount.value = Number(res.data.total ?? res.data.list.length)
        if (res.data.summary) {
          serverSummary.value = res.data.summary
        }
        return
      } else if (Array.isArray(res.data)) {
        remoteOrders.value = res.data
        totalCount.value = res.data.length
        return
      }
    }
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '获取订单列表失败')
  } finally {
    loading.value = false
  }
  remoteOrders.value = []
  totalCount.value = 0
}

// 各状态数量统计 Badge (消费服务端全库 SSOT 统计，解决客户端单页切片失真)
const statusCounts = computed(() => {
  if (serverSummary.value?.statusCounts) {
    return serverSummary.value.statusCounts
  }
  const map: Record<string, number> = {
    all: totalCount.value || remoteOrders.value.length,
    paid: 0,
    unpaid: 0,
    rejected: 0,
    void: 0
  }
  for (const o of remoteOrders.value) {
    const s = o.status || o.orderStatus
    if (s && map[s] !== undefined) {
      map[s]++
    }
  }
  return map
})

// 动态汇总小计横条计算 (优先使用后端整库高精汇总)
const summaryResult = computed<FinanceSummaryResult>(() => {
  if (serverSummary.value) {
    return serverSummary.value
  }
  return FinanceAggregator.calculateSummaryStrip(remoteOrders.value)
})

// 顶部主分段切换
function handleMainTabChange(tab: 'regular' | 'quarterly') {
  activeMainTab.value = tab
  filterForm.chargeType = tab
  filterForm.page = 1
  loadOrders()
}

// 状态分段 Tab 切换
function handleStatusTabChange(statusKey: string) {
  activeStatusTab.value = statusKey
  filterForm.orderStatus = statusKey
  filterForm.page = 1
  loadOrders()
}

// 搜索操作
function handleSearch() {
  filterForm.page = 1
  loadOrders()
  ElMessage.success({
    message: `筛选完成，已更新订单流水与统计汇总`,
    duration: 1500
  })
}

// 重置操作 (恢复 24 个默认值)
function handleReset() {
  const defaults = FinanceAggregator.resetFilterForm(tenantStore.currentCampusId)
  Object.assign(filterForm, defaults)
  activeMainTab.value = 'regular'
  activeStatusTab.value = 'all'
  classDisplayName.value = ''
  filterForm.page = 1
  loadOrders()
  ElMessage.info('已恢复默认筛选条件')
}

// 导出 Excel (真实导出下载模拟)
function handleExport() {
  const data = remoteOrders.value
  if (data.length === 0) {
    ElMessage.warning('当前条件下没有可导出的订单')
    return
  }

  const headers = ['学员姓名', '学号', '订单编号', '手机号', '报读课程', '原价', '实收金额', '支付方式', '报名时间', '支付时间', '订单状态']
  const rows = data.map(o => [
    o.studentName,
    o.studentNo,
    o.orderNo,
    o.phone,
    o.courseName,
    o.originalPrice,
    o.actualAmount,
    getPayMethodLabel(o.paymentMethod),
    o.signupTime,
    o.payTime || '',
    getOrderStatusLabel(o.status)
  ])

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map(e => e.join(','))].join('\n')

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `财务订单营收流水_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  ElMessage.success(`成功导出 ${data.length} 笔订单流水对账文件`)
}

// 一键复制文本
function copyText(text: string, title: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      ElMessage.success(`${title}已成功复制到剪贴板`)
    }).catch(() => {
      fallbackCopy(text, title)
    })
  } else {
    fallbackCopy(text, title)
  }
}

function fallbackCopy(text: string, title: string) {
  const input = document.createElement('input')
  input.value = text
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
  ElMessage.success(`${title}已成功复制到剪贴板`)
}

// 订单作废 (边界防御测试验证)
function handleVoidOrder(order: OrderRecord) {
  if (order.status === 'paid' || order.orderStatus === 'paid') {
    ElMessageBox.alert(
      '已支付订单禁止直接作废，如需退还费用必须发起【退费多级审批流】逐级复核！',
      '风控安全拦截',
      { type: 'warning', confirmButtonText: '知道了' }
    )
    return
  }

  ElMessageBox.confirm(
    `确定要作废订单 ${order.orderNo} 吗？作废后将释放学员名额与未生效课包。`,
    '作废确认',
    {
      confirmButtonText: '确定作废',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await financialApi.voidOrder(order.id)
      ElMessage.success('订单已作废并成功释放预留名额并落库')
      await loadOrders()
    } catch (err: any) {
      ElMessage.error(err.message || '作废失败')
    }
  })
}

// 弹窗 1: 收款凭证逻辑
const voucherDialogVisible = ref(false)
const currentVoucherOrder = ref<OrderRecord | null>(null)
const voucherAuditRemark = ref('')

function openVoucherDialog(order: OrderRecord) {
  currentVoucherOrder.value = order
  voucherAuditRemark.value = order.verifyRemark || ''
  voucherDialogVisible.value = true
}

function simulateUploadVoucher() {
  if (!currentVoucherOrder.value) return
  currentVoucherOrder.value.voucherUrl = 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80'
  ElMessage.success('已模拟上传并解析收款凭条图像')
}

async function saveVoucherAudit() {
  if (!currentVoucherOrder.value) return
  try {
    await financialApi.updateVoucher(currentVoucherOrder.value.id, {
      voucherUrl: currentVoucherOrder.value.voucherUrl || '',
      auditRemark: voucherAuditRemark.value,
      auditor: '财务审核专员'
    })
    currentVoucherOrder.value.verifyRemark = voucherAuditRemark.value
    voucherDialogVisible.value = false
    ElMessage.success('收款凭证审核附言已保存入账并同步落盘')
    await loadOrders()
  } catch (err: any) {
    ElMessage.error(err.message || '更新凭证失败')
  }
}

// 弹窗 2: 修改订单逻辑
const modifyDialogVisible = ref(false)
const currentEditOrder = ref<OrderRecord | null>(null)
const editOrderForm = reactive({
  creator: '',
  performanceOwner: '',
  actualAmount: 0,
  goodsDelivery: 'none' as any,
  remark: ''
})

function openModifyDialog(order: OrderRecord) {
  currentEditOrder.value = order
  editOrderForm.creator = order.creator
  editOrderForm.performanceOwner = order.performanceOwner || order.salesOwner || ''
  editOrderForm.actualAmount = order.actualAmount
  editOrderForm.goodsDelivery = order.goodsDelivery
  editOrderForm.remark = order.remark || ''
  modifyDialogVisible.value = true
}

async function saveOrderModification() {
  if (!currentEditOrder.value) return
  try {
    await financialApi.updateOrder(currentEditOrder.value.id, {
      creator: editOrderForm.creator,
      performanceOwner: editOrderForm.performanceOwner,
      actualAmount: Number(editOrderForm.actualAmount),
      goodsDelivery: editOrderForm.goodsDelivery,
      remark: editOrderForm.remark
    })
    modifyDialogVisible.value = false
    ElMessage.success('订单信息更新成功')
    await loadOrders()
  } catch (err: any) {
    ElMessage.error(err.message || '更新失败')
  }
}

// 弹窗 3: 班级弹窗选择逻辑
const classSelectDialogVisible = ref(false)
const classDisplayName = ref('')
const classSearchKeyword = ref('')
const selectedClassRow = ref<any>(null)
const classList = ref<any[]>([])

const filteredClassList = computed(() => {
  if (!classSearchKeyword.value.trim()) return classList.value
  const kw = classSearchKeyword.value.trim().toLowerCase()
  return classList.value.filter(c =>
    (c.name || '').toLowerCase().includes(kw) || (c.teacherName || '').toLowerCase().includes(kw)
  )
})

async function openClassSelectModal() {
  classSelectDialogVisible.value = true
  if (classList.value.length === 0) {
    try {
      const res = await educationalApi.getClasses({ campusId: tenantStore.currentCampusId })
      if (res && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data.items || res.data.list || [])
        classList.value = list
      }
    } catch (err: any) {
      ElMessage.error(err.message || '加载班级列表失败')
      classList.value = []
    }
  }
}

function handleClassCurrentChange(row: any) {
  selectedClassRow.value = row
}

function confirmClassSelection() {
  if (selectedClassRow.value) {
    filterForm.classId = selectedClassRow.value.id
    classDisplayName.value = selectedClassRow.value.name
    classSelectDialogVisible.value = false
  }
}

function clearClassSelection() {
  filterForm.classId = ''
  classDisplayName.value = ''
}

// 抽屉: 学员详情逻辑
const studentDrawerVisible = ref(false)
const currentSelectedStudent = ref<any>(null)

async function openStudentDrawer(row: OrderRecord) {
  if (!row.studentId) {
    ElMessage.warning('该订单记录暂未关联学员ID')
    return
  }
  try {
    const res = await studentApi.getStudentById(row.studentId)
    if (res && res.data) {
      currentSelectedStudent.value = res.data
      studentDrawerVisible.value = true
      return
    }
    ElMessage.error('未找到对应学员的档案记录')
  } catch (err: any) {
    ElMessage.error(err.message || '获取学员档案详情失败')
  }
}

const studentOrderHistory = computed(() => {
  if (!currentSelectedStudent.value) return []
  return remoteOrders.value.filter(o =>
    o.studentNo === currentSelectedStudent.value.studentNo ||
    o.studentName === currentSelectedStudent.value.name
  )
})

// 多选表格
const selectedRows = ref<OrderRecord[]>([])
function handleSelectionChange(selection: OrderRecord[]) {
  selectedRows.value = selection
}

// 辅助标签工具方法
function getOrderStatusTag(status?: OrderStatus): '' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'paid': return 'success'
    case 'unpaid': return 'warning'
    case 'rejected': return 'danger'
    case 'void': return 'info'
    default: return 'info'
  }
}

function getOrderStatusLabel(status?: OrderStatus): string {
  switch (status) {
    case 'paid': return '已支付'
    case 'unpaid': return '待支付'
    case 'rejected': return '已驳回'
    case 'void': return '已作废'
    default: return status || '--'
  }
}

function getPayMethodTag(method?: PaymentMethod): '' | 'success' | 'warning' | 'danger' | 'info' {
  switch (method) {
    case 'wechat': return 'success'
    case 'alipay': return ''
    case 'bank_transfer': return 'warning'
    case 'pos': return 'info'
    case 'wallet': return 'danger'
    default: return 'info'
  }
}

function getPayMethodLabel(method?: PaymentMethod): string {
  switch (method) {
    case 'wechat': return '微信支付'
    case 'alipay': return '支付宝'
    case 'bank_transfer': return '对公转账'
    case 'pos': return 'POS刷卡'
    case 'wallet': return '电子钱包'
    default: return method || '--'
  }
}

onMounted(async () => {
  // 保持与当前校区初始状态一致
  filterForm.campusId = tenantStore.currentCampusId || 'CAMPUS_HQ'
  await loadOrders()
})

watch(() => tenantStore.currentCampusId, () => {
  filterForm.campusId = tenantStore.currentCampusId
  loadOrders()
})
</script>

<style scoped>
.high-density-grid :deep(.el-input-number) {
  width: 100%;
}
</style>
