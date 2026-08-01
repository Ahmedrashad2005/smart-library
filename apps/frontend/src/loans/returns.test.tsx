import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { listLoans, loanDetail, returnLoan } from './api';
import type { Loan, LoanStatus } from './api';
import { ReturnsPage } from './pages';

vi.mock('./api', () => ({
  listLoans: vi.fn(),
  loanDetail: vi.fn(),
  returnLoan: vi.fn(),
}));

const makeLoan = (status: LoanStatus = 'ACTIVE', copyStatus = 'BORROWED'): Loan => ({
  id: `loan-${status.toLowerCase()}`,
  status,
  borrowedAt: '2026-07-01T00:00:00.000Z',
  dueAt: status === 'OVERDUE' ? '2026-07-10T00:00:00.000Z' : '2026-08-10T00:00:00.000Z',
  returnedAt: status === 'RETURNED' ? '2026-08-01T00:00:00.000Z' : null,
  renewedCount: 0,
  member: { id: 'member-1', fullName: 'Nadia Member', email: 'nadia@test.local' },
  bookCopy: {
    id: 'copy-1',
    copyCode: 'COPY-100',
    barcode: 'BAR-100',
    status: copyStatus,
    condition: 'GOOD',
    book: { id: 'book-1', title: 'Clean Architecture' },
  },
});
const props = {
  token: 'staff-token',
  staff: true,
  path: '/librarian/returns',
  go: vi.fn(),
  notify: vi.fn(),
};
const results = (items: Loan[]) => ({
  items,
  total: items.length,
  page: 1,
  limit: 10,
  totalPages: 1,
});

async function findAndSelect(loan: Loan) {
  vi.mocked(listLoans).mockResolvedValue(results([loan]));
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Find loan to return'), loan.bookCopy.copyCode);
  await user.click(screen.getByRole('button', { name: 'Find loan' }));
  await user.click(await screen.findByRole('button', { name: new RegExp(loan.bookCopy.copyCode) }));
  return user;
}

describe('ReturnsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/librarian/returns');
  });

  it('renders the initial manual lookup with no camera request or submit form', () => {
    render(<ReturnsPage {...props} />);
    expect(screen.getByRole('heading', { name: 'Return a copy' })).toBeInTheDocument();
    expect(screen.getByLabelText('Find loan to return')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm return' })).not.toBeInTheDocument();
    expect(listLoans).not.toHaveBeenCalled();
  });

  it.each(['ACTIVE', 'OVERDUE'] as const)('looks up and renders an %s loan', async (status) => {
    const loan = makeLoan(status);
    render(<ReturnsPage {...props} />);
    await findAndSelect(loan);
    expect(screen.getByText(/Nadia Member; borrowed/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Clean Architecture — COPY-100/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Return condition')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Review return' })).toBeDisabled();
    if (status === 'OVERDUE') expect(screen.getByText(/days overdue/)).toBeInTheDocument();
    expect(listLoans).toHaveBeenCalledWith({ q: 'COPY-100', page: 1, limit: 10 }, 'staff-token');
  });

  it('shows lookup errors and keeps an already-returned detail unavailable', async () => {
    vi.mocked(listLoans).mockRejectedValueOnce(new ApiError('Unknown copy code', 404));
    const user = userEvent.setup();
    render(<ReturnsPage {...props} />);
    await user.type(screen.getByLabelText('Find loan to return'), 'UNKNOWN');
    await user.click(screen.getByRole('button', { name: 'Find loan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown copy code');

    window.history.replaceState({}, '', '/librarian/returns?loan=returned-id');
    vi.mocked(loanDetail).mockResolvedValueOnce(makeLoan('RETURNED', 'AVAILABLE'));
    render(<ReturnsPage {...props} />);
    expect(await screen.findByRole('button', { name: 'Review return' })).toBeDisabled();
  });

  it('opens an accessible confirmation and keyboard cancel does not submit', async () => {
    const active = makeLoan();
    render(<ReturnsPage {...props} />);
    const user = await findAndSelect(active);
    await user.selectOptions(screen.getByLabelText('Return condition'), 'DAMAGED');
    await user.type(screen.getByLabelText('Return notes'), 'Check binding');
    await user.click(screen.getByRole('button', { name: 'Review return' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm book return' });
    expect(dialog).toHaveTextContent('Nadia Member');
    expect(dialog).toHaveTextContent('Clean Architecture');
    expect(dialog).toHaveTextContent('COPY-100');
    expect(dialog).toHaveTextContent('DAMAGED');
    expect(dialog).toHaveTextContent('Check binding');
    expect(dialog).toHaveTextContent('will not become available');
    expect(returnLoan).not.toHaveBeenCalled();
    const cancel = screen.getByRole('button', { name: 'Cancel return' });
    cancel.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(returnLoan).not.toHaveBeenCalled();
  });

  it('submits condition and optional notes once, then reports the API copy status', async () => {
    const active = makeLoan();
    let resolveReturn: (loan: Loan) => void = () => undefined;
    vi.mocked(returnLoan).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReturn = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<ReturnsPage {...props} />);
    await findAndSelect(active);
    await user.selectOptions(screen.getByLabelText('Return condition'), 'GOOD');
    await user.type(screen.getByLabelText('Return notes'), 'Returned at desk');
    await user.click(screen.getByRole('button', { name: 'Review return' }));
    expect(returnLoan).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Confirm book return' })).toHaveTextContent('GOOD');
    const submit = screen.getByRole('button', { name: 'Confirm return' });
    await user.click(submit);
    expect(screen.getByRole('button', { name: 'Returning…' })).toBeDisabled();
    await user.click(submit);
    expect(returnLoan).toHaveBeenCalledTimes(1);
    expect(returnLoan).toHaveBeenCalledWith(
      active.id,
      { returnCondition: 'GOOD', returnNotes: 'Returned at desk' },
      'staff-token',
    );
    resolveReturn({
      ...active,
      status: 'RETURNED',
      returnedAt: '2026-08-01T00:00:00.000Z',
      returnCondition: 'GOOD',
      returnNotes: 'Returned at desk',
      bookCopy: { ...active.bookCopy, status: 'AVAILABLE' },
    });
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith('Returned. Copy is AVAILABLE.'));
    const result = screen.getByRole('status', { name: 'Return result' });
    expect(result).toHaveTextContent('Loan returned successfully');
    expect(result).toHaveTextContent('AVAILABLE');
    expect(result).toHaveTextContent('Available for circulation');
    expect(result).toHaveTextContent('Aug 1, 2026');
  });

  it.each(['DAMAGED', 'MAINTENANCE'])(
    'uses the backend %s copy status as final truth',
    async (copyStatus) => {
      const active = makeLoan();
      vi.mocked(returnLoan).mockResolvedValue({
        ...active,
        status: 'RETURNED',
        bookCopy: { ...active.bookCopy, status: copyStatus },
        returnCondition: 'DAMAGED',
      });
      render(<ReturnsPage {...props} />);
      const user = await findAndSelect(active);
      await user.selectOptions(screen.getByLabelText('Return condition'), 'DAMAGED');
      await user.click(screen.getByRole('button', { name: 'Review return' }));
      await user.click(screen.getByRole('button', { name: 'Confirm return' }));
      await waitFor(() =>
        expect(props.notify).toHaveBeenCalledWith(`Returned. Copy is ${copyStatus}.`),
      );
      const result = screen.getByRole('status', { name: 'Return result' });
      expect(result).toHaveTextContent(copyStatus);
      expect(result).toHaveTextContent('Unavailable for circulation');
    },
  );

  it.each([
    [409, 'Loan was already returned'],
    [500, 'Return service unavailable'],
  ] as const)('shows backend %s errors while preserving form values', async (code, message) => {
    const active = makeLoan();
    vi.mocked(returnLoan).mockRejectedValue(new ApiError(message, code));
    render(<ReturnsPage {...props} />);
    const user = await findAndSelect(active);
    await user.selectOptions(screen.getByLabelText('Return condition'), 'FAIR');
    await user.type(screen.getByLabelText('Return notes'), 'Keep this note');
    await user.click(screen.getByRole('button', { name: 'Review return' }));
    await user.click(screen.getByRole('button', { name: 'Confirm return' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('Return condition')).toHaveValue('FAIR');
    expect(screen.getByLabelText('Return notes')).toHaveValue('Keep this note');
  });
});
