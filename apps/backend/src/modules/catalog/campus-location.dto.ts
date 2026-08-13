import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateLibraryDto {
  @IsString() @MaxLength(80) code!: string;
  @IsString() @MaxLength(160) nameEn!: string;
  @IsString() @MaxLength(160) nameAr!: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsString() @MaxLength(160) building?: string;
}

export class UpdateLibraryDto extends PartialType(CreateLibraryDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateLibraryFloorDto {
  @Type(() => Number) @IsInt() floorNumber!: number;
  @IsString() @MaxLength(120) nameEn!: string;
  @IsString() @MaxLength(120) nameAr!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateLibraryFloorDto extends PartialType(CreateLibraryFloorDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateLibraryRoomDto {
  @IsString() @MaxLength(40) roomNumber!: string;
  @IsString() @MaxLength(120) nameEn!: string;
  @IsString() @MaxLength(120) nameAr!: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
}

export class UpdateLibraryRoomDto extends PartialType(CreateLibraryRoomDto) {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
