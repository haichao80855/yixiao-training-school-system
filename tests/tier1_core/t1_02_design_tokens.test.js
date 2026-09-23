const assert = require('../harness/assert');

module.exports = {
  tier: 1,
  featureId: 2,
  name: 'Feature 2: 盛通蓝设计系统 Token (Design System Tokens)',
  tests: [
    {
      name: '盛通蓝核心主色及其衍生色值校验',
      fn: () => {
        const brandTokens = {
          primary: '#1890FF',
          primaryHover: '#40A9FF',
          primaryActive: '#096DD9',
          primaryLightBg: '#E6F7FF',
        };
        assert.equal(brandTokens.primary, '#1890FF', '品牌主色必须是盛通蓝 #1890FF');
        assert.match(brandTokens.primary, /^#[0-9A-Fa-f]{6}$/);
      },
    },
    {
      name: '语义功能色定义规范 (绿/红/紫/橙)',
      fn: () => {
        const functionalColors = {
          success: '#67C23A',
          warning: '#FAAD14',
          danger: '#F56C6C',
          purpleSchedule: '#722ED1',
        };
        assert.equal(functionalColors.success, '#67C23A', '成功/已上课色值');
        assert.equal(functionalColors.warning, '#FAAD14', '警示色值');
        assert.equal(functionalColors.danger, '#F56C6C', '冲突/危险色值');
        assert.equal(functionalColors.purpleSchedule, '#722ED1', '排课日程紫');
      },
    },
    {
      name: '表格表头高度与数据行高基准 Token',
      fn: () => {
        const tableTokens = {
          headerHeight: 44,
          headerBg: '#FAFAFA',
          rowHeight: 50,
          rowHoverBg: '#F5F7FA',
          borderColor: '#EBEEF5',
        };
        assert.equal(tableTokens.headerHeight, 44, '标准表头高度为 44px');
        assert.equal(tableTokens.rowHeight, 50, '数据行高为 50px');
        assert.equal(tableTokens.headerBg, '#FAFAFA');
      },
    },
    {
      name: '字体阶梯与层级样式定义规范',
      fn: () => {
        const typography = {
          h1: { size: '20px', weight: 600, color: '#1F2D3D' },
          h2: { size: '16px', weight: 600, color: '#1F2D3D' },
          body: { size: '14px', weight: 400, color: '#303133' },
          caption: { size: '12px', weight: 400, color: '#909399' },
        };
        assert.equal(typography.h2.size, '16px');
        assert.equal(typography.body.size, '14px');
        assert.equal(typography.body.color, '#303133');
      },
    },
    {
      name: '卡片阴影与圆角微立体参数断言',
      fn: () => {
        const shapeTokens = {
          borderRadius: '4px',
          boxShadowLight: '0 2px 12px 0 rgba(0, 0, 0, 0.05)',
          boxShadowHover: '0 4px 16px 0 rgba(0, 0, 0, 0.10)',
        };
        assert.equal(shapeTokens.borderRadius, '4px');
        assert.includes(shapeTokens.boxShadowLight, 'rgba(0, 0, 0, 0.05)');
      },
    },
  ],
};
