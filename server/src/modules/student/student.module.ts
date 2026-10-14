import { Module, forwardRef } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';

import { StudentEnrollmentCoordinator } from './domain/student-enrollment.coordinator';
import { StudentMovementCoordinator } from './domain/student-movement.coordinator';
import { LessonRenewalCoordinator } from './domain/lesson-renewal.coordinator';

import { CurriculumModule } from '../curriculum/curriculum.module';
import { EducationalModule } from '../educational/educational.module';

@Module({
  imports: [CurriculumModule, forwardRef(() => EducationalModule)],
  controllers: [StudentController],
  providers: [
    StudentService,
    StudentEnrollmentCoordinator,
    StudentMovementCoordinator,
    LessonRenewalCoordinator,
  ],
  exports: [
    StudentService,
    StudentEnrollmentCoordinator,
    StudentMovementCoordinator,
    LessonRenewalCoordinator,
  ],
})
export class StudentModule {}
