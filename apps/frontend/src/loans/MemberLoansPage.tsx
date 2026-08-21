import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { BookCoverMedia } from '../catalog/BookCoverMedia';
import type { PublicLocale } from '../catalog/public.types';
import { ApiError } from '../lib/api';
import { MemberAreaNav } from '../member/MemberAreaNav';
import {
  listMyLoans,
  loanDetail,
  renewLoan,
  type Loan,
  type LoanResults,
  type LoanStatus,
  type RenewalReason,
} from './api';
import { dueDays } from './access';

export type MemberLoanProps = {
  path: string;
  token: string;
  locale?: PublicLocale;
  go: (to: string) => void;
  notify: (message: string) => void;
  onAuthRequired?: () => void;
};

type LoanFilter = LoanStatus | '';

const filters: LoanFilter[] = ['ACTIVE', 'OVERDUE', 'RETURNED', ''];

const copy = {
  ar: {
    eyebrow: 'مكتبة جامعة الدلتا',
    title: 'إعاراتي',
    intro: 'تابع الكتب التي استعرتها، مواعيد الإرجاع، وحالة التجديد بسهولة.',
    filterLabel: 'تصفية الإعارات',
    ACTIVE: 'النشطة',
    OVERDUE: 'المتأخرة',
    RETURNED: 'المُعادة',
    all: 'الكل',
    search: 'ابحث باسم الكتاب أو المؤلف أو رمز النسخة',
    searchLabel: 'البحث في إعاراتي',
    searchAction: 'بحث',
    clearSearch: 'مسح البحث',
    loading: 'جارٍ تحميل إعاراتك…',
    loadingDetail: 'جارٍ تحميل تفاصيل الإعارة…',
    loadError: 'تعذر تحميل إعاراتك.',
    detailError: 'تعذر تحميل تفاصيل الإعارة.',
    retry: 'إعادة المحاولة',
    activeEmpty: 'لا توجد لديك إعارات نشطة',
    activeEmptyBody: 'يمكنك استكشاف الكتب المتاحة في المكتبة الجامعية.',
    overdueEmpty: 'لا توجد إعارات متأخرة',
    overdueEmptyBody: 'رائع، جميع مواعيد الإرجاع لديك منتظمة.',
    returnedEmpty: 'لا توجد إعارات سابقة حتى الآن',
    allEmpty: 'لم تستعر أي كتاب حتى الآن',
    filterEmpty: 'لا توجد إعارات مطابقة لهذا البحث.',
    browse: 'تصفح المكتبة الجامعية',
    status: 'الحالة',
    ACTIVEStatus: 'إعارة نشطة',
    OVERDUEStatus: 'متأخرة',
    RETURNEDStatus: 'تم الإرجاع',
    authorFallback: 'مؤلف غير معروف',
    cover: 'غلاف كتاب',
    noCover: 'لا يوجد غلاف للكتاب',
    borrowed: 'تاريخ الاستعارة',
    due: 'موعد الإرجاع',
    returned: 'تاريخ الإرجاع',
    renewal: 'التجديد',
    renewAvailable: 'التجديد متاح',
    renewUsed: 'تجديدات مستخدمة',
    copyCode: 'رمز النسخة',
    location: 'مكان الكتاب',
    details: 'عرض التفاصيل',
    bookDetails: 'عرض الكتاب',
    renew: 'تجديد الإعارة',
    renewTitle: 'تجديد الإعارة؟',
    renewBody: 'سيتم تمديد موعد الإرجاع وفق سياسة المكتبة.',
    renewBack: 'رجوع',
    renewing: 'جارٍ التجديد…',
    renewSuccess: 'تم تجديد الإعارة وتحديث موعد الإرجاع.',
    renewError: 'تعذر تجديد الإعارة الآن. حاول مرة أخرى.',
    renewForbidden: 'لا يمكنك تجديد هذه الإعارة.',
    renewMissing: 'هذه الإعارة لم تعد متاحة.',
    renewChanged: 'تغيرت حالة الإعارة. تم تحميل أحدث بيانات من المكتبة.',
    OVERDUEReason: 'لا يمكن التجديد لأن الإعارة متأخرة.',
    RETURNEDReason: 'تم إرجاع هذه الإعارة.',
    LIMIT_REACHEDReason: 'تم استخدام الحد الأقصى للتجديدات.',
    MEMBER_INELIGIBLEReason: 'الحساب غير مؤهل للتجديد حاليًا.',
    dueToday: 'موعد الإرجاع اليوم',
    dueTomorrow: 'موعد الإرجاع غدًا',
    dueIn: 'متبقي {days} أيام',
    overdueBy: 'متأخرة منذ {days} أيام',
    returnedContext: 'تم إرجاع النسخة إلى المكتبة',
    previous: 'السابق',
    next: 'التالي',
    page: 'صفحة',
    of: 'من',
    back: 'العودة إلى إعاراتي',
    loanDetails: 'تفاصيل الإعارة',
    forbidden: 'لا يمكنك عرض هذه الإعارة.',
    missing: 'الإعارة غير موجودة.',
  },
  en: {
    eyebrow: 'Delta University Library',
    title: 'My Loans',
    intro: 'Follow your borrowed books, return dates, and renewal status at a glance.',
    filterLabel: 'Filter loans',
    ACTIVE: 'Active',
    OVERDUE: 'Overdue',
    RETURNED: 'Returned',
    all: 'All',
    search: 'Search by title, author, or copy code',
    searchLabel: 'Search My Loans',
    searchAction: 'Search',
    clearSearch: 'Clear search',
    loading: 'Loading your loans…',
    loadingDetail: 'Loading loan details…',
    loadError: 'We could not load your loans.',
    detailError: 'We could not load the loan details.',
    retry: 'Try again',
    activeEmpty: 'You have no active loans',
    activeEmptyBody: 'Explore the books available in the University Library.',
    overdueEmpty: 'You have no overdue loans',
    overdueEmptyBody: 'Great — all your return dates are on track.',
    returnedEmpty: 'You have no previous loans yet',
    allEmpty: 'You have not borrowed a book yet',
    filterEmpty: 'No loans match this search.',
    browse: 'Browse the University Library',
    status: 'Status',
    ACTIVEStatus: 'Active',
    OVERDUEStatus: 'Overdue',
    RETURNEDStatus: 'Returned',
    authorFallback: 'Unknown author',
    cover: 'Cover of',
    noCover: 'No cover available for',
    borrowed: 'Borrowed on',
    due: 'Return due',
    returned: 'Returned on',
    renewal: 'Renewal',
    renewAvailable: 'Renewal available',
    renewUsed: 'renewals used',
    copyCode: 'Copy code',
    location: 'Book location',
    details: 'View details',
    bookDetails: 'View book',
    renew: 'Renew loan',
    renewTitle: 'Renew this loan?',
    renewBody: 'The return date will be extended according to library policy.',
    renewBack: 'Go back',
    renewing: 'Renewing…',
    renewSuccess: 'Loan renewed and the return date was updated.',
    renewError: 'We could not renew the loan now. Please try again.',
    renewForbidden: 'You cannot renew this loan.',
    renewMissing: 'This loan is no longer available.',
    renewChanged: 'The loan changed. We loaded its latest library state.',
    OVERDUEReason: 'This overdue loan cannot be renewed.',
    RETURNEDReason: 'This loan has already been returned.',
    LIMIT_REACHEDReason: 'The maximum number of renewals has been used.',
    MEMBER_INELIGIBLEReason: 'This account is not currently eligible for renewal.',
    dueToday: 'Return due today',
    dueTomorrow: 'Return due tomorrow',
    dueIn: '{days} days remaining',
    overdueBy: 'Overdue by {days} days',
    returnedContext: 'The copy was returned to the library',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
    back: 'Back to My Loans',
    loanDetails: 'Loan details',
    forbidden: 'You cannot view this loan.',
    missing: 'Loan not found.',
  },
} as const;

function resolvedLocale(locale?: PublicLocale): PublicLocale {
  return locale ?? (document.documentElement.dir === 'rtl' ? 'ar' : 'en');
}

function formatDate(value: string | null | undefined, locale: PublicLocale): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function loanTitle(loan: Loan, locale: PublicLocale): string {
  return locale === 'ar'
    ? loan.bookCopy.book.titleAr || loan.bookCopy.book.title
    : loan.bookCopy.book.title;
}

function loanAuthors(loan: Loan, locale: PublicLocale): string {
  return loan.bookCopy.book.authors
    .map((author) => (locale === 'ar' ? author.arabicName || author.name : author.name))
    .join(locale === 'ar' ? '، ' : ', ');
}

function loanLocation(loan: Loan, locale: PublicLocale): string {
  const section =
    locale === 'ar'
      ? loan.bookCopy.section?.nameAr || loan.bookCopy.section?.nameEn
      : loan.bookCopy.section?.nameEn;
  const shelf =
    locale === 'ar'
      ? loan.bookCopy.shelf?.nameAr || loan.bookCopy.shelf?.nameEn
      : loan.bookCopy.shelf?.nameEn;
  return [section, shelf].filter(Boolean).join(' · ') || '—';
}

function statusLabel(status: LoanStatus, locale: PublicLocale): string {
  return copy[locale][`${status}Status`];
}

function renewalReason(reason: RenewalReason | null | undefined, locale: PublicLocale): string {
  return reason ? copy[locale][`${reason}Reason`] : copy[locale].renewError;
}

function dueContext(loan: Loan, locale: PublicLocale): { text: string; urgency: string } {
  const labels = copy[locale];
  if (loan.status === 'RETURNED') return { text: labels.returnedContext, urgency: 'returned' };
  const days = dueDays(loan.dueAt);
  if (loan.status === 'OVERDUE')
    return {
      text: labels.overdueBy.replace('{days}', String(Math.max(1, Math.abs(days)))),
      urgency: 'overdue',
    };
  if (days <= 0) return { text: labels.dueToday, urgency: 'soon' };
  if (days === 1) return { text: labels.dueTomorrow, urgency: 'soon' };
  return {
    text: labels.dueIn.replace('{days}', String(days)),
    urgency: days <= 3 ? 'soon' : 'normal',
  };
}

function LoanStatusPill({ loan, locale }: { loan: Loan; locale: PublicLocale }): JSX.Element {
  return (
    <span className={`member-loan-status is-${loan.status.toLowerCase()}`}>
      <span aria-hidden="true" />
      {statusLabel(loan.status, locale)}
    </span>
  );
}

function MemberLoanState({
  title,
  body,
  action,
  live = false,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  live?: boolean;
}): JSX.Element {
  return (
    <div className="member-loan-state" role={live ? 'status' : undefined}>
      {live && <span className="spinner" aria-hidden="true" />}
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

function LoanCover({
  loan,
  locale,
  go,
  detail = false,
}: {
  loan: Loan;
  locale: PublicLocale;
  go: (to: string) => void;
  detail?: boolean;
}): JSX.Element {
  const labels = copy[locale];
  const title = loanTitle(loan, locale);
  const author = loanAuthors(loan, locale);
  const media = (
    <BookCoverMedia
      url={loan.bookCopy.book.coverImageUrl}
      title={title}
      author={author}
      coverLabel={`${labels.cover} ${title}`}
      noCoverLabel={`${labels.noCover} ${title}`}
      variantKey={loan.bookCopy.book.id}
      loading={detail ? 'eager' : 'lazy'}
    />
  );
  return loan.bookCopy.book.slug ? (
    <button
      type="button"
      className={detail ? 'member-loan-detail__cover' : 'member-loan-card__cover'}
      aria-label={`${labels.bookDetails}: ${title}`}
      onClick={() => go(`/books/${loan.bookCopy.book.slug}`)}
    >
      {media}
    </button>
  ) : (
    <div className={detail ? 'member-loan-detail__cover' : 'member-loan-card__cover'}>{media}</div>
  );
}

function RenewalAction({
  loan,
  token,
  locale,
  onAuthRequired,
  onUpdated,
  notify,
}: {
  loan: Loan;
  token: string;
  locale: PublicLocale;
  onAuthRequired?: () => void;
  onUpdated: (loan: Loan, message: string) => void;
  notify: (message: string) => void;
}): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const labels = copy[locale];
  const eligibility = loan.renewalEligibility;
  const close = useCallback(() => {
    if (submittingRef.current) return;
    setOpen(false);
    setError('');
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (open) backRef.current?.focus();
  }, [open]);

  if (!eligibility?.canRenew) return null;

  const handleDialogKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const first = backRef.current;
    const last = confirmRef.current;
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setError('');
    try {
      const updated = await renewLoan(loan.id, token);
      setOpen(false);
      onUpdated(updated, labels.renewSuccess);
      notify(labels.renewSuccess);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setOpen(false);
        onAuthRequired?.();
      } else if (reason instanceof ApiError && (reason.status === 400 || reason.status === 409)) {
        try {
          const current = await loanDetail(loan.id, token);
          onUpdated(current, labels.renewChanged);
          setError(renewalReason(current.renewalEligibility?.reason, locale));
        } catch {
          setError(labels.renewChanged);
        }
      } else if (reason instanceof ApiError && reason.status === 403) {
        setError(labels.renewForbidden);
      } else if (reason instanceof ApiError && reason.status === 404) {
        setError(labels.renewMissing);
      } else {
        setError(labels.renewError);
      }
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="member-primary-button"
        onClick={() => setOpen(true)}
      >
        {labels.renew}
      </button>
      {open && (
        <div
          className="member-renew-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            className="member-renew-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`renew-title-${loan.id}`}
            aria-describedby={`renew-body-${loan.id}`}
            aria-busy={pending}
            onKeyDown={handleDialogKey}
          >
            <span className="member-renew-dialog__icon" aria-hidden="true">
              ↻
            </span>
            <h2 id={`renew-title-${loan.id}`}>{labels.renewTitle}</h2>
            <p id={`renew-body-${loan.id}`}>{labels.renewBody}</p>
            <p className="member-renew-dialog__book" dir="auto">
              {loanTitle(loan, locale)}
            </p>
            <dl>
              <div>
                <dt>{labels.due}</dt>
                <dd>{formatDate(loan.dueAt, locale)}</dd>
              </div>
              <div>
                <dt>{labels.renewal}</dt>
                <dd>
                  {eligibility.used} / {eligibility.maximum}
                </dd>
              </div>
            </dl>
            {error && (
              <p className="member-renew-dialog__error" role="alert">
                {error}
              </p>
            )}
            <div className="member-renew-dialog__actions">
              <button
                ref={backRef}
                type="button"
                className="member-link-button"
                disabled={pending}
                onClick={close}
              >
                {labels.renewBack}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className="member-primary-button"
                disabled={pending}
                onClick={() => void submit()}
              >
                {pending ? labels.renewing : labels.renew}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RenewalState({ loan, locale }: { loan: Loan; locale: PublicLocale }): JSX.Element {
  const labels = copy[locale];
  const eligibility = loan.renewalEligibility;
  return (
    <div
      className={`member-loan-renewal${eligibility?.canRenew ? ' is-available' : ''}`}
      role="status"
    >
      <span aria-hidden="true">↻</span>
      <div>
        <small>{labels.renewal}</small>
        <strong>
          {eligibility?.canRenew
            ? labels.renewAvailable
            : renewalReason(eligibility?.reason, locale)}
        </strong>
        {eligibility && (
          <span>
            {eligibility.used} / {eligibility.maximum} {labels.renewUsed}
          </span>
        )}
      </div>
    </div>
  );
}

function LoanCard({
  loan,
  locale,
  token,
  go,
  notify,
  onAuthRequired,
  onUpdated,
}: {
  loan: Loan;
  locale: PublicLocale;
  token: string;
  go: (to: string) => void;
  notify: (message: string) => void;
  onAuthRequired?: () => void;
  onUpdated: (loan: Loan, message: string) => void;
}): JSX.Element {
  const labels = copy[locale];
  const due = dueContext(loan, locale);
  return (
    <article className={`member-loan-card is-${loan.status.toLowerCase()}`}>
      <LoanCover loan={loan} locale={locale} go={go} />
      <div className="member-loan-card__body">
        <div className="member-loan-card__heading">
          <div>
            <p className="member-reservation-campus">{labels.eyebrow}</p>
            <h2 dir="auto">{loanTitle(loan, locale)}</h2>
            <p className="member-loan-authors" dir="auto">
              {loanAuthors(loan, locale) || labels.authorFallback}
            </p>
          </div>
          <LoanStatusPill loan={loan} locale={locale} />
        </div>
        <div className={`member-loan-due is-${due.urgency}`}>
          <div>
            <small>{loan.status === 'RETURNED' ? labels.returned : labels.due}</small>
            <strong>{formatDate(loan.returnedAt || loan.dueAt, locale)}</strong>
          </div>
          <span>{due.text}</span>
        </div>
        <RenewalState loan={loan} locale={locale} />
        <div className="member-loan-card__footer">
          <p>
            <span>{labels.copyCode}</span>
            <b dir="ltr">{loan.bookCopy.copyCode}</b>
          </p>
          <div>
            <RenewalAction
              loan={loan}
              token={token}
              locale={locale}
              notify={notify}
              onAuthRequired={onAuthRequired}
              onUpdated={onUpdated}
            />
            {loan.bookCopy.book.slug && (
              <button
                type="button"
                className="member-link-button"
                onClick={() => go(`/books/${loan.bookCopy.book.slug}`)}
              >
                {labels.bookDetails}
              </button>
            )}
            <button
              type="button"
              className="member-link-button"
              onClick={() => go(`/my-loans/${loan.id}`)}
            >
              {labels.details}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function initialQuery(): { filter: LoanFilter; page: number; q: string } {
  const values = new URLSearchParams(window.location.search);
  const requestedStatus = values.get('status')?.toUpperCase() ?? '';
  const requestedPage = Number(values.get('page'));
  return {
    filter: filters.includes(requestedStatus as LoanFilter) ? (requestedStatus as LoanFilter) : '',
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    q: values.get('q') ?? '',
  };
}

function updateUrl(filter: LoanFilter, page: number, q: string): void {
  const values = new URLSearchParams({ page: String(page) });
  if (filter) values.set('status', filter.toLowerCase());
  if (q) values.set('q', q);
  window.history.replaceState({}, '', `/my-loans?${values.toString()}`);
}

export function MemberLoansPage(props: MemberLoanProps): JSX.Element {
  const { onAuthRequired, token } = props;
  const locale = resolvedLocale(props.locale);
  const labels = copy[locale];
  const initial = useMemo(initialQuery, []);
  const [filter, setFilter] = useState<LoanFilter>(initial.filter);
  const [page, setPage] = useState(initial.page);
  const [searchInput, setSearchInput] = useState(initial.q);
  const [query, setQuery] = useState(initial.q);
  const [result, setResult] = useState<LoanResults | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setResult(null);
    setError('');
    void listMyLoans({ q: query, status: filter, page, limit: 12 }, token)
      .then((response) => {
        if (!active) return;
        const lastPage = Math.max(response.totalPages, 1);
        if (page > lastPage) {
          setPage(lastPage);
          updateUrl(filter, lastPage, query);
          return;
        }
        setResult(response);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 401) {
          onAuthRequired?.();
          return;
        }
        setError(labels.loadError);
      });
    return () => {
      active = false;
    };
  }, [filter, labels.loadError, onAuthRequired, page, query, retry, token]);

  const changeFilter = (next: LoanFilter) => {
    setFilter(next);
    setPage(1);
    updateUrl(next, 1, query);
  };
  const submitSearch = () => {
    const next = searchInput.trim();
    setQuery(next);
    setPage(1);
    updateUrl(filter, 1, next);
  };
  const updateLoan = (updated: Loan, message: string) => {
    setResult((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === updated.id ? updated : item)),
          }
        : current,
    );
    setNotice(message);
  };
  const empty = query
    ? { title: labels.filterEmpty, body: undefined }
    : filter === 'ACTIVE'
      ? { title: labels.activeEmpty, body: labels.activeEmptyBody }
      : filter === 'OVERDUE'
        ? { title: labels.overdueEmpty, body: labels.overdueEmptyBody }
        : filter === 'RETURNED'
          ? { title: labels.returnedEmpty, body: undefined }
          : { title: labels.allEmpty, body: labels.activeEmptyBody };

  return (
    <section className="page member-reservations-page member-loans-page">
      <MemberAreaNav locale={locale} currentPath="/my-loans" go={props.go} />
      <header className="member-page-intro">
        <p>{labels.eyebrow}</p>
        <h1>{labels.title}</h1>
        <span>{labels.intro}</span>
      </header>
      <div className="member-loan-tools">
        <div className="member-reservation-filters" role="toolbar" aria-label={labels.filterLabel}>
          {filters.map((value) => (
            <button
              type="button"
              key={value || 'all'}
              aria-pressed={filter === value}
              onClick={() => changeFilter(value)}
            >
              {value ? labels[value] : labels.all}
            </button>
          ))}
        </div>
        <form
          className="member-loan-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <span aria-hidden="true">⌕</span>
          <input
            value={searchInput}
            aria-label={labels.searchLabel}
            placeholder={labels.search}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              className="member-loan-search__clear"
              aria-label={labels.clearSearch}
              onClick={() => {
                setSearchInput('');
                setQuery('');
                setPage(1);
                updateUrl(filter, 1, '');
              }}
            >
              ×
            </button>
          )}
          <button type="submit" className="member-loan-search__submit">
            {labels.searchAction}
          </button>
        </form>
      </div>

      {notice && (
        <p className="member-reservation-notice" role="status">
          <span aria-hidden="true">✓</span>
          {notice}
        </p>
      )}

      {!result && !error ? (
        <MemberLoanState title={labels.loading} live />
      ) : error ? (
        <MemberLoanState
          title={error}
          action={
            <button
              type="button"
              className="member-primary-button"
              onClick={() => setRetry((v) => v + 1)}
            >
              {labels.retry}
            </button>
          }
        />
      ) : !result?.items.length ? (
        <MemberLoanState
          title={empty.title}
          body={empty.body}
          action={
            <button
              type="button"
              className="member-primary-button"
              onClick={() => props.go('/campus')}
            >
              {labels.browse}
            </button>
          }
        />
      ) : (
        <>
          <div className="member-loan-list">
            {result.items.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                token={props.token}
                locale={locale}
                go={props.go}
                notify={props.notify}
                onAuthRequired={props.onAuthRequired}
                onUpdated={updateLoan}
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
              onClick={() => {
                const next = result.page - 1;
                setPage(next);
                updateUrl(filter, next, query);
              }}
            >
              {labels.previous}
            </button>
            <span aria-live="polite">
              {labels.page} {result.page} {labels.of} {Math.max(result.totalPages, 1)}
            </span>
            <button
              type="button"
              disabled={result.page >= result.totalPages}
              onClick={() => {
                const next = result.page + 1;
                setPage(next);
                updateUrl(filter, next, query);
              }}
            >
              {labels.next}
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

export function MemberLoanDetails({ id, ...props }: MemberLoanProps & { id: string }): JSX.Element {
  const { onAuthRequired, token } = props;
  const locale = resolvedLocale(props.locale);
  const labels = copy[locale];
  const [loan, setLoan] = useState<Loan | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState('');
  const load = useCallback(() => {
    setLoan(null);
    setError('');
    void loanDetail(id, token)
      .then(setLoan)
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 401) {
          onAuthRequired?.();
          return;
        }
        if (reason instanceof ApiError && reason.status === 403) setError(labels.forbidden);
        else if (reason instanceof ApiError && reason.status === 404) setError(labels.missing);
        else setError(labels.detailError);
      });
  }, [id, labels.detailError, labels.forbidden, labels.missing, onAuthRequired, token]);
  useEffect(load, [load, retry]);

  if (!loan && !error)
    return (
      <section className="page member-reservations-page member-loans-page">
        <MemberAreaNav locale={locale} currentPath={props.path} go={props.go} />
        <MemberLoanState title={labels.loadingDetail} live />
      </section>
    );
  if (error)
    return (
      <section className="page member-reservations-page member-loans-page">
        <MemberAreaNav locale={locale} currentPath={props.path} go={props.go} />
        <MemberLoanState
          title={error}
          action={
            <button
              type="button"
              className="member-primary-button"
              onClick={() => setRetry((v) => v + 1)}
            >
              {labels.retry}
            </button>
          }
        />
      </section>
    );
  if (!loan) return <></>;

  const due = dueContext(loan, locale);
  return (
    <section className="page member-reservations-page member-loans-page member-loan-detail-page">
      <MemberAreaNav locale={locale} currentPath={props.path} go={props.go} />
      <button type="button" className="member-back-button" onClick={() => props.go('/my-loans')}>
        <span aria-hidden="true">{locale === 'ar' ? '→' : '←'}</span>
        {labels.back}
      </button>
      {notice && (
        <p className="member-reservation-notice" role="status">
          <span aria-hidden="true">✓</span>
          {notice}
        </p>
      )}
      <article className="member-loan-detail" aria-labelledby="member-loan-detail-title">
        <LoanCover loan={loan} locale={locale} go={props.go} detail />
        <div className="member-loan-detail__body">
          <p className="member-reservation-campus">{labels.eyebrow}</p>
          <div className="member-loan-detail__heading">
            <div>
              <p>{labels.loanDetails}</p>
              <h1 id="member-loan-detail-title" dir="auto">
                {loanTitle(loan, locale)}
              </h1>
              <span dir="auto">{loanAuthors(loan, locale) || labels.authorFallback}</span>
            </div>
            <LoanStatusPill loan={loan} locale={locale} />
          </div>
          <div className={`member-loan-due member-loan-detail__due is-${due.urgency}`}>
            <div>
              <small>{loan.status === 'RETURNED' ? labels.returned : labels.due}</small>
              <strong>{formatDate(loan.returnedAt || loan.dueAt, locale)}</strong>
            </div>
            <span>{due.text}</span>
          </div>
          <dl className="member-loan-detail__facts">
            <div>
              <dt>{labels.borrowed}</dt>
              <dd>{formatDate(loan.borrowedAt, locale)}</dd>
            </div>
            <div>
              <dt>{labels.copyCode}</dt>
              <dd dir="ltr">{loan.bookCopy.copyCode}</dd>
            </div>
            <div>
              <dt>{labels.location}</dt>
              <dd>{loanLocation(loan, locale)}</dd>
            </div>
            <div>
              <dt>{labels.renewal}</dt>
              <dd>
                {loan.renewalEligibility
                  ? `${loan.renewalEligibility.used} / ${loan.renewalEligibility.maximum}`
                  : '—'}
              </dd>
            </div>
          </dl>
          <RenewalState loan={loan} locale={locale} />
          <div className="member-loan-detail__actions">
            <RenewalAction
              loan={loan}
              token={props.token}
              locale={locale}
              notify={props.notify}
              onAuthRequired={props.onAuthRequired}
              onUpdated={(updated, message) => {
                setLoan(updated);
                setNotice(message);
              }}
            />
            {loan.bookCopy.book.slug && (
              <button
                type="button"
                className="member-link-button"
                onClick={() => props.go(`/books/${loan.bookCopy.book.slug}`)}
              >
                {labels.bookDetails}
              </button>
            )}
          </div>
        </div>
      </article>
    </section>
  );
}
