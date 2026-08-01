import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { MailService } from '../src/modules/auth/mail.service';

class TestMailService {
  readonly sent: Array<{ to: string; subject: string; url: string }> = [];
  async send(to: string, subject: string, url: string): Promise<void> {
    this.sent.push({ to, subject, url });
  }
}
const password = 'SmartLib123';
describe('Phase 2 authentication and RBAC', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const mail = new TestMailService();
  const api = () => request(app.getHttpServer());
  const mailToken = (): string => new URL(mail.sent.at(-1)!.url).searchParams.get('token')!;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
    const existing = await prisma.user.findUnique({
      where: { email: 'integration.member@test.local' },
    });
    if (existing) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: existing.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: existing.id } });
      await prisma.refreshToken.deleteMany({ where: { userId: existing.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });
  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });
  it('seeds one admin, two librarians, and fifteen members', async () => {
    expect(await prisma.user.count({ where: { role: UserRole.ADMIN } })).toBe(1);
    expect(await prisma.user.count({ where: { role: UserRole.LIBRARIAN } })).toBe(2);
    expect(await prisma.user.count({ where: { role: UserRole.MEMBER } })).toBeGreaterThanOrEqual(
      15,
    );
  });
  it('registers a member, hashes the password, and never serializes it', async () => {
    const response = await api()
      .post('/api/v1/auth/register')
      .send({ fullName: 'Integration Member', email: 'integration.member@test.local', password });
    expect(response.status).toBe(201);
    expect(response.body.passwordHash).toBeUndefined();
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'integration.member@test.local' },
    });
    expect(user.status).toBe(UserStatus.PENDING_VERIFICATION);
    expect(await argon2.verify(user.passwordHash, password)).toBe(true);
  });
  it('rejects duplicate registration', async () => {
    expect(
      (
        await api()
          .post('/api/v1/auth/register')
          .send({ fullName: 'Other', email: 'integration.member@test.local', password })
      ).status,
    ).toBe(400);
  });
  it('verifies email and rejects expired verification tokens', async () => {
    expect(
      (await api().post('/api/v1/auth/verify-email').send({ token: mailToken() })).status,
    ).toBe(201);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'integration.member@test.local' },
    });
    expect(user.status).toBe(UserStatus.ACTIVE);
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: 'expired-token', expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await api().post('/api/v1/auth/verify-email').send({ token: 'expired-token' })).status,
    ).toBe(400);
  });
  it('logs in and rejects invalid, blocked, and suspended credentials', async () => {
    const success = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'integration.member@test.local', password });
    expect(success.status).toBe(200);
    expect(success.body.accessToken).toBeTruthy();
    expect(
      (
        await api()
          .post('/api/v1/auth/login')
          .send({ email: 'integration.member@test.local', password: 'WrongPass1' })
      ).status,
    ).toBe(401);
    await prisma.user.update({
      where: { email: 'integration.member@test.local' },
      data: { status: UserStatus.BLOCKED },
    });
    expect(
      (
        await api()
          .post('/api/v1/auth/login')
          .send({ email: 'integration.member@test.local', password })
      ).status,
    ).toBe(401);
    await prisma.user.update({
      where: { email: 'integration.member@test.local' },
      data: { status: UserStatus.SUSPENDED },
    });
    expect(
      (
        await api()
          .post('/api/v1/auth/login')
          .send({ email: 'integration.member@test.local', password })
      ).status,
    ).toBe(401);
    await prisma.user.update({
      where: { email: 'integration.member@test.local' },
      data: { status: UserStatus.ACTIVE },
    });
  });
  it('rotates refresh tokens, rejects reuse, and revokes on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    expect(
      (
        await agent
          .post('/api/v1/auth/login')
          .send({ email: 'integration.member@test.local', password })
      ).status,
    ).toBe(200);
    const first = await agent.post('/api/v1/auth/refresh');
    expect(first.status).toBe(200);
    const rotatedCookie = first.headers['set-cookie']?.[0];
    expect(rotatedCookie).toBeDefined();
    const reused = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedCookie as string);
    expect(reused.status).toBe(200);
    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);
    await agent.post('/api/v1/auth/logout');
    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);
  });
  it('returns generic forgot-password responses and resets a password once', async () => {
    expect(
      (await api().post('/api/v1/auth/forgot-password').send({ email: 'missing@test.local' })).body
        .accepted,
    ).toBe(true);
    await api()
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'integration.member@test.local' });
    const token = mailToken();
    expect(
      (await api().post('/api/v1/auth/reset-password').send({ token, password: 'ResetPass1' }))
        .status,
    ).toBe(201);
    expect(
      (
        await api()
          .post('/api/v1/auth/login')
          .send({ email: 'integration.member@test.local', password: 'ResetPass1' })
      ).status,
    ).toBe(200);
    expect((await api().post('/api/v1/auth/reset-password').send({ token, password })).status).toBe(
      400,
    );
  });
  it('enforces protected profiles and admin RBAC', async () => {
    const member = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'integration.member@test.local', password: 'ResetPass1' });
    const memberToken = member.body.accessToken;
    expect((await api().get('/api/v1/users/me')).status).toBe(401);
    expect(
      (await api().get('/api/v1/users').set('Authorization', `Bearer ${memberToken}`)).status,
    ).toBe(403);
    expect(
      (
        await api()
          .patch('/api/v1/users/me')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ fullName: 'Updated Member' })
      ).status,
    ).toBe(200);
    const librarian = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'librarian1@smart-library.test', password });
    expect(
      (
        await api()
          .patch('/api/v1/users/x/role')
          .set('Authorization', `Bearer ${librarian.body.accessToken}`)
          .send({ role: 'ADMIN' })
      ).status,
    ).toBe(403);
    const admin = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'admin@smart-library.test', password });
    expect(
      (await api().get('/api/v1/users').set('Authorization', `Bearer ${admin.body.accessToken}`))
        .status,
    ).toBe(200);
  });
  it('allows administrators to block/unblock and blocked users lose access', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'integration.member@test.local' },
    });
    const admin = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'admin@smart-library.test', password });
    const token = admin.body.accessToken;
    expect(
      (
        await api()
          .patch(`/api/v1/users/${user.id}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'BLOCKED' })
      ).status,
    ).toBe(200);
    const member = await api()
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'ResetPass1' });
    expect(member.status).toBe(401);
    expect(
      (
        await api()
          .patch(`/api/v1/users/${user.id}/status`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'ACTIVE' })
      ).status,
    ).toBe(200);
  });
});
