/**
 * 文字头像：同一个人在所有页面颜色、文字都一样，名单里靠色块就能快速认人。
 */

/** 头像底色档数，对应 teacher.css 里的 --tp-avatar-1 … --tp-avatar-6 */
export const AVATAR_TONES = 6;

/**
 * 头像上显示的字：三个字及以上的名字取后两个字 (欧阳子涵 → 子涵，王小明 → 小明)，
 * 两个字的名字原样显示 (张一)，避免复姓、同姓的学员头像一模一样。
 */
export function avatarText(name: string | null | undefined): string {
  const chars = Array.from((name || '').trim());
  if (chars.length === 0) return '';
  return chars.length >= 3 ? chars.slice(-2).join('') : chars.join('');
}

/** 按 ID 固定取一档颜色 (1 … 6)；没有 ID 时按名字取 */
export function avatarTone(seed: string | null | undefined): number {
  const text = seed || '';
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + (ch.codePointAt(0) || 0)) >>> 0;
  return (hash % AVATAR_TONES) + 1;
}
