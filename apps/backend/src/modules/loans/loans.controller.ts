import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/auth.guards';
import { BorrowLoanDto, LoanQueryDto, ReturnLoanDto } from './loan.dto';
import { LoansService } from './loans.service';
@ApiTags('Loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}
  @ApiOperation({
    summary: 'Issue an available book copy to an eligible member (LIBRARIAN, ADMIN).',
  })
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post('borrow')
  borrow(@Body() dto: BorrowLoanDto, @CurrentUser() user: { id: string }) {
    return this.loans.borrow(dto, user);
  }
  @ApiOperation({
    summary: 'Return an active or overdue loan and update copy availability (LIBRARIAN, ADMIN).',
  })
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post(':id/return')
  returnLoan(
    @Param('id') id: string,
    @Body() dto: ReturnLoanDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.loans.returnLoan(id, dto, user);
  }
  @ApiOperation({
    summary: 'Renew an eligible active loan; MEMBERS may renew only their own loan.',
  })
  @Roles(UserRole.MEMBER, UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post(':id/renew')
  renew(@Param('id') id: string, @CurrentUser() user: { id: string; role: UserRole }) {
    return this.loans.renew(id, user);
  }
  @ApiOperation({ summary: 'List the authenticated member’s loans.' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'OVERDUE', 'RETURNED'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Roles(UserRole.MEMBER)
  @Get('me')
  mine(@Query() query: LoanQueryDto, @CurrentUser() user: { id: string }) {
    return this.loans.list(query, user.id);
  }
  @ApiOperation({ summary: 'Search and filter all loans (LIBRARIAN, ADMIN).' })
  @ApiQuery({ name: 'q', required: false, description: 'Member, title, copy code, or barcode.' })
  @ApiQuery({ name: 'memberId', required: false })
  @ApiQuery({ name: 'bookId', required: false })
  @ApiQuery({ name: 'copyId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'OVERDUE', 'RETURNED'] })
  @ApiQuery({ name: 'borrowedFrom', required: false, description: 'ISO 8601 date-time.' })
  @ApiQuery({ name: 'borrowedTo', required: false, description: 'ISO 8601 date-time.' })
  @ApiQuery({ name: 'dueFrom', required: false, description: 'ISO 8601 date-time.' })
  @ApiQuery({ name: 'dueTo', required: false, description: 'ISO 8601 date-time.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Get()
  list(@Query() query: LoanQueryDto) {
    return this.loans.list(query);
  }
  @ApiOperation({ summary: 'Get a loan; MEMBERS may view only their own loan.' })
  @Roles(UserRole.MEMBER, UserRole.LIBRARIAN, UserRole.ADMIN)
  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: { id: string; role: UserRole }) {
    return this.loans.detail(id, user);
  }
}
