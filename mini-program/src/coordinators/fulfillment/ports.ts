export interface FulfillmentPort {
  fetchWorkbench(scheduleEventId: string): Promise<any>;
  commitFulfillment(payload: any): Promise<any>;
  reverseFulfillment(payload: any): Promise<any>;
  uploadPhoto?(filePath: string, scheduleEventId?: string): Promise<string>;
  uploadVideo?(filePath: string, scheduleEventId?: string): Promise<string>;
}

export interface DraftStoragePort {
  getDraft<T = any>(key: string): T | null;
  setDraft<T = any>(key: string, value: T): void;
  removeDraft(key: string): void;
}
