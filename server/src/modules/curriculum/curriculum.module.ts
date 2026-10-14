import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';

import { CourseDeliveryEngine } from './domain/course-delivery.engine';

@Module({
  controllers: [CurriculumController],
  providers: [CurriculumService, CourseDeliveryEngine],
  exports: [CurriculumService, CourseDeliveryEngine],
})
export class CurriculumModule {}
