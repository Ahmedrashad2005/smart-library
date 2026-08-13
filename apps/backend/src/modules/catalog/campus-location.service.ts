import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import {
  CreateLibraryDto,
  CreateLibraryFloorDto,
  CreateLibraryRoomDto,
  UpdateLibraryDto,
  UpdateLibraryFloorDto,
  UpdateLibraryRoomDto,
} from './campus-location.dto';

@Injectable()
export class CampusLocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  listLibraries() {
    return this.prisma.library.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        nameEn: true,
        nameAr: true,
        descriptionEn: true,
        descriptionAr: true,
        building: true,
      },
      orderBy: { nameEn: 'asc' },
    });
  }

  async library(id: string) {
    const library = await this.prisma.library.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        code: true,
        nameEn: true,
        nameAr: true,
        descriptionEn: true,
        descriptionAr: true,
        building: true,
        floors: {
          where: { isActive: true },
          select: {
            id: true,
            floorNumber: true,
            nameEn: true,
            nameAr: true,
            sortOrder: true,
            rooms: {
              where: { isActive: true },
              select: {
                id: true,
                roomNumber: true,
                nameEn: true,
                nameAr: true,
                descriptionEn: true,
                descriptionAr: true,
              },
              orderBy: { roomNumber: 'asc' },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { floorNumber: 'asc' }],
        },
      },
    });
    if (!library) throw new NotFoundException('Library not found');
    return library;
  }

  async createLibrary(dto: CreateLibraryDto, actor: Pick<User, 'id'>) {
    return this.write('CREATE', 'library', actor, () => this.prisma.library.create({ data: dto }));
  }

  async updateLibrary(id: string, dto: UpdateLibraryDto, actor: Pick<User, 'id'>) {
    const old = await this.prisma.library.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Library not found');
    return this.write('UPDATE', 'library', actor, () =>
      this.prisma.library.update({ where: { id }, data: dto }),
    );
  }

  async createFloor(libraryId: string, dto: CreateLibraryFloorDto, actor: Pick<User, 'id'>) {
    const library = await this.prisma.library.findFirst({
      where: { id: libraryId, isActive: true },
    });
    if (!library) throw new BadRequestException('Floor requires an active library');
    return this.write('CREATE', 'libraryFloor', actor, () =>
      this.prisma.libraryFloor.create({ data: { ...dto, libraryId } }),
    );
  }

  async updateFloor(id: string, dto: UpdateLibraryFloorDto, actor: Pick<User, 'id'>) {
    const old = await this.prisma.libraryFloor.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Library floor not found');
    return this.write('UPDATE', 'libraryFloor', actor, () =>
      this.prisma.libraryFloor.update({ where: { id }, data: dto }),
    );
  }

  async createRoom(floorId: string, dto: CreateLibraryRoomDto, actor: Pick<User, 'id'>) {
    const floor = await this.prisma.libraryFloor.findFirst({
      where: { id: floorId, isActive: true, library: { isActive: true } },
    });
    if (!floor) throw new BadRequestException('Room requires an active floor and library');
    return this.write('CREATE', 'libraryRoom', actor, () =>
      this.prisma.libraryRoom.create({ data: { ...dto, floorId } }),
    );
  }

  async updateRoom(id: string, dto: UpdateLibraryRoomDto, actor: Pick<User, 'id'>) {
    const old = await this.prisma.libraryRoom.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Library room not found');
    return this.write('UPDATE', 'libraryRoom', actor, () =>
      this.prisma.libraryRoom.update({ where: { id }, data: dto }),
    );
  }

  private async write<T extends { id: string }>(
    action: string,
    entityType: string,
    actor: Pick<User, 'id'>,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      const entity = await operation();
      await this.audit.write(action, entityType, entity.id, actor, undefined, {
        newValues: entity as unknown as Prisma.InputJsonValue,
      });
      return entity;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new BadRequestException('A location record with this unique value already exists');
      throw error;
    }
  }
}
