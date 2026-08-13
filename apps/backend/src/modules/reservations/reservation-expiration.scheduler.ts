import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ReservationsService } from './reservations.service';

const DEFAULT_EXPIRATION_INTERVAL_MS = 60_000;
const MIN_EXPIRATION_INTERVAL_MS = 5_000;
const MAX_EXPIRATION_INTERVAL_MS = 2_147_483_647;

export function reservationExpirationInterval(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_EXPIRATION_INTERVAL_MS;
  const configured = Number(value);
  return Number.isSafeInteger(configured) &&
    configured >= MIN_EXPIRATION_INTERVAL_MS &&
    configured <= MAX_EXPIRATION_INTERVAL_MS
    ? configured
    : DEFAULT_EXPIRATION_INTERVAL_MS;
}

@Injectable()
export class ReservationExpirationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationExpirationScheduler.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly reservations: ReservationsService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    void this.run();
    const interval = reservationExpirationInterval(process.env.RESERVATION_EXPIRATION_INTERVAL_MS);
    this.timer = setInterval(() => void this.run(), interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const processed = await this.reservations.processDueExpirations();
      if (processed > 0) this.logger.log(`Expired ${processed} due reservation(s)`);
    } catch (error) {
      this.logger.error(
        'Reservation expiration pass failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}
