import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { createReadStream } from 'fs';
import { mkdir, open, stat, unlink } from 'fs/promises';
import { basename, extname, resolve } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';

export const coverMaxBytes = (): number => Math.floor((Number(process.env.BOOK_COVER_MAX_MB) || 5) * 1024 * 1024);
export type UploadedCoverFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };
const types: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
@Injectable()
export class BookCoverService {
  readonly root = resolve(process.env.BOOK_COVER_STORAGE_DIR ?? resolve(process.cwd(), 'uploads', 'books', 'covers'));
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}
  async upload(bookId: string, file: UploadedCoverFile | undefined, actor: { id: string }) {
    if (!file) throw new BadRequestException('Cover image is required');
    if (file.size > coverMaxBytes()) throw new PayloadTooLargeException('Cover image is too large');
    const extension = types[file.mimetype];
    if (!extension) throw new BadRequestException('Cover must be JPG, PNG, or WebP');
    const validSignature = file.mimetype === 'image/jpeg' ? file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) : file.mimetype === 'image/png' ? file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : file.buffer.subarray(0, 4).equals(Buffer.from('RIFF')) && file.buffer.subarray(8, 12).equals(Buffer.from('WEBP'));
    if (!validSignature) throw new BadRequestException('Cover image content is invalid');
    const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { id: true, coverImageUrl: true } });
    if (!book) throw new NotFoundException('Book not found');
    await mkdir(this.root, { recursive: true });
    const key = `${randomUUID()}${extension}`;
    const handle = await open(resolve(this.root, key), 'wx', 0o600);
    try { await handle.writeFile(file.buffer); } finally { await handle.close(); }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.book.update({ where: { id: bookId }, data: { coverImageUrl: `${process.env.COVER_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/api/v1/books/${bookId}/cover/${key}` } });
        await tx.auditLog.create({ data: { actorId: actor.id, action: book.coverImageUrl ? 'BOOK_COVER_REPLACED' : 'BOOK_COVER_UPLOADED', entityType: 'book', entityId: bookId, oldValues: { coverImageUrl: book.coverImageUrl }, newValues: { coverImageUrl: result.coverImageUrl } } });
        return result;
      });
      return { coverImageUrl: updated.coverImageUrl };
    } catch (error) { await unlink(resolve(this.root, key)).catch(() => undefined); throw error; }
  }
  async stream(bookId: string, key: string) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { coverImageUrl: true } });
    if (!book || !book.coverImageUrl?.endsWith(`/${key}`)) throw new NotFoundException('Book cover not found');
    const safe = basename(key); const filePath = resolve(this.root, safe);
    try { const details = await stat(filePath); return { stream: createReadStream(filePath), size: details.size, mimeType: extname(safe).toLowerCase() === '.jpg' ? 'image/jpeg' : extname(safe).toLowerCase() === '.png' ? 'image/png' : 'image/webp' }; } catch { throw new NotFoundException('Book cover not found'); }
  }
}
