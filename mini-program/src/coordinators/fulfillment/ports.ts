export interface FulfillmentPort {
  fetchWorkbench(scheduleEventId: string): Promise<any>;
  commitFulfillment(payload: any): Promise<any>;
  reverseFulfillment(payload: any): Promise<any>;
  uploadPhoto?(filePath: string, scheduleEventId?: string): Promise<string>;
  uploadVideo?(filePath: string, scheduleEventId?: string): Promise<string>;
}

export interface DraftScope {
  /** 排课日程唯一标识 */
  scheduleId: string;
  /** 学员唯一标识 (为空表示整班级排课大纲与通用评语草稿) */
  studentId?: string;
  /** 校区作用域标识 (可选，默认继承当前校区上下文) */
  campusId?: string;
}

export interface DraftStorageOptions {
  /** 草稿生命周期毫秒数 (默认 7 * 24 * 3600 * 1000 即 7 天) */
  ttlMs?: number;
}

export interface DraftStoragePort {
  /** 获取草稿 (支持 DraftScope 领域标识，亦平滑兼容旧式 string key) */
  getDraft<T = any>(scopeOrKey: DraftScope | string): T | null;

  /** 保存草稿 (自动包装封套、更新索引与时间戳) */
  setDraft<T = any>(scopeOrKey: DraftScope | string, value: T, options?: DraftStorageOptions): void;

  /** 驱逐单项草稿 */
  removeDraft(scopeOrKey: DraftScope | string): void;

  /** 履约结课出站后：一键原子级联出清该排课下的整班大纲草稿与所有学员个人草稿 */
  purgeScheduleDrafts(scheduleId: string, campusId?: string): number;

  /** 主动紧缩淘汰过期草稿，释放本地配额 */
  compact?(): { reclaimedKeys: number; freedBytes: number };
}
