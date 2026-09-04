import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { pipeline } from 'stream/promises';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/auth.decorators';
import { JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard } from '../../common/auth.guards';
import { CatalogService } from './catalog.service';
import { BookCoverService, coverMaxBytes, type UploadedCoverFile } from './book-cover.service';
import {
  CopyStatusDto,
  CreateBookDto,
  CreateCopyDto,
  UpdateBookDto,
  UpdateCopyDto,
} from './catalog.dto';
@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly covers: BookCoverService,
  ) {}
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Browse the catalog, including safe NAWA Campus discovery' })
  @ApiQuery({ name: 'q', required: false, description: 'Book title, ISBN, or author search.' })
  @ApiQuery({ name: 'available', required: false, type: Boolean })
  @ApiQuery({
    name: 'facultySlug',
    required: false,
    description: 'Filter by an active Delta University faculty technical slug.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'archiveState',
    required: false,
    enum: ['active', 'archived', 'all'],
    description: 'Archived states require LIBRARIAN or ADMIN.',
  })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    type: Boolean,
    description: 'Equivalent to archiveState=all for authorized managers.',
  })
  @ApiQuery({
    name: 'campus',
    required: false,
    type: Boolean,
    description: 'Return only books with active physical NAWA Campus copies.',
  })
  @ApiQuery({
    name: 'sourceCollection',
    required: false,
    type: String,
    description: 'Filter Campus books by an exact supplied source collection.',
  })
  @Get('books')
  books(
    @Query()
    query: {
      q?: string;
      categoryId?: string;
      facultySlug?: string;
      language?: string;
      available?: string;
      campus?: string;
      sourceCollection?: string;
      sort?: string;
      page?: string;
      limit?: string;
      includeArchived?: string;
      archiveState?: 'active' | 'archived' | 'all';
    },
    @CurrentUser() user?: { role: UserRole },
  ) {
    return this.catalog.listBooks(query, user);
  }
  @Public() @Get('books/search') search(
    @Query() query: { q?: string; page?: string; limit?: string },
  ) {
    return this.catalog.listBooks(query);
  }
  @Public() @Get('books/slug/:slug') bySlug(@Param('slug') slug: string) {
    return this.catalog.book(slug, true);
  }
  @Public() @Get('books/:id') byId(@Param('id') id: string) {
    return this.catalog.book(id);
  }
  @Public()
  @ApiOperation({ summary: 'Get current catalog and safe NAWA Campus availability' })
  @Get('books/:id/availability')
  async availability(@Param('id') id: string) {
    const book = await this.catalog.book(id);
    return book
      ? {
          totalCopies: book.totalCopies,
          availableCopies: book.availableCopies,
          campusAvailability: book.campusAvailability,
          locations: book.copies
            .filter((copy) => copy.status === 'AVAILABLE')
            .map(
              (copy) =>
                copy.campusLocation ?? {
                  section: {
                    id: copy.section.id,
                    nameEn: copy.section.nameEn,
                    nameAr: copy.section.nameAr,
                  },
                  floor: copy.section.floor,
                  room: copy.section.room,
                  shelf: copy.shelf.code,
                },
            ),
        }
      : null;
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: coverMaxBytes() } }))
  @Post('books/:id/cover')
  uploadCover(
    @Param('id') id: string,
    @UploadedFile() file: UploadedCoverFile | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.covers.upload(id, file, user);
  }

  @Get('books/:id/cover/:key')
  async cover(
    @Param('id') id: string,
    @Param('key') key: string,
    @Res() response: Response,
  ): Promise<void> {
    const cover = await this.covers.stream(id, key);
    response.set({
      'Content-Type': cover.mimeType,
      'Content-Length': String(cover.size),
      'Cache-Control': 'public, max-age=3600',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    await pipeline(cover.stream, response);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post('books')
  createBook(@Body() dto: CreateBookDto, @CurrentUser() user: { id: string }) {
    return this.catalog.createBook(dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Patch('books/:id')
  updateBook(
    @Param('id') id: string,
    @Body() dto: Partial<UpdateBookDto>,
    @CurrentUser() user: { id: string },
  ) {
    return this.catalog.updateBook(id, dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @ApiQuery({ name: 'archiveState', required: false, enum: ['active', 'archived', 'all'] })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Copy code, barcode, QR value, or book title.',
  })
  @ApiQuery({ name: 'bookId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['AVAILABLE', 'BORROWED', 'RESERVED', 'LOST', 'DAMAGED', 'MAINTENANCE', 'ARCHIVED'],
  })
  @ApiQuery({
    name: 'condition',
    required: false,
    enum: ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'],
  })
  @ApiQuery({ name: 'sectionId', required: false })
  @ApiQuery({ name: 'shelfId', required: false })
  @Get('book-copies')
  copies(
    @Query()
    query: {
      q?: string;
      bookId?: string;
      status?: import('@prisma/client').BookCopyStatus;
      condition?: import('@prisma/client').BookCopyCondition;
      sectionId?: string;
      shelfId?: string;
      includeArchived?: string;
      archiveState?: 'active' | 'archived' | 'all';
      page?: string;
      limit?: string;
    },
  ) {
    return this.catalog.listCopies(query);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post('book-copies')
  createCopy(@Body() dto: CreateCopyDto, @CurrentUser() user: { id: string }) {
    return this.catalog.createCopy(dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Patch('book-copies/:id')
  updateCopy(
    @Param('id') id: string,
    @Body() dto: Partial<UpdateCopyDto>,
    @CurrentUser() user: { id: string },
  ) {
    return this.catalog.updateCopy(id, dto, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Patch('book-copies/:id/status')
  status(@Param('id') id: string, @Body() dto: CopyStatusDto, @CurrentUser() user: { id: string }) {
    return this.catalog.updateCopyStatus(id, dto.status, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post('book-copies/:id/archive')
  archiveCopy(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.catalog.archiveCopy(id, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post('book-copies/:id/restore')
  restoreCopy(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.catalog.restoreCopy(id, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Get('book-copies/:id/qr')
  qr(@Param('id') id: string) {
    return this.catalog.copyQr(id);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Get('book-copies/:id')
  copy(@Param('id') id: string) {
    return this.catalog.copy(id);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post('books/:id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.catalog.archiveBook(id, user);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @Post('books/:id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.catalog.restoreBook(id, user);
  }
}
