import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/auth.guards';
import { UpdateMeDto, UpdateRoleDto, UpdateStatusDto } from './users.dto';
import { UsersService } from './users.service';
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me') me(@CurrentUser() user: { id: string }) {
    return this.users.me(user.id);
  }
  @Patch('me') updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.id, dto);
  }
  @Roles(UserRole.ADMIN) @Get() list() {
    return this.users.list();
  }
  @Roles(UserRole.ADMIN) @Get(':id') one(@Param('id') id: string) {
    return this.users.one(id);
  }
  @Roles(UserRole.ADMIN) @Patch(':id/status') status(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.users.status(id, dto.status);
  }
  @Roles(UserRole.ADMIN) @Patch(':id/role') role(
    @CurrentUser() actor: { id: string; role: UserRole },
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.users.role(actor, id, dto.role);
  }
}
