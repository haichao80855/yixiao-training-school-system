export class CreateOrgNodeDto {
  code: string;
  name: string;
  type: string; // group | region | campus | department | post
  level: number;
  parentId?: string;
  leader?: string;
  phone?: string;
}

export class UpdateOrgNodeDto {
  name?: string;
  leader?: string;
  phone?: string;
  status?: string;
}
