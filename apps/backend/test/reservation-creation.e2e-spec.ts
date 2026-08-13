import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  BookCopyStatus,
  ReservationStatus,
  UserStatus,
  type Book,
  type BookCopy,
  type User,
} from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Phase 5.2.2 reservation creation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let firstMember: User;
  let secondMember: User;
  let firstMemberToken = '';
  let secondMemberToken = '';
  let librarianToken = '';
  let adminToken = '';
  let categoryId = '';
  let sectionId = '';
  let shelfId = '';
  let roomId = '';
  const suffix = `reservation-create-${Date.now()}`;
  let fixtureNumber = 0;
  const api = () => request(app.getHttpServer());

  const login = async (email: string) =>
    (await api().post('/api/v1/auth/login').send({ email, password: 'SmartLib123' })).body
      .accessToken as string;

  const createBook = async (
    statuses: BookCopyStatus[],
    options: { campus?: boolean; archived?: boolean } = {},
  ): Promise<{ book: Book; copies: BookCopy[] }> => {
    fixtureNumber += 1;
    const key = `${suffix}-${fixtureNumber}`;
    const book = await prisma.book.create({
      data: {
        title: `Reservation creation fixture ${fixtureNumber}`,
        slug: key,
        categoryId,
        totalCopies: statuses.length,
        availableCopies: statuses.filter((status) => status === BookCopyStatus.AVAILABLE).length,
        isArchived: options.archived ?? false,
        deletedAt: options.archived ? new Date() : null,
      },
    });
    const copies = await Promise.all(
      statuses.map((status, index) =>
        prisma.bookCopy.create({
          data: {
            bookId: book.id,
            copyCode: `${key}-copy-${String(index + 1).padStart(2, '0')}`,
            qrCodeValue: `copy:${key}-${index + 1}`,
            sectionId,
            shelfId,
            homeLibraryRoomId: options.campus === false ? null : roomId,
            shelfLocationCode: `F3-R315-${index + 1}`,
            status,
          },
        }),
      ),
    );
    return { book, copies };
  };

  const reserve = (token: string, bookId: string) =>
    api().post('/api/v1/reservations').set('Authorization', `Bearer ${token}`).send({ bookId });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const [category, shelf, memberOne, memberFive] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isArchived: false, deletedAt: null } }),
      prisma.shelf.findFirstOrThrow({
        where: {
          isArchived: false,
          deletedAt: null,
          section: {
            isArchived: false,
            deletedAt: null,
            locationRoom: {
              is: {
                isActive: true,
                floor: { isActive: true, library: { isActive: true } },
              },
            },
          },
        },
        include: { section: true },
      }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member1@smart-library.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member5@smart-library.test' } }),
    ]);
    categoryId = category.id;
    sectionId = shelf.sectionId;
    shelfId = shelf.id;
    roomId = shelf.section.roomId!;
    firstMember = memberOne;
    secondMember = memberFive;
    [firstMemberToken, secondMemberToken, librarianToken, adminToken] = await Promise.all([
      login(firstMember.email),
      login(secondMember.email),
      login('librarian1@smart-library.test'),
      login('admin@smart-library.test'),
    ]);
  });

  afterEach(async () => {
    await prisma.systemSetting.update({
      where: { key: 'reservation.pickupWindowHours' },
      data: { value: 24 },
    });
    await Promise.all([
      prisma.user.update({
        where: { id: firstMember.id },
        data: { status: UserStatus.ACTIVE, emailVerifiedAt: firstMember.emailVerifiedAt },
      }),
      prisma.user.update({
        where: { id: secondMember.id },
        data: { status: UserStatus.ACTIVE, emailVerifiedAt: secondMember.emailVerifiedAt },
      }),
    ]);
    const reservations = await prisma.reservation.findMany({
      where: { book: { slug: { startsWith: suffix } } },
      select: { id: true },
    });
    if (reservations.length)
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: reservations.map(({ id }) => id) } },
      });
    await prisma.reservation.deleteMany({ where: { book: { slug: { startsWith: suffix } } } });
    await prisma.bookCopy.deleteMany({ where: { book: { slug: { startsWith: suffix } } } });
    await prisma.book.deleteMany({ where: { slug: { startsWith: suffix } } });
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  it('creates one ACTIVE reservation atomically with policy expiration, deterministic copy selection, counters, location, and audit data', async () => {
    const { book, copies } = await createBook([BookCopyStatus.AVAILABLE, BookCopyStatus.AVAILABLE]);
    await prisma.systemSetting.update({
      where: { key: 'reservation.pickupWindowHours' },
      data: { value: 2 },
    });
    const response = await api()
      .post('/api/v1/reservations')
      .set('Authorization', `Bearer ${firstMemberToken}`)
      .send({
        bookId: book.id,
        memberId: secondMember.id,
        bookCopyId: copies[1]!.id,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      memberId: firstMember.id,
      bookId: book.id,
      bookCopyId: copies[0]!.id,
      status: ReservationStatus.ACTIVE,
      book: { id: book.id, title: book.title, slug: book.slug },
      bookCopy: {
        id: copies[0]!.id,
        copyCode: copies[0]!.copyCode,
        status: BookCopyStatus.RESERVED,
      },
      pickupLocation: {
        floor: { floorNumber: 3 },
        room: { roomNumber: '315' },
        shelfLocationCode: 'F3-R315-1',
      },
      availability: { totalCopies: 2, availableCopies: 1 },
    });
    expect(response.body.bookCopy).not.toHaveProperty('barcode');
    expect(response.body.bookCopy).not.toHaveProperty('qrCodeValue');
    expect(
      new Date(response.body.expiresAt).getTime() - new Date(response.body.reservedAt).getTime(),
    ).toBe(7_200_000);

    const [reservation, selectedCopy, otherCopy, persistedBook, audits] = await Promise.all([
      prisma.reservation.findUniqueOrThrow({ where: { id: response.body.id } }),
      prisma.bookCopy.findUniqueOrThrow({ where: { id: copies[0]!.id } }),
      prisma.bookCopy.findUniqueOrThrow({ where: { id: copies[1]!.id } }),
      prisma.book.findUniqueOrThrow({ where: { id: book.id } }),
      prisma.auditLog.findMany({
        where: { action: 'RESERVATION_CREATED', entityId: response.body.id },
      }),
    ]);
    expect(reservation).toMatchObject({
      memberId: firstMember.id,
      bookId: book.id,
      bookCopyId: copies[0]!.id,
      status: ReservationStatus.ACTIVE,
    });
    expect(selectedCopy.status).toBe(BookCopyStatus.RESERVED);
    expect(otherCopy.status).toBe(BookCopyStatus.AVAILABLE);
    expect(persistedBook.availableCopies).toBe(1);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: firstMember.id,
      targetUserId: firstMember.id,
      entityType: 'reservation',
      entityId: response.body.id,
    });
    expect(audits[0]!.newValues).toMatchObject({
      memberId: firstMember.id,
      bookId: book.id,
      bookCopyId: copies[0]!.id,
      newCopyStatus: BookCopyStatus.RESERVED,
    });
  });

  it('requires authentication, permits MEMBER only, and rejects an account blocked after token issuance', async () => {
    const { book } = await createBook([BookCopyStatus.AVAILABLE]);
    expect((await api().post('/api/v1/reservations').send({ bookId: book.id })).status).toBe(401);
    expect((await reserve(librarianToken, book.id)).status).toBe(403);
    expect((await reserve(adminToken, book.id)).status).toBe(403);

    await prisma.user.update({
      where: { id: firstMember.id },
      data: { status: UserStatus.BLOCKED },
    });
    expect((await reserve(firstMemberToken, book.id)).status).toBe(401);
    await prisma.user.update({
      where: { id: firstMember.id },
      data: { status: UserStatus.ACTIVE, emailVerifiedAt: null },
    });
    expect((await reserve(firstMemberToken, book.id)).status).toBe(403);
    expect(await prisma.reservation.count({ where: { bookId: book.id } })).toBe(0);
  });

  it('rejects nonexistent, archived, Store-only, and zero-eligible-copy books cleanly', async () => {
    const archived = await createBook([BookCopyStatus.AVAILABLE], { archived: true });
    const storeOnly = await createBook([BookCopyStatus.AVAILABLE], { campus: false });
    const unavailable = await createBook([
      BookCopyStatus.BORROWED,
      BookCopyStatus.MAINTENANCE,
      BookCopyStatus.DAMAGED,
    ]);
    const damagedCondition = await createBook([BookCopyStatus.AVAILABLE]);
    await prisma.bookCopy.update({
      where: { id: damagedCondition.copies[0]!.id },
      data: { condition: 'DAMAGED' },
    });
    const archivedCopy = await createBook([BookCopyStatus.AVAILABLE]);
    await prisma.bookCopy.update({
      where: { id: archivedCopy.copies[0]!.id },
      data: { isArchived: true, deletedAt: new Date(), status: BookCopyStatus.ARCHIVED },
    });

    expect((await reserve(firstMemberToken, '00000000-0000-4000-8000-000000000001')).status).toBe(
      404,
    );
    expect((await reserve(firstMemberToken, archived.book.id)).status).toBe(404);
    expect((await reserve(firstMemberToken, storeOnly.book.id)).status).toBe(409);
    expect((await reserve(firstMemberToken, unavailable.book.id)).status).toBe(409);
    expect((await reserve(firstMemberToken, damagedCondition.book.id)).status).toBe(409);
    expect((await reserve(firstMemberToken, archivedCopy.book.id)).status).toBe(409);
    expect(
      await prisma.reservation.count({
        where: {
          bookId: {
            in: [
              archived.book.id,
              storeOnly.book.id,
              unavailable.book.id,
              damagedCondition.book.id,
              archivedCopy.book.id,
            ],
          },
        },
      }),
    ).toBe(0);
  });

  it('rejects duplicate member/book reservations and prevents another member from using its RESERVED copy', async () => {
    const { book, copies } = await createBook([BookCopyStatus.AVAILABLE]);
    expect((await reserve(firstMemberToken, book.id)).status).toBe(201);
    expect((await reserve(firstMemberToken, book.id)).status).toBe(409);
    expect((await reserve(secondMemberToken, book.id)).status).toBe(409);
    expect(await prisma.reservation.count({ where: { bookId: book.id } })).toBe(1);
    expect((await prisma.bookCopy.findUniqueOrThrow({ where: { id: copies[0]!.id } })).status).toBe(
      BookCopyStatus.RESERVED,
    );
  });

  it.each([ReservationStatus.CANCELLED, ReservationStatus.EXPIRED, ReservationStatus.COLLECTED])(
    'allows a new reservation after historical %s records',
    async (historicalStatus) => {
      const { book, copies } = await createBook([BookCopyStatus.AVAILABLE]);
      await prisma.reservation.create({
        data: {
          memberId: firstMember.id,
          bookId: book.id,
          bookCopyId: copies[0]!.id,
          status: historicalStatus,
          expiresAt: new Date(Date.now() - 60_000),
          ...(historicalStatus === ReservationStatus.CANCELLED
            ? { cancelledAt: new Date(Date.now() - 30_000) }
            : {}),
          ...(historicalStatus === ReservationStatus.COLLECTED
            ? { collectedAt: new Date(Date.now() - 30_000) }
            : {}),
        },
      });

      const response = await reserve(firstMemberToken, book.id);
      expect(response.status).toBe(201);
      expect(response.body.status).toBe(ReservationStatus.ACTIVE);
      expect(
        await prisma.reservation.count({
          where: { bookId: book.id, status: ReservationStatus.ACTIVE },
        }),
      ).toBe(1);
    },
  );

  it('allows exactly one of two real concurrent members to reserve a single available copy', async () => {
    const { book, copies } = await createBook([BookCopyStatus.AVAILABLE]);
    const [first, second] = await Promise.all([
      reserve(firstMemberToken, book.id),
      reserve(secondMemberToken, book.id),
    ]);
    const results = [first, second];

    expect(results.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(results.filter(({ status }) => status === 409)).toHaveLength(1);
    expect(
      await prisma.reservation.count({
        where: { bookCopyId: copies[0]!.id, status: ReservationStatus.ACTIVE },
      }),
    ).toBe(1);
    expect((await prisma.bookCopy.findUniqueOrThrow({ where: { id: copies[0]!.id } })).status).toBe(
      BookCopyStatus.RESERVED,
    );
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).availableCopies).toBe(
      0,
    );
    const active = await prisma.reservation.findFirstOrThrow({
      where: { bookId: book.id, status: ReservationStatus.ACTIVE },
    });
    expect(
      await prisma.auditLog.count({
        where: {
          action: 'RESERVATION_CREATED',
          entityType: 'reservation',
          entityId: active.id,
        },
      }),
    ).toBe(1);
  });

  it('keeps a RESERVED copy unavailable to the existing direct Borrow workflow', async () => {
    const { book } = await createBook([BookCopyStatus.AVAILABLE]);
    const reserved = await reserve(firstMemberToken, book.id);
    expect(reserved.status).toBe(201);

    const borrow = await api()
      .post('/api/v1/loans/borrow')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ memberId: secondMember.id, bookCopyId: reserved.body.bookCopyId });
    expect(borrow.status).toBe(409);
    expect(await prisma.loan.count({ where: { bookCopyId: reserved.body.bookCopyId } })).toBe(0);
    expect(
      (await prisma.bookCopy.findUniqueOrThrow({ where: { id: reserved.body.bookCopyId } })).status,
    ).toBe(BookCopyStatus.RESERVED);
  });
});
