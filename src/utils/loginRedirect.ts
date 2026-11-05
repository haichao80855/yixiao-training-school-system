/** 登录后回跳地址：只接受站内相对路径，防止被构造成跳到外部站点 */
export function safeLoginRedirect(raw: unknown): string | null {
  const target = Array.isArray(raw) ? raw[0] : raw
  if (
    typeof target !== 'string' ||
    !target.startsWith('/') ||
    target.startsWith('//') ||
    target.includes('\\') ||
    target.startsWith('/login')
  ) {
    return null
  }
  return target
}
