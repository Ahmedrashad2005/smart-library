import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ReservationStatus } from '@prisma/client';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Active NAWA Campus book to reserve. The service assigns an eligible physical copy.',
  })
  @IsUUID()
  bookId!: string;
}

export class CollectReservationDto {
  @ApiProperty({
    description: 'One-time pickup credential read from the member QR ticket or entered manually.',
  })
  @IsString()
  @MaxLength(512)
  pickupToken!: string;
}

export class ReservationQueryDto {
  @ApiProperty({
    required: false,
    enum: [...Object.values(ReservationStatus), 'ALL'],
    default: 'ALL',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn([...Object.values(ReservationStatus), 'ALL'])
  status?: ReservationStatus | 'ALL';

  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 12, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
