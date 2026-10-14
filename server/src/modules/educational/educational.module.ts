import { Module, forwardRef } from '@nestjs/common';
import { EducationalController } from './educational.controller';
import { EducationalService } from './educational.service';
import { LessonSettlementEngine } from './domain/lesson-settlement.engine';
import { BatchSchedulingCoordinator } from './domain/batch-scheduling.coordinator';
import { ClassRosterCoordinator } from './domain/class-roster.coordinator';
import { LearningGrowthProjector } from './domain/learning-growth.projector';
import { ClassLifecycleCoordinator } from './domain/class-lifecycle.coordinator';
import { LessonEvaluationCoordinator } from './domain/lesson-evaluation.coordinator';
import { LessonFulfillmentCoordinator } from './domain/lesson-fulfillment.coordinator';
import { OutboxNotificationDispatcher } from './domain/notification/outbox-notification.dispatcher';
import { MockNotificationAdapter } from './domain/notification/mock-notification.adapter';
import { WechatNotificationAdapter } from './domain/notification/wechat-notification.adapter';
import { NOTIFICATION_PORT } from './domain/notification/notification.port';

import {
  MediaStoragePort,
  AliyunOssMediaAdapter,
} from './domain/ports/media-storage.port';
import {
  GrowthTokenPort,
  HmacSha256TokenAdapter,
} from './domain/ports/growth-token.port';

import { CurriculumModule } from '../curriculum/curriculum.module';
import { StudentModule } from '../student/student.module';

@Module({
  imports: [CurriculumModule, forwardRef(() => StudentModule)],
  controllers: [EducationalController],
  providers: [
    EducationalService,
    LessonSettlementEngine,
    BatchSchedulingCoordinator,
    ClassRosterCoordinator,
    LearningGrowthProjector,
    ClassLifecycleCoordinator,
    LessonEvaluationCoordinator,
    LessonFulfillmentCoordinator,
    OutboxNotificationDispatcher,
    MockNotificationAdapter,
    WechatNotificationAdapter,
    {
      provide: NOTIFICATION_PORT,
      useClass:
        process.env.NODE_ENV === 'production' && process.env.WECHAT_MP_APPID
          ? WechatNotificationAdapter
          : MockNotificationAdapter,
    },
    {
      provide: MediaStoragePort,
      useClass: AliyunOssMediaAdapter,
    },
    {
      provide: GrowthTokenPort,
      useClass: HmacSha256TokenAdapter,
    },
  ],
  exports: [
    EducationalService,
    LessonSettlementEngine,
    BatchSchedulingCoordinator,
    ClassRosterCoordinator,
    LearningGrowthProjector,
    ClassLifecycleCoordinator,
    LessonEvaluationCoordinator,
    LessonFulfillmentCoordinator,
    OutboxNotificationDispatcher,
    MockNotificationAdapter,
    WechatNotificationAdapter,
    NOTIFICATION_PORT,
    MediaStoragePort,
    GrowthTokenPort,
  ],
})
export class EducationalModule {}
