import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/auth.guards';
import {
  CreateLibraryDto,
  CreateLibraryFloorDto,
  CreateLibraryRoomDto,
  UpdateLibraryDto,
  UpdateLibraryFloorDto,
  UpdateLibraryRoomDto,
} from './campus-location.dto';
import { CampusLocationService } from './campus-location.service';

@ApiTags('NAWA Campus locations')
@Controller()
export class CampusLocationController {
  constructor(private readonly locations: CampusLocationService) {}

  @Public()
  @Get('libraries')
  @ApiOperation({ summary: 'List safe active Campus library locations' })
  libraries() {
    return this.locations.listLibraries();
  }

  @Public()
  @Get('libraries/:id')
  @ApiOperation({ summary: 'Get a safe active Campus library hierarchy' })
  library(@Param('id') id: string) {
    return this.locations.library(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('libraries')
  createLibrary(@Body() dto: CreateLibraryDto, @CurrentUser() user: { id: string }) {
    return this.locations.createLibrary(dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('libraries/:id')
  updateLibrary(
    @Param('id') id: string,
    @Body() dto: UpdateLibraryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.locations.updateLibrary(id, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('libraries/:libraryId/floors')
  createFloor(
    @Param('libraryId') libraryId: string,
    @Body() dto: CreateLibraryFloorDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.locations.createFloor(libraryId, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('library-floors/:id')
  updateFloor(
    @Param('id') id: string,
    @Body() dto: UpdateLibraryFloorDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.locations.updateFloor(id, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('library-floors/:floorId/rooms')
  createRoom(
    @Param('floorId') floorId: string,
    @Body() dto: CreateLibraryRoomDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.locations.createRoom(floorId, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('library-rooms/:id')
  updateRoom(
    @Param('id') id: string,
    @Body() dto: UpdateLibraryRoomDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.locations.updateRoom(id, dto, user);
  }
}
