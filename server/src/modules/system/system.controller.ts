import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { SystemService } from './system.service';
import { CreateOrgNodeDto, UpdateOrgNodeDto } from './dto/create-org-node.dto';
import { CreateRoleDto, AssignPermissionsDto } from './dto/update-role.dto';

@Controller('api/system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  // 1. 机构信息
  @Get('company')
  getCompanyInfo() {
    return this.systemService.getCompanyInfo();
  }

  // 2. 校区列表 (支持多校区切换浮标)
  @Get('campuses')
  getCampuses() {
    return this.systemService.getCampuses();
  }

  // 3. 5 级组织架构树
  @Get('org-tree')
  getOrgTree() {
    return this.systemService.getOrgTree();
  }

  @Post('org-tree')
  createOrgNode(@Body() dto: CreateOrgNodeDto) {
    return this.systemService.createOrgNode(dto);
  }

  @Put('org-tree/:id')
  updateOrgNode(@Param('id') id: string, @Body() dto: UpdateOrgNodeDto) {
    return this.systemService.updateOrgNode(id, dto);
  }

  @Delete('org-tree/:id')
  deleteOrgNode(@Param('id') id: string) {
    return this.systemService.deleteOrgNode(id);
  }

  // 4. 4 级权限清单
  @Get('permissions')
  getPermissions() {
    return this.systemService.getPermissions();
  }

  // 5. 角色列表与配置
  @Get('roles')
  getRoles() {
    return this.systemService.getRoles();
  }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.systemService.createRole(dto);
  }

  @Post('roles/:id/permissions')
  assignRolePermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.systemService.assignRolePermissions(id, dto);
  }

  // 6. 业务字典
  @Get('dict-items')
  getDictItems(@Query('category') category?: string) {
    return this.systemService.getDictItems(category);
  }
}
