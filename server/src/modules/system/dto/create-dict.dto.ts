export class CreateDictItemDto {
  category: string;
  dictKey: string;
  label: string;
  order?: number;
  enabled?: boolean;
}

export class UpdateDictItemDto {
  label?: string;
  order?: number;
  enabled?: boolean;
}
