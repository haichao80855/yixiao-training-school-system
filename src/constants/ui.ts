/**
 * 全局 UI 规格与尺寸常量规范
 * 依据 UI 走查设计系统标准定义，统一全站弹窗与表单规格
 */

/**
 * 弹窗宽度四档标准
 * - sm (480px): 简单确认、单字段录入、密码重置、钱包充提、转让管理等轻量表单
 * - md (640px): 标准表单、班级/员工/排课设立、分配入班、分班测评报告等常规操作
 * - lg (960px): 复杂向导、履约考勤明细大弹窗、课程编辑三步向导、报名选课等宽表单
 * - xl (1200px): 超大看板、全景明细、全景课评矩阵等全屏级中台操作
 */
export const DIALOG_SIZE = {
  sm: '480px',
  md: '640px',
  lg: '960px',
  xl: '1200px',
} as const

export type DialogSizeKey = keyof typeof DIALOG_SIZE

/**
 * 表单标签宽度规范
 * 全站基础表单统一 100px，复杂长文本表单 120px
 */
export const FORM_LABEL_WIDTH = {
  default: '100px',
  long: '120px',
  short: '80px',
  sm: '80px',
  md: '100px',
  lg: '120px',
} as const

/**
 * 分页器常用规格与分页尺寸
 */
export const PAGINATION_CONFIG = {
  layout: 'total, sizes, prev, pager, next, jumper',
  pageSizes: [10, 20, 50, 100],
  cardPageSizes: [12, 18, 24, 36, 48],
} as const
