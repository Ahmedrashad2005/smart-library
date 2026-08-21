import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { loanDetail, renewLoan } from './api';
import type { Loan, LoanStatus, RenewalReason } from './api';
import { LoanDetails } from './pages';

vi.mock('./api', () => ({ loanDetail: vi.fn(), renewLoan: vi.fn() }));

const eligibility = (canRenew = true, reason: RenewalReason | null = null, used = 0) => ({
  canRenew,
  reason,
  used,
  maximum: 2,
  remaining: Math.max(0, 2 - used),
});
const loan = (status: LoanStatus = 'ACTIVE', used = 0): Loan => ({
  id: 'mine-1',
  status,
  renewedCount: used,
  renewalEligibility:
    status === 'ACTIVE' && used < 2
      ? eligibility(true, null, used)
      : eligibility(false, status === 'ACTIVE' ? 'LIMIT_REACHED' : status, used),
  borrowedAt: '2026-08-01T00:00:00Z',
  dueAt: status === 'OVERDUE' ? '2026-08-10T00:00:00Z' : '2026-08-20T00:00:00Z',
  returnedAt: status === 'RETURNED' ? '2026-08-12T00:00:00Z' : null,
  lastRenewedAt: used ? '2026-08-10T00:00:00Z' : null,
  member: { id: 'private-member', fullName: 'Member', email: 'member@test' },
  issuedBy: { id: 'private-staff', fullName: 'Private Librarian' },
  bookCopy: {
    id: 'private-copy',
    copyCode: 'COPY-1',
    barcode: 'PRIVATE-BARCODE',
    status: status === 'RETURNED' ? 'AVAILABLE' : 'BORROWED',
    condition: 'GOOD',
    book: {
      id: 'book',
      slug: 'member-book',
      title: 'Member Book',
      titleAr: 'كتاب العضو',
      coverImageUrl: 'https://images.test/member-book.jpg',
      authors: [{ id: 'author', name: 'Detail Author', arabicName: 'مؤلف التفاصيل' }],
    },
    section: { code: 'S', nameEn: 'Knowledge', nameAr: 'المعرفة' },
    shelf: { code: 'SH', nameEn: 'Shelf 1', nameAr: 'الرف 1' },
  },
});
const props = {
  id: 'mine-1',
  token: 'member-token',
  staff: false,
  locale: 'en' as const,
  path: '/my-loans/mine-1',
  go: vi.fn(),
  notify: vi.fn(),
  onAuthRequired: vi.fn(),
};

describe('member loan details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-16T10:00:00Z').getTime());
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });
  afterEach(() => vi.restoreAllMocks());

  it('renders safe book-focused details with location and real book navigation', async () => {
    vi.mocked(loanDetail).mockResolvedValue(loan('ACTIVE', 1));
    const user = userEvent.setup();
    render(<LoanDetails {...props} />);
    expect(screen.getByText('Loading loan details…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Member Book' })).toBeInTheDocument();
    expect(screen.getByText('Detail Author')).toBeInTheDocument();
    expect(screen.getByText('Knowledge · Shelf 1')).toBeInTheDocument();
    expect(screen.getByText('COPY-1')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.queryByText('Private Librarian')).not.toBeInTheDocument();
    expect(screen.queryByText('member@test')).not.toBeInTheDocument();
    expect(screen.queryByText('PRIVATE-BARCODE')).not.toBeInTheDocument();
    expect(screen.queryByText('private-copy')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View book: Member Book' }));
    expect(props.go).toHaveBeenCalledWith('/books/member-book');
  });

  it('uses a keyboard confirmation, cancel, pending guard, and authoritative success', async () => {
    const initial = loan();
    vi.mocked(loanDetail).mockResolvedValue(initial);
    let resolveRenew!: (value: Loan) => void;
    vi.mocked(renewLoan).mockImplementation(
      () => new Promise((resolve) => (resolveRenew = resolve)),
    );
    const user = userEvent.setup();
    render(<LoanDetails {...props} />);
    await user.click(await screen.findByRole('button', { name: 'Renew loan' }));
    let dialog = screen.getByRole('dialog', { name: 'Renew this loan?' });
    expect(dialog).toHaveTextContent('Member Book');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(renewLoan).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Renew loan' }));
    dialog = screen.getByRole('dialog', { name: 'Renew this loan?' });
    await user.click(within(dialog).getByRole('button', { name: 'Renew loan' }));
    expect(within(dialog).getByRole('button', { name: 'Renewing…' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Renewing…' }));
    expect(renewLoan).toHaveBeenCalledTimes(1);
    resolveRenew({
      ...initial,
      dueAt: '2026-09-03T00:00:00Z',
      renewedCount: 1,
      renewalEligibility: eligibility(true, null, 1),
    });
    expect(
      await screen.findByText('Loan renewed and the return date was updated.'),
    ).toBeInTheDocument();
    expect(screen.getByText('3 Sept 2026')).toBeInTheDocument();
  });

  it.each([
    ['OVERDUE', 0, 'This overdue loan cannot be renewed.'],
    ['RETURNED', 0, 'This loan has already been returned.'],
    ['ACTIVE', 2, 'The maximum number of renewals has been used.'],
  ] as const)('uses backend renewal denial for %s/%s', async (status, used, reason) => {
    vi.mocked(loanDetail).mockResolvedValue(loan(status, used));
    render(<LoanDetails {...props} />);
    expect(await screen.findByText(reason)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renew loan' })).not.toBeInTheDocument();
  });

  it('renders returned date and never presents renewal for returned history', async () => {
    vi.mocked(loanDetail).mockResolvedValue(loan('RETURNED'));
    render(<LoanDetails {...props} />);
    expect(await screen.findByText('Returned')).toBeInTheDocument();
    expect(screen.getByText('12 Aug 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renew loan' })).not.toBeInTheDocument();
  });

  it.each([
    [403, 'You cannot view this loan.'],
    [404, 'Loan not found.'],
    [500, 'We could not load the loan details.'],
  ])('maps backend %s to a safe retryable state', async (status, message) => {
    vi.mocked(loanDetail).mockRejectedValue(new ApiError('Private backend message', status));
    render(<LoanDetails {...props} />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Private backend message')).not.toBeInTheDocument();
  });
});
