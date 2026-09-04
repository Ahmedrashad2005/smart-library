import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from '../lib/api';
import { BookDetail, type BookDetailRecord } from '../catalog/BookDetail';
import { createReservation, type ReservationResult } from './api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, apiRequest: vi.fn() };
});
vi.mock('./api', () => ({ createReservation: vi.fn() }));

const mockedApi = vi.mocked(apiRequest);
const mockedCreate = vi.mocked(createReservation);
const go = vi.fn();
const login = vi.fn();

function campusBook(available = true): BookDetailRecord {
  return {
    id: 'book-reserve',
    slug: 'operating-system-concepts',
    title: 'Operating System Concepts',
    titleAr: 'مفاهيم نظم التشغيل',
    totalCopies: 1,
    availableCopies: available ? 1 : 0,
    authors: [{ author: { id: 'author', name: 'Abraham Silberschatz' } }],
    campusAvailability: {
      hasPhysicalCopies: true,
      totalCopies: 1,
      availableCopies: available ? 1 : 0,
      availabilityStatus: available ? 'AVAILABLE' : 'UNAVAILABLE',
      copies: [
        {
          id: 'copy-campus',
          status: available ? 'AVAILABLE' : 'BORROWED',
          condition: 'GOOD',
          campusLocation: {
            library: {
              id: 'library',
              code: 'NAWA-COLLEGE-LIBRARY',
              nameEn: 'College Library',
              nameAr: 'مكتبة الكلية',
            },
            floor: { id: 'floor', number: 3, nameEn: 'Floor 3', nameAr: 'الدور الثالث' },
            room: { id: 'room', number: '315', nameEn: 'Room 315', nameAr: 'غرفة 315' },
            shelfLocationCode: '2/1',
            sourceCollection: null,
          },
        },
      ],
    },
  };
}

function reservation(overrides: Partial<ReservationResult> = {}): ReservationResult {
  return {
    id: 'reservation-1',
    memberId: 'member-1',
    bookId: 'book-reserve',
    bookCopyId: 'copy-campus',
    status: 'ACTIVE',
    reservedAt: '2026-08-13T10:00:00.000Z',
    expiresAt: '2026-08-14T10:00:00.000Z',
    book: {
      id: 'book-reserve',
      title: 'Operating System Concepts',
      titleAr: 'مفاهيم نظم التشغيل',
      slug: 'operating-system-concepts',
      authors: [],
    },
    bookCopy: { id: 'copy-campus', copyCode: 'CAMPUS-017', status: 'RESERVED', condition: 'GOOD' },
    pickupLocation: {
      library: { id: 'library', nameEn: 'College Library', nameAr: 'مكتبة الكلية' },
      floor: { id: 'floor', floorNumber: 3, nameEn: 'Floor 3', nameAr: 'الدور الثالث' },
      room: { id: 'room', roomNumber: '315', nameEn: 'Room 315', nameAr: 'غرفة 315' },
      shelfLocationCode: '2/1',
    },
    availability: { totalCopies: 1, availableCopies: 0 },
    pickupToken: 'reservation-1.a_secure_pickup_credential_value_123456',
    ...overrides,
  };
}

function renderPage(
  options: {
    locale?: 'ar' | 'en';
    available?: boolean;
    session?: { token: string; role: 'MEMBER' | 'LIBRARIAN' | 'ADMIN' } | null;
  } = {},
) {
  mockedApi.mockResolvedValueOnce(campusBook(options.available ?? true));
  return render(
    <BookDetail
      slug="operating-system-concepts"
      locale={options.locale ?? 'ar'}
      go={go}
      session={options.session ?? null}
      onLoginRequired={login}
    />,
  );
}

describe('student reservation on the real Book Details page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  });

  it('shows an Arabic Reserve CTA beside real Campus availability', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'احجز للاستعارة' })).toBeEnabled();
    expect(screen.getByText('متاح في المكتبة الجامعية')).toBeVisible();
    expect(screen.getByText('الدور الثالث — غرفة 315')).toBeVisible();
  });

  it('shows a disabled unavailable state when no physical copy can be reserved', async () => {
    renderPage({ available: false });
    expect(await screen.findByRole('button', { name: 'غير متاح للحجز حاليًا' })).toBeDisabled();
  });

  it('starts authentication instead of posting for an unauthenticated student', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'احجز للاستعارة' }));
    expect(login).toHaveBeenCalledOnce();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('submits exactly once, disables while pending, and renders the persistent result', async () => {
    const user = userEvent.setup();
    let resolve!: (value: ReservationResult) => void;
    mockedCreate.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    renderPage({ session: { token: 'member-token', role: 'MEMBER' } });
    const button = await screen.findByRole('button', { name: 'احجز للاستعارة' });
    await user.dblClick(button);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith('book-reserve', 'member-token');
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName('جارٍ إنشاء الحجز…');
    resolve(reservation());
    expect(await screen.findByRole('heading', { name: 'تم حجز الكتاب' })).toBeVisible();
    expect(screen.getByText('الدور الثالث · غرفة 315')).toBeVisible();
    expect(screen.getByText('CAMPUS-017')).toBeVisible();
    expect(screen.getByText('reservation-1.a_secure_pickup_credential_value_123456')).toBeVisible();
    const expectedDeadline = new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date('2026-08-14T10:00:00.000Z'));
    expect(screen.getByText(expectedDeadline)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'العودة إلى المكتبة الجامعية' }));
    expect(go).toHaveBeenCalledWith('/campus');
  });

  it.each([
    [
      new ApiError('Member already has an active reservation for this book', 409),
      'لديك حجز نشط لهذا الكتاب بالفعل.',
    ],
    [
      new ApiError('No available Campus copy for this book', 409),
      'لا توجد نسخة متاحة للحجز حاليًا.',
    ],
    [new ApiError('Member is not eligible', 403), 'حسابك غير مؤهل لإنشاء حجز حاليًا.'],
    [new ApiError('Book not found', 404), 'هذا الكتاب لم يعد متاحًا للحجز.'],
    [new Error('offline'), 'تعذر إنشاء الحجز الآن. حاول مرة أخرى.'],
  ])('maps a safe reservation failure to useful feedback', async (reason, expected) => {
    const user = userEvent.setup();
    mockedCreate.mockRejectedValueOnce(reason);
    renderPage({ session: { token: 'member-token', role: 'MEMBER' } });
    await user.click(await screen.findByRole('button', { name: 'احجز للاستعارة' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });

  it('recovers an expired access session through the login flow on 401', async () => {
    const user = userEvent.setup();
    mockedCreate.mockRejectedValueOnce(new ApiError('Unauthorized', 401));
    renderPage({ session: { token: 'expired-token', role: 'MEMBER' } });
    await user.click(await screen.findByRole('button', { name: 'احجز للاستعارة' }));
    await waitFor(() => expect(login).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['LIBRARIAN', 'ADMIN'] as const)(
    'explains the MEMBER-only policy to %s',
    async (role) => {
      renderPage({ session: { token: 'staff-token', role } });
      expect(await screen.findByText('الحجز متاح لحسابات الأعضاء فقط.')).toBeVisible();
      expect(screen.getByRole('button', { name: 'احجز للاستعارة' })).toBeDisabled();
    },
  );

  it('renders the complete action and success state in polished English LTR', async () => {
    const user = userEvent.setup();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    mockedCreate.mockResolvedValueOnce(reservation());
    renderPage({ locale: 'en', session: { token: 'member-token', role: 'MEMBER' } });
    await user.click(await screen.findByRole('button', { name: 'Reserve for pickup' }));
    expect(await screen.findByRole('heading', { name: 'Book reserved' })).toBeVisible();
    expect(screen.getByText('Floor 3 · Room 315')).toBeVisible();
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });
});
