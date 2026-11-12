import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    // 圆角只保留设计规范的档位 (值来自 tokens.css)，旧类名一次性映射到新数值：
    // rounded / rounded-sm → 小控件 8；rounded-md → 按钮输入框 10；rounded-lg → 卡片 14；
    // rounded-xl 及以上 → 弹窗抽屉 20；rounded-full / rounded-capsule → 胶囊
    borderRadius: {
      none: '0px',
      sm: 'var(--st-radius-sm, 8px)',
      DEFAULT: 'var(--st-radius-sm, 8px)',
      md: 'var(--st-radius-md, 10px)',
      lg: 'var(--st-radius-lg, 14px)',
      xl: 'var(--st-radius-xl, 20px)',
      '2xl': 'var(--st-radius-xl, 20px)',
      '3xl': 'var(--st-radius-xl, 20px)',
      full: '9999px',
      control: 'var(--st-radius-sm, 8px)',
      button: 'var(--st-radius-md, 10px)',
      card: 'var(--st-radius-lg, 14px)',
      dialog: 'var(--st-radius-xl, 20px)',
      capsule: 'var(--st-radius-pill, 999px)'
    },
    // 字号最小 12px：不提供小于 xs 的档位。语义档位与 tokens.css 的 --st-font-size-* 一致
    fontSize: {
      xs: ['12px', { lineHeight: '16px' }],
      sm: ['14px', { lineHeight: '20px' }],
      base: ['16px', { lineHeight: '24px' }],
      lg: ['18px', { lineHeight: '28px' }],
      xl: ['20px', { lineHeight: '28px' }],
      '2xl': ['24px', { lineHeight: '32px' }],
      '3xl': ['30px', { lineHeight: '36px' }],
      '4xl': ['36px', { lineHeight: '40px' }],
      '5xl': ['48px', { lineHeight: '1' }],
      caption: ['var(--st-font-size-caption, 12px)', { lineHeight: '16px' }],
      table: ['var(--st-font-size-table, 13px)', { lineHeight: '20px' }],
      body: ['var(--st-font-size-body, 14px)', { lineHeight: '22px' }],
      subtitle: ['var(--st-font-size-subtitle, 16px)', { lineHeight: '24px' }],
      title: ['var(--st-font-size-title, 20px)', { lineHeight: '28px' }],
      figure: ['var(--st-font-size-figure, 28px)', { lineHeight: '34px' }]
    },
    extend: {
      transitionDuration: {
        DEFAULT: '200ms',
        st: 'var(--st-duration, 200ms)'
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        st: 'var(--st-ease, cubic-bezier(0.2, 0.8, 0.2, 1))'
      },
      colors: {
        st: {
          primary: 'rgb(var(--st-rgb-primary, 37 99 235) / <alpha-value>)',
          'primary-hover': 'var(--st-color-primary-hover, #3B82F6)',
          'primary-active': 'var(--st-color-primary-active, #1D4ED8)',
          'primary-light': 'rgb(var(--st-rgb-primary-light, 239 244 255) / <alpha-value>)',
          'primary-border': 'var(--st-color-primary-border, #C7D7FE)',
          'primary-bg': 'var(--st-color-primary-bg, #F5F8FF)',
          success: 'var(--st-color-success, #16A34A)',
          'success-light': 'var(--st-color-success-light, #ECFDF3)',
          'success-deep': 'var(--st-color-success-deep, #15803D)',
          'success-border': 'var(--st-color-success-border, #BBF7D0)',
          warning: 'var(--st-color-warning, #D97706)',
          'warning-light': 'var(--st-color-warning-light, #FFF7E8)',
          'warning-deep': 'var(--st-color-warning-deep, #B45309)',
          'warning-border': 'var(--st-color-warning-border, #FDE68A)',
          danger: 'var(--st-color-danger, #DC2626)',
          'danger-light': 'var(--st-color-danger-light, #FEF2F2)',
          'danger-deep': 'var(--st-color-danger-deep, #B91C1C)',
          'danger-border': 'var(--st-color-danger-border, #FECACA)',
          purple: 'var(--st-color-purple, #7C3AED)',
          'purple-light': 'var(--st-color-purple-light, #F5F3FF)',
          'purple-border': 'var(--st-color-purple-border, #DDD6FE)',
          bg: 'var(--st-color-bg, #F5F5F7)',
          card: 'var(--st-color-card, #FFFFFF)',
          header: 'var(--st-color-header, #F8FAFC)',
          title: 'var(--st-color-title, #0F172A)',
          regular: 'var(--st-color-regular, #334155)',
          secondary: 'var(--st-color-secondary, #475569)',
          muted: 'var(--st-color-muted, #64748B)',
          placeholder: 'var(--st-color-placeholder, #94A3B8)',
          border: 'var(--st-color-border, #E2E8F0)',
          'border-dark': 'var(--st-color-border-dark, #CBD5E1)',
          fill: 'var(--st-color-fill, #F1F5F9)',
          divider: 'var(--st-color-divider, #EEF2F6)'
        }
      },
      height: {
        header: '60px',
        'table-header': '44px',
        'table-row': '50px'
      },
      width: {
        sidebar: '220px',
        'sidebar-collapsed': '64px'
      },
      fontFamily: {
        // 数字展示统一走系统无衬线字体 + tabular-nums（见 index.css），避免代码风格的等宽字体
        mono: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif']
      },
      boxShadow: {
        header: '0 1px 0 0 rgba(15, 23, 42, 0.04)',
        card: 'var(--st-shadow-card)',
        hover: 'var(--st-shadow-hover)',
        popover: 'var(--st-shadow-popover)'
      },
    },
  },
  plugins: [],
} satisfies Config
