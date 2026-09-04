import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BookCopyCondition, LoanStatus } from '@prisma/client';

export class BorrowLoanDto {
  @ApiProperty({ format: 'uuid', description: 'Verified MEMBER user identifier.' })
  @IsUUID()
  memberId!: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Use one copy identifier.' })
  @IsOptional()
  @IsUUID()
  bookCopyId?: string;
  @ApiPropertyOptional({ description: 'Physical library copy code.' })
  @IsOptional()
  @IsString()
  copyCode?: string;
  @ApiPropertyOptional({ description: 'Scanned barcode value.' })
  @IsOptional()
  @IsString()
  barcode?: string;
  @ApiPropertyOptional({ description: 'Scanned QR value.' })
  @IsOptional()
  @IsString()
  qrCodeValue?: string;
}
export class ReturnLoanDto {
  @ApiProperty({
    enum: BookCopyCondition,
    description: 'Condition observed when the copy is returned.',
  })
  @IsEnum(BookCopyCondition)
  returnCondition!: BookCopyCondition;
  @ApiPropertyOptional({ description: 'Optional staff return note.' })
  @IsOptional()
  @IsString()
  returnNotes?: string;
}
export class LoanQueryDto {
  @ApiPropertyOptional({ description: 'Member name/email, book title, copy code, or barcode.' })
  @IsOptional()
  @IsString()
  q?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  memberId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  bookId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  copyId?: string;
  @ApiPropertyOptional({ enum: LoanStatus })
  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  borrowedFrom?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  borrowedTo?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
