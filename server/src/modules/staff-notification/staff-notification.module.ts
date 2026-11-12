import { Module } from '@nestjs/common';
import { StaffNotificationController } from './staff-notification.controller';
import { StaffNotificationService } from './domain/staff-notification.service';

@Module({
  controllers: [StaffNotificationController],
  providers: [StaffNotificationService],
  exports: [StaffNotificationService],
})
export class StaffNotificationModule {}
