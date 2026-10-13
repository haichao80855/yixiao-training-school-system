import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { SystemService } from './system.service';
import { CreateOrgNodeDto, UpdateOrgNodeDto } from './dto/create-org-node.dto';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto/update-role.dto';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './dto/create-user.dto';
import { CreateDictItemDto, UpdateDictItemDto } from './dto/create-dict.dto';
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';

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

  @Put('roles/:id')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.systemService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.systemService.deleteRole(id);
  }

  // 6. 员工档案管理
  @Get('users')
  getUsers(
    @Query('keyword') keyword?: string,
    @Query('roleId') roleId?: string,
    @Query('status') status?: string,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.systemService.getUsers({ campusId: scope?.targetCampusId, keyword, roleId, status });
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.systemService.createUser(dto);
  }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.systemService.updateUser(id, dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.systemService.deleteUser(id);
  }

  @Patch('users/:id/password')
  resetUserPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.systemService.resetUserPassword(id, dto?.password);
  }

  @Patch('users/:id/status')
  toggleUserStatus(
    @Param('id') id: string,
    @Body('status') status?: string,
  ) {
    return this.systemService.toggleUserStatus(id, status);
  }

  // 7. 业务字典
  @Get('dict-items')
  getDictItems(@Query('category') category?: string) {
    return this.systemService.getDictItems(category);
  }

  @Post('dict-items')
  createDictItem(@Body() dto: CreateDictItemDto) {
    return this.systemService.createDictItem(dto);
  }

  @Put('dict-items/:id')
  updateDictItem(
    @Param('id') id: string,
    @Body() dto: UpdateDictItemDto,
  ) {
    return this.systemService.updateDictItem(id, dto);
  }

  @Delete('dict-items/:id')
  deleteDictItem(@Param('id') id: string) {
    return this.systemService.deleteDictItem(id);
  }

  @Patch('dict-items/:id/status')
  toggleDictItemStatus(
    @Param('id') id: string,
    @Body('enabled') enabled?: boolean,
  ) {
    return this.systemService.toggleDictItemStatus(id, enabled);
  }
}
