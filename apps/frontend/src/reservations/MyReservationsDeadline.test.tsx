import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listMyReservations, reservationDetail } from './api';
import type { ReservationPage, ReservationResult } from './api';
import { reservationDeadline } from './deadline';
import { MyReservationDetails, MyReservationsPage } from './MyReservationsPage';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, listMyReservations: vi.fn(), reservationDetail: vi.fn() };
});

const start = new Date('2026-08-13T09:00:00.000Z').getTime();

function reservation(expiresAt: string, status: ReservationResult['status'] = 'ACTIVE') {
  return {
    id: 'deadline-reservation',
    memberId: 'private-member',
    bookId: 'private-book',
    bookCopyId: 'private-copy',
    status,
    reservedAt: new Date(start - 60_000).toISOString(),
    expiresAt,
    cancelledAt: null,
    collectedAt: null,
    canCancel: status === 'ACTIVE',
    book: {
      id: 'private-book',
      slug: 'deadline-book',
      title: 'Deadline Book',
      titleAr: 'كتاب الموعد',
      coverImageUrl: null,
      authors: [{ author: { id: 'author', name: 'NAWA Author', nameAr: 'مؤلف نوى' } }],
    },
    bookCopy: {
      id: 'private-copy',
      copyCode: 'NAWA-CAMPUS-DEADLINE',
      status: status === 'ACTIVE' ? 'RESERVED' : 'AVAILABLE',
      condition: 'GOOD',
    },
    pickupLocation: {
      library: { id: 'library', nameEn: 'College Library', nameAr: 'مكتبة الكلية' },
      floor: { id: 'floor', floorNumber: 3, nameEn: 'Third Floor', nameAr: 'الدور الثالث' },
      room: { id: 'room', roomNumber: '315', nameEn: 'Room 315', nameAr: 'غرفة 315' },
      shelfLocationCode: '1/1',
    },
    availability: { totalCopies: 1, availableCopies: status === 'ACTIVE' ? 0 : 1 },
  } satisfies ReservationResult;
}

const page = (items: ReservationResult[]): ReservationPage => ({
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

describe('My Reservations authoritative deadline UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/my-reservations');
  });

  afterEach(() => vi.useRealTimers());

  it('describes 18 hours from the backend expiresAt without inventing a fixed window', () => {
    const expiresAt = new Date(start + 18 * 60 * 60_000).toISOString();
    expect(reservationDeadline(expiresAt, start, 'en')).toEqual({
      text: '18 hours remaining',
      urgency: 'normal',
    });
    expect(reservationDeadline(expiresAt, start - 6 * 60 * 60_000, 'en').text).toBe(
      '24 hours remaining',
    );
  });

  it('renders polished Arabic minute-level wording from the exact deadline', () => {
    const expiresAt = new Date(start + (2 * 60 + 20) * 60_000).toISOString();
    expect(reservationDeadline(expiresAt, start, 'ar')).toEqual({
      text: 'متبقي ساعتان و20 دقيقة',
      urgency: 'soon',
    });
  });

  it('renders restrained critical urgency on the real reservation card', async () => {
    vi.mocked(listMyReservations).mockResolvedValue(
      page([reservation(new Date(Date.now() + 45 * 60_000).toISOString())]),
    );
    render(<MyReservationsPage {...props} />);
    const remaining = await screen.findByText('45 minutes remaining');
    expect(remaining).toHaveClass('is-critical');
    expect(remaining).toHaveAccessibleName('Time remaining: 45 minutes remaining');
  });

  it('stops positive time and refetches authoritative detail when expiresAt passes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
    const active = reservation(new Date(start + 1_000).toISOString());
    const expired = reservation(active.expiresAt, 'EXPIRED');
    vi.mocked(reservationDetail).mockResolvedValueOnce(active).mockResolvedValueOnce(expired);
    render(<MyReservationDetails {...props} id="deadline-reservation" />);
    await act(async () => Promise.resolve());
    expect(screen.getByText('1 minute remaining')).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1_100));
    expect(reservationDetail).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.queryByText(/remaining$/)).not.toBeInTheDocument();
  });

  it('never persists an expired state locally while the authoritative refresh is pending', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
    const active = reservation(new Date(start + 1_000).toISOString());
    let resolveRefresh: ((value: ReservationResult) => void) | undefined;
    vi.mocked(reservationDetail)
      .mockResolvedValueOnce(active)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
      );
    render(<MyReservationDetails {...props} id="deadline-reservation" />);
    await act(async () => Promise.resolve());
    await act(async () => vi.advanceTimersByTimeAsync(1_100));
    expect(screen.getByRole('status')).toHaveTextContent('Loading reservation details…');
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
    resolveRefresh?.(reservation(active.expiresAt, 'EXPIRED'));
    await act(async () => Promise.resolve());
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('updates the label by the minute without second-by-second API polling', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
    const active = reservation(new Date(start + 10 * 60_000).toISOString());
    vi.mocked(listMyReservations).mockResolvedValue(page([active]));
    render(<MyReservationsPage {...props} />);
    await act(async () => Promise.resolve());
    expect(screen.getByText('10 minutes remaining')).toBeInTheDocument();
    for (let minute = 0; minute < 5; minute += 1)
      await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(screen.getByText('5 minutes remaining')).toBeInTheDocument();
    expect(listMyReservations).toHaveBeenCalledTimes(1);
  });
});
