import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';
import { CoursewareSourceController } from './courseware-source.controller';
import { CoursewareSourceService } from './courseware-source.service';
import { UploadModule } from '../upload/upload.module';

import { CourseDeliveryEngine } from './domain/course-delivery.engine';

@Module({
  imports: [UploadModule],
  controllers: [CurriculumController, CoursewareSourceController],
  providers: [CurriculumService, CourseDeliveryEngine, CoursewareSourceService],
  exports: [CurriculumService, CourseDeliveryEngine, CoursewareSourceService],
})
export class CurriculumModule {}
