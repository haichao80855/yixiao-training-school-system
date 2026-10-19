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
          primary: 'var(--st-color-primary, #1890FF)',
          'primary-hover': 'var(--st-color-primary-hover, #40A9FF)',
          'primary-active': 'var(--st-color-primary-active, #096DD9)',
          'primary-light': 'var(--st-color-primary-light, #ECF5FF)',
          'primary-border': 'var(--st-color-primary-border, #BAE7FF)',
          'primary-bg': 'var(--st-color-primary-bg, #F0F7FF)',
          success: 'var(--st-color-success, #67C23A)',
          'success-light': 'var(--st-color-success-light, #F0F9EB)',
          warning: 'var(--st-color-warning, #FAAD14)',
          'warning-light': 'var(--st-color-warning-light, #FFF7E6)',
          'warning-deep': 'var(--st-color-warning-deep, #D46B08)',
          danger: 'var(--st-color-danger, #F56C6C)',
          'danger-light': 'var(--st-color-danger-light, #FEF0F0)',
          'danger-deep': 'var(--st-color-danger-deep, #F5222D)',
          purple: 'var(--st-color-purple, #722ED1)',
          'purple-light': 'var(--st-color-purple-light, #F9F0FF)',
          bg: 'var(--st-color-bg, #F5F7FA)',
          card: '#FFFFFF',
          header: '#FAFAFA',
          title: '#1F2D3D',
          regular: '#303133',
          secondary: '#606266',
          muted: '#909399',
          placeholder: '#C0C4CC',
          border: '#EBEEF5',
          'border-dark': '#DCDFE6'
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
      boxShadow: {
        header: '0 2px 8px 0 rgba(0, 0, 0, 0.05)',
        card: '0 1px 4px 0 rgba(0, 0, 0, 0.04)',
        hover: '0 4px 12px 0 rgba(0, 0, 0, 0.08)',
        popover: '0 4px 16px 0 rgba(0, 0, 0, 0.12)'
      },
      borderRadius: {
        capsule: '14px'
      }
    },
  },
  plugins: [],
} satisfies Config
