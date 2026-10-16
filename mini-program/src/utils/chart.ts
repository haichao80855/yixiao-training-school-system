/**
 * 拓视未来教育「一校教培系统」小程序轻量矢量图表数学转换引擎
 * 纯数学坐标映射、贝塞尔平滑与极坐标圆弧计算，零外部依赖
 */

export interface LinePoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

export interface LineChartResult {
  points: LinePoint[];
  pathD: string;
  areaPathD: string;
  yAxisTicks: Array<{ value: number; y: number }>;
  min: number;
  max: number;
  svgDataUri: string;
}

export interface DonutSliceResult {
  label: string;
  value: number;
  percentage: number;
  formattedPercent: string;
  color: string;
  startAngle: number;
  endAngle: number;
  pathD: string;
}

export interface DonutChartResult {
  slices: DonutSliceResult[];
  total: number;
  svgDataUri: string;
}

export interface FunnelStepResult {
  step: string;
  value: number;
  widthPct: number;
  conversionRate: string;
  color: string;
}

export interface FunnelChartResult {
  steps: FunnelStepResult[];
  maxVal: number;
}

export interface BarItemResult {
  label: string;
  value: number;
  heightPct: number;
  color: string;
}

export interface BarChartResult {
  items: BarItemResult[];
  maxVal: number;
}

/**
 * 转义 SVG 颜色字符串，防止 # 引起 Data-URI 解析异常
 */
export function escapeSvgColor(color: string): string {
  if (!color) return '';
  return color.replace(/#/g, '%23');
}

/**
 * 1. 折线图数据转换与 SVG 矢量生成
 */
export function transformLineSeries(
  series: Array<{ label: string; value: number }>,
  options: {
    width?: number;
    height?: number;
    padding?: number;
    color?: string;
    fillColor?: string;
    showArea?: boolean;
    showGrid?: boolean;
  } = {}
): LineChartResult {
  const width = options.width || 340;
  const height = options.height || 180;
  const padding = options.padding || 30;
  const strokeColor = options.color || '#2F54EB';
  const fillColor = options.fillColor || 'rgba(47, 84, 235, 0.12)';
  const showArea = options.showArea !== false;
  const showGrid = options.showGrid !== false;

  if (!series || series.length === 0) {
    const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%"><line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="%23F0F2F5" /></svg>`;
    return {
      points: [],
      pathD: '',
      areaPathD: '',
      yAxisTicks: [
        { value: 100, y: padding },
        { value: 50, y: Math.round(height / 2) },
        { value: 0, y: height - padding },
      ],
      min: 0,
      max: 100,
      svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(emptySvg)}`,
    };
  }

  const values = series.map((s) => (Number.isFinite(Number(s.value)) ? Number(s.value) : 0));
  let rawMin = Math.min(...values);
  let rawMax = Math.max(...values);

  if (rawMin === rawMax) {
    rawMax = rawMax === 0 ? 100 : rawMax * 1.5;
    rawMin = 0;
  }

  const min = Math.max(0, Math.floor(rawMin * 0.9));
  const max = Math.ceil(rawMax * 1.1) || 100;
  const range = max - min || 1;

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const stepX = series.length > 1 ? usableWidth / (series.length - 1) : usableWidth;

  const points: LinePoint[] = series.map((item, idx) => {
    const x = Math.round(padding + idx * stepX);
    const val = Number.isFinite(Number(item.value)) ? Number(item.value) : 0;
    const yRatio = (val - min) / range;
    const y = Math.round(height - padding - yRatio * usableHeight);
    return { x, y, value: val, label: String(item.label || '') };
  });

  // 贝塞尔曲线平滑算法
  let pathD = '';
  if (points.length === 1) {
    pathD = `M ${points[0].x} ${points[0].y} L ${width - padding} ${points[0].y}`;
  } else if (points.length > 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = Math.round(p1.x + (p2.x - p0.x) / 6);
      const cp1y = Math.round(p1.y + (p2.y - p0.y) / 6);
      const cp2x = Math.round(p2.x - (p3.x - p1.x) / 6);
      const cp2y = Math.round(p2.y - (p3.y - p1.y) / 6);

      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
  }

  const bottomY = height - padding;
  const areaPathD =
    points.length > 0 && showArea
      ? `${pathD} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`
      : '';

  // Y 轴 3 档刻度
  const yAxisTicks = [
    { value: max, y: padding },
    { value: Math.round((max + min) / 2), y: Math.round(height / 2) },
    { value: min, y: bottomY },
  ];

  const encodedStroke = escapeSvgColor(strokeColor);
  const encodedFill = escapeSvgColor(fillColor);
  const gridStroke = '%23F0F2F5';

  const gridXml = showGrid
    ? `<line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="${gridStroke}" stroke-dasharray="4,4" />
    <line x1="${padding}" y1="${Math.round(height / 2)}" x2="${width - padding}" y2="${Math.round(height / 2)}" stroke="${gridStroke}" stroke-dasharray="4,4" />
    <line x1="${padding}" y1="${bottomY}" x2="${width - padding}" y2="${bottomY}" stroke="${gridStroke}" />`
    : '';

  const circlesXml = points
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="%23FFFFFF" stroke="${encodedStroke}" stroke-width="2" />`
    )
    .join('');

  const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
    ${gridXml}
    ${areaPathD ? `<path d="${areaPathD}" fill="${encodedFill}" />` : ''}
    <path d="${pathD}" fill="none" stroke="${encodedStroke}" stroke-width="2.5" stroke-linecap="round" />
    ${circlesXml}
  </svg>`;

  const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgXml)}`;

  return { points, pathD, areaPathD, yAxisTicks, min, max, svgDataUri };
}

/**
 * 2. 环形图 (Donut) 极坐标圆弧计算与 SVG 矢量生成
 */
export function transformDonutSlices(
  slices: Array<{ label: string; value: number; color?: string }>,
  options: {
    cx?: number;
    cy?: number;
    radius?: number;
    innerRadius?: number;
  } = {}
): DonutChartResult {
  const cx = options.cx || 100;
  const cy = options.cy || 100;
  const R = options.radius || 80;
  const r = options.innerRadius || 52;

  const defaultPalette = ['#2F54EB', '#13C2C2', '#FAAD14', '#FF4D4F', '#722ED1'];
  const validSlices = Array.isArray(slices) ? slices : [];
  const total = validSlices.reduce((sum, s) => {
    const val = Number(s?.value);
    return sum + (Number.isFinite(val) && val > 0 ? val : 0);
  }, 0);

  // 全零数据降级：浅灰色背景圆环
  if (total <= 0) {
    const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cx * 2} ${cy * 2}" width="100%" height="100%">
      <circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="%23F0F2F5" stroke-width="${R - r}" />
    </svg>`;
    return {
      slices: validSlices.map((s, idx) => ({
        label: s.label,
        value: 0,
        percentage: 0,
        formattedPercent: '0.0%',
        color: s.color || defaultPalette[idx % defaultPalette.length],
        startAngle: 0,
        endAngle: 0,
        pathD: '',
      })),
      total: 0,
      svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(emptySvg)}`,
    };
  }

  let currentAngle = -Math.PI / 2; // 从 12 点钟方向顺时针起画
  const results: DonutSliceResult[] = [];

  for (let i = 0; i < validSlices.length; i++) {
    const s = validSlices[i];
    const val = Math.max(0, Number(s.value) || 0);
    const ratio = total > 0 ? val / total : 0;
    const sweep = ratio * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweep;
    currentAngle = endAngle;

    const color = s.color || defaultPalette[i % defaultPalette.length];
    const percentage = Number((ratio * 100).toFixed(1));

    let pathD = '';
    if (val > 0) {
      if (sweep >= 2 * Math.PI - 0.001) {
        // 100% 单一切片完整圆环 (双半圆拼合避免 SVG Arc 起止点重合退化)
        const midAngle = startAngle + Math.PI;
        const x1 = cx + R * Math.cos(startAngle);
        const y1 = cy + R * Math.sin(startAngle);
        const xMidOuter = cx + R * Math.cos(midAngle);
        const yMidOuter = cy + R * Math.sin(midAngle);

        const xMidInner = cx + r * Math.cos(midAngle);
        const yMidInner = cy + r * Math.sin(midAngle);
        const x4 = cx + r * Math.cos(startAngle);
        const y4 = cy + r * Math.sin(startAngle);

        pathD = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${xMidOuter.toFixed(2)} ${yMidOuter.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} M ${x4.toFixed(2)} ${y4.toFixed(2)} A ${r} ${r} 0 0 0 ${xMidInner.toFixed(2)} ${yMidInner.toFixed(2)} A ${r} ${r} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
      } else {
        const x1 = cx + R * Math.cos(startAngle);
        const y1 = cy + R * Math.sin(startAngle);
        const x2 = cx + R * Math.cos(endAngle);
        const y2 = cy + R * Math.sin(endAngle);

        const x3 = cx + r * Math.cos(endAngle);
        const y3 = cy + r * Math.sin(endAngle);
        const x4 = cx + r * Math.cos(startAngle);
        const y4 = cy + r * Math.sin(startAngle);

        const largeArc = sweep > Math.PI ? 1 : 0;
        pathD = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
      }
    }

    results.push({
      label: s.label,
      value: val,
      percentage,
      formattedPercent: `${percentage.toFixed(1)}%`,
      color,
      startAngle,
      endAngle,
      pathD,
    });
  }

  const pathsXml = results
    .filter((sl) => sl.pathD)
    .map((sl) => `<path d="${sl.pathD}" fill="${escapeSvgColor(sl.color)}" />`)
    .join('');

  const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cx * 2} ${cy * 2}" width="100%" height="100%">
    ${pathsXml}
  </svg>`;

  const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgXml)}`;

  return { slices: results, total, svgDataUri };
}

/**
 * 3. 转化漏斗 (Funnel) 数据转换
 */
export function transformFunnelSteps(
  steps: Array<{ step: string; value: number; color?: string }>
): FunnelChartResult {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { steps: [], maxVal: 0 };
  }

  const defaultPalette = ['#2F54EB', '#1890FF', '#13C2C2', '#52C41A', '#FAAD14'];
  const maxVal = Math.max(...steps.map((s) => Number(s.value) || 0), 1);

  const results: FunnelStepResult[] = steps.map((item, idx) => {
    const val = Math.max(0, Number(item.value) || 0);
    const widthPct = Math.max(12, Math.round((val / maxVal) * 100));
    let conversionRate = '100.0%';
    if (idx > 0) {
      const prevVal = Number(steps[idx - 1].value) || 0;
      conversionRate = prevVal > 0 ? `${((val / prevVal) * 100).toFixed(1)}%` : '0.0%';
    }
    return {
      step: item.step,
      value: val,
      widthPct,
      conversionRate,
      color: item.color || defaultPalette[idx % defaultPalette.length],
    };
  });

  return { steps: results, maxVal };
}

/**
 * 4. 柱状图 (Bar) 数据转换
 */
export function transformBarSeries(
  items: Array<{ label: string; value: number; color?: string }>
): BarChartResult {
  if (!Array.isArray(items) || items.length === 0) {
    return { items: [], maxVal: 0 };
  }

  const defaultColor = '#2F54EB';
  const maxVal = Math.max(...items.map((i) => Number(i.value) || 0), 1);

  const results: BarItemResult[] = items.map((item) => {
    const val = Math.max(0, Number(item.value) || 0);
    const heightPct = Math.max(4, Math.round((val / maxVal) * 100));
    return {
      label: item.label,
      value: val,
      heightPct,
      color: item.color || defaultColor,
    };
  });

  return { items: results, maxVal };
}
