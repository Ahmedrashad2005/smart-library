import { useCallback, useEffect, useState } from 'react';
import { apiRequest, requestMessage } from '../lib/api';
import { PublicIcon, type PublicIconName } from '../catalog/PublicIcon';

type Locale = 'ar' | 'en';
type Props = {
  token: string;
  locale: Locale;
  path: string;
  go: (to: string) => void;
  notify: (message: string) => void;
};
type Counts = {
  books: number;
  copies: number;
  available: number;
  loans: number;
  reservations: number;
};
type Reservation = {
  id: string;
  status: string;
  reservedAt: string;
  expiresAt: string;
  book: { title: string; titleAr?: string };
  bookCopy: { copyCode: string };
  member: { fullName: string; membershipNumber?: string };
};
type ReservationResult = { items: Reservation[]; total: number; page: number; totalPages: number };
const date = (value: string) =>
  new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(value));
const label = (value: string, locale: Locale) =>
  ({
    ACTIVE: locale === 'ar' ? 'نشط' : 'Active',
    EXPIRED: locale === 'ar' ? 'منتهي' : 'Expired',
    CANCELLED: locale === 'ar' ? 'ملغى' : 'Cancelled',
    COLLECTED: locale === 'ar' ? 'تم الاستلام' : 'Collected',
  })[value] || value;

export function LibrarianDashboard({ token, locale, path, go, notify }: Props): JSX.Element {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [reservations, setReservations] = useState<ReservationResult | null>(null);
  const [status, setStatus] = useState('ACTIVE');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [books, copies, loans, reservationsResult] = await Promise.all([
        apiRequest<{ total: number }>('/books?limit=1', {}, token),
        apiRequest<{ total: number; items: Array<{ status: string }> }>(
          '/book-copies?limit=50',
          {},
          token,
        ),
        apiRequest<{ total: number }>('/loans?status=ACTIVE&limit=1', {}, token),
        apiRequest<ReservationResult>(`/reservations?status=${status}&limit=10`, {}, token),
      ]);
      setCounts({
        books: books.total,
        copies: copies.total,
        available: copies.items.filter((c) => c.status === 'AVAILABLE').length,
        loans: loans.total,
        reservations: reservationsResult.total,
      });
      setReservations(reservationsResult);
    } catch (reason) {
      setError(requestMessage(reason));
    }
  }, [status, token]);
  useEffect(() => {
    void load();
  }, [load]);
  const pickup = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      await apiRequest(`/reservations/${id}/confirm-pickup`, { method: 'POST' }, token);
      notify(
        locale === 'ar'
          ? 'تم تأكيد الاستلام وإنشاء الإعارة.'
          : 'Pickup confirmed and loan created.',
      );
      await load();
    } catch (reason) {
      setError(requestMessage(reason));
    } finally {
      setBusy('');
    }
  };
  const cards: Array<{
    key: string;
    icon: PublicIconName;
    label: string;
    value: number;
    detail: string;
  }> = counts
    ? [
        {
          key: 'books',
          icon: 'book',
          label: locale === 'ar' ? 'الكتب' : 'Books',
          value: counts.books,
          detail: locale === 'ar' ? 'سجلات الكتالوج' : 'Catalog records',
        },
        {
          key: 'copies',
          icon: 'categories',
          label: locale === 'ar' ? 'عدد النسخ' : 'Book copies',
          value: counts.copies,
          detail: locale === 'ar' ? 'مقتنيات المكتبة' : 'Physical inventory',
        },
        {
          key: 'available',
          icon: 'quality',
          label: locale === 'ar' ? 'النسخ المتاحة' : 'Available now',
          value: counts.available,
          detail: locale === 'ar' ? 'جاهزة للإعارة' : 'Ready to lend',
        },
        {
          key: 'loans',
          icon: 'return',
          label: locale === 'ar' ? 'الإعارات النشطة' : 'Active loans',
          value: counts.loans,
          detail: locale === 'ar' ? 'تحتاج متابعة' : 'Currently out',
        },
        {
          key: 'reservations',
          icon: 'history',
          label: locale === 'ar' ? 'الحجوزات النشطة' : 'Active reservations',
          value: counts.reservations,
          detail: locale === 'ar' ? 'في انتظار الاستلام' : 'Awaiting pickup',
        },
      ]
    : [];
  const isReservations = path === '/librarian/reservations';
  return (
    <section className="page librarian-dashboard" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="librarian-hero">
        <div className="librarian-hero__content">
          <p className="librarian-kicker">
            <span className="librarian-kicker__mark">
              <PublicIcon name="book" />
            </span>
            {locale === 'ar' ? 'مكتبة جامعة الدلتا' : 'Delta University Library'}
          </p>
          <h1>{locale === 'ar' ? 'لوحة تحكم المكتبة' : 'Librarian dashboard'}</h1>
          <p className="librarian-hero__description">
            {locale === 'ar'
              ? 'إدارة الكتب والمقتنيات والخدمات اليومية للمكتبة.'
              : 'Manage books, physical inventory, and the library’s daily services.'}
          </p>
        </div>
        <button
          className="button primary librarian-hero__action"
          type="button"
          onClick={() => go('/librarian/books/create')}
        >
          <span aria-hidden="true">＋</span>
          {locale === 'ar' ? 'إضافة كتاب' : 'Add book'}
        </button>
      </header>
      <nav
        className="librarian-nav"
        aria-label={locale === 'ar' ? 'تنقل المكتبي' : 'Librarian navigation'}
      >
        <button
          type="button"
          aria-current={!isReservations ? 'page' : undefined}
          className={!isReservations ? 'active' : ''}
          onClick={() => go('/librarian')}
        >
          <PublicIcon name="categories" />
          {locale === 'ar' ? 'لوحة التحكم' : 'Overview'}
        </button>
        <button type="button" onClick={() => go('/librarian/books')}>
          <PublicIcon name="book" />
          {locale === 'ar' ? 'الكتب' : 'Books'}
        </button>
        <button type="button" onClick={() => go('/librarian/book-copies')}>
          <PublicIcon name="categories" />
          {locale === 'ar' ? 'النسخ والمقتنيات' : 'Copies & inventory'}
        </button>
        <button
          type="button"
          aria-current={isReservations ? 'page' : undefined}
          className={isReservations ? 'active' : ''}
          onClick={() => go('/librarian/reservations')}
        >
          <PublicIcon name="history" />
          {locale === 'ar' ? 'الحجوزات' : 'Reservations'}
        </button>
        <button type="button" onClick={() => go('/librarian/loans')}>
          <PublicIcon name="return" />
          {locale === 'ar' ? 'الإعارات' : 'Loans'}
        </button>
      </nav>
      {error && (
        <div className="state error" role="alert">
          <h2>{error}</h2>
          <button className="button quiet" onClick={() => void load()}>
            {locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}
      {!counts && !error ? (
        <div className="state" role="status">
          <h2>{locale === 'ar' ? 'جارٍ تحميل البيانات…' : 'Loading dashboard…'}</h2>
        </div>
      ) : (
        <>
          <div
            className="librarian-metrics"
            aria-label={locale === 'ar' ? 'ملخص المكتبة' : 'Library summary'}
          >
            {cards.map((card) => (
              <article className={`metric-card metric-card--${card.key}`} key={card.key}>
                <span className="metric-card__icon">
                  <PublicIcon name={card.icon} />
                </span>
                <div>
                  <span className="metric-card__label">{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="librarian-section">
            <div className="section-heading">
              <div>
                <h2>{locale === 'ar' ? 'الحجوزات' : 'Reservations'}</h2>
                <p>
                  {locale === 'ar'
                    ? 'تابع الحجوزات وقم بتأكيد الاستلام عند حضور العضو.'
                    : 'Review reservations and confirm pickup when the member arrives.'}
                </p>
              </div>
              <select
                value={status}
                aria-label="Reservation status"
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ACTIVE">{label('ACTIVE', locale)}</option>
                <option value="EXPIRED">{label('EXPIRED', locale)}</option>
                <option value="CANCELLED">{label('CANCELLED', locale)}</option>
                <option value="COLLECTED">{label('COLLECTED', locale)}</option>
                <option value="ALL">{locale === 'ar' ? 'الكل' : 'All'}</option>
              </select>
            </div>
            {!reservations?.items.length ? (
              <div className="empty-state" role="status">
                <span className="empty-state__icon">
                  <PublicIcon name="history" />
                </span>
                <strong>
                  {locale === 'ar'
                    ? 'لا توجد حجوزات بهذه الحالة.'
                    : 'No reservations match this filter.'}
                </strong>
                <span>
                  {locale === 'ar'
                    ? 'ستظهر الحجوزات هنا عند إنشاء حجز جديد.'
                    : 'New reservations will appear here when members place them.'}
                </span>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{locale === 'ar' ? 'العضو' : 'Member'}</th>
                      <th>{locale === 'ar' ? 'الكتاب' : 'Book'}</th>
                      <th>{locale === 'ar' ? 'النسخة' : 'Copy'}</th>
                      <th>{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th>{locale === 'ar' ? 'الإجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong dir="auto">{item.member.fullName}</strong>
                          <br />
                          <span className="muted" dir="ltr">
                            {item.member.membershipNumber || ''}
                          </span>
                        </td>
                        <td dir="auto">
                          <strong>
                            {locale === 'ar'
                              ? item.book.titleAr || item.book.title
                              : item.book.title}
                          </strong>
                        </td>
                        <td>
                          <span className="metadata-ltr">{item.bookCopy.copyCode}</span>
                        </td>
                        <td>
                          <span
                            className={`librarian-status librarian-status--${item.status.toLowerCase()}`}
                          >
                            <span aria-hidden="true" />
                            {label(item.status, locale)}
                          </span>
                          <small className="table-subtext">
                            {locale === 'ar' ? 'ينتهي' : 'Expires'} {date(item.expiresAt)}
                          </small>
                        </td>
                        <td>
                          {item.status === 'ACTIVE' && (
                            <button
                              className="button primary button--compact"
                              disabled={busy === item.id}
                              onClick={() => void pickup(item.id)}
                            >
                              {busy === item.id
                                ? '…'
                                : locale === 'ar'
                                  ? 'تأكيد الاستلام'
                                  : 'Confirm pickup'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
