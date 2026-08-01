import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { listMyLoans } from './api';
import type { Loan } from './api';
import { LoanList } from './pages';

vi.mock('./api', () => ({ listMyLoans: vi.fn(), listLoans: vi.fn(), renewLoan: vi.fn() }));
const memberLoan: Loan = {
  id: 'mine-1',
  status: 'OVERDUE',
  borrowedAt: '2026-07-01T00:00:00Z',
  dueAt: '2026-07-10T00:00:00Z',
  returnedAt: null,
  renewedCount: 1,
  member: { id: 'me', fullName: 'Private Member', email: 'private@test' },
  bookCopy: {
    id: 'copy',
    copyCode: 'COPY-ME',
    status: 'BORROWED',
    condition: 'GOOD',
    book: {
      id: 'book',
      title: 'My Book',
      coverImageUrl: 'https://images.test/my-book.jpg',
      authors: [
        { id: 'author-1', name: 'First Author', arabicName: 'المؤلف الأول' },
        { id: 'author-2', name: 'Second Author', arabicName: 'المؤلف الثاني' },
      ],
    },
  },
};
const props = {
  token: 'member-token',
  staff: false,
  mine: true,
  path: '/my-loans',
  go: vi.fn(),
  notify: vi.fn(),
};
const result = (items: Loan[], page = 1) => ({ items, total: 2, page, limit: 10, totalPages: 2 });

describe('member loan list', () => {
  beforeEach(() => vi.clearAllMocks());
  it('shows loading, empty, and backend error states', async () => {
    vi.mocked(listMyLoans).mockResolvedValueOnce(result([]));
    const { unmount } = render(<LoanList {...props} />);
    expect(screen.getByText('Loading loans…')).toBeInTheDocument();
    expect(await screen.findByText('No loans match these filters.')).toBeInTheDocument();
    unmount();
    vi.mocked(listMyLoans).mockRejectedValueOnce(new ApiError('Unable to load my loans', 500));
    render(<LoanList {...props} />);
    expect(await screen.findByText('Unable to load my loans')).toBeInTheDocument();
  });
  it('renders only member-safe loan data and backend overdue status', async () => {
    vi.mocked(listMyLoans).mockResolvedValue(result([memberLoan]));
    render(<LoanList {...props} />);
    expect(await screen.findByText('My Book')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cover of My Book' })).toHaveAttribute(
      'src',
      'https://images.test/my-book.jpg',
    );
    expect(screen.getByText('First Author, Second Author')).toBeInTheDocument();
    expect(screen.getByText('COPY-ME')).toBeInTheDocument();
    expect(screen.getByText('OVERDUE')).toBeInTheDocument();
    expect(screen.getByText(/Borrowed Jul 1, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Due Jul 10, 2026/)).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search loans')).toBeInTheDocument();
    expect(screen.queryByText('private@test')).not.toBeInTheDocument();
  });
  it('renders a clean placeholder when the cover is null', async () => {
    const withoutCover: Loan = {
      ...memberLoan,
      id: 'mine-no-cover',
      bookCopy: {
        ...memberLoan.bookCopy,
        book: { ...memberLoan.bookCopy.book, coverImageUrl: null },
      },
    };
    vi.mocked(listMyLoans).mockResolvedValue(result([withoutCover]));
    render(<LoanList {...props} />);
    expect(
      await screen.findByRole('img', { name: 'No cover available for My Book' }),
    ).toBeInTheDocument();
  });
  it('sends all status filters and pagination to the member endpoint', async () => {
    vi.mocked(listMyLoans).mockResolvedValue(result([memberLoan]));
    const user = userEvent.setup();
    render(<LoanList {...props} />);
    await screen.findByText('My Book');
    for (const status of ['ACTIVE', 'OVERDUE', 'RETURNED', '']) {
      await user.selectOptions(screen.getByLabelText('Loan status'), status);
      await waitFor(() =>
        expect(listMyLoans).toHaveBeenLastCalledWith(
          expect.objectContaining({ status }),
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
});
