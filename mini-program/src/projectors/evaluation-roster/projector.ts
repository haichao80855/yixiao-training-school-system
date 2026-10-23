import type {
  EvaluationRosterProjector,
  EvaluationRosterQuery,
  EvaluationRosterView,
  EvaluationRosterItemView,
  EvaluationMetricsSummary,
} from './types';
import type { RosterQueryPort, RosterCachePort, RosterScheduleDto, RosterWorkbenchDto } from './ports';

export interface ProjectorOptions {
  queryPort: RosterQueryPort;
  cachePort: RosterCachePort;
  concurrency?: number;
  cacheTtlMs?: number;
}

interface RawRosterPayload {
  campusId: string;
  items: EvaluationRosterItemView[];
  queriedAt: number;
}

export class DefaultEvaluationRosterProjector implements EvaluationRosterProjector {
  private readonly queryPort: RosterQueryPort;
  private readonly cachePort: RosterCachePort;
  private readonly concurrency: number;
  private readonly cacheTtlMs: number;

  constructor(options: ProjectorOptions) {
    this.queryPort = options.queryPort;
    this.cachePort = options.cachePort;
    this.concurrency = options.concurrency || 4;
    this.cacheTtlMs = options.cacheTtlMs || 3 * 60 * 1000; // 默认 3 分钟
  }

  async projectRoster(
    query: EvaluationRosterQuery,
    onRevalidated?: (freshView: EvaluationRosterView) => void
  ): Promise<EvaluationRosterView> {
    const campusId = query.campusId || 'campus-bj-hq';
    const cacheKey = this.buildCacheKey(campusId, query.dateRange);

    // 1. SWR 优先检查本地缓存（除非强制刷新）
    if (!query.forceRefresh) {
      const cachedPayload = this.cachePort.get<RawRosterPayload>(cacheKey);
      if (cachedPayload && cachedPayload.campusId === campusId) {
        // 构建瞬间可展示视图
        const instantView = this.filterAndAggregate(cachedPayload.items, query, 'cache_instant', cachedPayload.queriedAt);

        // 后台静默发起再校验更新
        this.fetchAndProjectFresh(query, cacheKey)
          .then((freshView) => {
            if (onRevalidated) {
              onRevalidated(freshView);
            }
          })
          .catch((err) => {
            console.warn('[EvaluationRosterProjector] SWR 静默再校验容错降级:', err);
          });

        return instantView;
      }
    }

    // 2. 无缓存或强制刷新：同步执行拉取并投影流水线
    try {
      const freshView = await this.fetchAndProjectFresh(query, cacheKey);
      return freshView;
    } catch (networkError) {
      console.warn('[EvaluationRosterProjector] 同步拉取失败，尝试降级沙箱兜底:', networkError);
      // 3. 降级兜底：尝试获取可能已过期的缓存
      const fallbackCached = this.cachePort.get<RawRosterPayload>(cacheKey);
      if (fallbackCached) {
        return this.filterAndAggregate(fallbackCached.items, query, 'degraded_fallback', fallbackCached.queriedAt);
      }
      // 4. 彻底离线且无缓存：返回安全零值空对象，阻断白屏异常
      return {
        campusId,
        items: [],
        metrics: {
          pendingCount: 0,
          pushedCount: 0,
          totalCount: 0,
          coverageRate: 0,
          coverageRateText: '0%',
        },
        source: 'degraded_fallback',
        queriedAt: Date.now(),
      };
    }
  }

  invalidateCampusCache(campusId: string): void {
    const prefix = `roster_cache_${campusId}`;
    this.cachePort.clearByPrefix(prefix);
  }

  /**
   * 核心网络流水线：排课日程检索 -> 4路并发工作台聚合 -> 规约条目 -> 缓存更新
   */
  private async fetchAndProjectFresh(
    query: EvaluationRosterQuery,
    cacheKey: string
  ): Promise<EvaluationRosterView> {
    const campusId = query.campusId || 'campus-bj-hq';

    // A. 检索排课日程
    const schedules = await this.queryPort.fetchCampusSchedules(campusId, query.dateRange);

    // B. 受控 4 路并发池拉取每个 schedule 的履约工作台 (Promise.allSettled 防御单点故障)
    const workbenchResults = await this.mapConcurrent(
      schedules,
      this.concurrency,
      (schedule) => this.queryPort.fetchScheduleWorkbench(schedule.id)
    );

    // C. 展平并映射为全量花名册基础条目
    const rawItems: EvaluationRosterItemView[] = [];

    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      const result = workbenchResults[i];

      // 已取消的课次不需要课评
      if (schedule.status === 'cancelled') continue;

      if (result.status === 'fulfilled') {
        const wb = result.value;
        const students = wb.students || [];

        for (const student of students) {
          // 与 Web 课评一致：请假 / 缺勤学员「请假免评」，不计入待评与覆盖率
          if (student.status === 'leave' || student.status === 'absent') continue;
          const isPushed = Boolean(student.evaluated || student.isPushed);
          const rawItem: EvaluationRosterItemView = {
            id: student.studentId,
            name: student.name,
            phone: student.phone || '--',
            studentNo: student.studentNo || `S${student.studentId}`,
            className: schedule.className,
            scheduleId: schedule.id,
            signTime: this.formatSignTime(schedule.date, schedule.startTime),
            isPushed,
            pushStatusText: isPushed ? '已推送' : '未推送',
            isLowBalance: typeof student.remainingLessons === 'number' && student.remainingLessons <= 3,
            remainingLessons: student.remainingLessons,
            courseTypeLabel: schedule.classType || '线下课',
          };
          rawItems.push(rawItem);
        }
      } else {
        console.warn(`[EvaluationRosterProjector] 排课日程 ${schedule.id} 工作台加载失败:`, result.reason);
      }
    }

    const queriedAt = Date.now();

    // D. 写入本地带 TTL 缓存
    const cachePayload: RawRosterPayload = {
      campusId,
      items: rawItems,
      queriedAt,
    };
    this.cachePort.set(cacheKey, cachePayload, this.cacheTtlMs);

    // E. 依据当前查询条件过滤并计算流式指标
    return this.filterAndAggregate(rawItems, query, 'network_fresh', queriedAt);
  }

  /**
   * 单趟流式指标规约与分面过滤
   */
  private filterAndAggregate(
    allItems: readonly EvaluationRosterItemView[],
    query: EvaluationRosterQuery,
    source: EvaluationRosterView['source'],
    queriedAt: number
  ): EvaluationRosterView {
    const campusId = query.campusId || 'campus-bj-hq';

    // 1. 全盘指标规约（反映当前校区/时间切片下整体待评全景）
    let totalCount = 0;
    let pushedCount = 0;

    for (const item of allItems) {
      totalCount++;
      if (item.isPushed) {
        pushedCount++;
      }
    }

    const pendingCount = totalCount - pushedCount;
    const coverageRate = totalCount > 0 ? Math.round((pushedCount / totalCount) * 1000) / 10 : 0;
    const coverageRateText = totalCount > 0 ? `${coverageRate}%` : '0%';

    const metrics: EvaluationMetricsSummary = {
      pendingCount,
      pushedCount,
      totalCount,
      coverageRate,
      coverageRateText,
    };

    // 2. 状态分面与关键字过滤
    const keyword = (query.keyword || '').trim().toLowerCase();
    const statusFilter = query.statusFilter || 'all';

    const filteredItems = allItems.filter((item) => {
      // 状态筛选
      if (statusFilter === 'pending' && item.isPushed) {
        return false;
      }
      if (statusFilter === 'pushed' && !item.isPushed) {
        return false;
      }

      // 关键字检索 (姓名 / 手机 / 学号 / 班级名称)
      if (keyword) {
        const matchName = item.name.toLowerCase().includes(keyword);
        const matchPhone = item.phone.toLowerCase().includes(keyword);
        const matchNo = item.studentNo.toLowerCase().includes(keyword);
        const matchClass = item.className.toLowerCase().includes(keyword);
        if (!matchName && !matchPhone && !matchNo && !matchClass) {
          return false;
        }
      }

      return true;
    });

    return {
      campusId,
      items: filteredItems,
      metrics,
      source,
      queriedAt,
    };
  }

  /**
   * 受控滑动窗口并发池 (Controlled Concurrency Pool)
   */
  private async mapConcurrent<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
  ): Promise<PromiseSettledResult<R>[]> {
    if (items.length === 0) return [];

    const results: PromiseSettledResult<R>[] = new Array(items.length);
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        try {
          const value = await fn(items[index]);
          results[index] = { status: 'fulfilled', value };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    };

    const poolSize = Math.min(limit, items.length);
    const workers = Array.from({ length: poolSize }, () => worker());
    await Promise.all(workers);

    return results;
  }

  private buildCacheKey(campusId: string, dateRange?: string | { startDate: string; endDate: string }): string {
    let rangeKey = 'all';
    if (typeof dateRange === 'string') {
      rangeKey = dateRange.replace(/\s+/g, '');
    } else if (dateRange && typeof dateRange === 'object') {
      rangeKey = `${dateRange.startDate}_${dateRange.endDate}`;
    }
    return `roster_cache_${campusId}_${rangeKey}`;
  }

  private formatSignTime(dateStr?: string, timeStr?: string): string {
    if (!dateStr) return '2026-10-13 18:30';
    const cleanTime = timeStr ? timeStr.substring(0, 5) : '18:30';
    return `${dateStr} ${cleanTime}`;
  }
}
