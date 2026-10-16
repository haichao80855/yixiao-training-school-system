import type { EnrollmentIntentPayload, EnrollmentReceipt } from './types';

export interface EnrollmentFulfillmentPort {
  fulfill(payload: EnrollmentIntentPayload): Promise<EnrollmentReceipt>;
}
