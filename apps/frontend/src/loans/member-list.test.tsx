import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { listMyLoans, loanDetail, renewLoan } from './api';
import type { Loan, LoanStatus, RenewalReason } from './api';
import { LoanList } from './pages';

vi.mock('./api', () => ({
  listMyLoans: vi.fn(),
  listLoans: vi.fn(),
  loanDetail: vi.fn(),
  renewLoan: vi.fn(),
}));

const eligibility = (canRenew = true, reason: RenewalReason | null = null, used = 0) => ({
  canRenew,
  reason,
  used,
  maximum: 2,
  remaining: Math.max(0, 2 - used),
});

const loan = (status: LoanStatus = 'ACTIVE'): Loan => ({
  id: `mine-${status.toLowerCase()}`,
  status,
  borrowedAt: '2026-08-01T00:00:00Z',
  dueAt: status === 'OVERDUE' ? '2026-08-10T00:00:00Z' : '2026-08-20T00:00:00Z',
  returnedAt: status === 'RETURNED' ? '2026-08-12T00:00:00Z' : null,
  renewedCount: status === 'RETURNED' ? 1 : 0,
  renewalEligibility:
    status === 'ACTIVE'
      ? eligibility()
      : eligibility(
          false,
          status === 'OVERDUE' ? 'OVERDUE' : 'RETURNED',
          status === 'RETURNED' ? 1 : 0,
        ),
  member: { id: 'private-member-id', fullName: 'Private Member', email: 'private@test' },
  bookCopy: {
    id: 'private-copy-id',
    copyCode: `COPY-${status}`,
    barcode: 'PRIVATE-BARCODE',
    status: status === 'RETURNED' ? 'AVAILABLE' : 'BORROWED',
    condition: 'GOOD',
    book: {
      id: 'book-1',
      slug: 'my-book',
      title: 'My Book',
      titleAr: 'كتابي',
      coverImageUrl: 'https://images.test/my-book.jpg',
      authors: [
        { id: 'author-1', name: 'First Author', arabicName: 'المؤلف الأول' },
        { id: 'author-2', name: 'Second Author', arabicName: 'المؤلف الثاني' },
      ],
    },
    section: { code: 'S', nameEn: 'Knowledge', nameAr: 'المعرفة' },
    shelf: { code: 'SH', nameEn: 'Shelf 1', nameAr: 'الرف 1' },
  },
  issuedBy: { id: 'private-staff', fullName: 'Private Librarian' },
});

const props = {
  token: 'member-token',
  staff: false,
  mine: true,
  locale: 'en' as const,
  path: '/my-loans',
  go: vi.fn(),
  notify: vi.fn(),
  onAuthRequired: vi.fn(),
};
const result = (items: Loan[], page = 1, totalPages = 1) => ({
  items,
  total: items.length || 2,
  page,
  limit: 12,
  totalPages,
});

describe('book-focused member loan list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-16T10:00:00Z').getTime());
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    window.history.replaceState({}, '', '/my-loans');
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows localized loading, empty-active, and retryable error states', async () => {
    window.history.replaceState({}, '', '/my-loans?status=active&page=1');
    vi.mocked(listMyLoans).mockResolvedValueOnce(result([]));
    const { unmount } = render(<LoanList {...props} />);
    expect(screen.getByText('Loading your loans…')).toBeInTheDocument();
    expect(await screen.findByText('You have no active loans')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Browse the University Library' }),
    ).toBeInTheDocument();
    unmount();

    vi.mocked(listMyLoans).mockRejectedValueOnce(new ApiError('Private failure', 500));
    render(<LoanList {...props} />);
    expect(await screen.findByText('We could not load your loans.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Private failure')).not.toBeInTheDocument();
  });

  it('renders safe book activity cards with cover, authors, status, due date, copy, and no member data', async () => {
    vi.mocked(listMyLoans).mockResolvedValue(result([loan()]));
    render(<LoanList {...props} />);
    const card = await screen.findByRole('article');
    expect(within(card).getByRole('heading', { name: 'My Book' })).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: 'Cover of My Book' })).toHaveAttribute(
      'src',
      'https://images.test/my-book.jpg',
    );
    expect(within(card).getByText('First Author, Second Author')).toBeInTheDocument();
    expect(within(card).getByText('Active')).toBeInTheDocument();
    expect(within(card).getByText('20 Aug 2026')).toBeInTheDocument();
    expect(within(card).getByText('4 days remaining')).toBeInTheDocument();
    expect(within(card).getByText('COPY-ACTIVE')).toBeInTheDocument();
    expect(within(card).getByText('Renewal available')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Private Member')).not.toBeInTheDocument();
    expect(screen.queryByText('private@test')).not.toBeInTheDocument();
    expect(screen.queryByText('PRIVATE-BARCODE')).not.toBeInTheDocument();
    expect(screen.queryByText(/fine/i)).not.toBeInTheDocument();
  });

  it('renders a clean NAWA placeholder when the cover is absent', async () => {
    const withoutCover = loan();
    withoutCover.bookCopy.book.coverImageUrl = null;
    vi.mocked(listMyLoans).mockResolvedValue(result([withoutCover]));
    render(<LoanList {...props} />);
    expect(
      await screen.findByRole('img', { name: 'No cover available for My Book' }),
    ).toBeInTheDocument();
  });

  it('shows overdue clearly and returned history secondarily without renewal or fake fines', async () => {
    vi.mocked(listMyLoans).mockResolvedValue(result([loan('OVERDUE'), loan('RETURNED')]));
    render(<LoanList {...props} />);
    expect(await screen.findByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Overdue by 6 days')).toBeInTheDocument();
    const returnedCard = screen
      .getByText('The copy was returned to the library')
      .closest('article');
    expect(returnedCard).not.toBeNull();
    expect(within(returnedCard!).getByText('Returned')).toBeInTheDocument();
    expect(screen.getByText('12 Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('The copy was returned to the library')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renew loan' })).not.toBeInTheDocument();
    expect(screen.queryByText(/fine/i)).not.toBeInTheDocument();
  });

  it('uses member-focused server search, real status filters, and pagination', async () => {
    vi.mocked(listMyLoans).mockResolvedValue(result([loan()], 1, 2));
    const user = userEvent.setup();
    render(<LoanList {...props} />);
    await screen.findByText('My Book');
    const search = screen.getByLabelText('Search My Loans');
    expect(search).toHaveAttribute('placeholder', 'Search by title, author, or copy code');
    expect(screen.queryByText(/Member, title|barcode/i)).not.toBeInTheDocument();
    await user.type(search, 'First Author');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(listMyLoans).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'First Author', page: 1 }),
        'member-token',
      ),
    );
    for (const [label, status] of [
      ['Active', 'ACTIVE'],
      ['Overdue', 'OVERDUE'],
      ['Returned', 'RETURNED'],
      ['All', ''],
    ] as const) {
      await user.click(screen.getByRole('button', { name: label }));
      await waitFor(() =>
        expect(listMyLoans).toHaveBeenLastCalledWith(
          expect.objectContaining({ status, page: 1 }),
          'member-token',
        ),
      );
    }
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(listMyLoans).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        'member-token',
      ),
    );
  });

  it('provides sibling My Loans and My Reservations navigation', async () => {
    vi.mocked(listMyLoans).mockResolvedValue(result([loan()]));
    const user = userEvent.setup();
    render(<LoanList {...props} />);
    const navigation = screen.getByRole('navigation', { name: 'Member account navigation' });
    expect(within(navigation).getByRole('button', { name: /My Loans/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(within(navigation).getByRole('button', { name: /My Reservations/ }));
    expect(props.go).toHaveBeenCalledWith('/my-reservations');
  });

  it('confirms renewal, prevents duplicate submission, and uses the authoritative response', async () => {
    const initial = loan();
    const updated = {
      ...initial,
      dueAt: '2026-09-03T00:00:00Z',
      renewedCount: 1,
      renewalEligibility: eligibility(true, null, 1),
    };
    vi.mocked(listMyLoans).mockResolvedValue(result([initial]));
    let resolveRenew!: (value: Loan) => void;
    vi.mocked(renewLoan).mockImplementation(
      () => new Promise((resolve) => (resolveRenew = resolve)),
    );
    const user = userEvent.setup();
    render(<LoanList {...props} />);
    await user.click(await screen.findByRole('button', { name: 'Renew loan' }));
    const dialog = screen.getByRole('dialog', { name: 'Renew this loan?' });
    expect(dialog).toHaveTextContent('My Book');
    expect(renewLoan).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Renew loan' }));
    expect(within(dialog).getByRole('button', { name: 'Renewing…' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Renewing…' }));
    expect(renewLoan).toHaveBeenCalledTimes(1);
    expect(renewLoan).toHaveBeenCalledWith(initial.id, 'member-token');
    resolveRenew(updated);
    expect(
      await screen.findByText('Loan renewed and the return date was updated.'),
    ).toBeInTheDocument();
    expect(screen.getByText('3 Sept 2026')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 renewals used')).toBeInTheDocument();
  });

  it('refetches authoritative loan state after a renewal lifecycle conflict', async () => {
    const initial = loan();
    const current = {
      ...initial,
      renewedCount: 2,
      renewalEligibility: eligibility(false, 'LIMIT_REACHED', 2),
    };
    vi.mocked(listMyLoans).mockResolvedValue(result([initial]));
    vi.mocked(renewLoan).mockRejectedValue(new ApiError('Private conflict', 409));
    vi.mocked(loanDetail).mockResolvedValue(current);
    const user = userEvent.setup();
    render(<LoanList {...props} />);
    await user.click(await screen.findByRole('button', { name: 'Renew loan' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Renew loan' }),
    );
    expect(
      await screen.findByText('The maximum number of renewals has been used.'),
    ).toBeInTheDocument();
    expect(loanDetail).toHaveBeenCalledWith(initial.id, 'member-token');
    expect(screen.getByText('2 / 2 renewals used')).toBeInTheDocument();
  });
});
