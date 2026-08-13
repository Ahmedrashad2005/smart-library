import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BookCoverMedia } from '../catalog/BookCoverMedia';
import type { PublicLocale } from '../catalog/public.types';
import { ApiError } from '../lib/api';
import {
  listMyReservations,
  reservationDetail,
  type ReservationFilter,
  type ReservationPage,
  type ReservationResult,
  type ReservationStatus,
} from './api';

type CommonProps = {
  token: string;
  locale: PublicLocale;
  go: (to: string) => void;
  onAuthRequired: () => void;
};

const filters: ReservationFilter[] = ['active', 'cancelled', 'expired', 'collected', 'all'];

const copy = {
  ar: {
    title: 'حجوزاتي',
    intro: 'تابع الكتب التي حجزتها من مكتبة الكلية ومواعيد استلامها.',
    filters: 'تصفية الحجوزات',
    active: 'النشطة',
    cancelled: 'الملغاة',
    expired: 'المنتهية',
    collected: 'تم الاستلام',
    all: 'الكل',
    loading: 'جارٍ تحميل حجوزاتك…',
    loadingDetail: 'جارٍ تحميل تفاصيل الحجز…',
    error: 'تعذر تحميل حجوزاتك.',
    detailError: 'تعذر تحميل تفاصيل الحجز.',
    forbidden: 'لا يمكنك عرض هذا الحجز.',
    missing: 'الحجز غير موجود.',
    retry: 'إعادة المحاولة',
    activeEmpty: 'لا توجد حجوزات نشطة',
    activeEmptyBody: 'يمكنك حجز الكتب المتاحة من مكتبة الكلية.',
    historyEmpty: 'لم تقم بأي حجز بعد.',
    filterEmpty: 'لا توجد حجوزات بهذه الحالة.',
    browse: 'تصفح مكتبة الكلية',
    details: 'عرض التفاصيل',
    bookDetails: 'عرض الكتاب',
    back: 'العودة إلى حجوزاتي',
    reserved: 'تاريخ الحجز',
    deadline: 'متاح للاستلام حتى',
    cancelledAt: 'تاريخ الإلغاء',
    collectedAt: 'تاريخ الاستلام',
    pickup: 'مكان الاستلام',
    copyCode: 'رمز النسخة',
    campus: 'مكتبة الكلية · NAWA Campus',
    previous: 'السابق',
    next: 'التالي',
    page: 'صفحة',
    of: 'من',
    reservationDetails: 'تفاصيل الحجز',
    authorFallback: 'مؤلف غير معروف',
    noCover: 'لا يوجد غلاف للكتاب',
    cover: 'غلاف كتاب',
  },
  en: {
    title: 'My Reservations',
    intro: 'Follow the books you reserved from the College Library and their pickup deadlines.',
    filters: 'Filter reservations',
    active: 'Active',
    cancelled: 'Cancelled',
    expired: 'Expired',
    collected: 'Collected',
    all: 'All',
    loading: 'Loading your reservations…',
    loadingDetail: 'Loading reservation details…',
    error: 'We could not load your reservations.',
    detailError: 'We could not load the reservation details.',
    forbidden: 'You cannot view this reservation.',
    missing: 'Reservation not found.',
    retry: 'Try again',
    activeEmpty: 'No active reservations',
    activeEmptyBody: 'You can reserve available books from the College Library.',
    historyEmpty: 'You have not made any reservations yet.',
    filterEmpty: 'There are no reservations with this status.',
    browse: 'Browse the Campus Library',
    details: 'View details',
    bookDetails: 'View book',
    back: 'Back to My Reservations',
    reserved: 'Reserved on',
    deadline: 'Available for pickup until',
    cancelledAt: 'Cancelled on',
    collectedAt: 'Collected on',
    pickup: 'Pickup location',
    copyCode: 'Copy code',
    campus: 'NAWA Campus · College Library',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    reservationDetails: 'Reservation details',
    authorFallback: 'Unknown author',
    noCover: 'No cover available for',
    cover: 'Cover of',
  },
} as const;

const statusCopy: Record<ReservationStatus, { ar: string; en: string }> = {
  ACTIVE: { ar: 'حجز نشط', en: 'Active' },
  CANCELLED: { ar: 'ملغي', en: 'Cancelled' },
  EXPIRED: { ar: 'انتهت المهلة', en: 'Expired' },
  COLLECTED: { ar: 'تم الاستلام', en: 'Collected' },
};

function initialQuery(): { filter: ReservationFilter; page: number } {
  const values = new URLSearchParams(window.location.search);
  const requested = values.get('status')?.toLowerCase();
  const requestedPage = Number(values.get('page'));
  return {
    filter: filters.includes(requested as ReservationFilter)
      ? (requested as ReservationFilter)
      : 'active',
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

function updateListUrl(filter: ReservationFilter, page: number): void {
  const values = new URLSearchParams({ status: filter, page: String(page) });
  window.history.replaceState({}, '', `/my-reservations?${values.toString()}`);
}

function formatDate(value: string | null | undefined, locale: PublicLocale): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function localizedName(value: { nameEn: string; nameAr: string }, locale: PublicLocale): string {
  return locale === 'ar' ? value.nameAr : value.nameEn;
}

function titleOf(reservation: ReservationResult, locale: PublicLocale): string {
  return locale === 'ar'
    ? reservation.book.titleAr || reservation.book.title
    : reservation.book.title;
}

function authorsOf(reservation: ReservationResult, locale: PublicLocale): string {
  return reservation.book.authors
    .map(({ author }) => (locale === 'ar' ? author.nameAr || author.name : author.name))
    .join(locale === 'ar' ? '، ' : ', ');
}

function pickupOf(reservation: ReservationResult, locale: PublicLocale): string {
  if (!reservation.pickupLocation) return '—';
  const { floor, room } = reservation.pickupLocation;
  return `${localizedName(floor, locale)} · ${localizedName(room, locale)}`;
}

function safeDetailError(error: unknown, locale: PublicLocale): string {
  const labels = copy[locale];
  if (error instanceof ApiError && error.status === 403) return labels.forbidden;
  if (error instanceof ApiError && error.status === 404) return labels.missing;
  return labels.detailError;
}

function StatusPill({ status, locale }: { status: ReservationStatus; locale: PublicLocale }) {
  return (
    <span className={`member-reservation-status is-${status.toLowerCase()}`}>
      <span aria-hidden="true" />
      {statusCopy[status][locale]}
    </span>
  );
}

function ReservationDates({
  reservation,
  locale,
}: {
  reservation: ReservationResult;
  locale: PublicLocale;
}) {
  const labels = copy[locale];
  return (
    <dl className="member-reservation-dates">
      <div>
        <dt>{labels.reserved}</dt>
        <dd>{formatDate(reservation.reservedAt, locale)}</dd>
      </div>
      <div className={reservation.status === 'ACTIVE' ? 'is-deadline' : undefined}>
        <dt>{labels.deadline}</dt>
        <dd>{formatDate(reservation.expiresAt, locale)}</dd>
      </div>
      {reservation.cancelledAt && (
        <div>
          <dt>{labels.cancelledAt}</dt>
          <dd>{formatDate(reservation.cancelledAt, locale)}</dd>
        </div>
      )}
      {reservation.collectedAt && (
        <div>
          <dt>{labels.collectedAt}</dt>
          <dd>{formatDate(reservation.collectedAt, locale)}</dd>
        </div>
      )}
    </dl>
  );
}

function ReservationCard({
  reservation,
  locale,
  go,
}: {
  reservation: ReservationResult;
  locale: PublicLocale;
  go: (to: string) => void;
}) {
  const labels = copy[locale];
  const title = titleOf(reservation, locale);
  const authors = authorsOf(reservation, locale);
  const firstAuthor = reservation.book.authors[0]?.author;
  const coverAuthor = firstAuthor
    ? locale === 'ar'
      ? firstAuthor.nameAr || firstAuthor.name
      : firstAuthor.name
    : '';
  return (
    <article className="member-reservation-card">
      <button
        type="button"
        className="member-reservation-cover"
        aria-label={`${labels.bookDetails}: ${title}`}
        onClick={() => go(`/books/${reservation.book.slug}`)}
      >
        <BookCoverMedia
          url={reservation.book.coverImageUrl}
          title={title}
          author={coverAuthor}
          coverLabel={`${labels.cover} ${title}`}
          noCoverLabel={`${labels.noCover} ${title}`}
          variantKey={reservation.book.id}
        />
      </button>
      <div className="member-reservation-card__body">
        <div className="member-reservation-card__heading">
          <div>
            <p className="member-reservation-campus">{labels.campus}</p>
            <h2 dir="auto">{title}</h2>
            <p className="member-reservation-authors" dir="auto">
              {authors || labels.authorFallback}
            </p>
          </div>
          <StatusPill status={reservation.status} locale={locale} />
        </div>
        <ReservationDates reservation={reservation} locale={locale} />
        <div className="member-reservation-location">
          <span aria-hidden="true">⌖</span>
          <div>
            <small>{labels.pickup}</small>
            <strong>{pickupOf(reservation, locale)}</strong>
          </div>
        </div>
        <div className="member-reservation-card__footer">
          <p>
            <span>{labels.copyCode}</span>
            <b dir="ltr">{reservation.bookCopy.copyCode}</b>
          </p>
          <div>
            <button
              type="button"
              className="member-link-button"
              onClick={() => go(`/books/${reservation.book.slug}`)}
            >
              {labels.bookDetails}
            </button>
            <button
              type="button"
              className="member-primary-button"
              onClick={() => go(`/my-reservations/${reservation.id}`)}
            >
              {labels.details}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ListState({
  title,
  body,
  action,
  live = false,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  live?: boolean;
}) {
  return (
    <div className="member-reservation-state" role={live ? 'status' : undefined}>
      {live && <span className="spinner" aria-hidden="true" />}
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function MyReservationsPage({ token, locale, go, onAuthRequired }: CommonProps) {
  const initial = useMemo(initialQuery, []);
  const [filter, setFilter] = useState<ReservationFilter>(initial.filter);
  const [page, setPage] = useState(initial.page);
  const [result, setResult] = useState<ReservationPage | null>(null);
  const [error, setError] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const labels = copy[locale];

  useEffect(() => {
    let active = true;
    setResult(null);
    setError('');
    void listMyReservations({ status: filter, page, limit: 12 }, token)
      .then((response) => {
        if (!active) return;
        const lastPage = Math.max(response.totalPages, 1);
        if (page > lastPage) {
          setPage(lastPage);
          updateListUrl(filter, lastPage);
          return;
        }
        setResult(response);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          onAuthRequired();
          return;
        }
        setError(labels.error);
      });
    return () => {
      active = false;
    };
  }, [filter, labels.error, onAuthRequired, page, retryVersion, token]);

  const changeFilter = (next: ReservationFilter) => {
    setFilter(next);
    setPage(1);
    updateListUrl(next, 1);
  };
  const changePage = (next: number) => {
    if (!result || next < 1 || next > Math.max(result.totalPages, 1)) return;
    setPage(next);
    updateListUrl(filter, next);
  };
  const emptyTitle =
    filter === 'active'
      ? labels.activeEmpty
      : filter === 'all'
        ? labels.historyEmpty
        : labels.filterEmpty;

  return (
    <section className="page member-reservations-page">
      <header className="member-page-intro">
        <p>NAWA Campus</p>
        <h1>{labels.title}</h1>
        <span>{labels.intro}</span>
      </header>
      <div className="member-reservation-filters" role="toolbar" aria-label={labels.filters}>
        {filters.map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            onClick={() => changeFilter(value)}
          >
            {labels[value]}
          </button>
        ))}
      </div>

      {!result && !error ? (
        <ListState title={labels.loading} live />
      ) : error ? (
        <ListState
          title={error}
          action={
            <button
              type="button"
              className="member-primary-button"
              onClick={() => setRetryVersion((value) => value + 1)}
            >
              {labels.retry}
            </button>
          }
        />
      ) : !result?.items.length ? (
        <ListState
          title={emptyTitle}
          body={filter === 'active' ? labels.activeEmptyBody : undefined}
          action={
            <button type="button" className="member-primary-button" onClick={() => go('/campus')}>
              {labels.browse}
            </button>
          }
        />
      ) : (
        <>
          <div className="member-reservation-list">
            {result.items.map((reservation) => (
              <ReservationCard
                key={reservation.id}
                reservation={reservation}
                locale={locale}
                go={go}
              />
            ))}
          </div>
          <nav
            className="member-reservation-pagination"
            aria-label={`${labels.title} — ${labels.page}`}
          >
            <button
              type="button"
              disabled={result.page <= 1}
              onClick={() => changePage(result.page - 1)}
            >
              {labels.previous}
            </button>
            <span aria-live="polite">
              {labels.page} {result.page} {labels.of} {Math.max(result.totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={result.page >= result.totalPages}
              onClick={() => changePage(result.page + 1)}
            >
              {labels.next}
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

export function MyReservationDetails({
  id,
  token,
  locale,
  go,
  onAuthRequired,
}: CommonProps & { id: string }) {
  const [reservation, setReservation] = useState<ReservationResult | null>(null);
  const [error, setError] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const labels = copy[locale];
  const load = useCallback(() => {
    setReservation(null);
    setError('');
    void reservationDetail(id, token)
      .then(setReservation)
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 401) {
          onAuthRequired();
          return;
        }
        setError(safeDetailError(reason, locale));
      });
  }, [id, locale, onAuthRequired, token]);
  useEffect(load, [load, retryVersion]);

  if (!reservation && !error)
    return (
      <section className="page member-reservations-page">
        <ListState title={labels.loadingDetail} live />
      </section>
    );
  if (error)
    return (
      <section className="page member-reservations-page">
        <ListState
          title={error}
          action={
            <button
              type="button"
              className="member-primary-button"
              onClick={() => setRetryVersion((value) => value + 1)}
            >
              {labels.retry}
            </button>
          }
        />
      </section>
    );
  if (!reservation) return <></>;

  const title = titleOf(reservation, locale);
  const authors = authorsOf(reservation, locale);
  return (
    <section className="page member-reservations-page member-reservation-detail-page">
      <button type="button" className="member-back-button" onClick={() => go('/my-reservations')}>
        <span aria-hidden="true">{locale === 'ar' ? '→' : '←'}</span>
        {labels.back}
      </button>
      <article className="member-reservation-detail" aria-labelledby="reservation-detail-title">
        <div className="member-reservation-detail__cover">
          <BookCoverMedia
            url={reservation.book.coverImageUrl}
            title={title}
            author={authors}
            coverLabel={`${labels.cover} ${title}`}
            noCoverLabel={`${labels.noCover} ${title}`}
            variantKey={reservation.book.id}
            loading="eager"
          />
        </div>
        <div className="member-reservation-detail__body">
          <p className="member-reservation-campus">{labels.campus}</p>
          <div className="member-reservation-detail__heading">
            <div>
              <p>{labels.reservationDetails}</p>
              <h1 id="reservation-detail-title" dir="auto">
                {title}
              </h1>
              <span dir="auto">{authors || labels.authorFallback}</span>
            </div>
            <StatusPill status={reservation.status} locale={locale} />
          </div>
          <ReservationDates reservation={reservation} locale={locale} />
          <dl className="member-reservation-detail__facts">
            <div>
              <dt>{labels.pickup}</dt>
              <dd>{pickupOf(reservation, locale)}</dd>
            </div>
            <div>
              <dt>{labels.copyCode}</dt>
              <dd dir="ltr">{reservation.bookCopy.copyCode}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="member-primary-button"
            onClick={() => go(`/books/${reservation.book.slug}`)}
          >
            {labels.bookDetails}
          </button>
        </div>
      </article>
    </section>
  );
}

export function MyReservationsRoute({ path, ...props }: CommonProps & { path: string }) {
  const detailId = /^\/my-reservations\/([^/]+)$/.exec(path)?.[1];
  return detailId ? (
    <MyReservationDetails id={detailId} {...props} />
  ) : (
    <MyReservationsPage {...props} />
  );
}
