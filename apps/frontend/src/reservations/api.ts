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
};

export function createReservation(bookId: string, accessToken: string) {
  return apiRequest<ReservationResult>(
    '/reservations',
    { method: 'POST', body: JSON.stringify({ bookId }) },
    accessToken,
  );
}
