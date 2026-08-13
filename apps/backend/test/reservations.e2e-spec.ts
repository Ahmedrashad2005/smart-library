import { Test } from '@nestjs/testing';
import {
  BookCopyStatus,
  Prisma,
  ReservationStatus,
  type Book,
  type BookCopy,
  type User,
} from '@prisma/client';
import type { TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ReservationPolicyService } from '../src/modules/reservations/reservation-policy.service';

describe('Phase 5.2.1 reservation foundation', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let policy: ReservationPolicyService;
  let member: User;
  let secondMember: User;
  let book: Book;
  let firstCopy: BookCopy;
  let secondCopy: BookCopy;
  let fixtureReady = false;
  const suffix = `reservation-foundation-${Date.now()}`;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.init();
    prisma = module.get(PrismaService);
    policy = module.get(ReservationPolicyService);

    const [category, shelf, firstMember, anotherMember] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { isArchived: false } }),
      prisma.shelf.findFirstOrThrow({
        where: { isArchived: false, section: { isArchived: false } },
      }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member1@smart-library.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member5@smart-library.test' } }),
    ]);
    member = firstMember;
    secondMember = anotherMember;
    book = await prisma.book.create({
      data: {
        title: 'Reservation Foundation Fixture',
        slug: suffix,
        categoryId: category.id,
        totalCopies: 2,
        availableCopies: 2,
      },
    });
    const copies = await Promise.all(
      [1, 2].map((number) =>
        prisma.bookCopy.create({
          data: {
            bookId: book.id,
            copyCode: `${suffix}-copy-${number}`,
            qrCodeValue: `copy:${suffix}-${number}`,
            sectionId: shelf.sectionId,
            shelfId: shelf.id,
          },
        }),
      ),
    );
    firstCopy = copies[0]!;
    secondCopy = copies[1]!;
    fixtureReady = true;
  });

  afterEach(async () => {
    if (!fixtureReady) return;
    await prisma.reservation.deleteMany({ where: { bookId: book.id } });
    await prisma.bookCopy.updateMany({
      where: { id: { in: [firstCopy.id, secondCopy.id] } },
      data: { status: BookCopyStatus.AVAILABLE },
    });
  });

  afterAll(async () => {
    if (prisma) {
      if (fixtureReady) {
        await prisma.reservation.deleteMany({ where: { bookId: book.id } });
        await prisma.bookCopy.deleteMany({ where: { bookId: book.id } });
        await prisma.book.delete({ where: { id: book.id } });
      }
      await prisma.$disconnect();
    }
    if (module) await module.close();
  });

  it('reads the seeded 24-hour pickup policy and calculates expiration from it', async () => {
    const setting = await prisma.systemSetting.findUniqueOrThrow({
      where: { key: 'reservation.pickupWindowHours' },
    });
    const originalValue = typeof setting.value === 'number' ? setting.value : 24;
    const reservedAt = new Date('2026-08-13T08:00:00.000Z');

    expect(setting.value).toBe(24);
    expect(await policy.pickupWindowHours()).toBe(24);
    expect((await policy.expiresAt(reservedAt)).getTime() - reservedAt.getTime()).toBe(86_400_000);

    try {
      await prisma.systemSetting.update({
        where: { key: 'reservation.pickupWindowHours' },
        data: { value: -1 },
      });
      expect(await policy.pickupWindowHours()).toBe(24);
    } finally {
      await prisma.systemSetting.update({
        where: { key: 'reservation.pickupWindowHours' },
        data: { value: originalValue },
      });
    }
  });

  it('creates a reservation with safe historical relations while reserving its copy', async () => {
    const expiresAt = await policy.expiresAt();
    const reservation = await prisma.$transaction(async (tx) => {
      await tx.bookCopy.update({
        where: { id: firstCopy.id },
        data: { status: BookCopyStatus.RESERVED },
      });
      return tx.reservation.create({
        data: {
          memberId: member.id,
          bookId: book.id,
          bookCopyId: firstCopy.id,
          expiresAt,
        },
        include: { member: true, book: true, bookCopy: true },
      });
    });

    expect(reservation.status).toBe(ReservationStatus.ACTIVE);
    expect(reservation.member.id).toBe(member.id);
    expect(reservation.book.id).toBe(book.id);
    expect(reservation.bookCopy.id).toBe(firstCopy.id);
    expect(reservation.bookCopy.status).toBe(BookCopyStatus.RESERVED);
    expect(reservation.expiresAt.getTime()).toBeGreaterThan(reservation.reservedAt.getTime());
  });

  it('enforces one active reservation per copy and per member/book while retaining history', async () => {
    const expiresAt = await policy.expiresAt();
    const active = await prisma.reservation.create({
      data: {
        memberId: member.id,
        bookId: book.id,
        bookCopyId: firstCopy.id,
        expiresAt,
      },
    });

    await expect(
      prisma.reservation.create({
        data: {
          memberId: secondMember.id,
          bookId: book.id,
          bookCopyId: firstCopy.id,
          expiresAt,
        },
      }),
    ).rejects.toMatchObject<Partial<Prisma.PrismaClientKnownRequestError>>({ code: 'P2002' });
    await expect(
      prisma.reservation.create({
        data: {
          memberId: member.id,
          bookId: book.id,
          bookCopyId: secondCopy.id,
          expiresAt,
        },
      }),
    ).rejects.toMatchObject<Partial<Prisma.PrismaClientKnownRequestError>>({ code: 'P2002' });

    await prisma.reservation.update({
      where: { id: active.id },
      data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
    });
    const replacement = await prisma.reservation.create({
      data: {
        memberId: member.id,
        bookId: book.id,
        bookCopyId: firstCopy.id,
        expiresAt,
      },
    });

    expect(replacement.status).toBe(ReservationStatus.ACTIVE);
    expect(await prisma.reservation.count({ where: { bookId: book.id } })).toBe(2);
  });

  it('persists every reservation lifecycle value and preserves all existing copy statuses', async () => {
    const expiresAt = await policy.expiresAt();
    await prisma.reservation.createMany({
      data: [
        {
          memberId: member.id,
          bookId: book.id,
          bookCopyId: firstCopy.id,
          status: ReservationStatus.ACTIVE,
          expiresAt,
        },
        {
          memberId: member.id,
          bookId: book.id,
          bookCopyId: firstCopy.id,
          status: ReservationStatus.CANCELLED,
          expiresAt,
          cancelledAt: new Date(),
        },
        {
          memberId: member.id,
          bookId: book.id,
          bookCopyId: firstCopy.id,
          status: ReservationStatus.EXPIRED,
          expiresAt: new Date(Date.now() - 1_000),
        },
        {
          memberId: member.id,
          bookId: book.id,
          bookCopyId: firstCopy.id,
          status: ReservationStatus.COLLECTED,
          expiresAt,
          collectedAt: new Date(),
        },
      ],
    });
    const persistedStatuses = new Set(
      (
        await prisma.reservation.findMany({
          where: { bookId: book.id },
          select: { status: true },
        })
      ).map(({ status }) => status),
    );
    expect(persistedStatuses).toEqual(new Set(Object.values(ReservationStatus)));

    for (const status of Object.values(BookCopyStatus)) {
      const updated = await prisma.bookCopy.update({
        where: { id: secondCopy.id },
        data: { status },
      });
      expect(updated.status).toBe(status);
    }
  });
});
