import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookCopyStatus, ReservationStatus, type User } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ReservationsService } from '../src/modules/reservations/reservations.service';

describe('Phase 5.2.3 reservation query, cancellation, and expiration lifecycle', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reservations: ReservationsService;
  let firstMember: User;
  let secondMember: User;
  let eligibleMember: User;
  let firstToken = '';
  let secondToken = '';
  let eligibleToken = '';
  let librarianToken = '';
  let categoryId = '';
  let sectionId = '';
  let shelfId = '';
  let roomId = '';
  let sequence = 0;
  const suffix = `reservation-lifecycle-${Date.now()}`;
  const api = () => request(app.getHttpServer());
  const login = async (email: string) =>
    (await api().post('/api/v1/auth/login').send({ email, password: 'SmartLib123' })).body
      .accessToken as string;

  const createBook = async (copies = 1) => {
    sequence += 1;
    const current = sequence;
    const key = `${suffix}-${current}`;
    const book = await prisma.book.create({
      data: {
        title: `Reservation lifecycle ${current}`,
        slug: key,
        coverImageUrl: `https://covers.test/${key}.jpg`,
        categoryId,
        totalCopies: copies,
        availableCopies: copies,
      },
    });
    const author = await prisma.author.create({
      data: {
        name: `${suffix} author ${current}`,
        nameAr: `مؤلف الحجز ${current}`,
      },
    });
    await prisma.bookAuthor.create({ data: { bookId: book.id, authorId: author.id } });
    const bookCopies = await Promise.all(
      Array.from({ length: copies }, (_, index) =>
        prisma.bookCopy.create({
          data: {
            bookId: book.id,
            copyCode: `${key}-copy-${index + 1}`,
            qrCodeValue: `copy:${key}-${index + 1}`,
            sectionId,
            shelfId,
            homeLibraryRoomId: roomId,
            shelfLocationCode: `F3-R315-${index + 1}`,
          },
        }),
      ),
    );
    return { book, copies: bookCopies, author };
  };
  const reserve = (token: string, bookId: string) =>
    api().post('/api/v1/reservations').set('Authorization', `Bearer ${token}`).send({ bookId });
  const cancel = (token: string, id: string) =>
    api().post(`/api/v1/reservations/${id}/cancel`).set('Authorization', `Bearer ${token}`);
  const collect = (token: string, pickupToken: string) =>
    api()
      .post('/api/v1/reservations/collect-by-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ pickupToken });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
    reservations = app.get(ReservationsService);
    const [category, shelf, memberOne, memberFive, memberTwo] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isArchived: false, deletedAt: null } }),
      prisma.shelf.findFirstOrThrow({
        where: {
          isArchived: false,
          section: {
            isArchived: false,
            locationRoom: {
              is: { isActive: true, floor: { isActive: true, library: { isActive: true } } },
            },
          },
        },
        include: { section: true },
      }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member1@smart-library.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member5@smart-library.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member9@smart-library.test' } }),
    ]);
    categoryId = category.id;
    sectionId = shelf.sectionId;
    shelfId = shelf.id;
    roomId = shelf.section.roomId!;
    firstMember = memberOne;
    secondMember = memberFive;
    eligibleMember = memberTwo;
    [firstToken, secondToken, eligibleToken, librarianToken] = await Promise.all([
      login(firstMember.email),
      login(secondMember.email),
      login(eligibleMember.email),
      login('librarian1@smart-library.test'),
    ]);
  });

  afterEach(async () => {
    const records = await prisma.reservation.findMany({
      where: { book: { slug: { startsWith: suffix } } },
      select: { id: true },
    });
    if (records.length)
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: records.map(({ id }) => id) } },
      });
    if (records.length)
      await prisma.loan.deleteMany({
        where: { reservationId: { in: records.map(({ id }) => id) } },
      });
    await prisma.reservation.deleteMany({ where: { book: { slug: { startsWith: suffix } } } });
    await prisma.bookCopy.deleteMany({ where: { book: { slug: { startsWith: suffix } } } });
    await prisma.bookAuthor.deleteMany({ where: { book: { slug: { startsWith: suffix } } } });
    await prisma.book.deleteMany({ where: { slug: { startsWith: suffix } } });
    await prisma.author.deleteMany({ where: { name: { startsWith: suffix } } });
  });
  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  it('lists only owned safe reservations with status filtering, newest-first pagination, and ownership protection', async () => {
    const [first, second, other] = await Promise.all([createBook(), createBook(), createBook()]);
    const firstReservation = await reserve(firstToken, first.book.id);
    const secondReservation = await reserve(firstToken, second.book.id);
    const otherReservation = await reserve(secondToken, other.book.id);
    await cancel(firstToken, firstReservation.body.id);

    expect((await api().get('/api/v1/reservations/me')).status).toBe(401);
    expect(
      (await api().get('/api/v1/reservations/me').set('Authorization', `Bearer ${librarianToken}`))
        .status,
    ).toBe(403);
    const active = await api()
      .get('/api/v1/reservations/me?status=active&page=1&limit=1')
      .set('Authorization', `Bearer ${firstToken}`);
    expect(active.status).toBe(200);
    expect(active.body).toMatchObject({ total: 1, page: 1, limit: 1, totalPages: 1 });
    expect(active.body.items[0]).toMatchObject({
      id: secondReservation.body.id,
      memberId: firstMember.id,
      status: ReservationStatus.ACTIVE,
      canCancel: true,
      book: {
        id: second.book.id,
        coverImageUrl: `https://covers.test/${second.book.slug}.jpg`,
        authors: [
          {
            author: {
              id: second.author.id,
              name: second.author.name,
              nameAr: second.author.nameAr,
            },
          },
        ],
      },
      bookCopy: { status: BookCopyStatus.RESERVED },
      pickupLocation: { floor: { floorNumber: 3 }, room: { roomNumber: '315' } },
    });
    expect(active.body.items[0].bookCopy).not.toHaveProperty('qrCodeValue');
    const all = await api()
      .get('/api/v1/reservations/me?status=all&page=1&limit=1')
      .set('Authorization', `Bearer ${firstToken}`);
    expect(all.body).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
    expect(all.body.items[0].id).toBe(secondReservation.body.id);
    expect(
      (
        await api()
          .get(`/api/v1/reservations/${otherReservation.body.id}`)
          .set('Authorization', `Bearer ${firstToken}`)
      ).status,
    ).toBe(403);
    await prisma.reservation.update({
      where: { id: otherReservation.body.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    expect(
      (
        await api()
          .get(`/api/v1/reservations/${otherReservation.body.id}`)
          .set('Authorization', `Bearer ${firstToken}`)
      ).status,
    ).toBe(403);
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: otherReservation.body.id } }))
        .status,
    ).toBe(ReservationStatus.ACTIVE);
    expect(
      (
        await api()
          .get(`/api/v1/reservations/${secondReservation.body.id}`)
          .set('Authorization', `Bearer ${firstToken}`)
      ).body.id,
    ).toBe(secondReservation.body.id);
  });

  it('rejects malformed filters, pagination, limits, and identifiers with the standard validation contract', async () => {
    for (const query of [
      'status=unknown',
      'page=0',
      'page=1.5',
      'page=not-a-number',
      'limit=0',
      'limit=51',
      'limit=not-a-number',
    ]) {
      const response = await api()
        .get(`/api/v1/reservations/me?${query}`)
        .set('Authorization', `Bearer ${firstToken}`);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ statusCode: 400 });
      expect(response.body.message).toEqual(expect.any(Array));
    }
    expect(
      (
        await api()
          .get('/api/v1/reservations/not-a-uuid')
          .set('Authorization', `Bearer ${firstToken}`)
      ).status,
    ).toBe(400);
  });

  it('cancels atomically, releases the copy, synchronizes counters, audits once, and permits re-reservation', async () => {
    const { book, copies } = await createBook();
    const created = await reserve(firstToken, book.id);
    const cancelled = await cancel(firstToken, created.body.id);
    expect(cancelled.status).toBe(201);
    expect(cancelled.body).toMatchObject({
      status: ReservationStatus.CANCELLED,
      canCancel: false,
      bookCopy: { status: BookCopyStatus.AVAILABLE },
      availability: { availableCopies: 1 },
    });
    expect(cancelled.body.cancelledAt).toEqual(expect.any(String));
    expect((await prisma.bookCopy.findUniqueOrThrow({ where: { id: copies[0]!.id } })).status).toBe(
      BookCopyStatus.AVAILABLE,
    );
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).availableCopies).toBe(
      1,
    );
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_CANCELLED', entityId: created.body.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.findFirstOrThrow({
        where: { action: 'RESERVATION_CANCELLED', entityId: created.body.id },
      }),
    ).toMatchObject({
      actorId: firstMember.id,
      targetUserId: firstMember.id,
      entityType: 'reservation',
      entityId: created.body.id,
      newValues: {
        reservationStatus: ReservationStatus.CANCELLED,
        memberId: firstMember.id,
        bookId: book.id,
        bookCopyId: copies[0]!.id,
      },
    });
    expect((await cancel(firstToken, created.body.id)).status).toBe(409);
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_CANCELLED', entityId: created.body.id },
      }),
    ).toBe(1);
    expect((await reserve(firstToken, book.id)).status).toBe(201);
  });

  it('rejects cancellation by another member and terminal or inconsistent reservation states', async () => {
    const { book, copies } = await createBook();
    const created = await reserve(firstToken, book.id);
    expect((await cancel(secondToken, created.body.id)).status).toBe(403);
    await prisma.bookCopy.update({
      where: { id: copies[0]!.id },
      data: { status: BookCopyStatus.BORROWED },
    });
    expect((await cancel(firstToken, created.body.id)).status).toBe(409);
    expect(
      await prisma.reservation.findUniqueOrThrow({ where: { id: created.body.id } }),
    ).toMatchObject({ status: ReservationStatus.ACTIVE, cancelledAt: null });
    expect((await prisma.bookCopy.findUniqueOrThrow({ where: { id: copies[0]!.id } })).status).toBe(
      BookCopyStatus.BORROWED,
    );
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).availableCopies).toBe(
      0,
    );
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_CANCELLED', entityId: created.body.id },
      }),
    ).toBe(0);
    await prisma.bookCopy.update({
      where: { id: copies[0]!.id },
      data: { status: BookCopyStatus.RESERVED },
    });
    await prisma.reservation.update({
      where: { id: created.body.id },
      data: { status: ReservationStatus.COLLECTED, collectedAt: new Date() },
    });
    expect((await cancel(firstToken, created.body.id)).status).toBe(409);
    expect((await cancel(firstToken, '00000000-0000-4000-8000-000000000001')).status).toBe(404);
  });

  it('keeps RESERVED state under reservation control across catalog management writes', async () => {
    const { book, copies } = await createBook(2);
    const created = await reserve(firstToken, book.id);
    expect(
      (
        await api()
          .patch(`/api/v1/book-copies/${created.body.bookCopyId}/status`)
          .set('Authorization', `Bearer ${librarianToken}`)
          .send({ status: BookCopyStatus.AVAILABLE })
      ).status,
    ).toBe(409);
    expect(
      (
        await api()
          .post(`/api/v1/book-copies/${created.body.bookCopyId}/archive`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(409);
    expect(
      (
        await api()
          .patch(`/api/v1/book-copies/${created.body.bookCopyId}`)
          .set('Authorization', `Bearer ${librarianToken}`)
          .send({ condition: 'DAMAGED' })
      ).status,
    ).toBe(409);
    expect(
      (
        await api()
          .patch(`/api/v1/book-copies/${copies[1]!.id}/status`)
          .set('Authorization', `Bearer ${librarianToken}`)
          .send({ status: BookCopyStatus.RESERVED })
      ).status,
    ).toBe(409);
    expect(
      (
        await api()
          .post(`/api/v1/books/${book.id}/archive`)
          .set('Authorization', `Bearer ${librarianToken}`)
      ).status,
    ).toBe(409);

    const [reservation, reservedCopy, availableCopy, persistedBook] = await Promise.all([
      prisma.reservation.findUniqueOrThrow({ where: { id: created.body.id } }),
      prisma.bookCopy.findUniqueOrThrow({ where: { id: copies[0]!.id } }),
      prisma.bookCopy.findUniqueOrThrow({ where: { id: copies[1]!.id } }),
      prisma.book.findUniqueOrThrow({ where: { id: book.id } }),
    ]);
    expect(reservation.status).toBe(ReservationStatus.ACTIVE);
    expect(reservedCopy.status).toBe(BookCopyStatus.RESERVED);
    expect(availableCopy.status).toBe(BookCopyStatus.AVAILABLE);
    expect(persistedBook).toMatchObject({
      isArchived: false,
      totalCopies: 2,
      availableCopies: 1,
    });
  });

  it('expires due reservations atomically and idempotently without touching future or terminal records', async () => {
    const [dueBook, futureBook, cancelledBook, collectedBook] = await Promise.all([
      createBook(),
      createBook(),
      createBook(),
      createBook(),
    ]);
    const due = await reserve(firstToken, dueBook.book.id);
    const future = await reserve(firstToken, futureBook.book.id);
    const cancelled = await reserve(firstToken, cancelledBook.book.id);
    const collected = await reserve(firstToken, collectedBook.book.id);
    await cancel(firstToken, cancelled.body.id);
    await prisma.reservation.update({
      where: { id: collected.body.id },
      data: { status: ReservationStatus.COLLECTED, collectedAt: new Date() },
    });
    await prisma.bookCopy.update({
      where: { id: collected.body.bookCopyId },
      data: { status: BookCopyStatus.BORROWED },
    });
    const now = new Date();
    await prisma.reservation.update({
      where: { id: due.body.id },
      data: { expiresAt: new Date(now.getTime() - 1_000) },
    });

    expect(await reservations.processDueExpirations(now)).toBe(1);
    expect(await reservations.processDueExpirations(now)).toBe(0);
    expect(
      await prisma.reservation.findUniqueOrThrow({ where: { id: due.body.id } }),
    ).toMatchObject({ status: ReservationStatus.EXPIRED });
    expect(
      (await prisma.bookCopy.findUniqueOrThrow({ where: { id: due.body.bookCopyId } })).status,
    ).toBe(BookCopyStatus.AVAILABLE);
    expect(
      (await prisma.book.findUniqueOrThrow({ where: { id: dueBook.book.id } })).availableCopies,
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_EXPIRED', entityId: due.body.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.findFirstOrThrow({
        where: { action: 'RESERVATION_EXPIRED', entityId: due.body.id },
      }),
    ).toMatchObject({
      actorId: null,
      targetUserId: firstMember.id,
      entityType: 'reservation',
      entityId: due.body.id,
      newValues: {
        reservationStatus: ReservationStatus.EXPIRED,
        memberId: firstMember.id,
        bookId: dueBook.book.id,
        bookCopyId: due.body.bookCopyId,
      },
    });
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: future.body.id } })).status,
    ).toBe(ReservationStatus.ACTIVE);
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: cancelled.body.id } })).status,
    ).toBe(ReservationStatus.CANCELLED);
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: collected.body.id } })).status,
    ).toBe(ReservationStatus.COLLECTED);
  });

  it('defensively expires stale ACTIVE state before queries and allows another member to reserve the released copy', async () => {
    const { book } = await createBook();
    const created = await reserve(firstToken, book.id);
    await prisma.reservation.update({
      where: { id: created.body.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const detail = await api()
      .get(`/api/v1/reservations/${created.body.id}`)
      .set('Authorization', `Bearer ${firstToken}`);
    expect(detail.body).toMatchObject({ status: ReservationStatus.EXPIRED, canCancel: false });
    expect((await reserve(secondToken, book.id)).status).toBe(201);
  });

  it('resolves a real cancellation-versus-expiration race with one terminal transition and one release', async () => {
    const { book } = await createBook();
    const created = await reserve(firstToken, book.id);
    const expiresAt = new Date(Date.now() + 1_000);
    await prisma.reservation.update({ where: { id: created.body.id }, data: { expiresAt } });
    await Promise.all([
      cancel(firstToken, created.body.id),
      reservations.processDueExpirations(new Date(expiresAt.getTime() + 1)),
    ]);
    const final = await prisma.reservation.findUniqueOrThrow({ where: { id: created.body.id } });
    expect([ReservationStatus.CANCELLED, ReservationStatus.EXPIRED]).toContain(final.status);
    expect(
      (await prisma.bookCopy.findUniqueOrThrow({ where: { id: created.body.bookCopyId } })).status,
    ).toBe(BookCopyStatus.AVAILABLE);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).availableCopies).toBe(
      1,
    );
    expect(
      await prisma.auditLog.count({
        where: {
          entityId: created.body.id,
          action: { in: ['RESERVATION_CANCELLED', 'RESERVATION_EXPIRED'] },
        },
      }),
    ).toBe(1);
  });

  it('lets only one of two competing expiration processors transition the same reservation', async () => {
    const { book } = await createBook();
    const created = await reserve(firstToken, book.id);
    const now = new Date();
    await prisma.reservation.update({
      where: { id: created.body.id },
      data: { expiresAt: new Date(now.getTime() - 1) },
    });
    const processed = await Promise.all([
      reservations.processDueExpirations(now),
      reservations.processDueExpirations(now),
    ]);
    expect(processed.reduce((total, value) => total + value, 0)).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_EXPIRED', entityId: created.body.id },
      }),
    ).toBe(1);
  });

  it('isolates one inconsistent expiration candidate and still expires unrelated due work', async () => {
    const [inconsistentBook, validBook] = await Promise.all([createBook(), createBook()]);
    const inconsistent = await reserve(firstToken, inconsistentBook.book.id);
    const valid = await reserve(firstToken, validBook.book.id);
    const now = new Date();
    await prisma.reservation.updateMany({
      where: { id: { in: [inconsistent.body.id, valid.body.id] } },
      data: { expiresAt: new Date(now.getTime() - 1_000) },
    });
    await prisma.bookCopy.update({
      where: { id: inconsistent.body.bookCopyId },
      data: { status: BookCopyStatus.BORROWED },
    });

    expect(await reservations.processDueExpirations(now)).toBe(1);
    expect(
      await prisma.reservation.findUniqueOrThrow({ where: { id: inconsistent.body.id } }),
    ).toMatchObject({ status: ReservationStatus.ACTIVE });
    expect(
      (await prisma.bookCopy.findUniqueOrThrow({ where: { id: inconsistent.body.bookCopyId } }))
        .status,
    ).toBe(BookCopyStatus.BORROWED);
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_EXPIRED', entityId: inconsistent.body.id },
      }),
    ).toBe(0);
    expect(
      await prisma.reservation.findUniqueOrThrow({ where: { id: valid.body.id } }),
    ).toMatchObject({ status: ReservationStatus.EXPIRED });
    expect(
      (await prisma.bookCopy.findUniqueOrThrow({ where: { id: valid.body.bookCopyId } })).status,
    ).toBe(BookCopyStatus.AVAILABLE);
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_EXPIRED', entityId: valid.body.id },
      }),
    ).toBe(1);
  });

  it('converges safely when cancellation and another member creation compete for one copy', async () => {
    const { book } = await createBook();
    const original = await reserve(firstToken, book.id);
    const [cancelResult, initialCreate] = await Promise.all([
      cancel(firstToken, original.body.id),
      reserve(secondToken, book.id),
    ]);
    expect(cancelResult.status).toBe(201);
    const created =
      initialCreate.status === 201 ? initialCreate : await reserve(secondToken, book.id);
    expect([201, 409]).toContain(initialCreate.status);
    expect(created.status).toBe(201);

    const active = await prisma.reservation.findMany({
      where: { bookId: book.id, status: ReservationStatus.ACTIVE },
    });
    expect(active).toHaveLength(1);
    expect(active[0]!.memberId).toBe(secondMember.id);
    expect(
      (await prisma.bookCopy.findUniqueOrThrow({ where: { id: active[0]!.bookCopyId } })).status,
    ).toBe(BookCopyStatus.RESERVED);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).availableCopies).toBe(
      0,
    );
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_CANCELLED', entityId: original.body.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_CREATED', entityId: active[0]!.id },
      }),
    ).toBe(1);
  });

  it('converges safely when expiration and another member creation compete for one copy', async () => {
    const { book } = await createBook();
    const original = await reserve(firstToken, book.id);
    const now = new Date();
    await prisma.reservation.update({
      where: { id: original.body.id },
      data: { expiresAt: new Date(now.getTime() - 1) },
    });
    const [processed, initialCreate] = await Promise.all([
      reservations.processDueExpirations(now),
      reserve(secondToken, book.id),
    ]);
    const created =
      initialCreate.status === 201 ? initialCreate : await reserve(secondToken, book.id);
    expect([0, 1]).toContain(processed);
    expect([201, 409]).toContain(initialCreate.status);
    expect(created.status).toBe(201);

    const [oldReservation, active, persistedBook] = await Promise.all([
      prisma.reservation.findUniqueOrThrow({ where: { id: original.body.id } }),
      prisma.reservation.findMany({
        where: { bookId: book.id, status: ReservationStatus.ACTIVE },
      }),
      prisma.book.findUniqueOrThrow({ where: { id: book.id } }),
    ]);
    expect(oldReservation.status).toBe(ReservationStatus.EXPIRED);
    expect(active).toHaveLength(1);
    expect(active[0]!.memberId).toBe(secondMember.id);
    expect(
      (await prisma.bookCopy.findUniqueOrThrow({ where: { id: active[0]!.bookCopyId } })).status,
    ).toBe(BookCopyStatus.RESERVED);
    expect(persistedBook).toMatchObject({ totalCopies: 1, availableCopies: 0 });
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_EXPIRED', entityId: original.body.id },
      }),
    ).toBe(1);
  });

  it('collects one valid pickup credential atomically into exactly one loan', async () => {
    const { book, copies } = await createBook();
    const created = await reserve(eligibleToken, book.id);
    expect(created.status).toBe(201);
    const pickupToken = created.body.pickupToken as string;
    expect(pickupToken).toMatch(new RegExp(`^${created.body.id}\\.`));
    const persistedBefore = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(persistedBefore.pickupTokenHash).toBeTruthy();
    expect(persistedBefore.pickupTokenHash).not.toContain(pickupToken);

    expect((await collect(eligibleToken, pickupToken)).status).toBe(403);
    const response = await collect(librarianToken, pickupToken);
    expect(response.status).toBe(201);
    const [reservation, copy, loan, storedBook] = await Promise.all([
      prisma.reservation.findUniqueOrThrow({ where: { id: created.body.id } }),
      prisma.bookCopy.findUniqueOrThrow({ where: { id: copies[0]!.id } }),
      prisma.loan.findMany({ where: { reservationId: created.body.id } }),
      prisma.book.findUniqueOrThrow({ where: { id: book.id } }),
    ]);
    expect(reservation).toMatchObject({
      status: ReservationStatus.COLLECTED,
      collectedByUserId: expect.any(String),
      collectedAt: expect.any(Date),
    });
    expect(copy.status).toBe(BookCopyStatus.BORROWED);
    expect(loan).toHaveLength(1);
    expect(loan[0]).toMatchObject({
      memberId: eligibleMember.id,
      bookCopyId: copies[0]!.id,
      reservationId: created.body.id,
      issuedById: reservation.collectedByUserId,
    });
    expect(storedBook.availableCopies).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: { action: 'RESERVATION_COLLECTED', entityId: created.body.id },
      }),
    ).toBe(1);
    expect((await collect(librarianToken, pickupToken)).status).toBe(409);
    expect(await prisma.loan.count({ where: { reservationId: created.body.id } })).toBe(1);
  });

  it('rejects invalid, expired, and concurrent collection without duplicate loans', async () => {
    const invalidBook = await createBook();
    const invalid = await reserve(eligibleToken, invalidBook.book.id);
    expect(invalid.status).toBe(201);
    const invalidToken = `${invalid.body.id}.${'a'.repeat(43)}`;
    expect((await collect(librarianToken, invalidToken)).status).toBe(404);
    expect(await prisma.loan.count({ where: { reservationId: invalid.body.id } })).toBe(0);

    const expiredBook = await createBook();
    const expired = await reserve(eligibleToken, expiredBook.book.id);
    expect(expired.status).toBe(201);
    await prisma.reservation.update({
      where: { id: expired.body.id },
      data: {
        expiresAt: new Date(Date.now() - 1_000),
        pickupTokenExpiresAt: new Date(Date.now() - 1_000),
      },
    });
    expect((await collect(librarianToken, expired.body.pickupToken)).status).toBe(409);
    expect(await prisma.loan.count({ where: { reservationId: expired.body.id } })).toBe(0);

    const concurrentBook = await createBook();
    const concurrent = await reserve(eligibleToken, concurrentBook.book.id);
    expect(concurrent.status).toBe(201);
    const results = await Promise.all([
      collect(librarianToken, concurrent.body.pickupToken),
      collect(librarianToken, concurrent.body.pickupToken),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await prisma.loan.count({ where: { reservationId: concurrent.body.id } })).toBe(1);
    expect(
      (await prisma.reservation.findUniqueOrThrow({ where: { id: concurrent.body.id } })).status,
    ).toBe(ReservationStatus.COLLECTED);
  });
});
