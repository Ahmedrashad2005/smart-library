import type { Role } from '../auth/access';

export const isStaffLoanRoute = (path: string) => /^\/librarian\/(loans|returns)/.test(path);
export const isMemberLoanRoute = (path: string) => /^\/my-loans/.test(path);
export const canAccessLoanRoute = (authenticated: boolean, role: Role | undefined, path: string) =>
  isStaffLoanRoute(path)
    ? authenticated && (role === 'LIBRARIAN' || role === 'ADMIN')
    : isMemberLoanRoute(path)
      ? authenticated && role === 'MEMBER'
      : false;
export const remainingRenewals = (loan: { renewedCount: number }) =>
  Math.max(0, 2 - loan.renewedCount);
export const loanCanRenew = (loan: { status: string; renewedCount: number }) =>
  loan.status === 'ACTIVE' && remainingRenewals(loan) > 0;
export const dueDays = (dueAt: string, now = Date.now()) =>
  Math.ceil((new Date(dueAt).getTime() - now) / 86_400_000);
