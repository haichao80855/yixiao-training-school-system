import { CoursewareProvider } from './courseware-source.policy';

/**
 * 原平台健康状态机 (不做 IO，由调用方喂入每一轮探测结果)
 *
 * 一轮探测 = 对某个平台抽样若干链接逐个请求。
 * - 一轮里失败占多数 (>= 2/3) 记为「故障轮」，成功占多数 (失败 <= 1/3) 记为「正常轮」，其余不改变计数。
 * - 连续 2 个故障轮才判定为 down，连续 2 个正常轮才恢复为 up，避免偶发抖动来回切换。
 * - 有效样本少于 3 个的轮次不参与判定。
 */
export type ProviderState = 'unknown' | 'up' | 'down';

export interface ProviderHealth {
  state: ProviderState;
  /** 状态最近一次变化的时间 */
  since: string | null;
  lastCheckedAt: string | null;
  lastRound: { ok: number; fail: number; samples: number } | null;
  /** 最近一轮失败样本的简要原因 (状态码或错误类型)，不含链接 */
  lastFailures: string[];
  consecutiveDown: number;
  consecutiveUp: number;
}

export interface ProbeOutcome {
  ok: boolean;
  /** 失败原因：HTTP 状态码或错误类型 */
  reason?: string;
}

export const ROUNDS_TO_FLIP = 2;
export const MIN_SAMPLES = 3;

export function initialHealth(): ProviderHealth {
  return {
    state: 'unknown',
    since: null,
    lastCheckedAt: null,
    lastRound: null,
    lastFailures: [],
    consecutiveDown: 0,
    consecutiveUp: 0,
  };
}

export type RoundVerdict = 'down' | 'up' | 'inconclusive';

export function judgeRound(outcomes: ProbeOutcome[]): RoundVerdict {
  const n = outcomes.length;
  if (n < MIN_SAMPLES) return 'inconclusive';
  const fail = outcomes.filter((o) => !o.ok).length;
  if (fail * 3 >= n * 2) return 'down';
  if (fail * 3 <= n) return 'up';
  return 'inconclusive';
}

/** 喂入一轮结果，返回新状态；changed 表示 up/down 发生了翻转 (用于告警) */
export function applyRound(
  prev: ProviderHealth,
  outcomes: ProbeOutcome[],
  now: Date,
): { next: ProviderHealth; changed: boolean; verdict: RoundVerdict } {
  const verdict = judgeRound(outcomes);
  const fail = outcomes.filter((o) => !o.ok);
  const next: ProviderHealth = {
    ...prev,
    lastCheckedAt: now.toISOString(),
    lastRound: { ok: outcomes.length - fail.length, fail: fail.length, samples: outcomes.length },
    lastFailures: fail.map((o) => o.reason || 'error').slice(0, 10),
  };
  if (verdict === 'down') {
    next.consecutiveDown = prev.consecutiveDown + 1;
    next.consecutiveUp = 0;
  } else if (verdict === 'up') {
    next.consecutiveUp = prev.consecutiveUp + 1;
    next.consecutiveDown = 0;
  }

  let state = prev.state;
  if (verdict === 'down' && next.consecutiveDown >= ROUNDS_TO_FLIP) state = 'down';
  // 首次探测正常即可从 unknown 进入 up；从 down 恢复需要连续正常
  if (verdict === 'up' && (prev.state === 'unknown' || next.consecutiveUp >= ROUNDS_TO_FLIP)) state = 'up';

  const flipped = state !== prev.state;
  if (flipped) {
    next.state = state;
    next.since = now.toISOString();
  }
  // 启动后第一次确认正常 (unknown -> up) 不算变化，不发告警
  const changed = flipped && (prev.state !== 'unknown' || state === 'down');
  return { next, changed, verdict };
}

export type HealthMap = Record<CoursewareProvider, ProviderHealth>;
