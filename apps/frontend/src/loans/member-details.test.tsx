import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { loanDetail, renewLoan } from './api';
import type { Loan, LoanStatus } from './api';
import { LoanDetails } from './pages';

vi.mock('./api', () => ({ loanDetail: vi.fn(), renewLoan: vi.fn() }));
const loan = (status: LoanStatus = 'ACTIVE', renewedCount = 0): Loan => ({
  id: 'mine-1',
  status,
  renewedCount,
  borrowedAt: '2026-07-01T00:00:00Z',
  dueAt: '2026-08-01T00:00:00Z',
  returnedAt: status === 'RETURNED' ? '2026-07-20T00:00:00Z' : null,
  lastRenewedAt: renewedCount ? '2026-07-15T00:00:00Z' : null,
  member: { id: 'me', fullName: 'Member', email: 'member@test' },
  issuedBy: { id: 'staff', fullName: 'Private Librarian' },
  bookCopy: {
    id: 'copy',
    copyCode: 'COPY-1',
    barcode: 'BAR-1',
    status: 'BORROWED',
    condition: 'GOOD',
    book: {
      id: 'book',
      title: 'Member Book',
      coverImageUrl: 'https://images.test/member-book.jpg',
      authors: [{ id: 'author', name: 'Detail Author', arabicName: 'مؤلف التفاصيل' }],
    },
    section: { code: 'S', nameEn: 'Section' },
    shelf: { code: 'SH', nameEn: 'Shelf' },
  },
});
const props = {
  id: 'mine-1',
  token: 'member-token',
  staff: false,
  path: '/my-loans/mine-1',
  go: vi.fn(),
  notify: vi.fn(),
};

describe('member loan details', () => {
  beforeEach(() => vi.clearAllMocks());
  it('shows loading and safe own-loan details without staff controls or metadata', async () => {
    vi.mocked(loanDetail).mockResolvedValue(loan('ACTIVE', 1));
    render(<LoanDetails {...props} />);
    expect(screen.getByText('Loading loan…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Member Book' })).toBeInTheDocument();
    expect(screen.getByText(/COPY-1 · BAR-1/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cover of Member Book' })).toBeInTheDocument();
    expect(screen.getByText('Detail Author')).toBeInTheDocument();
    expect(screen.getByText(/Jul 1, 2026 · Aug 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText('1/2; 1 remaining')).toBeInTheDocument();
    expect(screen.getByText('Jul 15, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Private Librarian/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Process return' })).not.toBeInTheDocument();
  });
  it('renews the member loan once and displays previous/new dates', async () => {
    const initial = loan();
    vi.mocked(loanDetail).mockResolvedValue(initial);
    let resolveRenew: (value: Loan) => void = () => undefined;
    vi.mocked(renewLoan).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRenew = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<LoanDetails {...props} />);
    await user.click(await screen.findByRole('button', { name: 'Renew loan' }));
    expect(screen.getByRole('button', { name: 'Renewing…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Renewing…' }));
    expect(renewLoan).toHaveBeenCalledTimes(1);
    resolveRenew({
      ...initial,
      dueAt: '2026-08-15T00:00:00Z',
      renewedCount: 1,
      lastRenewedAt: '2026-08-02T00:00:00Z',
    });
    expect(
      await screen.findByText(/Renewal completed: Aug 1, 2026 → Aug 15, 2026/),
    ).toBeInTheDocument();
  });
  it.each([
    ['OVERDUE', 0, 'loan is overdue'],
    ['RETURNED', 0, 'loan is returned'],
    ['ACTIVE', 2, 'renewal limit reached'],
  ] as const)('denies %s/%s renewal', async (status, count, reason) => {
    vi.mocked(loanDetail).mockResolvedValue(loan(status, count));
    render(<LoanDetails {...props} />);
    expect(await screen.findByText(new RegExp(reason))).toBeInTheDocument();
  });
  it('renders the backend denied/not-found state for another member loan', async () => {
    vi.mocked(loanDetail).mockRejectedValue(
      new ApiError('Members can view only their own loans', 403),
    );
    render(<LoanDetails {...props} id="other" />);
    expect(await screen.findByText('Members can view only their own loans')).toBeInTheDocument();
  });
});
