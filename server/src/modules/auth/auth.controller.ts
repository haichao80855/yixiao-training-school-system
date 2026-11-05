import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

export class LoginDto {
  account: string;
  password: string;
}

export class ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.account, body.password);
    return this.authService.login(user);
  }

  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  /** 修改本人密码：须校验原密码，不依赖 system:user:resetPwd 管理权限 */
  @Post('change-password')
  async changePassword(@CurrentUser('id') userId: string, @Body() body: ChangePasswordDto) {
    return this.authService.changeOwnPassword(userId, body?.oldPassword, body?.newPassword);
  }
}
