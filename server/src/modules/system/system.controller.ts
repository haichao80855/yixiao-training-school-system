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
import { CreateOrgNodeDto, UpdateOrgNodeDto, CreateCampusDto, UpdateCampusDto } from './dto/create-org-node.dto';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto/update-role.dto';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './dto/create-user.dto';
import { CreateDictItemDto, UpdateDictItemDto } from './dto/create-dict.dto';
import { UpdateCompanyDto, TransferAdminDto } from './dto/update-company.dto';
import { CampusScope, CampusScopeResult } from '../../common/campus-scope.policy';
import { RequirePermissions, RequireAnyPermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  // 1. 机构信息
  @Get('company')
  @RequirePermissions('system:view')
  getCompanyInfo() {
    return this.systemService.getCompanyInfo();
  }

  @Put('company')
  @RequirePermissions('system:company:edit')
  updateCompanyInfo(@Body() dto: UpdateCompanyDto) {
    return this.systemService.updateCompanyInfo(dto);
  }

  @Post('company/transfer-admin')
  @RequirePermissions('system:company:edit')
  transferSuperAdmin(
    @CurrentUser('id') currentUserId: string,
    @Body() dto: TransferAdminDto,
  ) {
    return this.systemService.transferSuperAdmin(currentUserId, dto);
  }

  // 2. 校区列表 (支持多校区切换浮标，已登录用户基础功能)
  @Get(['campuses', 'campus'])
  getCampuses() {
    return this.systemService.getCampuses();
  }

  @Post('campuses')
  @RequirePermissions('system:org:add')
  createCampus(@Body() dto: CreateCampusDto) {
    return this.systemService.createCampus(dto);
  }

  @Put('campuses/:id')
  @RequirePermissions('system:org:edit')
  updateCampus(@Param('id') id: string, @Body() dto: UpdateCampusDto) {
    return this.systemService.updateCampus(id, dto);
  }

  @Delete('campuses/:id')
  @RequirePermissions('system:org:delete')
  deleteCampus(@Param('id') id: string) {
    return this.systemService.deleteCampus(id);
  }

  // 3. 5 级组织架构树
  @Get('org-tree')
  @RequirePermissions('system:org:view')
  getOrgTree() {
    return this.systemService.getOrgTree();
  }

  @Post('org-tree')
  @RequirePermissions('system:org:add')
  createOrgNode(@Body() dto: CreateOrgNodeDto) {
    return this.systemService.createOrgNode(dto);
  }

  @Put('org-tree/:id')
  @RequirePermissions('system:org:edit')
  updateOrgNode(@Param('id') id: string, @Body() dto: UpdateOrgNodeDto) {
    return this.systemService.updateOrgNode(id, dto);
  }

  @Delete('org-tree/:id')
  @RequirePermissions('system:org:delete')
  deleteOrgNode(@Param('id') id: string) {
    return this.systemService.deleteOrgNode(id);
  }

  // 4. 4 级权限清单与权威树
  @Get('permissions')
  @RequirePermissions('system:role:view')
  getPermissions(@Query('flat') flat?: string) {
    return this.systemService.getPermissions({ flat: flat === 'true' });
  }

  // 5. 角色列表与配置
  @Get('roles')
  @RequirePermissions('system:role:view')
  getRoles() {
    return this.systemService.getRoles();
  }

  @Post('roles')
  @RequirePermissions('system:role:add')
  createRole(@Body() dto: CreateRoleDto) {
    return this.systemService.createRole(dto);
  }

  @Post('roles/:id/permissions')
  @RequirePermissions('system:role:edit')
  assignRolePermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.systemService.assignRolePermissions(id, dto);
  }

  @Put('roles/:id')
  @RequirePermissions('system:role:edit')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.systemService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions('system:role:delete')
  deleteRole(@Param('id') id: string) {
    return this.systemService.deleteRole(id);
  }

  // 6. 员工档案管理
  @Get('users')
  @RequireAnyPermissions(
    'system:user:view',
    'system:org:view',
    'educational:workbench',
    'educational:timeSchedule',
    'educational:classManagement',
    'educational:attendance',
  )
  getUsers(
    @Query('keyword') keyword?: string,
    @Query('roleId') roleId?: string,
    @Query('status') status?: string,
    @Query('orgNodeId') orgNodeId?: string,
    @CampusScope() scope?: CampusScopeResult,
  ) {
    return this.systemService.getUsers({
      campusId: scope?.targetCampusId,
      keyword,
      roleId,
      status,
      orgNodeId,
    });
  }

  @Post('users')
  @RequirePermissions('system:user:add')
  createUser(@Body() dto: CreateUserDto) {
    return this.systemService.createUser(dto);
  }

  @Put('users/:id')
  @RequirePermissions('system:user:edit')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.systemService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @RequirePermissions('system:user:delete')
  deleteUser(@Param('id') id: string) {
    return this.systemService.deleteUser(id);
  }

  @Patch('users/:id/password')
  @RequirePermissions('system:user:resetPwd')
  resetUserPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.systemService.resetUserPassword(id, dto?.password);
  }

  @Patch('users/:id/status')
  @RequirePermissions('system:user:status')
  toggleUserStatus(
    @Param('id') id: string,
    @Body('status') status?: string,
  ) {
    return this.systemService.toggleUserStatus(id, status);
  }

  // 7. 业务字典 (开放已登录操作员安全读取公共业务枚举与参数)
  @Get('dict-items')
  getDictItems(@Query('category') category?: string) {
    return this.systemService.getDictItems(category);
  }

  // 7.1 字典缓存运行指标 (超管与运维诊断)
  @Get('dict-items/cache/stats')
  @RequirePermissions('system:dict:view')
  getDictCacheStats() {
    return this.systemService.getDictCacheStats();
  }

  @Post('dict-items')
  @RequirePermissions('system:dict:add')
  createDictItem(@Body() dto: CreateDictItemDto) {
    return this.systemService.createDictItem(dto);
  }

  @Put('dict-items/:id')
  @RequirePermissions('system:dict:edit')
  updateDictItem(
    @Param('id') id: string,
    @Body() dto: UpdateDictItemDto,
  ) {
    return this.systemService.updateDictItem(id, dto);
  }

  @Delete('dict-items/:id')
  @RequirePermissions('system:dict:delete')
  deleteDictItem(@Param('id') id: string) {
    return this.systemService.deleteDictItem(id);
  }

  @Patch('dict-items/:id/status')
  @RequirePermissions('system:dict:edit')
  toggleDictItemStatus(
    @Param('id') id: string,
    @Body('enabled') enabled?: boolean,
  ) {
    return this.systemService.toggleDictItemStatus(id, enabled);
  }
}
