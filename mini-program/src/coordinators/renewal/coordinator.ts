/**
 * 微信小程序移动端「课消流失预警与一键续费决策流深模块」协调器
 * Client Renewal Risk & Decision Pipeline Coordinator
 *
 * 架构核心职责：
 * 1. 极简外部接口：对外暴露四个高杠杆任务型入口：
 *    - loadWarningDashboard(filter)
 *    - prepareRenewalDecision(studentId, options)
 *    - proceedToCheckout(draft)
 *    - initiateContact(phone, studentName)
 * 2. 核心领域能力：
 *    - 老学员原单价智能继承与阶梯赠课优惠试算；
 *    - 班容动态核验与自动安全降级 (Overcapacity Downgrade to Unassigned Pool)；
 *    - 课消流失多因子风险评级 (SSOT Burning Alerts)；
 *    - ACB 财务防腐屏障严格拦截 (RefundLockedError)；
 * 3. 六边形端口解耦：通过 RenewalDecisionPort 隔离生产 HTTP 与单测 Fake 适配器。
 */

import type { RenewalDecisionPort } from './ports';
import { HttpRenewalDecisionAdapter } from './adapters/http-renewal-decision.adapter';
import { FakeRenewalDecisionAdapter } from './adapters/fake-renewal-decision.adapter';
import {
  RefundLockedError,
  RENEWAL_RISK_CONSTANTS,
  type ClientRenewalCoordinatorInterface,
  type RenewalDashboardFilter,
  type RenewalDashboardView,
  type RenewalDraftOptions,
  type RenewalOrderDraft,
} from './types';

export class ClientRenewalCoordinator implements ClientRenewalCoordinatorInterface {
  private readonly stagedDrafts = new Map<string, RenewalOrderDraft>();
  private lastDraft: RenewalOrderDraft | null = null;

  constructor(
    private readonly port: RenewalDecisionPort = new HttpRenewalDecisionAdapter()
  ) {}

  /**
   * 1. 拉取流失预警大盘统计指标与结构化学员流失名册
   */
  async loadWarningDashboard(filter?: RenewalDashboardFilter): Promise<RenewalDashboardView> {
    const dashboard = await this.port.fetchWarningRoster(filter);

    // 严密数据自愈校验
    if (!dashboard || !dashboard.statistics) {
      throw new Error('预警大盘返回数据异常，缺少核心统计指标');
    }

    dashboard.list = Array.isArray(dashboard.list) ? dashboard.list : [];

    if (dashboard.statistics.pendingCount === undefined && dashboard.statistics.pending !== undefined) {
      dashboard.statistics.pendingCount = dashboard.statistics.pending;
    }
    if (dashboard.statistics.pending === undefined && dashboard.statistics.pendingCount !== undefined) {
      dashboard.statistics.pending = dashboard.statistics.pendingCount;
    }

    // 计算预估续费总池 (元) 保底 (基于学员真实签约单价与 SSOT 常量)
    if (!dashboard.statistics.estimatedRenewalPoolAmount && dashboard.list.length > 0) {
      dashboard.statistics.estimatedRenewalPoolAmount = dashboard.list
        .filter((item) => item.decision?.renewalWindowOpen || item.consumptionHealth?.warningLevel !== 'normal')
        .reduce((sum, item) => {
          const price = item.pricePerLesson || (item as any).quote?.pricePerLesson || 200;
          return (
            sum +
            Math.max(
              0,
              price * RENEWAL_RISK_CONSTANTS.RECOMMENDED_SEMESTER_LESSONS -
                RENEWAL_RISK_CONSTANTS.DEFAULT_SUGGESTED_DISCOUNT
            )
          );
        }, 0);
    }

    return dashboard;
  }

  /**
   * 2. 调用后端决策协调器生成自洽续费草案
   * 闭环业务不变量：
   * - 内置 ACB 退费在途锁定强拦截：若学员名下存在在途退费或已退费单据，抛出强类型 RefundLockedError；
   * - 老学员原签约单价智能继承与优惠赠课计算；
   * - 班容动态核验与自动安全降级：若原班已满员，置位 fallbackUnassigned: true 并清空 classId，安全回退待分班资产池。
   */
  async prepareRenewalDecision(
    studentId: string,
    options?: RenewalDraftOptions
  ): Promise<RenewalOrderDraft> {
    const trimmedId = studentId !== undefined && studentId !== null ? String(studentId).trim() : '';
    if (!trimmedId) {
      throw new Error('学员ID不能为空');
    }

    // 2.1 穿透网络接缝调用端口生成草案 (端口内部遇到在途退费将抛出 RefundLockedError)
    const draft = await this.port.generateRenewalDraft(trimmedId, options);

    if (!draft || !draft.draftId) {
      throw new Error('生成续费草案失败，服务端未下发有效草案数据');
    }

    // 2.2 端侧二次防御：ACB 财务防腐硬阻断
    if (draft.validation && draft.validation.isRefundLocked) {
      throw new RefundLockedError(
        draft.validation.warningMessage || '该学员名下存在已退费或在途退费审批单据，已被财务防腐屏障锁定，严禁发起续费开单',
        trimmedId
      );
    }

    // 2.3 班容动态核验与自动降级 (若原班满员，安全回退待分班资产池，防止超员炸班)
    let isFull = Boolean(draft.validation && draft.validation.isClassFull);
    let classCapacity = 0;
    if (!isFull && draft.quote?.classId && typeof this.port.checkClassCapacity === 'function') {
      try {
        const cap = await this.port.checkClassCapacity(draft.quote.classId);
        if (cap && cap.isFull) {
          isFull = true;
          classCapacity = cap.capacity;
        }
      } catch (e) {
        console.warn('[renewalCoordinator] 班容校验异常:', e);
      }
    }

    if (isFull) {
      draft.validation = draft.validation || { pass: true, isClassFull: true, isRefundLocked: false, fallbackUnassigned: true };
      draft.validation.isClassFull = true;
      draft.validation.fallbackUnassigned = true;
      draft.quote.classId = null;
      draft.quote.className = null;
      if (draft.enrollCommand) {
        draft.enrollCommand.classId = undefined;
        draft.enrollCommand.fallbackUnassigned = true;
      }
      if (!draft.validation.warningMessage) {
        draft.validation.warningMessage = classCapacity > 0
          ? `原在读班级当前在读已达上限 (${classCapacity}人)，续费草案已自动置为待分班状态以防超编`
          : '原在读班级已满员，续费草案已自动置为待分班状态以防超编';
      }
    } else if (!draft.quote?.classId) {
      draft.validation = draft.validation || { pass: true, isClassFull: false, isRefundLocked: false, fallbackUnassigned: true };
      draft.validation.fallbackUnassigned = true;
      if (draft.enrollCommand) {
        draft.enrollCommand.classId = undefined;
        draft.enrollCommand.fallbackUnassigned = true;
      }
    }

    // 2.4 暂存草案供后续直通开单向导使用
    this.stageDraft(draft);

    return draft;
  }

  /**
   * 3. 无损暂存草案并路由直通开单向导 wizard.vue
   */
  async proceedToCheckout(draft: RenewalOrderDraft): Promise<{ success: boolean; url: string; draftId: string }> {
    if (!draft || !draft.draftId || !draft.studentId) {
      throw new Error('无效的续费草案，无法跳转开单结算');
    }

    // 无损暂存
    this.stageDraft(draft);

    const targetUrl = `/package-student/enroll/wizard?renewalDraftId=${encodeURIComponent(
      draft.draftId
    )}&studentId=${encodeURIComponent(draft.studentId)}`;

    try {
      if (typeof uni !== 'undefined' && typeof uni.navigateTo === 'function') {
        uni.navigateTo({ url: targetUrl });
      }
    } catch (e) {
      console.warn('[renewalCoordinator] 路由跳转开单向导警告:', e);
    }

    return {
      success: true,
      url: targetUrl,
      draftId: draft.draftId,
    };
  }

  /**
   * 4. 规范化触发客户端外呼与沟通意图 (调用 uni.makePhoneCall)
   * 增强真机二次剪贴板自动复制兜底，保障在 iPad/模拟器/弱网或取消外呼时学员联系方式不丢失
   */
  async initiateContact(
    phone: string,
    studentName?: string
  ): Promise<{ success: boolean; phone: string; studentName?: string }> {
    const raw = phone !== undefined && phone !== null ? String(phone) : '';
    const cleanPhone = raw.replace(/[^0-9]/g, '').trim();

    if (!cleanPhone || cleanPhone.length < 5) {
      if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
        uni.showToast({ title: '该学员未预留有效联系电话', icon: 'none' });
      }
      throw new Error('该学员未预留有效联系电话');
    }

    try {
      if (typeof uni !== 'undefined' && typeof uni.makePhoneCall === 'function') {
        uni.makePhoneCall({
          phoneNumber: cleanPhone,
          fail: (err: any) => {
            console.warn('[renewalCoordinator] makePhoneCall fail:', err);
            try {
              if (typeof uni.setClipboardData === 'function') {
                uni.setClipboardData({
                  data: cleanPhone,
                  success: () => {
                    if (typeof uni.showToast === 'function') {
                      uni.showToast({ title: '已将学员电话复制到剪贴板', icon: 'none' });
                    }
                  },
                });
              }
            } catch (clipErr) {
              console.warn('[renewalCoordinator] 剪贴板兜底异常:', clipErr);
            }
          },
        });
      }
    } catch (e) {
      console.warn('[renewalCoordinator] 唤起外呼拨号异常:', e);
      try {
        if (typeof uni !== 'undefined' && typeof uni.setClipboardData === 'function') {
          uni.setClipboardData({
            data: cleanPhone,
            success: () => {
              if (typeof uni.showToast === 'function') {
                uni.showToast({ title: '已将学员电话复制到剪贴板', icon: 'none' });
              }
            },
          });
        }
      } catch (clipErr) {
        console.warn('[renewalCoordinator] 剪贴板兜底异常:', clipErr);
      }
    }

    return {
      success: true,
      phone: cleanPhone,
      studentName,
    };
  }

  /**
   * 暂存草案管理辅助
   */
  stageDraft(draft: RenewalOrderDraft): void {
    if (!draft || !draft.draftId) return;
    this.stagedDrafts.set(draft.draftId, draft);
    this.lastDraft = draft;

    try {
      if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
        uni.setStorageSync(`renewal_draft_${draft.draftId}`, draft);
        uni.setStorageSync('latest_renewal_draft', draft);
      }
    } catch (e) {
      console.warn('[renewalCoordinator] 暂存草案至本地缓存异常:', e);
    }
  }

  getStagedDraft(draftId?: string): RenewalOrderDraft | null {
    if (draftId) {
      if (this.stagedDrafts.has(draftId)) {
        return this.stagedDrafts.get(draftId)!;
      }
      try {
        if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
          const item = uni.getStorageSync(`renewal_draft_${draftId}`);
          if (item) {
            const parsed = typeof item === 'string' ? JSON.parse(item) : item;
            if (parsed && (!parsed.draftId || parsed.draftId === draftId)) {
              this.stagedDrafts.set(draftId, parsed);
              return parsed;
            }
          }
        }
      } catch (e) {
        console.warn('[renewalCoordinator] 读取本地草案缓存异常:', e);
      }
      return null;
    }

    if (this.lastDraft) {
      return this.lastDraft;
    }

    try {
      if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
        const item = uni.getStorageSync('latest_renewal_draft');
        if (item) {
          const parsed = typeof item === 'string' ? JSON.parse(item) : item;
          if (parsed && parsed.draftId) {
            this.lastDraft = parsed;
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('[renewalCoordinator] 读取本地草案缓存异常:', e);
    }

    return null;
  }

  clearStagedDraft(draftId?: string): void {
    if (draftId) {
      this.stagedDrafts.delete(draftId);
      if (this.lastDraft && this.lastDraft.draftId === draftId) {
        this.lastDraft = null;
      }
      try {
        if (typeof uni !== 'undefined' && typeof uni.removeStorageSync === 'function') {
          uni.removeStorageSync(`renewal_draft_${draftId}`);
          if (typeof uni.getStorageSync === 'function') {
            const latest = uni.getStorageSync('latest_renewal_draft');
            if (latest) {
              const parsed = typeof latest === 'string' ? JSON.parse(latest) : latest;
              if (parsed && parsed.draftId === draftId) {
                uni.removeStorageSync('latest_renewal_draft');
              }
            }
          }
        }
      } catch (e) {
        console.warn('[renewalCoordinator] 清除本地草案缓存异常:', e);
      }
    } else {
      this.stagedDrafts.clear();
      this.lastDraft = null;
      try {
        if (typeof uni !== 'undefined' && typeof uni.removeStorageSync === 'function') {
          uni.removeStorageSync('latest_renewal_draft');
        }
      } catch (e) {
        console.warn('[renewalCoordinator] 清除本地草案缓存异常:', e);
      }
    }
  }
}

// 导出单例协调器与工厂
export const renewalCoordinator = new ClientRenewalCoordinator();
(renewalCoordinator as any).createCoordinator = (port?: RenewalDecisionPort) => new ClientRenewalCoordinator(port);
(renewalCoordinator as any).ClientRenewalCoordinator = ClientRenewalCoordinator;
(renewalCoordinator as any).CoordinatorClass = ClientRenewalCoordinator;
(renewalCoordinator as any).FakeRenewalDecisionAdapter = FakeRenewalDecisionAdapter;
(renewalCoordinator as any).HttpRenewalDecisionAdapter = HttpRenewalDecisionAdapter;
(renewalCoordinator as any).RefundLockedError = RefundLockedError;
(renewalCoordinator as any).RENEWAL_RISK_CONSTANTS = RENEWAL_RISK_CONSTANTS;

export {
  FakeRenewalDecisionAdapter,
  HttpRenewalDecisionAdapter,
  RefundLockedError,
  RENEWAL_RISK_CONSTANTS,
};
