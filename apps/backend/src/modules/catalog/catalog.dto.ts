import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { BookCopyCondition, BookCopyStatus } from '@prisma/client';
export class CreateBookDto {
  @IsString() title!: string;
  @IsOptional() @IsString() titleAr?: string;
  @IsString() slug!: string;
  @IsUUID() categoryId!: string;
  @IsArray() @ArrayNotEmpty() @IsUUID('4', { each: true }) authorIds!: string[];
  @IsOptional() @IsUUID() publisherId?: string;
  @IsOptional() @IsString() isbn10?: string;
  @IsOptional() @IsString() isbn13?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsUrl() coverImageUrl?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1000) @Max(2100) publicationYear?: number;
  @IsOptional() @IsString() sourcePublicationInfo?: string;
  @IsOptional() @IsString() ddc?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageCount?: number;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;
}
export class UpdateBookDto extends CreateBookDto {}
export class CreateCopyDto {
  @IsUUID() bookId!: string;
  @IsUUID() sectionId!: string;
  @IsUUID() shelfId!: string;
  @IsOptional() @IsUUID() homeLibraryRoomId?: string;
  @IsOptional() @IsString() copyCode?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsEnum(BookCopyStatus) status?: BookCopyStatus;
  @IsOptional() @IsEnum(BookCopyCondition) condition?: BookCopyCondition;
  @IsOptional() @IsDateString() acquisitionDate?: string;
  @IsOptional() @IsString() shelfLocationCode?: string;
  @IsOptional() @IsString() sourceInventoryReference?: string;
  @IsOptional() @IsString() sourceCollection?: string;
  @IsOptional() @IsString() notes?: string;
}
export class UpdateCopyDto extends CreateCopyDto {}
export class CopyStatusDto {
  @IsEnum(BookCopyStatus) status!: BookCopyStatus;
}
