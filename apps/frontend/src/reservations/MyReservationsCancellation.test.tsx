import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { cancelReservation, listMyReservations, reservationDetail } from './api';
import type { ReservationPage, ReservationResult } from './api';
import { MyReservationDetails, MyReservationsPage } from './MyReservationsPage';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    cancelReservation: vi.fn(),
    listMyReservations: vi.fn(),
    reservationDetail: vi.fn(),
  };
});

const activeReservation: ReservationResult = {
  id: 'reservation-cancel-id',
  memberId: 'member-private-id',
  bookId: 'book-private-id',
  bookCopyId: 'copy-private-id',
  status: 'ACTIVE',
  reservedAt: '2099-08-13T09:00:00.000Z',
  expiresAt: '2099-08-14T09:00:00.000Z',
  cancelledAt: null,
  collectedAt: null,
  canCancel: true,
  book: {
    id: 'book-private-id',
    slug: 'clean-code',
    title: 'Clean Code',
    titleAr: 'الشيفرة النظيفة',
    coverImageUrl: null,
    authors: [{ author: { id: 'author-1', name: 'Robert Martin', nameAr: 'روبرت مارتن' } }],
  },
  bookCopy: {
    id: 'copy-private-id',
    copyCode: 'NAWA-CAMPUS-021',
    status: 'RESERVED',
    condition: 'GOOD',
  },
  pickupLocation: {
    library: { id: 'library-private-id', nameEn: 'College Library', nameAr: 'مكتبة الكلية' },
    floor: {
      id: 'floor-private-id',
      floorNumber: 3,
      nameEn: 'Third Floor',
      nameAr: 'الدور الثالث',
    },
    room: { id: 'room-private-id', roomNumber: '315', nameEn: 'Room 315', nameAr: 'غرفة 315' },
    shelfLocationCode: '1/1',
  },
  availability: { totalCopies: 1, availableCopies: 0 },
};

const cancelledReservation: ReservationResult = {
  ...activeReservation,
  status: 'CANCELLED',
  cancelledAt: '2099-08-13T10:00:00.000Z',
  canCancel: false,
  bookCopy: { ...activeReservation.bookCopy, status: 'AVAILABLE' },
  availability: { totalCopies: 1, availableCopies: 1 },
};

const result = (items: ReservationResult[]): ReservationPage => ({
  items,
  total: items.length,
  page: 1,
  limit: 12,
  totalPages: items.length ? 1 : 0,
});

const props = {
  token: 'member-token',
  locale: 'en' as const,
  go: vi.fn(),
  onAuthRequired: vi.fn(),
};

async function openConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Cancel reservation' }));
  return screen.getByRole('dialog', { name: 'Cancel reservation?' });
}

describe('My Reservations cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/my-reservations');
    vi.mocked(listMyReservations).mockResolvedValue(result([activeReservation]));
  });

  it('shows cancellation only when the authoritative canCancel flag is true', async () => {
    vi.mocked(listMyReservations).mockResolvedValue(
      result([{ ...activeReservation, canCancel: false }]),
    );
    render(<MyReservationsPage {...props} />);
    await screen.findByRole('heading', { name: 'Clean Code' });
    expect(screen.queryByRole('button', { name: 'Cancel reservation' })).not.toBeInTheDocument();
  });

  it('opens a named confirmation, supports Escape, and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    const trigger = await screen.findByRole('button', { name: 'Cancel reservation' });
    const dialog = await openConfirmation(user);
    expect(dialog).toHaveTextContent('The copy will become available to another student');
    expect(dialog).toHaveTextContent('Clean Code');
    expect(within(dialog).getByRole('button', { name: 'Go back' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(cancelReservation).not.toHaveBeenCalled();
  });

  it('traps keyboard focus and going back never submits', async () => {
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    const dialog = await openConfirmation(user);
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Cancel reservation' })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Go back' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Go back' }));
    expect(cancelReservation).not.toHaveBeenCalled();
  });

  it('disables confirmation while pending and prevents repeated cancellation requests', async () => {
    let resolveCancellation: ((value: ReservationResult) => void) | undefined;
    vi.mocked(cancelReservation).mockReturnValue(
      new Promise((resolve) => {
        resolveCancellation = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    const dialog = await openConfirmation(user);
    const confirm = within(dialog).getByRole('button', { name: 'Cancel reservation' });
    await user.click(confirm);
    expect(within(dialog).getByRole('button', { name: 'Cancelling reservation…' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Go back' })).toBeDisabled();
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    confirm.click();
    expect(cancelReservation).toHaveBeenCalledTimes(1);
    expect(cancelReservation).toHaveBeenCalledWith('reservation-cancel-id', 'member-token');
    resolveCancellation?.(cancelledReservation);
    expect(
      await screen.findByText(/Reservation cancelled and the copy is available/),
    ).toBeVisible();
  });

  it('uses the server response, removes the Active item, and refetches without a reload', async () => {
    let cancelled = false;
    vi.mocked(cancelReservation).mockImplementation(async () => {
      cancelled = true;
      return cancelledReservation;
    });
    vi.mocked(listMyReservations).mockImplementation(async ({ status }) =>
      result(status === 'active' && !cancelled ? [activeReservation] : []),
    );
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    const dialog = await openConfirmation(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel reservation' }));
    expect(await screen.findByText('No active reservations')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel reservation' })).not.toBeInTheDocument();
    expect(listMyReservations).toHaveBeenCalledTimes(2);
  });

  it('loads the committed cancellation through the real Cancelled filter', async () => {
    let cancelled = false;
    vi.mocked(cancelReservation).mockImplementation(async () => {
      cancelled = true;
      return cancelledReservation;
    });
    vi.mocked(listMyReservations).mockImplementation(async ({ status }) =>
      result(
        status === 'active' && !cancelled
          ? [activeReservation]
          : status === 'cancelled' && cancelled
            ? [cancelledReservation]
            : [],
      ),
    );
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    const dialog = await openConfirmation(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel reservation' }));
    await screen.findByText('No active reservations');
    await user.click(screen.getByRole('button', { name: 'Cancelled' }));
    expect(await screen.findByText('Cancelled on')).toBeInTheDocument();
    expect(within(screen.getByRole('article')).getByText('Cancelled')).toBeInTheDocument();
    expect(listMyReservations).toHaveBeenLastCalledWith(
      { status: 'cancelled', page: 1, limit: 12 },
      'member-token',
    );
  });

  it('updates detail from the authoritative cancellation response and removes its action', async () => {
    vi.mocked(reservationDetail).mockResolvedValue(activeReservation);
    vi.mocked(cancelReservation).mockResolvedValue(cancelledReservation);
    const user = userEvent.setup();
    render(<MyReservationDetails {...props} id="reservation-cancel-id" />);
    const dialog = await openConfirmation(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel reservation' }));
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Cancelled on')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel reservation' })).not.toBeInTheDocument();
    expect(reservationDetail).toHaveBeenCalledTimes(1);
  });

  it.each([
    [403, 'You cannot cancel this reservation.'],
    [404, 'This reservation is no longer available.'],
  ])('shows safe cancellation feedback for backend %s', async (status, message) => {
    vi.mocked(cancelReservation).mockRejectedValue(new ApiError('Private backend text', status));
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    const dialog = await openConfirmation(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel reservation' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(dialog).not.toHaveTextContent('Private backend text');
  });

  it.each([
    ['EXPIRED', 'This reservation has expired and cannot be cancelled.'],
    ['CANCELLED', 'This reservation has already been cancelled.'],
  ] as const)(
    'refreshes a 409 race and displays the authoritative %s status',
    async (status, message) => {
      const latest: ReservationResult = {
        ...activeReservation,
        status,
        canCancel: false,
        cancelledAt: status === 'CANCELLED' ? '2099-08-13T10:00:00.000Z' : null,
      };
      vi.mocked(cancelReservation).mockRejectedValue(new ApiError('Conflict', 409));
      vi.mocked(reservationDetail).mockResolvedValue(latest);
      vi.mocked(listMyReservations)
        .mockResolvedValueOnce(result([activeReservation]))
        .mockResolvedValueOnce(result([]));
      const user = userEvent.setup();
      render(<MyReservationsPage {...props} />);
      const dialog = await openConfirmation(user);
      await user.click(within(dialog).getByRole('button', { name: 'Cancel reservation' }));
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(reservationDetail).toHaveBeenCalledWith('reservation-cancel-id', 'member-token');
      expect(await screen.findByText('No active reservations')).toBeInTheDocument();
    },
  );

  it('keeps the confirmation available after an unexpected network failure', async () => {
    vi.mocked(cancelReservation).mockRejectedValue(new TypeError('network down'));
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    const dialog = await openConfirmation(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel reservation' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'We could not cancel the reservation now. Please try again.',
    );
    expect(within(dialog).getByRole('button', { name: 'Cancel reservation' })).toBeEnabled();
  });

  it('renders the Arabic RTL confirmation with safe action order and wording', async () => {
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} locale="ar" />);
    await user.click(await screen.findByRole('button', { name: 'إلغاء الحجز' }));
    const dialog = screen.getByRole('dialog', { name: 'إلغاء الحجز؟' });
    const actions = within(dialog).getAllByRole('button');
    expect(actions.map((button) => button.textContent)).toEqual(['العودة', 'إلغاء الحجز']);
    expect(dialog).toHaveTextContent('سيتم إتاحة النسخة لطالب آخر');
  });
});
