/**
 * 接口耗时记录 (流畅度改进第 0 期)。
 *
 * - 每个 /api 请求结束时计算耗时；超过 SLOW_REQUEST_MS (默认 300) 打 warn 日志，
 *   REQUEST_TIMING_LOG=all 时每个请求都打。日志格式：`[timing] GET /api/students/:id 200 42ms`。
 * - 响应头带 `Server-Timing: app;dur=<ms>`，浏览器开发者工具的 Network → Timing 里能直接看到后端耗时。
 * - 路由按 Express 的路由模板归并 (/api/students/:id)，便于统计；没有匹配到路由时用原始路径。
 */
import type { NextFunction, Request, Response } from 'express';

function readNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function routeLabel(req: Request): string {
  const route = (req as Request & { route?: { path?: string } }).route;
  if (route?.path && typeof route.path === 'string') return `${req.baseUrl || ''}${route.path}`;
  return (req.originalUrl || req.url || '').split('?')[0];
}

export function createRequestTimingMiddleware() {
  const slowMs = readNumber('SLOW_REQUEST_MS', 300);
  const logAll = process.env.REQUEST_TIMING_LOG === 'all';

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.url.startsWith('/api')) return next();
    const start = process.hrtime.bigint();
    const elapsed = () => Number(process.hrtime.bigint() - start) / 1e6;

    // Server-Timing 必须在响应头发出前写入：包一层 writeHead
    const originalWriteHead = res.writeHead;
    res.writeHead = function writeHeadWithTiming(this: Response, ...args: any[]) {
      if (!res.headersSent) res.setHeader('Server-Timing', `app;dur=${elapsed().toFixed(1)}`);
      return (originalWriteHead as any).apply(this, args);
    } as typeof res.writeHead;

    res.on('finish', () => {
      const ms = elapsed();
      if (logAll || ms >= slowMs) {
        const line = `[timing] ${req.method} ${routeLabel(req)} ${res.statusCode} ${Math.round(ms)}ms`;
        if (ms >= slowMs) console.warn(`${line} (慢请求，阈值 ${slowMs}ms)`);
        else console.log(line);
      }
    });
    next();
  };
}
