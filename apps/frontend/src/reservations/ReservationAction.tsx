import { useRef, useState } from 'react';
import type { Role } from '../auth/access';
import { ApiError } from '../lib/api';
import type { CampusAvailability } from '../catalog/CampusAvailabilityCard';
import type { PublicLocale } from '../catalog/public.types';
import { createReservation, type ReservationResult } from './api';

type Props = {
  bookId: string;
  bookTitle: string;
  locale: PublicLocale;
  availability: CampusAvailability;
  session: { token: string; role: Role } | null;
  sessionReady: boolean;
  onLoginRequired: () => void;
  go: (to: string) => void;
};

const copy = {
  ar: {
    heading: 'احجز نسختك من المكتبة الجامعية',
    available: 'متاح في المكتبة الجامعية',
    unavailable: 'غير متاح للحجز حاليًا',
    reserve: 'احجز للاستعارة',
    submitting: 'جارٍ إنشاء الحجز…',
    checkingAccount: 'جارٍ التحقق من الحساب…',
    memberOnly: 'الحجز متاح لحسابات الأعضاء فقط.',
    success: 'تم حجز الكتاب',
    held: 'احتفظنا لك بنسخة في المكتبة الجامعية.',
    pickup: 'مكان الاستلام',
    deadline: 'الحجز متاح حتى',
    copyCode: 'رمز النسخة',
    status: 'حالة الحجز',
    browse: 'العودة إلى المكتبة الجامعية',
    duplicate: 'لديك حجز نشط لهذا الكتاب بالفعل.',
    noCopy: 'لا توجد نسخة متاحة للحجز حاليًا.',
    ineligible: 'حسابك غير مؤهل لإنشاء حجز حاليًا.',
    missing: 'هذا الكتاب لم يعد متاحًا للحجز.',
    unexpected: 'تعذر إنشاء الحجز الآن. حاول مرة أخرى.',
  },
  en: {
    heading: 'Reserve a University Library copy',
    available: 'Available at the University Library',
    unavailable: 'Currently unavailable for reservation',
    reserve: 'Reserve for pickup',
    submitting: 'Creating reservation…',
    checkingAccount: 'Checking your account…',
    memberOnly: 'Reservations are available to member accounts only.',
    success: 'Book reserved',
    held: 'We are holding a copy for you at the University Library.',
    pickup: 'Pickup location',
    deadline: 'Reservation available until',
    copyCode: 'Copy code',
    status: 'Reservation status',
    browse: 'Back to the University Library',
    duplicate: 'You already have an active reservation for this book.',
    noCopy: 'No copy is currently available to reserve.',
    ineligible: 'Your account is not currently eligible to create a reservation.',
    missing: 'This book is no longer available to reserve.',
    unexpected: 'We could not create the reservation. Please try again.',
  },
} as const;

function errorFeedback(error: unknown, locale: PublicLocale) {
  const labels = copy[locale];
  if (!(error instanceof ApiError)) return { message: labels.unexpected, duplicate: false };
  if (error.status === 409) {
    const duplicate = /already|active reservation/i.test(error.message);
    return { message: duplicate ? labels.duplicate : labels.noCopy, duplicate };
  }
  if (error.status === 403) return { message: labels.ineligible, duplicate: false };
  if (error.status === 404) return { message: labels.missing, duplicate: false };
  return { message: labels.unexpected, duplicate: false };
}

function localized(locale: PublicLocale, english: string, arabic: string): string {
  return locale === 'ar' ? arabic : english;
}

export function ReservationAction({
  bookId,
  bookTitle,
  locale,
  availability,
  session,
  sessionReady,
  onLoginRequired,
  go,
}: Props): JSX.Element {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ReservationResult | null>(null);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const pendingRef = useRef(false);
  const labels = copy[locale];
  const isAvailable =
    availability.hasPhysicalCopies &&
    availability.availabilityStatus === 'AVAILABLE' &&
    availability.availableCopies > 0;

  const reserve = async () => {
    if (pendingRef.current || !sessionReady || !isAvailable || duplicate) return;
    if (!session) {
      onLoginRequired();
      return;
    }
    if (session.role !== 'MEMBER') return;
    pendingRef.current = true;
    setPending(true);
    setError('');
    try {
      setResult(await createReservation(bookId, session.token));
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        onLoginRequired();
        return;
      }
      const feedback = errorFeedback(reason, locale);
      setDuplicate(feedback.duplicate);
      setError(feedback.message);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  if (result) {
    const pickup = result.pickupLocation;
    const deadline = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(result.expiresAt));
    return (
      <section
        className="reservation-result"
        role="status"
        aria-live="polite"
        aria-labelledby="reservation-success-title"
      >
        <div className="reservation-result__mark" aria-hidden="true">
          ✓
        </div>
        <div>
          <p className="reservation-result__eyebrow">
            {locale === 'ar' ? 'مكتبة جامعة الدلتا' : 'Delta University Library'}
          </p>
          <h2 id="reservation-success-title">{labels.success}</h2>
          <h3 dir="auto">
            {result.book.titleAr && locale === 'ar'
              ? result.book.titleAr
              : result.book.title || bookTitle}
          </h3>
          <p>{labels.held}</p>
        </div>
        <dl>
          <div>
            <dt>{labels.status}</dt>
            <dd>{result.status}</dd>
          </div>
          {pickup && (
            <div>
              <dt>{labels.pickup}</dt>
              <dd>
                {localized(locale, pickup.floor.nameEn, pickup.floor.nameAr)} ·{' '}
                {localized(locale, pickup.room.nameEn, pickup.room.nameAr)}
              </dd>
            </div>
          )}
          <div>
            <dt>{labels.deadline}</dt>
            <dd>{deadline}</dd>
          </div>
          <div>
            <dt>{labels.copyCode}</dt>
            <dd dir="ltr">{result.bookCopy.copyCode}</dd>
          </div>
        </dl>
        <button
          type="button"
          className="reservation-secondary-action"
          onClick={() => go('/campus')}
        >
          {labels.browse}
        </button>
      </section>
    );
  }

  return (
    <section className="reservation-action" aria-labelledby="reservation-action-title">
      <div>
        <p className="reservation-action__eyebrow">
          {locale === 'ar' ? 'مكتبة جامعة الدلتا' : 'Delta University Library'}
        </p>
        <h2 id="reservation-action-title">{labels.heading}</h2>
        <p className={isAvailable ? 'is-available' : 'is-unavailable'}>
          {isAvailable ? labels.available : labels.unavailable}
        </p>
      </div>
      {session && session.role !== 'MEMBER' && (
        <p className="reservation-feedback" role="status">
          {labels.memberOnly}
        </p>
      )}
      {error && (
        <p className="reservation-feedback is-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="reservation-primary-action"
        disabled={
          !sessionReady ||
          !isAvailable ||
          pending ||
          duplicate ||
          (!!session && session.role !== 'MEMBER')
        }
        aria-busy={pending || !sessionReady}
        onClick={() => void reserve()}
      >
        {!sessionReady
          ? labels.checkingAccount
          : pending
            ? labels.submitting
            : duplicate
              ? labels.duplicate
              : isAvailable
                ? labels.reserve
                : labels.unavailable}
      </button>
    </section>
  );
}
