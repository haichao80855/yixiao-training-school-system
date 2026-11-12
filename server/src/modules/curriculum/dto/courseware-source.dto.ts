import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveCoursewareDto {
  @IsIn(['download', 'preview'])
  purpose: 'download' | 'preview';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pptUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  filename?: string;
}

export class UpdateCoursewareSourceModeDto {
  @IsIn(['auto', 'origin', 'mirror'])
  mode: 'auto' | 'origin' | 'mirror';
}
