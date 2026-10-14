export const SERVICE_FEE_CATEGORY_MAP: Record<string, string> = {
  certification: '等级认证与考级',
  competition: '白名单与青少科创赛事',
};

export const SERVICE_FEE_STATUS_MAP: Record<string, { label: string; type: string }> = {
  pending: { label: '待核销', type: 'warning' },
  verified: { label: '已核销', type: 'success' },
};

export function formatServiceFeeCategory(category: string): string {
  return SERVICE_FEE_CATEGORY_MAP[category] || category || '其他考务';
}

export function formatServiceFeeStatus(status: string): { label: string; type: string } {
  return SERVICE_FEE_STATUS_MAP[status] || { label: status, type: 'info' };
}
