import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { ParentAdminController, ParentController } from './parent.controller';
import { ParentAuthService } from './parent-auth.service';
import { ParentChildrenService } from './parent-children.service';
import { ParentPortalService } from './parent-portal.service';
import { MediaLinksService } from './media-links.service';
import { WechatMiniProgramClient } from './wechat-mini-program.client';

@Module({
  imports: [AuthModule, UploadModule],
  controllers: [ParentController, ParentAdminController],
  providers: [ParentAuthService, ParentChildrenService, ParentPortalService, MediaLinksService, WechatMiniProgramClient],
})
export class ParentModule {}
