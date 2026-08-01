import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookCopyCondition, BookCopyStatus, Prisma, UserRole, type User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { CreateBookDto, CreateCopyDto, UpdateBookDto, UpdateCopyDto } from './catalog.dto';
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}
  async listBooks(
    query: {
      q?: string;
      categoryId?: string;
      language?: string;
      available?: string;
      sort?: string;
      page?: string;
      limit?: string;
      includeArchived?: string;
      archiveState?: 'active' | 'archived' | 'all';
    },
    user?: Pick<User, 'role'> | null,
  ) {
    const page = Math.max(1, Number(query.page ?? 1));
    const take = Math.min(50, Math.max(1, Number(query.limit ?? 12)));
    const archiveState =
      query.archiveState ?? (query.includeArchived === 'true' ? 'all' : 'active');
    const requestsArchived = archiveState !== 'active';
    if (
      requestsArchived &&
      !([UserRole.LIBRARIAN, UserRole.ADMIN] as UserRole[]).includes(user?.role as UserRole)
    ) {
      throw new ForbiddenException(
        'Archived catalog records require librarian or administrator access',
      );
    }
    const archiveWhere: Prisma.BookWhereInput =
      archiveState === 'archived'
        ? { isArchived: true }
        : archiveState === 'all'
          ? {}
          : { isArchived: false, deletedAt: null };
    const where: Prisma.BookWhereInput = {
      ...archiveWhere,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.language ? { language: query.language } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { titleAr: { contains: query.q, mode: 'insensitive' } },
              { isbn10: { contains: query.q } },
              { isbn13: { contains: query.q } },
              {
                authors: { some: { author: { name: { contains: query.q, mode: 'insensitive' } } } },
              },
            ],
          }
        : {}),
      ...(query.available === 'true' ? { availableCopies: { gt: 0 } } : {}),
    };
    const orderBy: Prisma.BookOrderByWithRelationInput[] =
      query.sort === 'title-desc'
        ? [{ title: 'desc' }]
        : query.sort === 'newest'
          ? [{ createdAt: 'desc' }]
          : [{ isFeatured: 'desc' }, { title: 'asc' }];
    const [items, total] = await this.prisma.$transaction([
      this.prisma.book.findMany({
        where,
        include: { category: true, publisher: true, authors: { include: { author: true } } },
        orderBy,
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.book.count({ where }),
    ]);
    return { items, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }
  async listCopies(query: {
    q?: string;
    bookId?: string;
    status?: BookCopyStatus;
    condition?: BookCopyCondition;
    sectionId?: string;
    shelfId?: string;
    includeArchived?: string;
    archiveState?: 'active' | 'archived' | 'all';
    page?: string;
    limit?: string;
  }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const take = Math.min(50, Math.max(1, Number(query.limit ?? 12)));
    const archiveState =
      query.archiveState ?? (query.includeArchived === 'true' ? 'all' : 'active');
    const archiveWhere: Prisma.BookCopyWhereInput =
      archiveState === 'archived'
        ? { isArchived: true }
        : archiveState === 'all'
          ? {}
          : { isArchived: false, deletedAt: null };
    const where: Prisma.BookCopyWhereInput = {
      ...archiveWhere,
      ...(query.bookId ? { bookId: query.bookId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.shelfId ? { shelfId: query.shelfId } : {}),
      ...(query.q
        ? {
            OR: [
              { copyCode: { contains: query.q, mode: 'insensitive' } },
              { barcode: { contains: query.q, mode: 'insensitive' } },
              { qrCodeValue: { contains: query.q, mode: 'insensitive' } },
              { book: { title: { contains: query.q, mode: 'insensitive' } } },
              { book: { titleAr: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.bookCopy.findMany({
        where,
        include: {
          book: { select: { id: true, title: true, titleAr: true, slug: true } },
          section: true,
          shelf: true,
        },
        orderBy: [{ isArchived: 'asc' }, { copyCode: 'asc' }],
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.bookCopy.count({ where }),
    ]);
    return {
      items: items.map((copy) => ({
        ...copy,
        location: {
          sectionId: copy.sectionId,
          shelfId: copy.shelfId,
          label: `${copy.section.floor} → ${copy.section.nameEn} → ${copy.shelf.code}`,
        },
      })),
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }
  async copy(id: string) {
    const copy = await this.prisma.bookCopy.findUnique({
      where: { id },
      include: {
        book: { select: { id: true, title: true, titleAr: true, slug: true } },
        section: true,
        shelf: true,
      },
    });
    if (!copy) throw new NotFoundException('Book copy not found');
    return {
      ...copy,
      location: {
        sectionId: copy.sectionId,
        shelfId: copy.shelfId,
        label: `${copy.section.floor} → ${copy.section.nameEn} → ${copy.shelf.code}`,
      },
    };
  }
  book(slugOrId: string, bySlug = false) {
    return this.prisma.book.findFirst({
      where: {
        ...(bySlug ? { slug: slugOrId } : { id: slugOrId }),
        isArchived: false,
        deletedAt: null,
      },
      include: {
        category: true,
        publisher: true,
        authors: { include: { author: true } },
        copies: { where: { isArchived: false }, include: { section: true, shelf: true } },
      },
    });
  }
  async createBook(dto: CreateBookDto, actor: Pick<User, 'id'> | null = null) {
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, isArchived: false, deletedAt: null },
    });
    if (!category) throw new BadRequestException('Invalid category');
    const authors = await this.prisma.author.count({
      where: { id: { in: dto.authorIds }, isArchived: false, deletedAt: null },
    });
    if (authors !== dto.authorIds.length) throw new BadRequestException('Invalid authors');
    const { authorIds, ...data } = dto;
    try {
      const book = await this.prisma.book.create({
        data: { ...data, authors: { create: authorIds.map((authorId) => ({ authorId })) } },
        include: { authors: { include: { author: true } } },
      });
      await this.audit.write('CREATE', 'book', book.id, actor, undefined, {
        newValues: book as unknown as Prisma.InputJsonValue,
      });
      return book;
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }
  async sync(bookId: string, tx: Prisma.TransactionClient = this.prisma) {
    const copies = await tx.bookCopy.findMany({
      where: { bookId, isArchived: false },
      select: { status: true },
    });
    return tx.book.update({
      where: { id: bookId },
      data: {
        totalCopies: copies.length,
        availableCopies: copies.filter((copy) => copy.status === BookCopyStatus.AVAILABLE).length,
      },
    });
  }
  async updateBook(id: string, dto: Partial<UpdateBookDto>, actor: Pick<User, 'id'> | null = null) {
    const old = await this.prisma.book.findFirst({
      where: { id, isArchived: false, deletedAt: null },
      include: { authors: true },
    });
    if (!old) throw new NotFoundException('Book not found');
    if (dto.categoryId) await this.assertActiveCategory(dto.categoryId);
    if (dto.publisherId) await this.assertActivePublisher(dto.publisherId);
    if (dto.authorIds) await this.assertAuthors(dto.authorIds);
    const { authorIds, ...data } = dto;
    try {
      const book = await this.prisma.$transaction(async (tx) =>
        tx.book.update({
          where: { id },
          data: {
            ...data,
            ...(authorIds
              ? { authors: { deleteMany: {}, create: authorIds.map((authorId) => ({ authorId })) } }
              : {}),
          },
          include: { authors: { include: { author: true } } },
        }),
      );
      await this.audit.write('UPDATE', 'book', id, actor, undefined, {
        oldValues: old as unknown as Prisma.InputJsonValue,
        newValues: book as unknown as Prisma.InputJsonValue,
      });
      return book;
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }
  async createCopy(dto: CreateCopyDto, actor: Pick<User, 'id'> | null = null) {
    return this.prisma.$transaction(async (tx) => {
      const shelf = await tx.shelf.findFirst({
        where: { id: dto.shelfId, sectionId: dto.sectionId, isArchived: false, deletedAt: null },
      });
      if (!shelf) throw new BadRequestException('Shelf does not belong to an active section');
      const code = dto.copyCode ?? `COPY-${randomUUID().slice(0, 8).toUpperCase()}`;
      const book = await tx.book.findFirst({
        where: { id: dto.bookId, isArchived: false, deletedAt: null },
      });
      if (!book) throw new BadRequestException('Book not found or archived');
      const copy = await tx.bookCopy.create({
        data: {
          ...dto,
          acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : undefined,
          copyCode: code,
          qrCodeValue: `copy:${code}`,
        },
      });
      await this.sync(dto.bookId, tx);
      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'bookCopy',
          entityId: copy.id,
          actorId: actor?.id,
          newValues: copy as unknown as Prisma.InputJsonValue,
        },
      });
      return copy;
    });
  }
  async updateCopy(id: string, dto: Partial<UpdateCopyDto>, actor: Pick<User, 'id'> | null = null) {
    return this.prisma.$transaction(async (tx) => {
      const old = await tx.bookCopy.findFirst({
        where: { id, isArchived: false, deletedAt: null },
      });
      if (!old) throw new NotFoundException('Book copy not found');
      const sectionId = dto.sectionId ?? old.sectionId;
      const shelfId = dto.shelfId ?? old.shelfId;
      const shelf = await tx.shelf.findFirst({
        where: { id: shelfId, sectionId, isArchived: false, deletedAt: null },
      });
      if (!shelf) throw new BadRequestException('Shelf does not belong to an active section');
      const { bookId: _bookId, copyCode: _copyCode, ...data } = dto;
      void _bookId;
      void _copyCode;
      const copy = await tx.bookCopy.update({
        where: { id },
        data: {
          ...data,
          sectionId,
          shelfId,
          acquisitionDate: dto.acquisitionDate ? new Date(dto.acquisitionDate) : undefined,
        },
      });
      await this.sync(copy.bookId, tx);
      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'bookCopy',
          entityId: id,
          actorId: actor?.id,
          oldValues: old as unknown as Prisma.InputJsonValue,
          newValues: copy as unknown as Prisma.InputJsonValue,
        },
      });
      return copy;
    });
  }
  async updateCopyStatus(
    id: string,
    status: BookCopyStatus,
    actor: Pick<User, 'id'> | null = null,
  ) {
    return this.updateCopy(id, { status }, actor);
  }
  async archiveCopy(id: string, actor: Pick<User, 'id'> | null = null) {
    return this.prisma.$transaction(async (tx) => {
      const old = await tx.bookCopy.findFirst({
        where: { id, isArchived: false, deletedAt: null },
      });
      if (!old) throw new NotFoundException('Book copy not found');
      const copy = await tx.bookCopy.update({
        where: { id },
        data: { isArchived: true, deletedAt: new Date(), status: BookCopyStatus.ARCHIVED },
      });
      await this.sync(copy.bookId, tx);
      await tx.auditLog.create({
        data: {
          action: 'ARCHIVE',
          entityType: 'bookCopy',
          entityId: id,
          actorId: actor?.id,
          oldValues: old as unknown as Prisma.InputJsonValue,
          newValues: copy as unknown as Prisma.InputJsonValue,
        },
      });
      return copy;
    });
  }
  async restoreCopy(id: string, actor: Pick<User, 'id'> | null = null) {
    return this.prisma.$transaction(async (tx) => {
      const old = await tx.bookCopy.findUnique({ where: { id } });
      if (!old) throw new NotFoundException('Book copy not found');
      const shelf = await tx.shelf.findFirst({
        where: { id: old.shelfId, sectionId: old.sectionId, isArchived: false, deletedAt: null },
      });
      if (!shelf)
        throw new BadRequestException('Copy cannot be restored without an active matching shelf');
      const copy = await tx.bookCopy.update({
        where: { id },
        data: { isArchived: false, deletedAt: null, status: BookCopyStatus.AVAILABLE },
      });
      await this.sync(copy.bookId, tx);
      await tx.auditLog.create({
        data: {
          action: 'RESTORE',
          entityType: 'bookCopy',
          entityId: id,
          actorId: actor?.id,
          oldValues: old as unknown as Prisma.InputJsonValue,
          newValues: copy as unknown as Prisma.InputJsonValue,
        },
      });
      return copy;
    });
  }
  async copyQr(id: string) {
    const copy = await this.prisma.bookCopy.findFirst({
      where: { id, isArchived: false, deletedAt: null },
      select: { id: true, copyCode: true, qrCodeValue: true },
    });
    if (!copy) throw new NotFoundException('Book copy not found');
    return { ...copy, value: copy.qrCodeValue };
  }
  async archiveBook(id: string, actor: Pick<User, 'id'> | null = null) {
    return this.prisma.$transaction(async (tx) => {
      const old = await tx.book.findFirst({ where: { id, isArchived: false, deletedAt: null } });
      if (!old) throw new NotFoundException('Book not found');
      const book = await tx.book.update({
        where: { id },
        data: { isArchived: true, deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          action: 'ARCHIVE',
          entityType: 'book',
          entityId: id,
          actorId: actor?.id,
          oldValues: old as unknown as Prisma.InputJsonValue,
          newValues: book as unknown as Prisma.InputJsonValue,
        },
      });
      return book;
    });
  }
  async restoreBook(id: string, actor: Pick<User, 'id'> | null = null) {
    return this.prisma.$transaction(async (tx) => {
      const old = await tx.book.findUnique({ where: { id } });
      if (!old) throw new NotFoundException('Book not found');
      const book = await tx.book.update({
        where: { id },
        data: { isArchived: false, deletedAt: null },
      });
      await tx.auditLog.create({
        data: {
          action: 'RESTORE',
          entityType: 'book',
          entityId: id,
          actorId: actor?.id,
          oldValues: old as unknown as Prisma.InputJsonValue,
          newValues: book as unknown as Prisma.InputJsonValue,
        },
      });
      return book;
    });
  }
  private async assertActiveCategory(id: string) {
    const entity = await this.prisma.category.findFirst({
      where: { id, isArchived: false, deletedAt: null },
    });
    if (!entity) throw new BadRequestException('Invalid category');
  }
  private async assertActivePublisher(id: string) {
    const entity = await this.prisma.publisher.findFirst({
      where: { id, isArchived: false, deletedAt: null },
    });
    if (!entity) throw new BadRequestException('Invalid publisher');
  }
  private async assertAuthors(ids: string[]) {
    const count = await this.prisma.author.count({
      where: { id: { in: ids }, isArchived: false, deletedAt: null },
    });
    if (!ids.length || count !== ids.length) throw new BadRequestException('Invalid authors');
  }
  private rethrowConstraint(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new BadRequestException('A record with this unique value already exists');
    throw error;
  }
}
