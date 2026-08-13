import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookCopyCondition,
  BookCopyStatus,
  Prisma,
  ReservationStatus,
  UserRole,
  UserStatus,
  type User,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateReservationDto, ReservationQueryDto } from './reservation.dto';
import { ReservationPolicyService } from './reservation-policy.service';

const reservationInclude = {
  book: {
    select: {
      id: true,
      title: true,
      titleAr: true,
      slug: true,
      coverImageUrl: true,
      totalCopies: true,
      availableCopies: true,
    },
  },
  bookCopy: {
    select: {
      id: true,
      bookId: true,
      copyCode: true,
      status: true,
      condition: true,
      shelfLocationCode: true,
      section: { select: { id: true, code: true, nameEn: true, nameAr: true } },
      shelf: { select: { id: true, code: true, nameEn: true, nameAr: true } },
      homeLibraryRoom: {
        select: {
          id: true,
          roomNumber: true,
          nameEn: true,
          nameAr: true,
          floor: {
            select: {
              id: true,
              floorNumber: true,
              nameEn: true,
              nameAr: true,
              library: { select: { id: true, code: true, nameEn: true, nameAr: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ReservationInclude;

type ReservationRecord = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: ReservationPolicyService,
    private readonly catalog: CatalogService,
  ) {}

  async create(dto: CreateReservationDto, actor: Pick<User, 'id'>) {
    try {
      return await this.retry(() =>
        this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = CAST(${actor.id} AS uuid) FOR UPDATE`;
            const member = await tx.user.findUnique({ where: { id: actor.id } });
            if (
              !member ||
              member.role !== UserRole.MEMBER ||
              member.status !== UserStatus.ACTIVE ||
              !member.emailVerifiedAt ||
              member.deletedAt
            )
              throw new ForbiddenException('Member is not eligible to create reservations');

            const book = await tx.book.findFirst({
              where: { id: dto.bookId, isArchived: false, deletedAt: null },
              select: { id: true },
            });
            if (!book) throw new NotFoundException('Book not found');

            const operationAt = new Date();
            await this.expireDueForBook(book.id, operationAt, tx);
            const duplicate = await tx.reservation.findFirst({
              where: { memberId: member.id, bookId: book.id, status: ReservationStatus.ACTIVE },
              select: { id: true },
            });
            if (duplicate)
              throw new ConflictException('Member already has an active reservation for this book');

            const [selected] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
              SELECT copy."id"
              FROM "BookCopy" AS copy
              INNER JOIN "LibraryRoom" AS room ON room."id" = copy."homeLibraryRoomId"
              INNER JOIN "LibraryFloor" AS floor ON floor."id" = room."floorId"
              INNER JOIN "Library" AS library ON library."id" = floor."libraryId"
              INNER JOIN "LibrarySection" AS section ON section."id" = copy."sectionId"
              INNER JOIN "Shelf" AS shelf ON shelf."id" = copy."shelfId"
              WHERE copy."bookId" = CAST(${book.id} AS uuid)
                AND copy."status" = CAST(${BookCopyStatus.AVAILABLE} AS "BookCopyStatus")
                AND copy."condition" <> CAST(${BookCopyCondition.DAMAGED} AS "BookCopyCondition")
                AND copy."isArchived" = false AND copy."deletedAt" IS NULL
                AND room."isActive" = true AND floor."isActive" = true
                AND library."isActive" = true
                AND section."isArchived" = false AND section."deletedAt" IS NULL
                AND shelf."isArchived" = false AND shelf."deletedAt" IS NULL
              ORDER BY copy."copyCode" ASC, copy."id" ASC
              FOR UPDATE OF copy SKIP LOCKED
              LIMIT 1
            `);
            if (!selected) throw new ConflictException('No available Campus copy for this book');

            const expiresAt = await this.policy.expiresAt(operationAt, tx);
            await tx.bookCopy.update({
              where: { id: selected.id },
              data: { status: BookCopyStatus.RESERVED },
            });
            await this.catalog.sync(book.id, tx);
            const reservation = await tx.reservation.create({
              data: {
                memberId: member.id,
                bookId: book.id,
                bookCopyId: selected.id,
                status: ReservationStatus.ACTIVE,
                reservedAt: operationAt,
                expiresAt,
              },
              include: reservationInclude,
            });
            await tx.auditLog.create({
              data: {
                action: 'RESERVATION_CREATED',
                entityType: 'reservation',
                entityId: reservation.id,
                actorId: member.id,
                targetUserId: member.id,
                newValues: {
                  reservationId: reservation.id,
                  memberId: member.id,
                  bookId: book.id,
                  bookCopyId: selected.id,
                  reservedAt: operationAt.toISOString(),
                  expiresAt: expiresAt.toISOString(),
                  previousCopyStatus: BookCopyStatus.AVAILABLE,
                  newCopyStatus: BookCopyStatus.RESERVED,
                },
              },
            });
            return this.present(reservation);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      if (this.isUniqueConflict(error))
        throw new ConflictException('An active reservation already exists for this book or copy');
      throw error;
    }
  }

  async mine(query: ReservationQueryDto, actor: Pick<User, 'id'>) {
    await this.processMemberDueExpirations(actor.id);
    const page = query.page ?? 1;
    const take = query.limit ?? 12;
    const where: Prisma.ReservationWhereInput = {
      memberId: actor.id,
      ...(query.status && query.status !== 'ALL' ? { status: query.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: reservationInclude,
        orderBy: [{ reservedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * take,
        take,
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return {
      items: items.map((reservation) => this.present(reservation)),
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async detail(id: string, actor: Pick<User, 'id'>) {
    const owner = await this.prisma.reservation.findUnique({
      where: { id },
      select: { memberId: true },
    });
    if (!owner) throw new NotFoundException('Reservation not found');
    if (owner.memberId !== actor.id)
      throw new ForbiddenException('Members can view only their own reservations');
    await this.expireIfDue(id, new Date(), false);
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: reservationInclude,
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return this.present(reservation);
  }

  async cancel(id: string, actor: Pick<User, 'id'>) {
    const outcome = await this.retry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const locked = await this.lockReservation(id, tx, false);
          if (!locked) throw new NotFoundException('Reservation not found');
          const reservation = await tx.reservation.findUnique({
            where: { id },
            include: reservationInclude,
          });
          if (!reservation) throw new NotFoundException('Reservation not found');
          if (reservation.memberId !== actor.id)
            throw new ForbiddenException('Members can cancel only their own reservations');
          if (reservation.status !== ReservationStatus.ACTIVE)
            throw new ConflictException(
              `Reservation is already ${reservation.status.toLowerCase()}`,
            );

          const operationAt = new Date();
          if (reservation.expiresAt <= operationAt) {
            await this.transitionExpired(reservation, operationAt, tx);
            return { expired: true as const };
          }
          this.assertReleasable(reservation);
          await tx.reservation.update({
            where: { id },
            data: { status: ReservationStatus.CANCELLED, cancelledAt: operationAt },
          });
          await tx.bookCopy.update({
            where: { id: reservation.bookCopyId },
            data: { status: BookCopyStatus.AVAILABLE },
          });
          await this.catalog.sync(reservation.bookId, tx);
          await tx.auditLog.create({
            data: {
              action: 'RESERVATION_CANCELLED',
              entityType: 'reservation',
              entityId: id,
              actorId: actor.id,
              targetUserId: reservation.memberId,
              oldValues: {
                reservationStatus: ReservationStatus.ACTIVE,
                copyStatus: BookCopyStatus.RESERVED,
              },
              newValues: {
                reservationStatus: ReservationStatus.CANCELLED,
                copyStatus: BookCopyStatus.AVAILABLE,
                cancelledAt: operationAt.toISOString(),
                memberId: reservation.memberId,
                bookId: reservation.bookId,
                bookCopyId: reservation.bookCopyId,
              },
            },
          });
          return {
            expired: false as const,
            reservation: await tx.reservation.findUniqueOrThrow({
              where: { id },
              include: reservationInclude,
            }),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    if (outcome.expired) throw new ConflictException('Reservation has expired');
    return this.present(outcome.reservation);
  }

  async processDueExpirations(now = new Date(), batchSize = 50): Promise<number> {
    const take = Math.min(100, Math.max(1, Math.floor(batchSize)));
    const candidates = await this.prisma.reservation.findMany({
      where: { status: ReservationStatus.ACTIVE, expiresAt: { lte: now } },
      select: { id: true },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take,
    });
    let processed = 0;
    for (const { id } of candidates) {
      try {
        if (await this.expireIfDue(id, now, true)) processed += 1;
      } catch (error) {
        this.logger.error(
          `Could not expire reservation ${id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return processed;
  }

  private async processMemberDueExpirations(memberId: string): Promise<void> {
    const now = new Date();
    const candidates = await this.prisma.reservation.findMany({
      where: { memberId, status: ReservationStatus.ACTIVE, expiresAt: { lte: now } },
      select: { id: true },
    });
    for (const { id } of candidates) await this.expireIfDue(id, now, false);
  }

  private async expireDueForBook(
    bookId: string,
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const due = await tx.reservation.findMany({
      where: { bookId, status: ReservationStatus.ACTIVE, expiresAt: { lte: now } },
      select: { id: true },
    });
    for (const { id } of due) {
      await this.lockReservation(id, tx, false);
      const reservation = await tx.reservation.findUniqueOrThrow({
        where: { id },
        include: reservationInclude,
      });
      if (reservation.status === ReservationStatus.ACTIVE && reservation.expiresAt <= now)
        await this.transitionExpired(reservation, now, tx);
    }
  }

  private async expireIfDue(id: string, now: Date, skipLocked: boolean): Promise<boolean> {
    return this.retry(() =>
      this.prisma.$transaction(
        async (tx) => {
          if (!(await this.lockReservation(id, tx, skipLocked))) return false;
          const reservation = await tx.reservation.findUnique({
            where: { id },
            include: reservationInclude,
          });
          if (
            !reservation ||
            reservation.status !== ReservationStatus.ACTIVE ||
            reservation.expiresAt > now
          )
            return false;
          await this.transitionExpired(reservation, now, tx);
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  private async transitionExpired(
    reservation: ReservationRecord,
    expiredAt: Date,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    this.assertReleasable(reservation);
    await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: ReservationStatus.EXPIRED },
    });
    await tx.bookCopy.update({
      where: { id: reservation.bookCopyId },
      data: { status: BookCopyStatus.AVAILABLE },
    });
    await this.catalog.sync(reservation.bookId, tx);
    await tx.auditLog.create({
      data: {
        action: 'RESERVATION_EXPIRED',
        entityType: 'reservation',
        entityId: reservation.id,
        actorId: null,
        targetUserId: reservation.memberId,
        oldValues: {
          reservationStatus: ReservationStatus.ACTIVE,
          copyStatus: BookCopyStatus.RESERVED,
        },
        newValues: {
          reservationStatus: ReservationStatus.EXPIRED,
          copyStatus: BookCopyStatus.AVAILABLE,
          expiredAt: expiredAt.toISOString(),
          memberId: reservation.memberId,
          bookId: reservation.bookId,
          bookCopyId: reservation.bookCopyId,
        },
      },
    });
  }

  private assertReleasable(reservation: ReservationRecord): void {
    if (
      reservation.bookCopyId !== reservation.bookCopy.id ||
      reservation.bookId !== reservation.bookCopy.bookId ||
      reservation.bookCopy.status !== BookCopyStatus.RESERVED
    )
      throw new ConflictException('Reservation copy state is inconsistent');
  }

  private async lockReservation(
    id: string,
    tx: Prisma.TransactionClient,
    skipLocked: boolean,
  ): Promise<boolean> {
    const rows = skipLocked
      ? await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "Reservation"
          WHERE "id" = CAST(${id} AS uuid)
          FOR UPDATE SKIP LOCKED
        `)
      : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id" FROM "Reservation"
          WHERE "id" = CAST(${id} AS uuid)
          FOR UPDATE
        `);
    return rows.length === 1;
  }

  private async retry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!this.isSerializationFailure(error)) throw error;
        if (attempt === 2)
          throw new ConflictException('Reservation state changed; please try again');
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
    throw new ConflictException('Reservation state changed; please try again');
  }

  private isSerializationFailure(error: unknown): boolean {
    const databaseCode =
      error instanceof Prisma.PrismaClientKnownRequestError ? String(error.meta?.code) : '';
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (['P2034', '40001'].includes(error.code) ||
        (error.code === 'P2010' && ['40001', '40P01'].includes(databaseCode)))
    );
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private present(reservation: ReservationRecord) {
    const { bookCopy, ...safeReservation } = reservation;
    const room = bookCopy.homeLibraryRoom;
    return {
      ...safeReservation,
      canCancel:
        reservation.status === ReservationStatus.ACTIVE && reservation.expiresAt > new Date(),
      bookCopy: {
        id: bookCopy.id,
        copyCode: bookCopy.copyCode,
        status: bookCopy.status,
        condition: bookCopy.condition,
      },
      pickupLocation: room
        ? {
            library: room.floor.library,
            floor: {
              id: room.floor.id,
              floorNumber: room.floor.floorNumber,
              nameEn: room.floor.nameEn,
              nameAr: room.floor.nameAr,
            },
            room: {
              id: room.id,
              roomNumber: room.roomNumber,
              nameEn: room.nameEn,
              nameAr: room.nameAr,
            },
            section: bookCopy.section,
            shelf: bookCopy.shelf,
            shelfLocationCode: bookCopy.shelfLocationCode,
          }
        : null,
      availability: {
        totalCopies: reservation.book.totalCopies,
        availableCopies: reservation.book.availableCopies,
      },
    };
  }
}
