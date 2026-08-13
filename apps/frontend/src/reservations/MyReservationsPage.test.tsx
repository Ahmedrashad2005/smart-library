import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { listMyReservations, reservationDetail } from './api';
import type { ReservationPage, ReservationResult, ReservationStatus } from './api';
import { MyReservationDetails, MyReservationsPage } from './MyReservationsPage';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, listMyReservations: vi.fn(), reservationDetail: vi.fn() };
});

const reservation: ReservationResult = {
  id: 'reservation-private-id',
  memberId: 'member-private-id',
  bookId: 'book-private-id',
  bookCopyId: 'copy-private-id',
  status: 'ACTIVE',
  reservedAt: '2026-08-13T09:00:00.000Z',
  expiresAt: '2026-08-14T09:00:00.000Z',
  cancelledAt: null,
  collectedAt: null,
  canCancel: true,
  book: {
    id: 'book-private-id',
    slug: 'operating-systems',
    title: 'Operating Systems',
    titleAr: 'نظم التشغيل',
    coverImageUrl: 'https://covers.test/operating-systems.jpg',
    authors: [
      { author: { id: 'author-1', name: 'Abraham Silberschatz', nameAr: 'أبراهام سيلبرشاتز' } },
      { author: { id: 'author-2', name: 'Peter Galvin', nameAr: 'بيتر جالفين' } },
    ],
  },
  bookCopy: {
    id: 'copy-private-id',
    copyCode: 'NAWA-CAMPUS-023',
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

const page = (items: ReservationResult[], current = 1, totalPages = 1): ReservationPage => ({
  items,
  total: items.length || 0,
  page: current,
  limit: 12,
  totalPages,
});

const props = {
  token: 'member-token',
  locale: 'en' as const,
  go: vi.fn(),
  onAuthRequired: vi.fn(),
};

describe('My Reservations list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/my-reservations');
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('renders loading then a safe book-focused ACTIVE reservation card', async () => {
    let resolveRequest: ((value: ReservationPage) => void) | undefined;
    vi.mocked(listMyReservations).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<MyReservationsPage {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your reservations…');
    resolveRequest?.(page([reservation]));

    expect(await screen.findByRole('heading', { name: 'Operating Systems' })).toBeInTheDocument();
    expect(screen.getByText('Abraham Silberschatz, Peter Galvin')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cover of Operating Systems' })).toHaveAttribute(
      'src',
      reservation.book.coverImageUrl,
    );
    expect(within(screen.getByRole('article')).getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Third Floor · Room 315')).toBeInTheDocument();
    expect(screen.getByText('NAWA-CAMPUS-023')).toBeInTheDocument();
    expect(screen.getByText('Available for pickup until').nextSibling).not.toBeNull();
    expect(screen.queryByText('reservation-private-id')).not.toBeInTheDocument();
    expect(screen.queryByText('member-private-id')).not.toBeInTheDocument();
    expect(screen.queryByText('copy-private-id')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancel reservation$/i })).not.toBeInTheDocument();
  });

  it('uses active as the default backend filter with page one and limit 12', async () => {
    vi.mocked(listMyReservations).mockResolvedValue(page([]));
    render(<MyReservationsPage {...props} />);
    await screen.findByText('No active reservations');
    expect(listMyReservations).toHaveBeenCalledWith(
      { status: 'active', page: 1, limit: 12 },
      'member-token',
    );
    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['Cancelled', 'cancelled'],
    ['Expired', 'expired'],
    ['Collected', 'collected'],
    ['All', 'all'],
  ] as const)('requests the real %s filter and resets pagination', async (label, status) => {
    window.history.replaceState({}, '', '/my-reservations?status=active&page=3');
    vi.mocked(listMyReservations).mockResolvedValue(page([], 1));
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    await user.click(screen.getByRole('button', { name: label }));
    await waitFor(() =>
      expect(listMyReservations).toHaveBeenLastCalledWith(
        { status, page: 1, limit: 12 },
        'member-token',
      ),
    );
    expect(window.location.search).toBe(`?status=${status}&page=1`);
  });

  it('uses backend pagination with accessible disabled states and URL state', async () => {
    vi.mocked(listMyReservations).mockImplementation(async ({ page: requestedPage }) =>
      page([reservation], requestedPage ?? 1, 2),
    );
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    await screen.findByText('Page 1 of 2');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(listMyReservations).toHaveBeenLastCalledWith(
        { status: 'active', page: 2, limit: 12 },
        'member-token',
      ),
    );
    expect(window.location.search).toBe('?status=active&page=2');
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('corrects an out-of-range URL page using the backend total', async () => {
    window.history.replaceState({}, '', '/my-reservations?status=all&page=9');
    vi.mocked(listMyReservations).mockResolvedValue(page([reservation], 9, 2));
    render(<MyReservationsPage {...props} />);
    await waitFor(() =>
      expect(listMyReservations).toHaveBeenLastCalledWith(
        { status: 'all', page: 2, limit: 12 },
        'member-token',
      ),
    );
    expect(window.location.search).toBe('?status=all&page=2');
  });

  it('renders a retryable localized list error without treating it as login failure', async () => {
    vi.mocked(listMyReservations)
      .mockRejectedValueOnce(new ApiError('Server detail', 500))
      .mockResolvedValueOnce(page([]));
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    expect(await screen.findByText('We could not load your reservations.')).toBeInTheDocument();
    expect(props.onAuthRequired).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No active reservations')).toBeInTheDocument();
  });

  it('recovers authentication only for a 401 list response', async () => {
    vi.mocked(listMyReservations).mockRejectedValue(new ApiError('Unauthorized', 401));
    render(<MyReservationsPage {...props} />);
    await waitFor(() => expect(props.onAuthRequired).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('We could not load your reservations.')).not.toBeInTheDocument();
  });

  it('renders an active empty state with a real Campus browse action', async () => {
    vi.mocked(listMyReservations).mockResolvedValue(page([]));
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    expect(await screen.findByText('No active reservations')).toBeInTheDocument();
    expect(
      screen.getByText('You can reserve available books from the College Library.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Browse the Campus Library' }));
    expect(props.go).toHaveBeenCalledWith('/campus');
  });

  it('renders the distinct all-history empty state', async () => {
    window.history.replaceState({}, '', '/my-reservations?status=all&page=1');
    vi.mocked(listMyReservations).mockResolvedValue(page([]));
    render(<MyReservationsPage {...props} />);
    expect(await screen.findByText('You have not made any reservations yet.')).toBeInTheDocument();
  });

  it('navigates through real book slug and owned reservation detail actions', async () => {
    vi.mocked(listMyReservations).mockResolvedValue(page([reservation]));
    const user = userEvent.setup();
    render(<MyReservationsPage {...props} />);
    const card = await screen.findByRole('article');
    await user.click(within(card).getByRole('button', { name: 'View book' }));
    expect(props.go).toHaveBeenCalledWith('/books/operating-systems');
    await user.click(within(card).getByRole('button', { name: 'View details' }));
    expect(props.go).toHaveBeenCalledWith('/my-reservations/reservation-private-id');
  });

  it.each([
    ['CANCELLED', 'Cancelled'],
    ['EXPIRED', 'Expired'],
    ['COLLECTED', 'Collected'],
  ] as const)('renders a semantic %s history status', async (status, label) => {
    vi.mocked(listMyReservations).mockResolvedValue(
      page([{ ...reservation, id: status, status: status as ReservationStatus }]),
    );
    render(<MyReservationsPage {...props} />);
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it('renders polished Arabic RTL content and localized author, dates, status, and location', async () => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    vi.mocked(listMyReservations).mockResolvedValue(page([reservation]));
    render(<MyReservationsPage {...props} locale="ar" />);
    expect(await screen.findByRole('heading', { name: 'حجوزاتي' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'نظم التشغيل' })).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('أبراهام سيلبرشاتز، بيتر جالفين')).toBeInTheDocument();
    expect(screen.getByText('حجز نشط')).toBeInTheDocument();
    expect(screen.getByText('الدور الثالث · غرفة 315')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});

describe('My Reservation details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('loads the owned detail and renders only safe book, status, deadline, copy, and pickup fields', async () => {
    vi.mocked(reservationDetail).mockResolvedValue(reservation);
    render(<MyReservationDetails {...props} id="reservation-private-id" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading reservation details…');
    expect(await screen.findByRole('heading', { name: 'Operating Systems' })).toBeInTheDocument();
    expect(reservationDetail).toHaveBeenCalledWith('reservation-private-id', 'member-token');
    expect(screen.getByText('Abraham Silberschatz, Peter Galvin')).toBeInTheDocument();
    expect(screen.getByText('Third Floor · Room 315')).toBeInTheDocument();
    expect(screen.getByText('NAWA-CAMPUS-023')).toBeInTheDocument();
    expect(screen.queryByText('member-private-id')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cancel reservation$/i })).not.toBeInTheDocument();
  });

  it.each([
    [403, 'You cannot view this reservation.'],
    [404, 'Reservation not found.'],
  ])('handles a backend %s safely', async (status, expected) => {
    vi.mocked(reservationDetail).mockRejectedValue(new ApiError('Private backend message', status));
    render(<MyReservationDetails {...props} id="unavailable" />);
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText('Private backend message')).not.toBeInTheDocument();
  });

  it('uses the exact book slug and returns to the list through semantic controls', async () => {
    vi.mocked(reservationDetail).mockResolvedValue(reservation);
    const user = userEvent.setup();
    render(<MyReservationDetails {...props} id="reservation-private-id" />);
    await user.click(await screen.findByRole('button', { name: 'View book' }));
    expect(props.go).toHaveBeenCalledWith('/books/operating-systems');
    await user.click(screen.getByRole('button', { name: 'Back to My Reservations' }));
    expect(props.go).toHaveBeenCalledWith('/my-reservations');
  });
});
