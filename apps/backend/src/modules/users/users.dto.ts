import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';
export class UpdateMeDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() preferredLanguage?: string;
}
export class UpdateStatusDto {
  @IsEnum(UserStatus) status!: UserStatus;
}
export class UpdateRoleDto {
  @IsEnum(UserRole) role!: UserRole;
}
