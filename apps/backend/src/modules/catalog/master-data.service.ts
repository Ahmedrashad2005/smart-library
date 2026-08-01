import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { PrismaService } from '../../database/prisma.service';
import { AuthorDto, CategoryDto, PublisherDto, SectionDto, ShelfDto } from './master-data.dto';

type MasterKind = 'category' | 'author' | 'publisher' | 'section' | 'shelf';
type MasterDto = CategoryDto | AuthorDto | PublisherDto | SectionDto | ShelfDto;

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(kind: MasterKind, includeArchived = false) {
    const where = includeArchived ? {} : { isArchived: false, deletedAt: null };
    if (kind === 'shelf')
      return this.prisma.shelf.findMany({
        where,
        include: { section: true },
        orderBy: { code: 'asc' },
      });
    if (kind === 'section')
      return this.prisma.librarySection.findMany({
        where,
        include: { shelves: { where: { isArchived: false } } },
        orderBy: { code: 'asc' },
      });
    if (kind === 'category')
      return this.prisma.category.findMany({ where, orderBy: { nameEn: 'asc' } });
    if (kind === 'author') return this.prisma.author.findMany({ where, orderBy: { name: 'asc' } });
    return this.prisma.publisher.findMany({ where, orderBy: { name: 'asc' } });
  }

  async create(kind: MasterKind, dto: MasterDto, actor: Pick<User, 'id'> | null) {
    if (kind === 'shelf') await this.assertShelfSection((dto as ShelfDto).sectionId);
    try {
      const entity = await this.createEntity(kind, dto);
      await this.audit.write('CREATE', kind, entity.id, actor, undefined, {
        newValues: entity as Prisma.InputJsonValue,
      });
      return entity;
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async update(
    kind: MasterKind,
    id: string,
    dto: Partial<MasterDto>,
    actor: Pick<User, 'id'> | null,
  ) {
    const old = await this.findActive(kind, id);
    if (kind === 'shelf' && 'sectionId' in dto && dto.sectionId)
      await this.assertShelfSection(dto.sectionId);
    try {
      const entity = await this.updateEntity(kind, id, dto);
      await this.audit.write('UPDATE', kind, id, actor, undefined, {
        oldValues: old as Prisma.InputJsonValue,
        newValues: entity as Prisma.InputJsonValue,
      });
      return entity;
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async archive(kind: MasterKind, id: string, actor: Pick<User, 'id'> | null) {
    const old = await this.findActive(kind, id);
    if (kind === 'section') {
      const activeShelves = await this.prisma.shelf.count({
        where: { sectionId: id, isArchived: false },
      });
      if (activeShelves) throw new BadRequestException('Archive the section shelves first');
    }
    const entity = await this.updateEntity(kind, id, {
      isArchived: true,
      deletedAt: new Date(),
    } as never);
    await this.audit.write('ARCHIVE', kind, id, actor, undefined, {
      oldValues: old as Prisma.InputJsonValue,
      newValues: entity as Prisma.InputJsonValue,
    });
    return entity;
  }

  async restore(kind: MasterKind, id: string, actor: Pick<User, 'id'> | null) {
    const current = await this.findAny(kind, id);
    if (kind === 'shelf')
      await this.assertShelfSection((current as unknown as { sectionId: string }).sectionId);
    const entity = await this.updateEntity(kind, id, {
      isArchived: false,
      deletedAt: null,
    } as never);
    await this.audit.write('RESTORE', kind, id, actor, undefined, {
      oldValues: current as Prisma.InputJsonValue,
      newValues: entity as Prisma.InputJsonValue,
    });
    return entity;
  }

  private async assertShelfSection(sectionId: string) {
    const section = await this.prisma.librarySection.findFirst({
      where: { id: sectionId, isArchived: false, deletedAt: null },
    });
    if (!section) throw new BadRequestException('Shelf must belong to an active section');
  }

  private async findActive(kind: MasterKind, id: string) {
    const entity = await this.findAny(kind, id);
    if (!entity || entity.isArchived || entity.deletedAt)
      throw new NotFoundException(`${kind} not found`);
    return entity;
  }

  private async findAny(
    kind: MasterKind,
    id: string,
  ): Promise<{ isArchived: boolean; deletedAt: Date | null }> {
    const entity = await this.findEntity(kind, id);
    if (!entity) throw new NotFoundException(`${kind} not found`);
    return entity;
  }

  private findEntity(kind: MasterKind, id: string) {
    if (kind === 'category') return this.prisma.category.findUnique({ where: { id } });
    if (kind === 'author') return this.prisma.author.findUnique({ where: { id } });
    if (kind === 'publisher') return this.prisma.publisher.findUnique({ where: { id } });
    if (kind === 'section') return this.prisma.librarySection.findUnique({ where: { id } });
    return this.prisma.shelf.findUnique({ where: { id } });
  }

  private createEntity(kind: MasterKind, dto: MasterDto): Promise<{ id: string }> {
    if (kind === 'category') return this.prisma.category.create({ data: dto as CategoryDto });
    if (kind === 'author') return this.prisma.author.create({ data: dto as AuthorDto });
    if (kind === 'publisher') return this.prisma.publisher.create({ data: dto as PublisherDto });
    if (kind === 'section') return this.prisma.librarySection.create({ data: dto as SectionDto });
    return this.prisma.shelf.create({ data: dto as ShelfDto });
  }

  private updateEntity(
    kind: MasterKind,
    id: string,
    dto: Partial<MasterDto>,
  ): Promise<{ id: string }> {
    if (kind === 'category')
      return this.prisma.category.update({
        where: { id },
        data: dto as Prisma.CategoryUpdateInput,
      });
    if (kind === 'author')
      return this.prisma.author.update({ where: { id }, data: dto as Prisma.AuthorUpdateInput });
    if (kind === 'publisher')
      return this.prisma.publisher.update({
        where: { id },
        data: dto as Prisma.PublisherUpdateInput,
      });
    if (kind === 'section')
      return this.prisma.librarySection.update({
        where: { id },
        data: dto as Prisma.LibrarySectionUpdateInput,
      });
    return this.prisma.shelf.update({ where: { id }, data: dto as Prisma.ShelfUpdateInput });
  }

  private rethrowConstraint(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException('A record with this unique value already exists');
    }
    throw error;
  }
}
