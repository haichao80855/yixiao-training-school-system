/**
 * 出参脱敏：删掉响应里所有名为 password 的字段 (bcrypt 哈希)。
 *
 * 很多查询用 include: { teacher: true } 带出整行 User，其中包括 password 哈希，
 * 以前会原样返回给前端。这里在统一响应包装时兜底删除，新的查询忘了 select 也不会泄露。
 */
const SECRET_KEYS = new Set(['password']);

export function stripSecrets<T>(value: T): T {
  const seen = new WeakSet<object>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object' || node instanceof Date || Buffer.isBuffer(node)) return;
    if (seen.has(node as object)) return;
    seen.add(node as object);
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const key of Object.keys(node as Record<string, unknown>)) {
      if (SECRET_KEYS.has(key)) {
        delete (node as Record<string, unknown>)[key];
      } else {
        walk((node as Record<string, unknown>)[key]);
      }
    }
  };
  walk(value);
  return value;
}
