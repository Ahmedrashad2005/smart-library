import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api';
import { createReservation } from './api';

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
});
