import { Module } from '@nestjs/common';
import { EducationalController } from './educational.controller';
import { EducationalService } from './educational.service';

@Module({
  controllers: [EducationalController],
  providers: [EducationalService],
  exports: [EducationalService],
})
export class EducationalModule {}
