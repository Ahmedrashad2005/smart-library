import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/auth.guards';
import { AuthorDto, CategoryDto, PublisherDto, SectionDto, ShelfDto } from './master-data.dto';
import { MasterDataService } from './master-data.service';

type Kind = 'category' | 'author' | 'publisher' | 'section' | 'shelf';
const kinds: Record<string, Kind> = {
  categories: 'category',
  authors: 'author',
  publishers: 'publisher',
  sections: 'section',
  shelves: 'shelf',
};

@ApiTags('Catalog management')
@Controller()
export class MasterDataController {
  constructor(private readonly master: MasterDataService) {}
  @Public()
  @Get(':resource(categories|authors|publishers|sections|shelves)')
  list(@Param('resource') resource: string, @Query('includeArchived') includeArchived?: string) {
    return this.master.list(kinds[resource]!, includeArchived === 'true');
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('categories')
  createCategory(@Body() dto: CategoryDto, @CurrentUser() user: { id: string }) {
    return this.master.create('category', dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('authors')
  createAuthor(@Body() dto: AuthorDto, @CurrentUser() user: { id: string }) {
    return this.master.create('author', dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('publishers')
  createPublisher(@Body() dto: PublisherDto, @CurrentUser() user: { id: string }) {
    return this.master.create('publisher', dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('sections')
  createSection(@Body() dto: SectionDto, @CurrentUser() user: { id: string }) {
    return this.master.create('section', dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('shelves')
  createShelf(@Body() dto: ShelfDto, @CurrentUser() user: { id: string }) {
    return this.master.create('shelf', dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':resource(categories|authors|publishers|sections|shelves)/:id')
  update(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: Partial<CategoryDto & AuthorDto & PublisherDto & SectionDto & ShelfDto>,
    @CurrentUser() user: { id: string },
  ) {
    return this.master.update(kinds[resource]!, id, dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':resource(categories|authors|publishers|sections|shelves)/:id/archive')
  archive(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.master.archive(kinds[resource]!, id, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post(':resource(categories|authors|publishers|sections|shelves)/:id/restore')
  restore(
    @Param('resource') resource: string,
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.master.restore(kinds[resource]!, id, user);
  }
}
