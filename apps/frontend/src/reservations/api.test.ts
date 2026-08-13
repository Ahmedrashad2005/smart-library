import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api';
import { createReservation, listMyReservations, reservationDetail } from './api';

vi.mock('../lib/api', () => ({ apiRequest: vi.fn() }));

describe('reservation API boundary', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it('sends only the selected book identity with the existing access token', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ id: 'reservation' });
    await createReservation('book-campus', 'member-token');
    expect(apiRequest).toHaveBeenCalledWith(
      '/reservations',
      { method: 'POST', body: JSON.stringify({ bookId: 'book-campus' }) },
      'member-token',
    );
    const body = JSON.parse(
      (vi.mocked(apiRequest).mock.calls[0]![1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body).toEqual({ bookId: 'book-campus' });
    expect(body).not.toHaveProperty('memberId');
    expect(body).not.toHaveProperty('bookCopyId');
  });

  it('requests the member list with real status pagination and a valid limit', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [] });
    await listMyReservations({ status: 'cancelled', page: 3, limit: 12 }, 'member-token');
    expect(apiRequest).toHaveBeenCalledWith(
      '/reservations/me?status=cancelled&page=3&limit=12',
      {},
      'member-token',
    );
  });

  it('normalizes unsafe pagination values and respects the backend maximum limit', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [] });
    await listMyReservations({ status: 'all', page: -2, limit: 100 }, 'member-token');
    expect(apiRequest).toHaveBeenCalledWith(
      '/reservations/me?status=all&page=1&limit=50',
      {},
      'member-token',
    );
  });

  it('loads an encoded owned reservation detail through the existing API client', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ id: 'owned' });
    await reservationDetail('owned/id', 'member-token');
    expect(apiRequest).toHaveBeenCalledWith('/reservations/owned%2Fid', {}, 'member-token');
  });
});
