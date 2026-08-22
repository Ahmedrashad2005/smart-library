import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { basename } from 'path';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { BookAssetStorageService } from './book-asset-storage.service';

export const previewMaxBytes = (): number => {
  const configured = Number(process.env.BOOK_PREVIEW_MAX_MB ?? 20);
  const megabytes = Number.isFinite(configured) && configured > 0 ? configured : 20;
  return Math.floor(megabytes * 1024 * 1024);
};

export type UploadedPreviewFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type PreviewBook = {
  id: string;
  title: string;
  previewPdfKey: string | null;
  previewPdfOriginalName: string | null;
  previewPdfMimeType: string | null;
  previewPdfSize: number | null;
  previewPdfUpdatedAt: Date | null;
};

@Injectable()
export class BookPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: BookAssetStorageService,
    private readonly audit: AuditLogService,
  ) {}

  async upload(bookId: string, file: UploadedPreviewFile | undefined, actor: Pick<User, 'id'>) {
    const book = await this.activeBook(bookId);
    const safeName = this.validate(file);
    const newKey = await this.storage.store(file!.buffer);
    let updated: PreviewBook;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.book.update({
          where: { id: bookId },
          data: {
            previewPdfKey: newKey,
            previewPdfOriginalName: safeName,
            previewPdfMimeType: 'application/pdf',
            previewPdfSize: file!.size,
            previewPdfUpdatedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: book.previewPdfKey ? 'REPLACE_PREVIEW_PDF' : 'UPLOAD_PREVIEW_PDF',
            entityType: 'book',
            entityId: bookId,
            oldValues: this.auditValues(book),
            newValues: this.auditValues(result),
          },
        });
        return result;
      });
    } catch (error) {
      await this.storage.remove(newKey);
      throw error;
    }
    if (book.previewPdfKey && book.previewPdfKey !== newKey) {
      await this.storage.remove(book.previewPdfKey).catch(() => undefined);
    }
    return this.presentation(updated);
  }

  async remove(bookId: string, actor: Pick<User, 'id'>) {
    const book = await this.activeBook(bookId);
    if (!book.previewPdfKey) return { removed: false, preview: this.presentation(book) };
    const oldKey = book.previewPdfKey;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.book.update({
        where: { id: bookId },
        data: {
          previewPdfKey: null,
          previewPdfOriginalName: null,
          previewPdfMimeType: null,
          previewPdfSize: null,
          previewPdfUpdatedAt: null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'DELETE_PREVIEW_PDF',
          entityType: 'book',
          entityId: bookId,
          oldValues: this.auditValues(book),
          newValues: this.auditValues(result),
        },
      });
      return result;
    });
    await this.storage.remove(oldKey).catch(() => undefined);
    return { removed: true, preview: this.presentation(updated) };
  }

  async stream(bookId: string) {
    const book = await this.activeBook(bookId);
    if (!book.previewPdfKey) throw new NotFoundException('Book preview PDF is unavailable');
    const stored = await this.storage.retrieve(book.previewPdfKey);
    return {
      ...stored,
      displayName: book.previewPdfOriginalName ?? `${book.title}-preview.pdf`,
    };
  }

  presentation(book: PreviewBook) {
    const available = Boolean(book.previewPdfKey);
    return {
      available,
      url: available ? `/books/${book.id}/preview-pdf` : null,
      originalName: available ? book.previewPdfOriginalName : null,
      size: available ? book.previewPdfSize : null,
      updatedAt: available ? book.previewPdfUpdatedAt : null,
    };
  }

  private async activeBook(id: string): Promise<PreviewBook> {
    const book = await this.prisma.book.findFirst({
      where: { id, isArchived: false, deletedAt: null },
    });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  private validate(file: UploadedPreviewFile | undefined): string {
    if (!file?.buffer?.length || file.size <= 0) {
      throw new BadRequestException('A non-empty PDF file is required');
    }
    if (file.size > previewMaxBytes()) {
      throw new PayloadTooLargeException('Book preview PDF exceeds the configured size limit');
    }
    const safeName = Array.from(basename(file.originalname.normalize('NFKC')))
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .slice(0, 180);
    if (!safeName.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Book preview must use the .pdf extension');
    }
    if (file.mimetype.toLowerCase() !== 'application/pdf') {
      throw new BadRequestException('Book preview must have the application/pdf MIME type');
    }
    if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new BadRequestException('The uploaded file is not a valid PDF');
    }
    return safeName || 'book-preview.pdf';
  }

  private auditValues(book: PreviewBook): Prisma.InputJsonValue {
    return {
      available: Boolean(book.previewPdfKey),
      originalName: book.previewPdfOriginalName,
      size: book.previewPdfSize,
      updatedAt: book.previewPdfUpdatedAt?.toISOString() ?? null,
    };
  }
}
