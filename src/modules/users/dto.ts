import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';
import { ROLES, type Role } from '../../common/jwt';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password: string;

  @IsIn(ROLES)
  role: Role;
}

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  displayName?: string;

  @IsIn(ROLES)
  @IsOptional()
  role?: Role;

  @IsIn(['ENABLED', 'DISABLED'])
  @IsOptional()
  status?: 'ENABLED' | 'DISABLED';
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  password: string;
}

export class UserQueryDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @IsOptional()
  @IsIn(['ENABLED', 'DISABLED'])
  status?: 'ENABLED' | 'DISABLED';
}
