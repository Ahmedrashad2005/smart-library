import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
const select = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  preferredLanguage: true,
  profileImageUrl: true,
  membershipNumber: true,
  qrCodeValue: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  me(id: string) {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null }, select });
  }
  async updateMe(
    id: string,
    data: { fullName?: string; phone?: string; preferredLanguage?: string },
  ) {
    return this.prisma.user.update({ where: { id }, data, select });
  }
  list() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select,
      orderBy: { createdAt: 'desc' },
    });
  }
  async members(q = '') {
    const now = new Date();
    const members = await this.prisma.user.findMany({
      where: {
        role: UserRole.MEMBER,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { membershipNumber: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        membershipNumber: true,
        status: true,
        emailVerifiedAt: true,
        loans: { where: { returnedAt: null }, select: { dueAt: true } },
      },
      take: 20,
      orderBy: { fullName: 'asc' },
    });
    return members.map((member) => {
      const overdueLoanCount = member.loans.filter((loan) => loan.dueAt < now).length;
      const activeLoanCount = member.loans.length;
      const eligible =
        member.status === UserStatus.ACTIVE &&
        !!member.emailVerifiedAt &&
        !overdueLoanCount &&
        activeLoanCount < 5;
      return {
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        membershipNumber: member.membershipNumber,
        status: member.status,
        emailVerifiedAt: member.emailVerifiedAt,
        activeLoanCount,
        overdueLoanCount,
        remainingLoanCapacity: Math.max(0, 5 - activeLoanCount),
        eligible,
      };
    });
  }
  async one(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
  async status(
    id: string,
    status: Parameters<typeof this.prisma.user.update>[0]['data']['status'],
  ) {
    return this.prisma.user.update({ where: { id }, data: { status }, select });
  }
  async role(actor: { id: string; role: UserRole }, id: string, role: UserRole) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === UserRole.ADMIN || actor.id === id)
      throw new ForbiddenException('Administrator accounts cannot be managed here');
    return this.prisma.user.update({ where: { id }, data: { role }, select });
  }
}
