import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { apiRequest } from '../lib/api';
import {
  borrowCopy,
  listLoans,
  listMyLoans,
  loanDetail,
  lookupCopies,
  lookupMembers,
  returnLoan,
} from './api';
import type { Loan } from './api';
import { BorrowPage, LoanDetails, LoanList, ReturnsPage } from './pages';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  requestMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));
vi.mock('./api', () => ({
  listLoans: vi.fn(),
  listMyLoans: vi.fn(),
  loanDetail: vi.fn(),
  lookupMembers: vi.fn(),
  lookupCopies: vi.fn(),
  borrowCopy: vi.fn(),
  returnLoan: vi.fn(),
  renewLoan: vi.fn(),
}));

const loan = (status: Loan['status'] = 'ACTIVE'): Loan => ({
  id: 'loan-rtl',
  status,
  borrowedAt: '2026-07-01T00:00:00Z',
  dueAt: '2026-08-10T00:00:00Z',
  renewedCount: status === 'ACTIVE' ? 0 : 2,
  member: { id: 'member-rtl', fullName: 'قارئ المكتبة', email: 'reader@test.local' },
  bookCopy: {
    id: 'copy-rtl',
    copyCode: 'COPY-RTL',
    status: status === 'RETURNED' ? 'AVAILABLE' : 'BORROWED',
    condition: 'GOOD',
    book: {
      id: 'book-rtl',
      title: 'English Book',
      titleAr: 'الكتاب العربي',
      authors: [
        { id: 'author-1', name: 'English Author', arabicName: 'المؤلف العربي' },
        { id: 'author-2', name: 'Second Author', arabicName: 'المؤلف الثاني' },
      ],
    },
  },
});
const pageProps = {
  token: 'token',
  staff: true,
  path: '/librarian/loans',
  go: vi.fn(),
  notify: vi.fn(),
};
const result = (items: Loan[]) => ({
  items,
  total: 20,
  page: 1,
  limit: 10,
  totalPages: 2,
});

describe('loan RTL and accessibility behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
    window.history.replaceState({}, '', '/books');
    vi.mocked(apiRequest).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 12,
      totalPages: 0,
    });
  });

  it('switches the real application between English LTR and Arabic RTL', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    await user.click(screen.getByRole('button', { name: 'العربية' }));
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.documentElement).toHaveAttribute('lang', 'en');
  });

  it('renders the staff loan table in RTL with textual status and named controls', async () => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
    vi.mocked(listLoans).mockResolvedValue(result([loan()]));
    render(<LoanList {...pageProps} mine={false} />);

    expect(await screen.findByText('الكتاب العربي')).toBeInTheDocument();
    expect(screen.getByText('المؤلف العربي, المؤلف الثاني')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByLabelText('Search loans')).toBeInTheDocument();
    expect(screen.getByLabelText('Loan status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Renew' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('exposes labelled RTL borrow fields and a keyboard-operable confirmation dialog', async () => {
    document.documentElement.dir = 'rtl';
    vi.mocked(lookupMembers).mockResolvedValue([
      {
        id: 'member-rtl',
        fullName: 'قارئ المكتبة',
        email: 'reader@test.local',
        membershipNumber: 'MEM-1',
        status: 'ACTIVE',
        emailVerifiedAt: '2026-01-01T00:00:00Z',
        activeLoanCount: 0,
        overdueLoanCount: 0,
        remainingLoanCapacity: 5,
        eligible: true,
      },
    ]);
    vi.mocked(lookupCopies).mockResolvedValue({
      items: [
        {
          id: 'copy-rtl',
          copyCode: 'COPY-RTL',
          status: 'AVAILABLE',
          condition: 'GOOD',
          isArchived: false,
          book: { id: 'book-rtl', title: 'English Book', titleAr: 'الكتاب العربي' },
        },
      ],
    });
    let resolveBorrow!: (value: Loan) => void;
    vi.mocked(borrowCopy).mockImplementation(
      () => new Promise((resolve) => (resolveBorrow = resolve)),
    );
    const user = userEvent.setup();
    render(<BorrowPage {...pageProps} path="/librarian/loans/borrow" />);

    expect(screen.getByLabelText('Find member')).toBeInTheDocument();
    expect(screen.getByLabelText('Copy code, barcode, or QR value')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review borrow' })).toBeDisabled();
    await user.type(screen.getByLabelText('Find member'), 'قارئ');
    await user.click(screen.getAllByRole('button', { name: 'Search' })[0]!);
    await user.click((await screen.findAllByText('قارئ المكتبة'))[0]!.closest('button')!);
    await user.type(screen.getByLabelText('Copy code, barcode, or QR value'), 'COPY-RTL');
    await user.click(screen.getByRole('button', { name: 'Find copy' }));
    await user.click((await screen.findAllByText('English Book'))[0]!.closest('button')!);
    await user.click(screen.getByRole('button', { name: 'Review borrow' }));

    const dialog = screen.getByRole('dialog', { name: 'Confirm book borrowing' });
    expect(dialog).toHaveTextContent('قارئ المكتبة');
    expect(dialog).toHaveTextContent('COPY-RTL');
    const cancel = screen.getByRole('button', { name: 'Cancel borrow' });
    cancel.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(borrowCopy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Review borrow' }));
    const confirm = screen.getByRole('button', { name: 'Confirm borrow' });
    confirm.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Borrowing…' })).toBeDisabled();
    expect(borrowCopy).toHaveBeenCalledOnce();
    resolveBorrow(loan());
    await waitFor(() => expect(pageProps.notify).toHaveBeenCalled());
  });

  it('renders the RTL return form and accessible confirmation and result semantics', async () => {
    document.documentElement.dir = 'rtl';
    const active = loan();
    vi.mocked(listLoans).mockResolvedValue(result([active]));
    vi.mocked(returnLoan).mockResolvedValue({
      ...active,
      status: 'RETURNED',
      returnedAt: '2026-08-01T00:00:00Z',
      returnCondition: 'GOOD',
      bookCopy: { ...active.bookCopy, status: 'AVAILABLE' },
    });
    const user = userEvent.setup();
    render(<ReturnsPage {...pageProps} path="/librarian/returns" />);

    expect(screen.getByLabelText('Find loan to return')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Find loan to return'), 'COPY-RTL');
    await user.click(screen.getByRole('button', { name: 'Find loan' }));
    await user.click(await screen.findByRole('button', { name: /COPY-RTL/ }));
    expect(screen.getByLabelText('Return condition')).toBeInTheDocument();
    expect(screen.getByLabelText('Return notes')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Return condition'), 'GOOD');
    await user.click(screen.getByRole('button', { name: 'Review return' }));
    expect(screen.getByRole('dialog', { name: 'Confirm book return' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm return' }));
    expect(await screen.findByRole('status', { name: 'Return result' })).toHaveTextContent(
      'AVAILABLE',
    );
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('prefers Arabic authors in the RTL member list with accessible filters and paging', async () => {
    document.documentElement.dir = 'rtl';
    vi.mocked(listMyLoans).mockResolvedValue(result([loan()]));
    render(<LoanList {...pageProps} staff={false} mine path="/my-loans" token="member-token" />);

    expect(await screen.findByText('المؤلف العربي, المؤلف الثاني')).toBeInTheDocument();
    expect(screen.getByText('الكتاب العربي')).toBeInTheDocument();
    expect(screen.getByLabelText('Loan status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('renders RTL member details and exposes the renewal denial as status text', async () => {
    document.documentElement.dir = 'rtl';
    vi.mocked(loanDetail).mockResolvedValue(loan('OVERDUE'));
    render(
      <LoanDetails
        {...pageProps}
        id="loan-rtl"
        staff={false}
        path="/my-loans/loan-rtl"
        token="member-token"
      />,
    );

    expect(await screen.findByRole('heading', { name: 'الكتاب العربي' })).toBeInTheDocument();
    expect(screen.getByText('المؤلف العربي, المؤلف الثاني')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Renewal unavailable: loan is overdue');
    expect(screen.queryByRole('button', { name: 'Renew loan' })).not.toBeInTheDocument();
  });
});
