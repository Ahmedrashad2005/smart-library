import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookCopyStatus, LoanStatus } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Phase 4 borrowing lifecycle', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let librarian = '';
  let member = '';
  const createdLoanIds: string[] = [];
  const touchedCopyIds = new Set<string>();
  const api = () => request(app.getHttpServer());
  const login = async (email: string) =>
    (await api().post('/api/v1/auth/login').send({ email, password: 'SmartLib123' })).body
      .accessToken as string;

  const availableCopy = () =>
    prisma.bookCopy.findFirstOrThrow({
      where: { status: BookCopyStatus.AVAILABLE, isArchived: false, book: { isArchived: false } },
      orderBy: { copyCode: 'asc' },
    });
  const createActiveLoan = async (
    memberEmail: string,
    dueAt = new Date(Date.now() + 7 * 86_400_000),
    renewedCount = 0,
  ) => {
    const [borrower, staff, copy] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: memberEmail } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'librarian1@smart-library.test' } }),
      availableCopy(),
    ]);
    const loan = await prisma.loan.create({
      data: {
        memberId: borrower.id,
        bookCopyId: copy.id,
        issuedById: staff.id,
        dueAt,
        renewedCount,
        status: LoanStatus.ACTIVE,
      },
    });
    createdLoanIds.push(loan.id);
    touchedCopyIds.add(copy.id);
    await prisma.bookCopy.update({
      where: { id: copy.id },
      data: { status: BookCopyStatus.BORROWED },
    });
    return loan;
  };
  const resetDirectFixtures = async () => {
    if (!createdLoanIds.length) return;
    const loans = await prisma.loan.findMany({
      where: { id: { in: createdLoanIds } },
      select: { bookCopyId: true },
    });
    await prisma.loan.deleteMany({ where: { id: { in: createdLoanIds } } });
    const copyIds = [...new Set([...touchedCopyIds, ...loans.map((loan) => loan.bookCopyId)])];
    if (copyIds.length)
      await prisma.bookCopy.updateMany({
        where: { id: { in: copyIds }, isArchived: false },
        data: { status: BookCopyStatus.AVAILABLE },
      });
    createdLoanIds.length = 0;
    touchedCopyIds.clear();
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
    librarian = await login('librarian1@smart-library.test');
    member = await login('member1@smart-library.test');
  });
  afterEach(async () => resetDirectFixtures());
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('returns 401 without authentication and 403 for a member using staff routes', async () => {
    const copy = await availableCopy();
    const borrower = await prisma.user.findUniqueOrThrow({
      where: { email: 'member9@smart-library.test' },
    });
    expect((await api().post('/api/v1/loans/borrow').send({})).status).toBe(401);
    expect(
      (
        await api()
          .post('/api/v1/loans/borrow')
          .set('Authorization', `Bearer ${member}`)
          .send({ memberId: borrower.id, bookCopyId: copy.id })
      ).status,
    ).toBe(403);
    expect(
      (await api().get('/api/v1/loans/me').set('Authorization', `Bearer ${member}`)).status,
    ).toBe(200);
  });

  it('borrows atomically, calculates a fourteen-day due date, returns, and recalculates availability', async () => {
    const borrower = await prisma.user.findUniqueOrThrow({
      where: { email: 'member9@smart-library.test' },
    });
    const copy = await availableCopy();
    const before = await prisma.book.findUniqueOrThrow({ where: { id: copy.bookId } });
    const borrowed = await api()
      .post('/api/v1/loans/borrow')
      .set('Authorization', `Bearer ${librarian}`)
      .send({ memberId: borrower.id, bookCopyId: copy.id });
    expect(borrowed.status).toBe(201);
    expect(borrowed.body.bookCopy.status).toBe(BookCopyStatus.BORROWED);
    expect(
      new Date(borrowed.body.dueAt).getTime() - new Date(borrowed.body.borrowedAt).getTime(),
    ).toBeGreaterThan(13 * 86_400_000);
    expect(
      (await prisma.book.findUniqueOrThrow({ where: { id: copy.bookId } })).availableCopies,
    ).toBe(before.availableCopies - 1);
    const returned = await api()
      .post(`/api/v1/loans/${borrowed.body.id}/return`)
      .set('Authorization', `Bearer ${librarian}`)
      .send({ returnCondition: 'GOOD' });
    expect(returned.status).toBe(201);
    expect(returned.body.bookCopy.status).toBe(BookCopyStatus.AVAILABLE);
    expect(
      (await prisma.book.findUniqueOrThrow({ where: { id: copy.bookId } })).availableCopies,
    ).toBe(before.availableCopies);
    expect(
      (
        await api()
          .post(`/api/v1/loans/${borrowed.body.id}/return`)
          .set('Authorization', `Bearer ${librarian}`)
          .send({ returnCondition: 'GOOD' })
      ).status,
    ).toBe(409);
    expect(
      await prisma.auditLog.count({ where: { entityType: 'loan', entityId: borrowed.body.id } }),
    ).toBeGreaterThanOrEqual(2);
  });

  it('rejects blocked, unverified, overdue, and maximum-loan members', async () => {
    const [blocked, unverified, overdueMember] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: 'member3@smart-library.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member2@smart-library.test' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'member5@smart-library.test' } }),
    ]);
    for (const borrower of [blocked, unverified, overdueMember]) {
      const copy = await availableCopy();
      expect(
        (
          await api()
            .post('/api/v1/loans/borrow')
            .set('Authorization', `Bearer ${librarian}`)
            .send({ memberId: borrower.id, bookCopyId: copy.id })
        ).status,
      ).toBe(400);
    }
    for (let index = 0; index < 5; index += 1) await createActiveLoan('member9@smart-library.test');
    const copy = await availableCopy();
    const memberNine = await prisma.user.findUniqueOrThrow({
      where: { email: 'member9@smart-library.test' },
    });
    expect(
      (
        await api()
          .post('/api/v1/loans/borrow')
          .set('Authorization', `Bearer ${librarian}`)
          .send({ memberId: memberNine.id, bookCopyId: copy.id })
      ).status,
    ).toBe(400);
  });

  it('rejects unavailable, archived-book, and archived-copy borrowing attempts', async () => {
    const borrower = await prisma.user.findUniqueOrThrow({
      where: { email: 'member9@smart-library.test' },
    });
    const unavailable = await prisma.bookCopy.findFirstOrThrow({
      where: { status: BookCopyStatus.BORROWED },
    });
    expect(
      (
        await api()
          .post('/api/v1/loans/borrow')
          .set('Authorization', `Bearer ${librarian}`)
          .send({ memberId: borrower.id, bookCopyId: unavailable.id })
      ).status,
    ).toBe(409);
    const copy = await availableCopy();
    await prisma.book.update({ where: { id: copy.bookId }, data: { isArchived: true } });
    expect(
      (
        await api()
          .post('/api/v1/loans/borrow')
          .set('Authorization', `Bearer ${librarian}`)
          .send({ memberId: borrower.id, bookCopyId: copy.id })
      ).status,
    ).toBe(400);
    await prisma.book.update({ where: { id: copy.bookId }, data: { isArchived: false } });
    await prisma.bookCopy.update({ where: { id: copy.id }, data: { isArchived: true } });
    expect(
      (
        await api()
          .post('/api/v1/loans/borrow')
          .set('Authorization', `Bearer ${librarian}`)
          .send({ memberId: borrower.id, bookCopyId: copy.id })
      ).status,
    ).toBe(400);
    await prisma.bookCopy.update({ where: { id: copy.id }, data: { isArchived: false } });
  });

  it('permits only one competing borrow of a copy', async () => {
    const borrower = await prisma.user.findUniqueOrThrow({
      where: { email: 'member9@smart-library.test' },
    });
    const copy = await availableCopy();
    const before = await prisma.book.findUniqueOrThrow({ where: { id: copy.bookId } });
    const attempt = () =>
      api()
        .post('/api/v1/loans/borrow')
        .set('Authorization', `Bearer ${librarian}`)
        .send({ memberId: borrower.id, bookCopyId: copy.id });
    const results = await Promise.all([attempt(), attempt()]);
    const success = results.find((result) => result.status === 201);
    if (success) {
      createdLoanIds.push(success.body.id as string);
      touchedCopyIds.add(copy.id);
    }
    expect(success).toBeDefined();
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(1);
    expect(
      await prisma.loan.count({
        where: { bookCopyId: copy.id, returnedAt: null, status: LoanStatus.ACTIVE },
      }),
    ).toBe(1);
    expect((await prisma.bookCopy.findUniqueOrThrow({ where: { id: copy.id } })).status).toBe(
      BookCopyStatus.BORROWED,
    );
    expect(
      (await prisma.book.findUniqueOrThrow({ where: { id: copy.bookId } })).availableCopies,
    ).toBe(before.availableCopies - 1);
    expect(
      await prisma.auditLog.count({
        where: { action: 'LOAN_CREATED', entityType: 'loan', entityId: success!.body.id },
      }),
    ).toBe(1);
    await api()
      .post(`/api/v1/loans/${success!.body.id}/return`)
      .set('Authorization', `Bearer ${librarian}`)
      .send({ returnCondition: 'GOOD' });
  });

  it('returns a damaged copy without making it available and keeps counters consistent', async () => {
    const borrower = await prisma.user.findUniqueOrThrow({
      where: { email: 'member9@smart-library.test' },
    });
    const copy = await availableCopy();
    const before = await prisma.book.findUniqueOrThrow({ where: { id: copy.bookId } });
    const borrowed = await api()
      .post('/api/v1/loans/borrow')
      .set('Authorization', `Bearer ${librarian}`)
      .send({ memberId: borrower.id, bookCopyId: copy.id });
    const returned = await api()
      .post(`/api/v1/loans/${borrowed.body.id}/return`)
      .set('Authorization', `Bearer ${librarian}`)
      .send({ returnCondition: 'DAMAGED', returnNotes: 'Damaged during use' });
    expect(returned.status).toBe(201);
    expect(returned.body.bookCopy.status).toBe(BookCopyStatus.DAMAGED);
    expect((await prisma.bookCopy.findUniqueOrThrow({ where: { id: copy.id } })).status).toBe(
      BookCopyStatus.DAMAGED,
    );
    expect(
      (await prisma.book.findUniqueOrThrow({ where: { id: copy.bookId } })).availableCopies,
    ).toBe(before.availableCopies - 1);
    await prisma.bookCopy.update({
      where: { id: copy.id },
      data: { status: BookCopyStatus.AVAILABLE, condition: 'GOOD' },
    });
    await prisma.book.update({
      where: { id: copy.bookId },
      data: { availableCopies: before.availableCopies },
    });
  });

  it('renews an eligible owner loan and rejects another member, overdue, and maximum renewals', async () => {
    const own = await createActiveLoan('member1@smart-library.test');
    const other = await createActiveLoan('member5@smart-library.test');
    const renewed = await api()
      .post(`/api/v1/loans/${own.id}/renew`)
      .set('Authorization', `Bearer ${member}`);
    expect(renewed.status).toBe(201);
    expect(renewed.body.renewedCount).toBe(1);
    expect(
      (await api().post(`/api/v1/loans/${other.id}/renew`).set('Authorization', `Bearer ${member}`))
        .status,
    ).toBe(403);
    const maximum = await createActiveLoan('member1@smart-library.test', undefined, 2);
    expect(
      (
        await api()
          .post(`/api/v1/loans/${maximum.id}/renew`)
          .set('Authorization', `Bearer ${member}`)
      ).status,
    ).toBe(400);
    const overdue = await createActiveLoan(
      'member1@smart-library.test',
      new Date(Date.now() - 60_000),
    );
    expect(
      (
        await api()
          .post(`/api/v1/loans/${overdue.id}/renew`)
          .set('Authorization', `Bearer ${member}`)
      ).status,
    ).toBe(400);
  });

  it('keeps member listings private and lets staff search, filter, and page loans', async () => {
    const own = await createActiveLoan('member1@smart-library.test');
    const other = await createActiveLoan('member5@smart-library.test');
    expect(
      (await api().get(`/api/v1/loans/${other.id}`).set('Authorization', `Bearer ${member}`))
        .status,
    ).toBe(403);
    const copy = await prisma.bookCopy.findUniqueOrThrow({ where: { id: own.bookCopyId } });
    const originalBook = await prisma.book.findUniqueOrThrow({ where: { id: copy.bookId } });
    await prisma.book.update({
      where: { id: copy.bookId },
      data: { coverImageUrl: 'https://images.test/member-loan-cover.jpg' },
    });
    const mine = await api()
      .get('/api/v1/loans/me?status=ACTIVE&page=1&limit=1')
      .set('Authorization', `Bearer ${member}`);
    expect(mine.status).toBe(200);
    expect(
      mine.body.items.every(
        (loan: { member: { email: string } }) => loan.member.email === 'member1@smart-library.test',
      ),
    ).toBe(true);
    const mineItem = mine.body.items.find((item: { id: string }) => item.id === own.id);
    expect(mineItem.bookCopy.book.coverImageUrl).toBe('https://images.test/member-loan-cover.jpg');
    expect(mineItem.bookCopy.book.authors.length).toBeGreaterThan(0);
    expect(mineItem.bookCopy.book.authors[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      arabicName: null,
    });
    expect(mineItem.renewalEligibility).toEqual({
      canRenew: true,
      reason: null,
      used: 0,
      maximum: 2,
      remaining: 2,
    });
    expect(mineItem.member.passwordHash).toBeUndefined();
    expect(mineItem.member.status).toBeUndefined();
    expect(mineItem.member.emailVerifiedAt).toBeUndefined();
    expect(mineItem.member.deletedAt).toBeUndefined();
    expect(mineItem.issuedBy).toBeUndefined();
    expect(mineItem.returnedBy).toBeUndefined();
    expect(mineItem).not.toHaveProperty('auditLogs');
    const searchedByAuthor = await api()
      .get(`/api/v1/loans/me?q=${encodeURIComponent(mineItem.bookCopy.book.authors[0].name)}`)
      .set('Authorization', `Bearer ${member}`);
    expect(searchedByAuthor.status).toBe(200);
    expect(searchedByAuthor.body.items.map((item: { id: string }) => item.id)).toContain(own.id);
    const detail = await api()
      .get(`/api/v1/loans/${own.id}`)
      .set('Authorization', `Bearer ${member}`);
    expect(detail.status).toBe(200);
    expect(detail.body.bookCopy.book.authors).toEqual(mineItem.bookCopy.book.authors);
    expect(detail.body.renewalEligibility).toEqual(mineItem.renewalEligibility);
    await prisma.book.update({ where: { id: copy.bookId }, data: { coverImageUrl: null } });
    const nullCover = await api()
      .get(`/api/v1/loans/${own.id}`)
      .set('Authorization', `Bearer ${member}`);
    expect(nullCover.body.bookCopy.book.coverImageUrl).toBeNull();
    const loanMember = await prisma.user.findUniqueOrThrow({
      where: { email: 'member1@smart-library.test' },
    });
    const listed = await api()
      .get(
        `/api/v1/loans?q=${encodeURIComponent(copy.copyCode)}&memberId=${loanMember.id}&bookId=${copy.bookId}&copyId=${copy.id}&status=ACTIVE&borrowedFrom=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}&dueFrom=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}&page=1&limit=1`,
      )
      .set('Authorization', `Bearer ${librarian}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toMatchObject({ page: 1, limit: 1 });
    expect(listed.body.items[0].id).toBe(own.id);
    await prisma.book.update({
      where: { id: copy.bookId },
      data: { coverImageUrl: originalBook.coverImageUrl },
    });
  });
});
