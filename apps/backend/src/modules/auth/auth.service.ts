import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from './mail.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import type { LoginDto, RegisterDto } from './auth.dto';
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const safe = (user: {
  passwordHash?: string;
  [key: string]: unknown;
}): Omit<typeof user, 'passwordHash'> => {
  const result = { ...user };
  delete result.passwordHash;
  return result;
};
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly audit: AuditLogService,
  ) {}
  private token(): string {
    return randomBytes(32).toString('base64url');
  }
  private async issue(
    user: { id: string; role: string },
    meta: { ip?: string; headers?: { 'user-agent'?: string } },
  ) {
    const raw = this.token();
    const refresh = await this.jwt.signAsync(
      { sub: user.id, type: 'refresh', token: raw },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? 'development-refresh-secret',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
      },
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hash(refresh),
        expiresAt: new Date(Date.now() + 604800000),
        ipAddress: meta.ip,
        userAgent: meta.headers?.['user-agent'],
      },
    });
    return {
      accessToken: await this.jwt.signAsync(
        { sub: user.id, role: user.role },
        {
          secret: process.env.JWT_ACCESS_SECRET ?? 'development-access-secret',
          expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
        },
      ),
      refreshToken: refresh,
    };
  }
  async register(dto: RegisterDto, meta: { ip?: string; headers?: { 'user-agent'?: string } }) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new BadRequestException('Email is already registered');
    const membershipNumber = `SL-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const verification = this.token();
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email,
        phone: dto.phone,
        passwordHash: await argon2.hash(dto.password),
        membershipNumber,
        qrCodeValue: `member:${membershipNumber}`,
      },
    });
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hash(verification),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await this.mail.send(
      email,
      'Verify your Smart Library email',
      `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/verify-email?token=${verification}`,
    );
    await this.audit.write('USER_REGISTERED', 'User', user.id, user, meta);
    return safe(user);
  }
  async login(dto: LoginDto, meta: { ip?: string; headers?: { 'user-agent'?: string } }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (
      !user ||
      !(await argon2.verify(user.passwordHash, dto.password)) ||
      user.status === UserStatus.BLOCKED ||
      user.status === UserStatus.SUSPENDED
    )
      throw new UnauthorizedException('Invalid credentials');
    const tokens = await this.issue(user, meta);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.write('USER_LOGIN', 'User', user.id, user, meta);
    return { ...tokens, user: safe(user) };
  }
  async logout(refresh: string | undefined): Promise<void> {
    if (refresh)
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hash(refresh), revokedAt: null },
        data: { revokedAt: new Date() },
      });
  }
  async verify(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash: hash(token),
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!record) throw new BadRequestException('Invalid or expired verification token');
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: record.userId, consumedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date(), status: UserStatus.ACTIVE },
      }),
    ]);
  }
  async resend(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), emailVerifiedAt: null, deletedAt: null },
    });
    if (!user) return;
    const token = this.token();
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 86400000) },
    });
    await this.mail.send(
      user.email,
      'Verify your Smart Library email',
      `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/verify-email?token=${token}`,
    );
  }
  async forgot(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), deletedAt: null },
    });
    if (!user) return;
    const token = this.token();
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 3600000) },
    });
    await this.mail.send(
      user.email,
      'Reset your Smart Library password',
      `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/reset-password?token=${token}`,
    );
  }
  async reset(token: string, password: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: hash(token),
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) throw new BadRequestException('Invalid or expired reset token');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await argon2.hash(password) },
      }),
    ]);
  }
  async refresh(
    refresh: string | undefined,
    meta: { ip?: string; headers?: { 'user-agent'?: string } },
  ) {
    if (!refresh) throw new UnauthorizedException();
    let payload: { sub: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(refresh, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'development-refresh-secret',
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException();
    const session = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: hash(refresh),
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: UserStatus.ACTIVE, deletedAt: null },
      },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException();
    await this.prisma.refreshToken.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
    return this.issue(session.user, meta);
  }
  async change(userId: string, currentPassword: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword)))
      throw new UnauthorizedException('Invalid credentials');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await argon2.hash(password) },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.mail.send(
      user.email,
      'Your Smart Library password changed',
      'Your password was changed successfully.',
    );
  }
}
