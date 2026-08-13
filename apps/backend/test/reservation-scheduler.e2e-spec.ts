import {
  ReservationExpirationScheduler,
  reservationExpirationInterval,
} from '../src/modules/reservations/reservation-expiration.scheduler';
import type { ReservationsService } from '../src/modules/reservations/reservations.service';

describe('Phase 5.2.4 reservation expiration scheduler hardening', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalInterval = process.env.RESERVATION_EXPIRATION_INTERVAL_MS;

  afterEach(() => {
    jest.useRealTimers();
    process.env.NODE_ENV = originalNodeEnv;
    if (originalInterval === undefined) delete process.env.RESERVATION_EXPIRATION_INTERVAL_MS;
    else process.env.RESERVATION_EXPIRATION_INTERVAL_MS = originalInterval;
    jest.restoreAllMocks();
  });

  it.each([
    [undefined, 60_000],
    ['', 60_000],
    ['60000', 60_000],
    ['5000', 5_000],
    ['0', 60_000],
    ['-1', 60_000],
    ['not-a-number', 60_000],
    ['4999', 60_000],
    ['5000.5', 60_000],
    ['2147483648', 60_000],
    ['9007199254740991', 60_000],
  ])('normalizes interval %s to %i milliseconds', (configured, expected) => {
    expect(reservationExpirationInterval(configured)).toBe(expected);
  });

  it('runs at startup, prevents overlapping passes, and releases the timer on shutdown', async () => {
    jest.useFakeTimers();
    process.env.NODE_ENV = 'development';
    process.env.RESERVATION_EXPIRATION_INTERVAL_MS = '5000';
    let releaseFirst!: () => void;
    const firstPass = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const processDueExpirations = jest
      .fn<Promise<number>, []>()
      .mockImplementationOnce(async () => {
        await firstPass;
        return 1;
      })
      .mockResolvedValue(0);
    const scheduler = new ReservationExpirationScheduler({
      processDueExpirations,
    } as unknown as ReservationsService);

    scheduler.onModuleInit();
    await Promise.resolve();
    expect(processDueExpirations).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(processDueExpirations).toHaveBeenCalledTimes(1);

    releaseFirst();
    await Promise.resolve();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5_000);
    expect(processDueExpirations).toHaveBeenCalledTimes(2);

    scheduler.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(15_000);
    expect(processDueExpirations).toHaveBeenCalledTimes(2);
  });

  it('does not start an automatic timer in the test environment', async () => {
    jest.useFakeTimers();
    process.env.NODE_ENV = 'test';
    const processDueExpirations = jest.fn<Promise<number>, []>().mockResolvedValue(0);
    const scheduler = new ReservationExpirationScheduler({
      processDueExpirations,
    } as unknown as ReservationsService);

    scheduler.onModuleInit();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(processDueExpirations).not.toHaveBeenCalled();
    scheduler.onModuleDestroy();
  });
});
