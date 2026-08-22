import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { pipeline } from 'stream/promises';
import { CurrentUser, Roles } from '../../common/auth.decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/auth.guards';
import {
  BookPreviewService,
  previewMaxBytes,
  type UploadedPreviewFile,
} from './book-preview.service';

@ApiTags('Catalog')
@Controller('books/:bookId/preview-pdf')
export class BookPreviewController {
  constructor(private readonly previews: BookPreviewService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: previewMaxBytes() } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or replace a Book-level preview PDF' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Safe preview presentation metadata.' })
  upload(
    @Param('bookId') bookId: string,
    @UploadedFile() file: UploadedPreviewFile | undefined,
    @CurrentUser() user: { id: string },
  ) {
    return this.previews.upload(bookId, file, user);
  }

  @Delete()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.LIBRARIAN, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a Book-level preview PDF without changing physical copies' })
  remove(@Param('bookId') bookId: string, @CurrentUser() user: { id: string }) {
    return this.previews.remove(bookId, user);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stream the preview PDF inline to an authenticated user' })
  @ApiResponse({ status: 200, description: 'Inline application/pdf stream.' })
  async view(@Param('bookId') bookId: string, @Res() response: Response): Promise<void> {
    const preview = await this.previews.stream(bookId);
    const fallback = `book-${bookId}-preview.pdf`;
    const encoded = encodeURIComponent(preview.displayName).replace(
      /['()*]/g,
      (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(preview.size),
      'Content-Disposition': `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    await pipeline(preview.stream, response);
  }
}
