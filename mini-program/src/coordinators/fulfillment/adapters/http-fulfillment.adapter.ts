import { eduApi } from '../../../api/edu';
import type { FulfillmentPort } from '../ports';

export class HttpFulfillmentAdapter implements FulfillmentPort {
  async fetchWorkbench(scheduleEventId: string): Promise<any> {
    return eduApi.getFulfillmentWorkbench(scheduleEventId);
  }

  async commitFulfillment(payload: any): Promise<any> {
    return eduApi.fulfillLesson(payload);
  }

  async reverseFulfillment(payload: any): Promise<any> {
    return eduApi.reverseFulfillment(payload);
  }

  async uploadPhoto(filePath: string, scheduleEventId?: string): Promise<string> {
    return eduApi.uploadPhoto(filePath, scheduleEventId);
  }

  async uploadVideo(filePath: string, scheduleEventId?: string): Promise<string> {
    return eduApi.uploadVideo(filePath, scheduleEventId);
  }
}
