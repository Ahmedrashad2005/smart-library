import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export const RESERVATION_PICKUP_WINDOW_SETTING_KEY = 'reservation.pickupWindowHours';
export const DEFAULT_RESERVATION_PICKUP_WINDOW_HOURS = 24;

@Injectable()
export class ReservationPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async pickupWindowHours(
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const setting = await client.systemSetting.findUnique({
      where: { key: RESERVATION_PICKUP_WINDOW_SETTING_KEY },
      select: { value: true },
    });
    const value = setting?.value;
    return typeof value === 'number' && Number.isInteger(value) && value > 0
      ? value
      : DEFAULT_RESERVATION_PICKUP_WINDOW_HOURS;
  }

  async expiresAt(
    from = new Date(),
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Date> {
    const hours = await this.pickupWindowHours(client);
    return new Date(from.getTime() + hours * 60 * 60 * 1000);
  }
}
