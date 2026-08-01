import { describe, expect, it } from 'vitest';
import { canAccessLoanRoute, dueDays, loanCanRenew, remainingRenewals } from './access';

describe('loan circulation access and eligibility', () => {
  it('protects staff routes for librarian and administrator only', () => {
    expect(canAccessLoanRoute(false, undefined, '/librarian/loans')).toBe(false);
    expect(canAccessLoanRoute(true, 'MEMBER', '/librarian/loans/borrow')).toBe(false);
    expect(canAccessLoanRoute(true, 'LIBRARIAN', '/librarian/returns')).toBe(true);
    expect(canAccessLoanRoute(true, 'ADMIN', '/librarian/loans/id')).toBe(true);
  });
  it('protects member routes and renewal eligibility', () => {
    expect(canAccessLoanRoute(true, 'MEMBER', '/my-loans')).toBe(true);
    expect(canAccessLoanRoute(true, 'ADMIN', '/my-loans/id')).toBe(false);
    expect(remainingRenewals({ renewedCount: 1 })).toBe(1);
    expect(loanCanRenew({ status: 'ACTIVE', renewedCount: 1 })).toBe(true);
    expect(loanCanRenew({ status: 'OVERDUE', renewedCount: 0 })).toBe(false);
    expect(loanCanRenew({ status: 'ACTIVE', renewedCount: 2 })).toBe(false);
  });
  it('reports date differences without replacing backend status', () => {
    expect(dueDays('2026-08-03T00:00:00.000Z', Date.parse('2026-08-01T00:00:00.000Z'))).toBe(2);
    expect(dueDays('2026-07-30T00:00:00.000Z', Date.parse('2026-08-01T00:00:00.000Z'))).toBe(-2);
  });
});
