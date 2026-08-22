import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AssistantClient } from '../src/modules/assistant/assistant.client';
import { ReservationExpirationScheduler } from '../src/modules/reservations/reservation-expiration.scheduler';

describe('assistant endpoint public access, JWT ownership, and read-only safety', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let memberToken = '';
  let librarianToken = '';
  const api = () => request(app.getHttpServer());
  const login = async (email: string) =>
    (await api().post('/api/v1/auth/login').send({ email, password: 'SmartLib123' })).body
      .accessToken as string;

  beforeAll(async () => {
    process.env.RECOMMENDATION_ENABLED = 'false';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AssistantClient)
      .useValue({ interpret: jest.fn() })
      .overrideProvider(ReservationExpirationScheduler)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
    memberToken = await login('member1@smart-library.test');
    librarianToken = await login('librarian1@smart-library.test');
  });

  afterAll(async () => app.close());

  it('allows a guest to search the real active catalog', async () => {
    const response = await api()
      .post('/api/v1/assistant/message')
      .send({ message: 'اعرض الكتب المتاحة', locale: 'ar' });
    expect(response.status).toBe(200);
    expect(response.body.type).toBe('BOOK_SEARCH_RESULTS');
    expect(response.body.books.length).toBeGreaterThan(0);
    expect(response.body.books[0]).toEqual(expect.objectContaining({ id: expect.any(String) }));
  });

  it('derives private Loan ownership only from the MEMBER JWT', async () => {
    const response = await api()
      .post('/api/v1/assistant/message')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ message: 'اعرض إعاراتي', locale: 'ar', memberId: 'another-member' });
    expect(response.status).toBe(200);
    expect(response.body.type).toBe('LOANS');
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|refreshToken|membershipNumber/);
  });

  it('does not grant MEMBER tools to a signed-in staff account', async () => {
    const response = await api()
      .post('/api/v1/assistant/message')
      .set('Authorization', `Bearer ${librarianToken}`)
      .send({ message: 'اعرض حجوزاتي', locale: 'ar' });
    expect(response.status).toBe(200);
    expect(response.body.type).toBe('LOGIN_REQUIRED');
  });

  it('validates locale, message length, and bounded conversation history', async () => {
    const invalidLocale = await api()
      .post('/api/v1/assistant/message')
      .send({ message: 'hello', locale: 'fr' });
    const oversized = await api()
      .post('/api/v1/assistant/message')
      .send({ message: 'a'.repeat(1001), locale: 'en' });
    const history = await api()
      .post('/api/v1/assistant/message')
      .send({
        message: 'hello',
        history: Array.from({ length: 11 }, () => ({ role: 'user', content: 'hello' })),
      });
    expect([invalidLocale.status, oversized.status, history.status]).toEqual([400, 400, 400]);
  });

  it('leaves Loans, Reservations, BookCopy states, and Book counters unchanged', async () => {
    const snapshot = async () =>
      JSON.stringify(
        await Promise.all([
          prisma.loan.findMany({
            select: { id: true, status: true, updatedAt: true },
            orderBy: { id: 'asc' },
          }),
          prisma.reservation.findMany({
            select: { id: true, status: true, updatedAt: true },
            orderBy: { id: 'asc' },
          }),
          prisma.bookCopy.findMany({
            select: { id: true, status: true, updatedAt: true },
            orderBy: { id: 'asc' },
          }),
          prisma.book.findMany({
            select: { id: true, totalCopies: true, availableCopies: true, updatedAt: true },
            orderBy: { id: 'asc' },
          }),
        ]),
      );
    const before = await snapshot();
    for (const message of ['اعرض إعاراتي', 'اعرض حجوزاتي', 'Big Java متاح؟'])
      expect(
        (
          await api()
            .post('/api/v1/assistant/message')
            .set('Authorization', `Bearer ${memberToken}`)
            .send({ message, locale: 'ar' })
        ).status,
      ).toBe(200);
    expect(await snapshot()).toBe(before);
  });
});
