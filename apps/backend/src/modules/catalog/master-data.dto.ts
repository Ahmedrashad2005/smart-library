import { IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

export class CategoryDto {
  @IsString() nameEn!: string;
  @IsString() nameAr!: string;
  @IsString() slug!: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
}

export class AuthorDto {
  @IsString() name!: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() biography?: string;
  @IsOptional() @IsString() biographyAr?: string;
  @IsOptional() @IsString() nationality?: string;
}

export class PublisherDto {
  @IsString() name!: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() descriptionAr?: string;
}

export class SectionDto {
  @IsString() nameEn!: string;
  @IsString() nameAr!: string;
  @IsString() floor!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() room?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
}

export class ShelfDto {
  @IsUUID() sectionId!: string;
  @IsString() code!: string;
  @IsString() nameEn!: string;
  @IsString() nameAr!: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
}
