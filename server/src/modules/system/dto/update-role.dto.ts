export class CreateRoleDto {
  code: string;
  name: string;
  description?: string;
  dataScope?: string; // all | campus | department | self
  permissionCodes?: string[];
}

export class UpdateRoleDto {
  name?: string;
  description?: string;
  dataScope?: string;
}

export class AssignPermissionsDto {
  permissionCodes: string[];
}
