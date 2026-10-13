export class CreateOrgNodeDto {
  code: string;
  name: string;
  type: string; // group | region | campus | department | post
  level: number;
  parentId?: string;
  leader?: string;
  phone?: string;
  address?: string; // 校区节点可选物理地址
}

export class UpdateOrgNodeDto {
  name?: string;
  leader?: string;
  phone?: string;
  address?: string;
  status?: string;
}

export class CreateCampusDto {
  code: string;
  name: string;
  address?: string;
  phone?: string;
  isHeadquarter?: boolean;
  parentOrgNodeId?: string; // 挂载的大区组织树节点 ID
}

export class UpdateCampusDto {
  name?: string;
  address?: string;
  phone?: string;
  status?: string;
}

