import { afterEach, describe, expect, it, vi } from 'vitest';
import { borrowCopy, listLoans, lookupMembers, returnLoan } from './api';

describe('loan API layer', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses the protected staff list and preserves search/filter/pagination', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: { items: [], page: 2 } }) });
    vi.stubGlobal('fetch', fetch);
    await listLoans({ q: 'copy-1', status: 'OVERDUE', page: 2, limit: 10 }, 'staff-token');
    expect(String(fetch.mock.calls[0]![0])).toContain(
      '/loans?q=copy-1&status=OVERDUE&page=2&limit=10',
    );
    expect(fetch.mock.calls[0]![1].headers.Authorization).toBe('Bearer staff-token');
  });
  it('sends only backend-supported borrow and return payloads', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'loan-1' } }) });
    vi.stubGlobal('fetch', fetch);
    await borrowCopy({ memberId: 'member', copyCode: 'SL-1' }, 'token');
    await returnLoan('loan-1', { returnCondition: 'DAMAGED', returnNotes: 'Torn cover' }, 'token');
    expect(fetch.mock.calls[0]![1].body).toBe(
      JSON.stringify({ memberId: 'member', copyCode: 'SL-1' }),
    );
    expect(String(fetch.mock.calls[1]![0])).toContain('/loans/loan-1/return');
    expect(fetch.mock.calls[1]![1].body).toContain('DAMAGED');
  });
  it('looks up staff member eligibility through the safe endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetch);
    await lookupMembers('member@example.test', 'staff-token');
    expect(String(fetch.mock.calls[0]![0])).toContain('/users/members?q=member%40example.test');
  });
});
