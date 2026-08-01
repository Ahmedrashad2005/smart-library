import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BorrowPage, LoanList } from './pages';
import { borrowCopy, listLoans, lookupCopies, lookupMembers } from './api';
import type { Loan } from './api';

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
const loan: Loan = {
  id: 'loan-1',
  status: 'OVERDUE',
  borrowedAt: '2026-07-01T00:00:00Z',
  dueAt: '2026-07-10T00:00:00Z',
  renewedCount: 0,
  member: { id: 'm', fullName: 'Member', email: 'member@test' },
  bookCopy: {
    id: 'c',
    copyCode: 'COPY-1',
    status: 'BORROWED',
    condition: 'GOOD',
    book: { id: 'b', title: 'Book', authors: [] },
  },
};
const props = {
  token: 'token',
  staff: true,
  go: vi.fn(),
  notify: vi.fn(),
  path: '/librarian/loans',
};

describe('rendered loan pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('shows loading, data including backend overdue status, filter, and pagination', async () => {
    vi.mocked(listLoans).mockResolvedValue({
      items: [loan],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 2,
    });
    const user = userEvent.setup();
    render(<LoanList {...props} mine={false} />);
    expect(screen.getByText('Loading loans…')).toBeInTheDocument();
    expect(await screen.findByText('OVERDUE')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Loan status'), 'ACTIVE');
    await waitFor(() =>
      expect(listLoans).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'ACTIVE' }),
        'token',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(listLoans).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), 'token'),
    );
  });
  it('shows empty and backend error states', async () => {
    vi.mocked(listLoans).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    const { rerender } = render(<LoanList {...props} mine={false} />);
    expect(await screen.findByText('No loans match these filters.')).toBeInTheDocument();
    vi.mocked(listLoans).mockRejectedValueOnce(new Error('Network down'));
    rerender(<LoanList {...props} mine={false} />);
  });
  it('searches members and copies, blocks ineligible selection, and submits once when eligible', async () => {
    vi.mocked(lookupMembers).mockResolvedValue([
      {
        id: 'm',
        fullName: 'Eligible',
        email: 'e@test',
        membershipNumber: 'x',
        status: 'ACTIVE',
        activeLoanCount: 0,
        overdueLoanCount: 0,
        remainingLoanCapacity: 5,
        eligible: true,
      },
    ]);
    vi.mocked(lookupCopies).mockResolvedValue({
      items: [
        {
          id: 'c',
          copyCode: 'COPY-1',
          status: 'AVAILABLE',
          condition: 'GOOD',
          isArchived: false,
          book: { id: 'b', title: 'Book', isArchived: false },
        },
      ],
    });
    let resolveBorrow: (value: Loan) => void = () => undefined;
    vi.mocked(borrowCopy).mockImplementation(
      () =>
        new Promise<Loan>((resolve) => {
          resolveBorrow = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<BorrowPage {...props} />);
    await user.type(screen.getByLabelText('Find member'), 'Eligible');
    await user.click(screen.getAllByRole('button', { name: 'Search' })[0]!);
    await user.click((await screen.findAllByText('Eligible'))[0]!.closest('button')!);
    await user.type(screen.getByLabelText('Copy code, barcode, or QR value'), 'COPY-1');
    await user.click(screen.getByRole('button', { name: 'Find copy' }));
    await user.click(await screen.findByText('Book'));
    const submit = screen.getByRole('button', { name: 'Confirm borrow' });
    await user.click(submit);
    expect(screen.getByRole('button', { name: 'Borrowing…' })).toBeDisabled();
    await user.click(submit);
    expect(borrowCopy).toHaveBeenCalledTimes(1);
    resolveBorrow({ ...loan, status: 'ACTIVE' });
    expect(await screen.findByText(/Created loan due/)).toBeInTheDocument();
  });
});
