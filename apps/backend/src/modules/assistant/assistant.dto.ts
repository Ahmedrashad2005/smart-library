import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { assistantIntents, type AssistantIntent } from './assistant.client';

export class AssistantHistoryTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;

  @ApiPropertyOptional({ type: [String], maxItems: 4 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  bookIds?: string[];
}

export class AssistantContextDto {
  @ApiPropertyOptional({ type: [String], maxItems: 4 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  referencedBookIds?: string[];

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  selectedBookId?: string;

  @ApiPropertyOptional({ enum: assistantIntents })
  @IsOptional()
  @IsIn(assistantIntents)
  lastIntent?: AssistantIntent;
}

export class AssistantMessageDto {
  @ApiProperty({ maxLength: 1000, example: 'رشح لي كتاب عن الشبكات' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({ enum: ['ar', 'en'], default: 'ar' })
  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: 'ar' | 'en';

  @ApiPropertyOptional({ type: [AssistantHistoryTurnDto], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AssistantHistoryTurnDto)
  history?: AssistantHistoryTurnDto[];

  @ApiPropertyOptional({ type: AssistantContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssistantContextDto)
  context?: AssistantContextDto;
}
