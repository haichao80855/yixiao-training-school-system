export class CreateDictItemDto {
  category: string;
  dictKey: string;
  label: string;
  order?: number;
  enabled?: boolean;
  remark?: string;
}

export class UpdateDictItemDto {
  label?: string;
  order?: number;
  enabled?: boolean;
  remark?: string;
}
