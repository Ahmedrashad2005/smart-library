import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api';
import { getMyRecommendations } from './api';

vi.mock('../lib/api', () => ({ apiRequest: vi.fn() }));

describe('recommendation API boundary', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it('sends only the bounded limit and safe interface locale with the member token', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ mode: 'cold_start', generatedAt: '', items: [] });
    await getMyRecommendations('member-token', 4, 'ar');
    expect(apiRequest).toHaveBeenCalledWith(
      '/recommendations/me?limit=4&locale=ar',
      {},
      'member-token',
    );
    expect(JSON.stringify(vi.mocked(apiRequest).mock.calls[0]?.[0])).not.toMatch(
      /memberId|userId|email/,
    );
  });
});
