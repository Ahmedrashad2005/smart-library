import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
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
