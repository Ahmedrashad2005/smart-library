import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/auth.guards';
import {
  CollectReservationDto,
  CreateReservationDto,
  ReservationQueryDto,
} from './reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @ApiOperation({
    summary: 'Reserve one available physical Campus copy for the authenticated member.',
    description:
      'Atomically assigns a Campus copy, marks it RESERVED, updates book availability, and creates an ACTIVE reservation. The response includes a one-time pickup credential only for this authenticated member.',
  })
  @ApiCreatedResponse({
    description:
      'Safe reservation summary with book, assigned copy, pickup location, and committed availability.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication is required or the account is inactive.',
  })
  @ApiForbiddenResponse({ description: 'Only an authenticated MEMBER may reserve for themselves.' })
  @ApiNotFoundResponse({ description: 'The requested active book does not exist.' })
  @ApiConflictResponse({
    description:
      'No eligible Campus copy remains, or the member already has an ACTIVE reservation for this book.',
  })
  @Roles(UserRole.MEMBER)
  @Post()
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: { id: string }) {
    return this.reservations.create(dto, user);
  }

  @ApiOperation({ summary: 'List reservations for librarian operations.' })
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Get()
  staffList(
    @Query() query: ReservationQueryDto,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reservations.staffList(query, Number(page ?? 1), Number(limit ?? 12));
  }

  @ApiOperation({
    summary: 'Collect a reservation ticket and atomically create its one associated loan.',
    description:
      'LIBRARIAN and ADMIN only. The QR payload or manually entered one-time credential is verified without persisting its plaintext value.',
  })
  @ApiBadRequestResponse({ description: 'The pickup credential format is invalid.' })
  @ApiConflictResponse({
    description:
      'The reservation is no longer active, expired, already collected, or its copy/member is ineligible.',
  })
  @ApiNotFoundResponse({ description: 'No reservation matches the pickup credential.' })
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post('collect-by-token')
  collectByToken(@Body() dto: CollectReservationDto, @CurrentUser() user: { id: string }) {
    return this.reservations.collectByToken(dto.pickupToken, user);
  }

  @ApiOperation({ summary: "List the authenticated member's reservations." })
  @ApiOkResponse({
    description:
      'Newest-first paginated safe reservations with book, copy, Campus location, and cancellation eligibility.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'cancelled', 'expired', 'collected', 'all'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 50, default: 12 },
  })
  @ApiBadRequestResponse({ description: 'Status, page, or limit query validation failed.' })
  @Roles(UserRole.MEMBER)
  @Get('me')
  mine(@Query() query: ReservationQueryDto, @CurrentUser() user: { id: string }) {
    return this.reservations.mine(query, user);
  }

  @ApiOperation({ summary: 'Get one reservation owned by the authenticated member.' })
  @ApiOkResponse({ description: 'Safe reservation details after defensive expiration processing.' })
  @ApiBadRequestResponse({ description: 'Reservation ID is not a UUID.' })
  @ApiForbiddenResponse({ description: 'The reservation belongs to another member.' })
  @ApiNotFoundResponse({ description: 'Reservation not found.' })
  @Roles(UserRole.MEMBER)
  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: { id: string }) {
    return this.reservations.detail(id, user);
  }

  @ApiOperation({
    summary: 'Cancel one owned ACTIVE reservation and release its physical copy.',
  })
  @ApiCreatedResponse({
    description: 'Committed CANCELLED reservation, AVAILABLE copy, and synchronized availability.',
  })
  @ApiBadRequestResponse({ description: 'Reservation ID is not a UUID.' })
  @ApiForbiddenResponse({ description: 'The reservation belongs to another member.' })
  @ApiNotFoundResponse({ description: 'Reservation not found.' })
  @ApiConflictResponse({
    description: 'The reservation is already cancelled, expired, collected, or inconsistent.',
  })
  @Roles(UserRole.MEMBER)
  @Post(':id/cancel')
  cancel(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: { id: string }) {
    return this.reservations.cancel(id, user);
  }
}
