export class CreateUserDto {
  account: string;
  realName: string;
  phone?: string;
  email?: string;
  campusId: string;
  orgNodeId?: string;
  roleId: string;
  password?: string;
  status?: string;
  dataScope?: string;
}

export class UpdateUserDto {
  realName?: string;
  phone?: string;
  email?: string;
  campusId?: string;
  orgNodeId?: string;
  roleId?: string;
  status?: string;
  dataScope?: string;
}

export class ResetPasswordDto {
  password?: string;
}
