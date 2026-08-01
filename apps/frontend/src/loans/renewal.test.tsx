import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { loanDetail, renewLoan } from './api';
import type { Loan, LoanStatus } from './api';
import { LoanDetails } from './pages';

vi.mock('./api', () => ({ loanDetail: vi.fn(), renewLoan: vi.fn() }));
const makeLoan = (status: LoanStatus = 'ACTIVE', renewedCount = 0): Loan => ({
  id: 'loan-1',
  status,
  renewedCount,
  borrowedAt: '2026-07-01T00:00:00Z',
  dueAt: '2026-08-01T00:00:00Z',
  returnedAt: status === 'RETURNED' ? '2026-07-20T00:00:00Z' : null,
  member: { id: 'member-1', fullName: 'Member One', email: 'member@test' },
  issuedBy: { id: 'staff-1', fullName: 'Librarian One' },
  bookCopy: {
    id: 'copy-1',
    copyCode: 'COPY-1',
    barcode: 'BAR-1',
    status: 'BORROWED',
    condition: 'GOOD',
    book: { id: 'book-1', title: 'Renewable Book', authors: [] },
  },
});
const props = {
  id: 'loan-1',
  token: 'token',
  staff: true,
  path: '/librarian/loans/loan-1',
  go: vi.fn(),
  notify: vi.fn(),
};

describe('staff loan renewal details', () => {
  beforeEach(() => vi.clearAllMocks());
  it('renews once while pending and renders backend renewal values', async () => {
    const initial = makeLoan();
    vi.mocked(loanDetail).mockResolvedValue(initial);
    let resolveRenew: (loan: Loan) => void = () => undefined;
    vi.mocked(renewLoan).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRenew = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<LoanDetails {...props} />);
    expect(await screen.findByRole('button', { name: 'Renew loan' })).toBeInTheDocument();
    expect(screen.getByText(/Aug 1, 2026/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Renew loan' }));
    expect(screen.getByRole('button', { name: 'Renewing…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Renewing…' }));
    expect(renewLoan).toHaveBeenCalledTimes(1);
    expect(renewLoan).toHaveBeenCalledWith('loan-1', 'token');
    resolveRenew({
      ...initial,
      dueAt: '2026-08-15T00:00:00Z',
      renewedCount: 1,
      lastRenewedAt: '2026-08-02T00:00:00Z',
    });
    expect(
      await screen.findByText(/Renewal completed: Aug 1, 2026 → Aug 15, 2026/),
    ).toBeInTheDocument();
    expect(screen.getByText('1/2; 1 remaining')).toBeInTheDocument();
    expect(screen.getByText('Aug 2, 2026')).toBeInTheDocument();
  });
  it.each([
    ['OVERDUE', 0, 'loan is overdue'],
    ['RETURNED', 0, 'loan is returned'],
    ['ACTIVE', 2, 'renewal limit reached'],
  ] as const)('explains why %s/%s cannot renew', async (status, count, reason) => {
    vi.mocked(loanDetail).mockResolvedValue(makeLoan(status, count));
    render(<LoanDetails {...props} />);
    expect(await screen.findByText(new RegExp(reason))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renew loan' })).not.toBeInTheDocument();
  });
  it('shows backend renewal validation errors', async () => {
    vi.mocked(loanDetail).mockResolvedValue(makeLoan());
    vi.mocked(renewLoan).mockRejectedValue(new ApiError('Member account is ineligible', 409));
    const user = userEvent.setup();
    render(<LoanDetails {...props} />);
    await user.click(await screen.findByRole('button', { name: 'Renew loan' }));
    expect(await screen.findByText('Member account is ineligible')).toBeInTheDocument();
  });
});
