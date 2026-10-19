/**
 * 一校教培系统统一中台图表主题与调色板定义
 * 与 src/assets/design-tokens.css 强对齐
 */

export const CHART_PALETTE = {
  primary: '#1d4ed8',     // --st-primary
  success: '#15803d',     // --st-success
  warning: '#b45309',     // --st-warning
  danger: '#be123c',      // --st-danger
  info: '#4b5563',        // --st-muted
  secondary: '#606266',   // --st-secondary
  accent: '#0284c7'       // 辅助色
} as const

export const CHART_SERIES_COLORS = [
  '#1d4ed8', // 经典蓝
  '#0284c7', // 天空蓝
  '#15803d', // 稳重绿
  '#b45309', // 暖阳橙
  '#7c3aed', // 典雅紫
  '#be123c'  // 警示红
]

/**
 * 获取当前环境生效的 CSS Token 颜色
 */
export function getTokenColor(tokenVar: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenVar).trim()
  return value || fallback
}
