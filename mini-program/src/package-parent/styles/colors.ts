/**
 * 给模板里的图标颜色 (AppIcon :color) 用的色值，与 tokens.scss 保持一致。
 * 模板里用不了 SCSS 变量，以前各页面直接写十六进制；新代码从这里取 (家长端 UI 改进计划第 3 期会把旧的也换过来)。
 */
export const P_COLORS = {
  ink: '#0F172A',
  ink2: '#475569',
  ink3: '#5B6577',
  ink4: '#94A3B8',
  lineStrong: '#CBD5E1',
  brand: '#2F54EB',
  roseInk: '#B91C1C',
  amber: '#E8A33D',
  amberInk: '#92400E',
  indigo: '#4F46E5',
  mint: '#15803D',
  rose: '#DC2626',
  sky: '#0369A1',
  white: '#FFFFFF',
} as const;
