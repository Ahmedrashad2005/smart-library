import { apiRequest } from '../lib/api';

export type ReservationStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'COLLECTED';

export type ReservationResult = {
  id: string;
  memberId: string;
  bookId: string;
  bookCopyId: string;
  status: ReservationStatus;
  reservedAt: string;
  expiresAt: string;
  book: {
    id: string;
    title: string;
    titleAr?: string | null;
    slug: string;
    coverImageUrl?: string | null;
    authors: Array<{
      author: { id: string; name: string; nameAr?: string | null };
    }>;
  };
  bookCopy: {
    id: string;
    copyCode: string;
    status: string;
    condition: string;
  };
  pickupLocation: {
    library: { id: string; nameEn: string; nameAr: string };
    floor: { id: string; floorNumber: number; nameEn: string; nameAr: string };
    room: { id: string; roomNumber: string; nameEn: string; nameAr: string };
    shelfLocationCode: string | null;
  } | null;
  availability: { totalCopies: number; availableCopies: number };
  cancelledAt?: string | null;
  collectedAt?: string | null;
  canCancel?: boolean;
};

export type ReservationFilter = 'active' | 'cancelled' | 'expired' | 'collected' | 'all';

export type ReservationPage = {
  items: ReservationResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ReservationFilters = {
  status?: ReservationFilter;
  page?: number;
  limit?: number;
};

function positiveInteger(value: number | undefined, fallback: number, maximum?: number): number {
  const normalized = Number.isInteger(value) && value! > 0 ? value! : fallback;
  return maximum ? Math.min(normalized, maximum) : normalized;
}

export function createReservation(bookId: string, accessToken: string) {
  return apiRequest<ReservationResult>(
    '/reservations',
    { method: 'POST', body: JSON.stringify({ bookId }) },
    accessToken,
  );
}

export function listMyReservations(filters: ReservationFilters, accessToken: string) {
  const values = new URLSearchParams({
    status: filters.status ?? 'active',
    page: String(positiveInteger(filters.page, 1)),
    limit: String(positiveInteger(filters.limit, 12, 50)),
  });
  return apiRequest<ReservationPage>(`/reservations/me?${values.toString()}`, {}, accessToken);
}

export function reservationDetail(id: string, accessToken: string) {
  return apiRequest<ReservationResult>(`/reservations/${encodeURIComponent(id)}`, {}, accessToken);
}

export function cancelReservation(id: string, accessToken: string) {
  return apiRequest<ReservationResult>(
    `/reservations/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
    accessToken,
  );
}
