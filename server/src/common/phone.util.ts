/**
 * 中国大陆手机号规范化工具
 * 去除空格、短横线、括号与 +86 / 86 / 0086 前缀，返回 11 位且以 1 开头的号码；无法识别时返回 null。
 */
export function normalizeCnMobile(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let digits = raw.replace(/[\s\-()（）.]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('0086')) digits = digits.slice(4);
  else if (digits.startsWith('86') && digits.length === 13) digits = digits.slice(2);
  return /^1\d{10}$/.test(digits) ? digits : null;
}

/** 脱敏展示：138****8000 */
export function maskCnMobile(phone: string): string {
  return phone && phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(7)}` : phone;
}
