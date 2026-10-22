import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
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
          warning: 'var(--st-color-warning, #D97706)',
          'warning-light': 'var(--st-color-warning-light, #FFF7E8)',
          'warning-deep': 'var(--st-color-warning-deep, #B45309)',
          danger: 'var(--st-color-danger, #DC2626)',
          'danger-light': 'var(--st-color-danger-light, #FEF2F2)',
          'danger-deep': 'var(--st-color-danger-deep, #B91C1C)',
          purple: 'var(--st-color-purple, #7C3AED)',
          'purple-light': 'var(--st-color-purple-light, #F5F3FF)',
          bg: 'var(--st-color-bg, #F5F6F8)',
          card: 'var(--st-color-card, #FFFFFF)',
          header: 'var(--st-color-header, #F8FAFC)',
          title: 'var(--st-color-title, #0F172A)',
          regular: 'var(--st-color-regular, #1E293B)',
          secondary: 'var(--st-color-secondary, #475569)',
          muted: 'var(--st-color-muted, #64748B)',
          placeholder: 'var(--st-color-placeholder, #94A3B8)',
          border: 'var(--st-color-border, #E5E7EB)',
          'border-dark': 'var(--st-color-border-dark, #D1D5DB)'
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
      borderRadius: {
        capsule: '14px'
      }
    },
  },
  plugins: [],
} satisfies Config
