import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export const DICTIONARY_TYPES = ['CATEGORY', 'UNIT'] as const;
export type DictionaryType = (typeof DICTIONARY_TYPES)[number];

export class CreateDictionaryDto {
  @IsIn(DICTIONARY_TYPES)
  type: DictionaryType;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateDictionaryDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn([true, false])
  enabled?: boolean;
}

export class DictionaryQueryDto extends PaginationQuery {
  @IsOptional()
  @IsIn(DICTIONARY_TYPES)
  type?: DictionaryType;

  /** 传 '1' 时包含已停用项（管理页面用） */
  @IsOptional()
  @IsIn(['0', '1'])
  includeDisabled?: string;
}
