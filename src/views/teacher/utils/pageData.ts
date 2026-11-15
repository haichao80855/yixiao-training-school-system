import type { RouteLocationNormalizedGeneric, RouteLocationResolvedGeneric } from 'vue-router';
import { teacherPortalApi } from '@/api';

/**
 * 详情页数据预取：手指按下列表行时就开始请求，导航时稍等片刻，新页面滑入时内容已经在了，
 * 不再先露出骨架屏 (iOS 原生 App 的做法：点按的那一下就开始准备下一页)。
 *
 * 预取结果只保留很短时间，并且被页面取用一次后就作废：之后的下拉刷新、切回页面仍然请求最新数据。
 */

export interface PageDataSource<T> {
  key: string;
  fetch: () => Promise<T>;
}

/** 预取结果在这段时间内可直接给页面用 (覆盖按下 → 松手 → 页面挂载) */
export const PREFETCH_FRESH_MS = 5000;

interface Entry {
  promise: Promise<unknown>;
  settledAt: number;
}

const entries = new Map<string, Entry>();

function usable(entry: Entry | undefined, now = Date.now()) {
  return !!entry && (entry.settledAt === 0 || now - entry.settledAt < PREFETCH_FRESH_MS);
}

/** 开始 (或复用进行中的) 预取 */
export function prefetchData<T>(source: PageDataSource<T>): Promise<T> {
  const existing = entries.get(source.key);
  if (usable(existing)) return existing!.promise as Promise<T>;
  const entry: Entry = { promise: Promise.resolve(), settledAt: 0 };
  entry.promise = source.fetch().then(
    (value) => {
      entry.settledAt = Date.now();
      return value;
    },
    (err) => {
      if (entries.get(source.key) === entry) entries.delete(source.key);
      throw err;
    },
  );
  // 只是预取：失败交给页面自己的加载去重试和报错
  entry.promise.catch(() => {});
  entries.set(source.key, entry);
  return entry.promise as Promise<T>;
}

/** 页面加载时调用：有新鲜的预取就直接用 (并作废它)，否则正常请求 */
export function takeData<T>(source: PageDataSource<T>): Promise<T> {
  const entry = entries.get(source.key);
  if (usable(entry)) {
    entries.delete(source.key);
    return entry!.promise as Promise<T>;
  }
  entries.delete(source.key);
  return source.fetch();
}

/** 测试用 */
export function clearPrefetched() {
  entries.clear();
}

export const pageData = {
  workbench: (lessonId: string): PageDataSource<Awaited<ReturnType<typeof teacherPortalApi.getLessonWorkbench>>['data']> => ({
    key: `workbench:${lessonId}`,
    fetch: async () => (await teacherPortalApi.getLessonWorkbench(lessonId)).data,
  }),
  classDetail: (classId: string): PageDataSource<Awaited<ReturnType<typeof teacherPortalApi.getClassDetail>>['data']> => ({
    key: `class:${classId}`,
    fetch: async () => (await teacherPortalApi.getClassDetail(classId)).data,
  }),
  studentDetail: (studentId: string): PageDataSource<Awaited<ReturnType<typeof teacherPortalApi.getStudentDetail>>['data']> => ({
    key: `student:${studentId}`,
    fetch: async () => (await teacherPortalApi.getStudentDetail(studentId)).data,
  }),
};

type AnyRoute = RouteLocationNormalizedGeneric | RouteLocationResolvedGeneric;

/** 目标页面需要的数据 (没有对应的预取时返回 null) */
export function dataForRoute(route: AnyRoute): PageDataSource<unknown> | null {
  const id = route.params.id;
  if (typeof id !== 'string' || !id) return null;
  switch (route.name) {
    case 'TeacherLesson':
    case 'TeacherEvaluate':
    case 'TeacherReview':
      return pageData.workbench(id);
    case 'TeacherClassDetail':
      return pageData.classDetail(id);
    case 'TeacherStudentDetail':
      return pageData.studentDetail(id);
    default:
      return null;
  }
}

/**
 * 预取目标页面：页面代码 + 数据。
 * waitMs：最多等这么久 (导航时用，数据慢的话不拖住转场，照常先显示骨架屏)。
 */
export function prefetchRoute(route: AnyRoute, waitMs?: number): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  const component = route.matched.at(-1)?.components?.default;
  // 路由懒加载的页面组件是一个返回 import() 的函数；模块只会下载一次
  if (typeof component === 'function') {
    try {
      const result = (component as () => unknown)();
      if (result instanceof Promise) tasks.push(result);
    } catch {
      // 忽略：导航时 vue-router 会再加载一次并报错
    }
  }
  const source = dataForRoute(route);
  if (source) tasks.push(prefetchData(source));
  const all = Promise.allSettled(tasks).then(() => {});
  if (waitMs === undefined) return all;
  return Promise.race([all, new Promise<void>((resolve) => setTimeout(resolve, waitMs))]);
}
