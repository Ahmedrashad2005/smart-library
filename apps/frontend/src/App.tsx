import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { loginPath, safeReturnPath, type Role } from './auth/access';
import { apiRequest, apiUpload, requestMessage } from './lib/api';
import { PublicCatalog } from './catalog/PublicCatalog';
import { PublicHeader } from './catalog/PublicHeader';
import { BookDetail } from './catalog/BookDetail';
import { BookCoverMedia } from './catalog/BookCoverMedia';
import { PublicIcon } from './catalog/PublicIcon';
import { BookPreviewPage } from './catalog/BookPreviewPage';
import { BookPreviewField, type PreviewMetadata } from './catalog/BookPreviewField';
import { CampusPage } from './catalog/CampusPage';
import { canAccessLoanRoute, isMemberLoanRoute, isStaffLoanRoute } from './loans/access';
import { LoanRoute } from './loans/pages';
import { MyReservationsRoute } from './reservations/MyReservationsPage';
import { FacultiesPage } from './faculties/FacultiesPage';
import { AssistantWidget } from './assistant/AssistantWidget';
import { LibrarianDashboard } from './librarian/LibrarianDashboard';
import {
  canManageRoute,
  managementListQuery,
  pageSlice,
  routeArea,
  shelvesForSection,
  validateBookForm,
  validateCopyForm,
  type ManagementArea,
} from './catalog/management';

type Category = { id: string; nameEn: string; nameAr: string; slug: string; isArchived: boolean };
type Author = { id: string; name: string; nameAr?: string; isArchived: boolean };
type Publisher = { id: string; name: string; nameAr?: string; isArchived: boolean };
type Section = {
  id: string;
  nameEn: string;
  nameAr: string;
  code: string;
  floor: string;
  room?: string;
  isArchived: boolean;
};
type Shelf = {
  id: string;
  sectionId: string;
  code: string;
  nameEn: string;
  nameAr: string;
  isArchived: boolean;
  section?: Section;
};
type Copy = {
  id: string;
  bookId?: string;
  copyCode: string;
  barcode?: string;
  sectionId: string;
  shelfId: string;
  status: CopyStatus;
  condition: CopyCondition;
  isArchived: boolean;
  book?: Book;
  section?: Section;
  shelf?: Shelf;
};
type Book = {
  id: string;
  slug: string;
  title: string;
  titleAr?: string;
  isbn13?: string;
  isbn10?: string;
  description?: string;
  descriptionAr?: string;
  coverImageUrl?: string;
  language: string;
  categoryId: string;
  publisherId?: string;
  totalCopies: number;
  availableCopies: number;
  isArchived: boolean;
  category?: Category;
  publisher?: Publisher;
  authors: Array<{ author: Author }>;
  copies?: Copy[];
  preview?: PreviewMetadata;
};
type CatalogResult = { items: Book[]; total: number; page: number; totalPages: number };
type CopyResult = { items: Copy[]; total: number; page: number; totalPages: number };
type Session = { token: string; role: Role; fullName: string } | null;
type CopyStatus =
  'AVAILABLE' | 'BORROWED' | 'RESERVED' | 'LOST' | 'DAMAGED' | 'MAINTENANCE' | 'ARCHIVED';
type CopyCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
const statuses: CopyStatus[] = [
  'AVAILABLE',
  'BORROWED',
  'RESERVED',
  'LOST',
  'DAMAGED',
  'MAINTENANCE',
];
const conditions: CopyCondition[] = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];

function pathNow(): string {
  return window.location.pathname;
}
function navigate(to: string, setPath: (path: string) => void): void {
  window.history.pushState({}, '', to);
  setPath(pathNow());
  window.dispatchEvent(new Event('nawa:navigation'));
}
function App(): JSX.Element {
  const [path, setPath] = useState(pathNow());
  const [session, setSession] = useState<Session>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [arabic, setArabic] = useState(document.documentElement.dir === 'rtl');
  useEffect(() => {
    let active = true;
    void apiRequest<{ accessToken?: string }>('/auth/refresh', { method: 'POST' })
      .then(async ({ accessToken }) => {
        if (!accessToken) return;
        const user = await apiRequest<{ role: Role; fullName: string }>(
          '/auth/me',
          {},
          accessToken,
        );
        if (active) setSession({ token: accessToken, role: user.role, fullName: user.fullName });
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setSessionReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const listener = () => {
      setPath(pathNow());
      window.dispatchEvent(new Event('nawa:navigation'));
    };
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
  const go = (to: string) => navigate(to, setPath);
  const language = () => {
    document.documentElement.dir = arabic ? 'ltr' : 'rtl';
    document.documentElement.lang = arabic ? 'en' : 'ar';
    setArabic(!arabic);
  };
  const area = routeArea(path);
  const management = !!area;
  const staffLoanRoute = isStaffLoanRoute(path);
  const memberLoanRoute = isMemberLoanRoute(path);
  const loanRoute = staffLoanRoute || memberLoanRoute;
  const reservationRoute = path === '/my-reservations' || /^\/my-reservations\/[^/]+$/.test(path);
  const librarianDashboardRoute =
    path === '/librarian' || path === '/librarian/dashboard' || path === '/librarian/reservations';
  const previewMatch = path.match(/^\/books\/([^/]+)\/preview$/);
  let page: JSX.Element;
  if (path === '/auth/login') {
    const returnTo = safeReturnPath(
      new URLSearchParams(window.location.search).get('returnTo'),
      '/my-loans',
    );
    page = (
      <LoginGate
        session={session}
        setSession={setSession}
        locale={arabic ? 'ar' : 'en'}
        onSuccess={() => go(returnTo)}
      />
    );
  } else if (previewMatch && !sessionReady)
    page = (
      <MemberRouteState
        locale={arabic ? 'ar' : 'en'}
        message={arabic ? 'جارٍ التحقق من حسابك…' : 'Checking your account…'}
      />
    );
  else if (previewMatch && !session)
    page = (
      <AuthRedirect
        go={go}
        returnTo={`${path}${window.location.search}`}
        locale={arabic ? 'ar' : 'en'}
      />
    );
  else if (previewMatch)
    page = (
      <BookPreviewPage
        slug={decodeURIComponent(previewMatch[1]!)}
        token={session!.token}
        locale={arabic ? 'ar' : 'en'}
        go={go}
      />
    );
  else if (reservationRoute && !sessionReady)
    page = (
      <MemberRouteState
        locale={arabic ? 'ar' : 'en'}
        message={arabic ? 'جارٍ التحقق من حسابك…' : 'Checking your account…'}
      />
    );
  else if (reservationRoute && !session)
    page = (
      <AuthRedirect
        go={go}
        returnTo={`${path}${window.location.search}`}
        locale={arabic ? 'ar' : 'en'}
      />
    );
  else if (reservationRoute && session?.role !== 'MEMBER')
    page = (
      <MemberRouteState
        locale={arabic ? 'ar' : 'en'}
        error
        message={
          arabic
            ? 'حجوزاتي متاحة لحسابات الأعضاء فقط.'
            : 'My Reservations is available to member accounts only.'
        }
      />
    );
  else if (reservationRoute)
    page = (
      <MyReservationsRoute
        path={path}
        token={session!.token}
        locale={arabic ? 'ar' : 'en'}
        go={go}
        onAuthRequired={() => go(loginPath(`${path}${window.location.search}`))}
      />
    );
  else if (memberLoanRoute && !sessionReady)
    page = (
      <MemberRouteState
        locale={arabic ? 'ar' : 'en'}
        message={arabic ? 'جارٍ التحقق من حسابك…' : 'Checking your account…'}
      />
    );
  else if (memberLoanRoute && !session)
    page = (
      <AuthRedirect
        go={go}
        returnTo={`${path}${window.location.search}`}
        locale={arabic ? 'ar' : 'en'}
      />
    );
  else if (memberLoanRoute && session?.role !== 'MEMBER')
    page = (
      <MemberRouteState
        locale={arabic ? 'ar' : 'en'}
        error
        message={
          arabic
            ? 'إعاراتي متاحة لحسابات الأعضاء فقط.'
            : 'My Loans is available to member accounts only.'
        }
        description={
          arabic
            ? 'استخدم حساب عضو للوصول إلى إعارات المكتبة الجامعية.'
            : 'Use a member account to view University Library loans.'
        }
      />
    );
  else if (staffLoanRoute && !canAccessLoanRoute(!!session, session?.role, path))
    page = <LoginGate session={session} setSession={setSession} locale={arabic ? 'ar' : 'en'} />;
  else if (loanRoute)
    page = (
      <LoanRoute
        path={path}
        token={session!.token}
        staff={isStaffLoanRoute(path)}
        locale={arabic ? 'ar' : 'en'}
        go={go}
        notify={setNotice}
        onAuthRequired={() => go(loginPath(`${path}${window.location.search}`))}
      />
    );
  else if (
    librarianDashboardRoute &&
    (!session || (session.role !== 'LIBRARIAN' && session.role !== 'ADMIN'))
  )
    page = <LoginGate session={session} setSession={setSession} locale={arabic ? 'ar' : 'en'} />;
  else if (librarianDashboardRoute)
    page = (
      <LibrarianDashboard
        path={path}
        token={session!.token}
        locale={arabic ? 'ar' : 'en'}
        go={go}
        notify={setNotice}
      />
    );
  else if (management && !canManageRoute(session?.role, path))
    page = <LoginGate session={session} setSession={setSession} locale={arabic ? 'ar' : 'en'} />;
  else if (
    path === '/librarian/books' ||
    path === '/librarian/books/create' ||
    /^\/librarian\/books\/[^/]+\/edit$/.test(path)
  )
    page = (
      <BooksManager
        path={path}
        token={session!.token}
        locale={arabic ? 'ar' : 'en'}
        go={go}
        notify={setNotice}
      />
    );
  else if (
    path === '/librarian/book-copies' ||
    path === '/librarian/book-copies/create' ||
    /^\/librarian\/book-copies\/[^/]+\/edit$/.test(path)
  )
    page = (
      <CopiesManager
        path={path}
        token={session!.token}
        locale={arabic ? 'ar' : 'en'}
        go={go}
        notify={setNotice}
      />
    );
  else if (area) page = <MasterManager area={area} token={session!.token} notify={setNotice} />;
  else if (path === '/faculties' || /^\/faculties\/[^/]+$/.test(path))
    page = (
      <FacultiesPage
        locale={arabic ? 'ar' : 'en'}
        slug={path === '/faculties' ? undefined : path.split('/').at(-1)}
        go={go}
      />
    );
  else if (path.startsWith('/books/'))
    page = (
      <BookDetail
        slug={path.split('/').at(-1) || ''}
        locale={arabic ? 'ar' : 'en'}
        go={go}
        session={session}
        sessionReady={sessionReady}
        onLoginRequired={() => go(loginPath(`${path}${window.location.search}`))}
      />
    );
  else if (path === '/campus') page = <CampusPage locale={arabic ? 'ar' : 'en'} go={go} />;
  else
    page = (
      <PublicCatalog
        locale={arabic ? 'ar' : 'en'}
        go={go}
        showFullCatalog={path !== '/'}
        memberToken={session?.role === 'MEMBER' ? session.token : undefined}
      />
    );
  return (
    <div className="app-shell">
      <PublicHeader
        locale={arabic ? 'ar' : 'en'}
        currentPath={path}
        session={session}
        go={go}
        onLanguageChange={language}
        onSignOut={() => {
          setSession(null);
          void apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      <main>{page}</main>
      {!management && !staffLoanRoute && (
        <AssistantWidget
          locale={arabic ? 'ar' : 'en'}
          accessToken={session?.role === 'MEMBER' ? session.token : undefined}
          go={go}
        />
      )}
    </div>
  );
}

function AuthRedirect({
  go,
  returnTo,
  locale,
}: {
  go: (to: string) => void;
  returnTo: string;
  locale: 'ar' | 'en';
}): JSX.Element {
  useEffect(() => go(loginPath(returnTo)), [go, returnTo]);
  return (
    <MemberRouteState
      locale={locale}
      message={locale === 'ar' ? 'جارٍ فتح تسجيل الدخول…' : 'Opening sign in…'}
    />
  );
}

function MemberRouteState({
  locale,
  message,
  description,
  error = false,
}: {
  locale: 'ar' | 'en';
  message: string;
  description?: string;
  error?: boolean;
}): JSX.Element {
  return (
    <section className="page member-route-state">
      <div className={`state${error ? ' error' : ''}`} role={error ? 'alert' : 'status'}>
        <h1>{message}</h1>
        {!error && <span className="spinner" aria-hidden="true" />}
        {error && (
          <p>
            {description ??
              (locale === 'ar'
                ? 'استخدم حساب عضو للوصول إلى حجوزات المكتبة الجامعية.'
                : 'Use a member account to view University Library reservations.')}
          </p>
        )}
      </div>
    </section>
  );
}

function LoginGate({
  session,
  setSession,
  locale,
  onSuccess,
}: {
  session: Session;
  setSession: (session: Session) => void;
  locale: 'ar' | 'en';
  onSuccess?: () => void;
}): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await apiRequest<{
        accessToken: string;
        user: { role: Role; fullName: string };
      }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setSession({
        token: result.accessToken,
        role: result.user.role,
        fullName: result.user.fullName,
      });
      onSuccess?.();
    } catch (reason) {
      setError(requestMessage(reason));
    } finally {
      setSaving(false);
    }
  };
  if (session?.role === 'MEMBER' && !onSuccess)
    return <AccessDenied message="Member accounts cannot access catalog management." />;
  const labels =
    locale === 'ar'
      ? {
          eyebrow: 'حساب مكتبة جامعة الدلتا',
          title: 'تسجيل الدخول',
          description: 'سجّل دخولك للوصول إلى استعاراتك وحجوزاتك من المكتبة الجامعية.',
          email: 'البريد الإلكتروني',
          password: 'كلمة المرور',
          submit: 'تسجيل الدخول',
          saving: 'جارٍ تسجيل الدخول…',
        }
      : {
          eyebrow: 'Delta University Library account',
          title: 'Sign in',
          description: 'Sign in to access your loans and University Library reservations.',
          email: 'Email',
          password: 'Password',
          submit: 'Sign in',
          saving: 'Signing in…',
        };
  return (
    <section className="page member-login-page">
      <div className="member-login-card">
        <div className="member-login-brand" aria-hidden="true">
          <span>DELTA UNIVERSITY</span>
          <b>{locale === 'ar' ? 'المكتبة الجامعية' : 'UNIVERSITY LIBRARY'}</b>
        </div>
        <p className="member-login-eyebrow">{labels.eyebrow}</p>
        <h1>{labels.title}</h1>
        <p className="member-login-description">{labels.description}</p>
        <form className="stack" onSubmit={(event) => void submit(event)}>
          <Field label={labels.email}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </Field>
          <Field label={labels.password}>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="member-login-submit" disabled={saving}>
            {saving ? labels.saving : labels.submit}
          </button>
        </form>
      </div>
    </section>
  );
}

function BooksManager({
  path,
  token,
  locale,
  go,
  notify,
}: {
  path: string;
  token: string;
  locale: 'ar' | 'en';
  go: (to: string) => void;
  notify: (message: string) => void;
}): JSX.Element {
  const editing = /^\/librarian\/books\/[^/]+\/edit$/.test(path);
  const creating = path.endsWith('/create');
  const id = editing ? path.split('/')[3]! : '';
  if (creating || editing)
    return <BookForm id={id} token={token} locale={locale} go={go} notify={notify} />;
  return <BooksTable token={token} locale={locale} go={go} notify={notify} />;
}

function BooksTable({
  token,
  locale,
  go,
  notify,
}: {
  token: string;
  locale: 'ar' | 'en';
  go: (to: string) => void;
  notify: (message: string) => void;
}): JSX.Element {
  const [data, setData] = useState<CatalogResult | null>(null);
  const [query, setQuery] = useState('');
  const [archiveState, setArchiveState] = useState<'active' | 'archived' | 'all'>('active');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<Book | null>(null);
  const load = useCallback(
    async (q = '', page = 1, state = archiveState) => {
      setError('');
      try {
        setData(
          await apiRequest<CatalogResult>(managementListQuery('/books', q, page, state), {}, token),
        );
      } catch (reason) {
        setError(requestMessage(reason));
      }
    },
    [archiveState, token],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const archive = async () => {
    if (!confirm) return;
    try {
      await apiRequest(`/books/${confirm.id}/archive`, { method: 'POST' }, token);
      notify(locale === 'ar' ? `تمت أرشفة “${confirm.title}”.` : `“${confirm.title}” archived.`);
      setConfirm(null);
      await load(query, data?.page, archiveState);
    } catch (reason) {
      setError(requestMessage(reason));
    }
  };
  return (
    <ManagementPage
      locale={locale}
      go={go}
      activePath="/librarian/books"
      title={locale === 'ar' ? 'الكتب' : 'Books'}
      description={
        locale === 'ar'
          ? 'أضف سجلات الكتب ونظّم محتوى الكتالوج.'
          : 'Create, update, and archive catalog records.'
      }
      action={
        <button className="button primary" onClick={() => go('/librarian/books/create')}>
          <span aria-hidden="true">＋</span> {locale === 'ar' ? 'إضافة كتاب' : 'Add book'}
        </button>
      }
    >
      <div className="filter-row">
        <Search
          value={query}
          onChange={setQuery}
          onSearch={() => void load(query)}
          locale={locale}
        />
        <ArchiveFilter
          value={archiveState}
          change={(state) => {
            setArchiveState(state);
            void load(query, 1, state);
          }}
          locale={locale}
        />
      </div>
      {!data && !error ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={() => void load(query)} />
      ) : !data?.items.length ? (
        <EmptyState
          title="No books found"
          action={
            <button className="button primary" onClick={() => go('/librarian/books/create')}>
              <span aria-hidden="true">＋</span> {locale === 'ar' ? 'إضافة كتاب' : 'Add book'}
            </button>
          }
        />
      ) : (
        <>
          <Table
            headers={
              locale === 'ar'
                ? ['الكتاب', 'المؤلفون', 'التوفر', 'الإجراءات']
                : ['Book', 'Authors', 'Availability', 'Actions']
            }
          >
            {data.items.map((book) => (
              <tr key={book.id}>
                <td>
                  <div className="management-book-cell">
                    <span className="management-book-cell__cover">
                      <BookCoverMedia
                        url={book.coverImageUrl}
                        title={locale === 'ar' ? book.titleAr || book.title : book.title}
                        author={book.authors[0]?.author.name || ''}
                        coverLabel={`${locale === 'ar' ? 'غلاف' : 'Cover of'} ${book.title}`}
                        noCoverLabel={locale === 'ar' ? 'لا يوجد غلاف' : 'No cover available'}
                        variantKey={book.id}
                      />
                    </span>
                    <span className="management-book-cell__details">
                      <strong dir="auto">
                        {locale === 'ar' ? book.titleAr || book.title : book.title}
                      </strong>
                      <span className="muted">
                        {book.category?.nameAr && locale === 'ar'
                          ? book.category.nameAr
                          : book.category?.nameEn ||
                            (locale === 'ar' ? 'غير مصنف' : 'Uncategorized')}
                      </span>
                      <span className="metadata-ltr">
                        {book.isbn13 || (locale === 'ar' ? 'بدون ISBN' : 'No ISBN')}
                      </span>
                    </span>
                  </div>
                </td>
                <td dir="auto">
                  {book.authors
                    .map(({ author }) =>
                      locale === 'ar' ? author.nameAr || author.name : author.name,
                    )
                    .join(locale === 'ar' ? '، ' : ', ') ||
                    (locale === 'ar' ? 'غير مذكور' : 'Not listed')}
                </td>
                <td>
                  <Badge
                    value={
                      locale === 'ar'
                        ? `${book.availableCopies} من ${book.totalCopies} متاح`
                        : `${book.availableCopies}/${book.totalCopies} available`
                    }
                    tone="success"
                  />
                </td>
                <td className="row-actions">
                  {book.isArchived ? (
                    <button
                      className="button quiet"
                      onClick={() =>
                        void apiRequest(`/books/${book.id}/restore`, { method: 'POST' }, token)
                          .then(async () => {
                            notify(
                              locale === 'ar'
                                ? `تمت استعادة “${book.title}”.`
                                : `“${book.title}” restored.`,
                            );
                            await load(query, data?.page, archiveState);
                          })
                          .catch((reason: unknown) => setError(requestMessage(reason)))
                      }
                    >
                      {locale === 'ar' ? 'استعادة' : 'Restore'}
                    </button>
                  ) : (
                    <>
                      <button
                        className="button quiet"
                        onClick={() => go(`/librarian/books/${book.id}/edit`)}
                      >
                        {locale === 'ar' ? 'تعديل' : 'Edit'}
                      </button>
                      <button className="button danger" onClick={() => setConfirm(book)}>
                        {locale === 'ar' ? 'أرشفة' : 'Archive'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={data.page}
            pages={data.totalPages}
            change={(page) => void load(query, page)}
          />
        </>
      )}
      {confirm && (
        <ConfirmDialog
          title={locale === 'ar' ? 'أرشفة الكتاب؟' : 'Archive book?'}
          message={
            locale === 'ar'
              ? `سيختفي “${confirm.title}” من الكتالوج النشط، ويمكن استعادته لاحقًا.`
              : `This hides “${confirm.title}” from the active catalog. You can restore it during this session.`
          }
          confirm={locale === 'ar' ? 'أرشفة' : 'Archive'}
          onConfirm={() => void archive()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </ManagementPage>
  );
}

function BookForm({
  id,
  token,
  locale,
  go,
  notify,
}: {
  id: string;
  token: string;
  locale: 'ar' | 'en';
  go: (to: string) => void;
  notify: (message: string) => void;
}): JSX.Element {
  const [masters, setMasters] = useState<{
    categories: Category[];
    authors: Author[];
    publishers: Publisher[];
  } | null>(null);
  const [book, setBook] = useState({
    title: '',
    titleAr: '',
    slug: '',
    categoryId: '',
    publisherId: '',
    authorIds: [] as string[],
    isbn13: '',
    description: '',
    language: 'en',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewMetadata>({
    available: false,
    url: null,
    originalName: null,
    size: null,
    updatedAt: null,
  });
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void Promise.all([
      apiRequest<Category[]>('/categories'),
      apiRequest<Author[]>('/authors'),
      apiRequest<Publisher[]>('/publishers'),
    ])
      .then(([categories, authors, publishers]) => setMasters({ categories, authors, publishers }))
      .catch((reason: unknown) => setMessage(requestMessage(reason)));
    if (id)
      void apiRequest<Book>(`/books/${id}`)
        .then((item) => {
          setBook({
            title: item.title,
            titleAr: item.titleAr || '',
            slug: item.slug,
            categoryId: item.categoryId,
            publisherId: item.publisherId || '',
            authorIds: item.authors.map(({ author }) => author.id),
            isbn13: item.isbn13 || '',
            description: item.description || '',
            language: item.language,
          });
          setCoverUrl(item.coverImageUrl || null);
          if (item.preview) setPreview(item.preview);
        })
        .catch((reason: unknown) => setMessage(requestMessage(reason)));
  }, [id, token]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateBookForm(book);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...book,
        publisherId: book.publisherId || undefined,
        titleAr: book.titleAr || undefined,
        isbn13: book.isbn13 || undefined,
        description: book.description || undefined,
      };
      const saved = await apiRequest<Book>(
        id ? `/books/${id}` : '/books',
        { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
        token,
      );
      if (coverFile) {
        const uploadedCover = await apiUpload<{ coverImageUrl: string }>(
          `/books/${saved.id}/cover`,
          coverFile,
          token,
        );
        setCoverUrl(uploadedCover.coverImageUrl);
        setCoverFile(null);
      }
      if (previewFile) {
        const uploaded = await apiUpload<PreviewMetadata>(
          `/books/${saved.id}/preview-pdf`,
          previewFile,
          token,
        );
        setPreview(uploaded);
        setPreviewFile(null);
      }
      notify(
        id
          ? locale === 'ar'
            ? 'تم تحديث بيانات الكتاب.'
            : 'Book updated.'
          : locale === 'ar'
            ? 'تمت إضافة الكتاب بنجاح.'
            : 'Book created.',
      );
      go('/librarian/books');
    } catch (reason) {
      setMessage(requestMessage(reason));
    } finally {
      setSaving(false);
    }
  };
  if (!masters)
    return (
      <section className="page">
        <Loading />
      </section>
    );
  return (
    <ManagementPage
      locale={locale}
      go={go}
      activePath="/librarian/books"
      title={id ? 'Edit book' : 'Create book'}
      description={
        locale === 'ar'
          ? 'أدخل البيانات الأساسية للكتاب ثم احفظ التغييرات.'
          : 'Required fields are marked clearly. Authors can be selected together.'
      }
    >
      <form className="form-grid librarian-form" onSubmit={(event) => void submit(event)}>
        <section className="form-section">
          <div className="form-section__heading">
            <span className="form-section__icon">
              <PublicIcon name="book" />
            </span>
            <div>
              <p className="form-section__eyebrow">
                {locale === 'ar' ? 'بيانات الكتالوج' : 'Catalog record'}
              </p>
              <h2>{locale === 'ar' ? 'معلومات الكتاب' : 'Book information'}</h2>
              <p>
                {locale === 'ar'
                  ? 'العنوان والمؤلف والتصنيف الذي يظهر للقراء.'
                  : 'Title, authors, and classification shown to readers.'}
              </p>
            </div>
          </div>
          <div className="form-section__grid">
            <Field label={locale === 'ar' ? 'العنوان' : 'Title'} error={errors.title}>
              <input
                value={book.title}
                onChange={(event) => setBook({ ...book, title: event.target.value })}
                required
              />
            </Field>
            <Field label={locale === 'ar' ? 'العنوان بالعربية' : 'Arabic title'}>
              <input
                value={book.titleAr}
                onChange={(event) => setBook({ ...book, titleAr: event.target.value })}
              />
            </Field>
            <Field label={locale === 'ar' ? 'المعرّف المختصر' : 'Slug'} error={errors.slug}>
              <input
                value={book.slug}
                onChange={(event) => setBook({ ...book, slug: event.target.value })}
                required
              />
            </Field>
            <Field label="ISBN-13">
              <input
                value={book.isbn13}
                onChange={(event) => setBook({ ...book, isbn13: event.target.value })}
              />
            </Field>
            <Field label={locale === 'ar' ? 'التصنيف' : 'Category'} error={errors.categoryId}>
              <select
                value={book.categoryId}
                onChange={(event) => setBook({ ...book, categoryId: event.target.value })}
              >
                <option value="">{locale === 'ar' ? 'اختر التصنيف' : 'Choose category'}</option>
                {masters.categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nameEn}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={locale === 'ar' ? 'الناشر' : 'Publisher'}>
              <select
                value={book.publisherId}
                onChange={(event) => setBook({ ...book, publisherId: event.target.value })}
              >
                <option value="">{locale === 'ar' ? 'بدون ناشر' : 'No publisher'}</option>
                {masters.publishers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={locale === 'ar' ? 'لغة الكتاب' : 'Language'}>
              <select
                value={book.language}
                onChange={(event) => setBook({ ...book, language: event.target.value })}
              >
                <option value="en">{locale === 'ar' ? 'الإنجليزية' : 'English'}</option>
                <option value="ar">{locale === 'ar' ? 'العربية' : 'Arabic'}</option>
              </select>
            </Field>
            <Field label={locale === 'ar' ? 'المؤلفون' : 'Authors'} error={errors.authorIds}>
              <select
                multiple
                value={book.authorIds}
                onChange={(event) =>
                  setBook({
                    ...book,
                    authorIds: Array.from(event.target.selectedOptions, (option) => option.value),
                  })
                }
              >
                {masters.authors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <span className="hint">
                {locale === 'ar'
                  ? 'يمكن اختيار أكثر من مؤلف باستخدام Ctrl/Cmd.'
                  : 'Use Ctrl/Cmd to select more than one author.'}
              </span>
            </Field>
          </div>
        </section>
        <section className="form-section">
          <div className="form-section__heading">
            <span className="form-section__icon form-section__icon--accent">Aa</span>
            <div>
              <p className="form-section__eyebrow">
                {locale === 'ar' ? 'المظهر والمحتوى' : 'Content & media'}
              </p>
              <h2>{locale === 'ar' ? 'الوصف والغلاف' : 'Description & cover'}</h2>
              <p>
                {locale === 'ar'
                  ? 'أضف وصفًا واضحًا وغلافًا مناسبًا للعرض.'
                  : 'Add a clear description and a portrait cover.'}
              </p>
            </div>
          </div>
          <div className="form-section__grid">
            <Field label={locale === 'ar' ? 'الوصف' : 'Description'} wide>
              <textarea
                value={book.description}
                onChange={(event) => setBook({ ...book, description: event.target.value })}
              />
            </Field>
            <Field label={locale === 'ar' ? 'غلاف الكتاب' : 'Book cover'}>
              <div className="cover-upload-control">
                {coverUrl && (
                  <img
                    className="management-cover-preview"
                    src={coverUrl}
                    alt={locale === 'ar' ? 'الغلاف الحالي' : 'Current book cover'}
                  />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={locale === 'ar' ? 'اختر غلاف الكتاب' : 'Choose book cover'}
                  onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
                />
                <span className="hint">
                  {coverFile
                    ? coverFile.name
                    : locale === 'ar'
                      ? 'JPG أو PNG أو WebP، بحد أقصى 5 ميجابايت'
                      : 'JPG, PNG, or WebP, up to 5 MB'}
                </span>
              </div>
            </Field>
          </div>
        </section>
        <BookPreviewField
          locale={locale}
          bookId={id || undefined}
          slug={book.slug || undefined}
          token={token}
          preview={preview}
          selected={previewFile}
          onSelect={setPreviewFile}
          onRemoved={() => {
            setPreview({
              available: false,
              url: null,
              originalName: null,
              size: null,
              updatedAt: null,
            });
            notify(locale === 'ar' ? 'تم حذف ملف المعاينة.' : 'Preview PDF removed.');
          }}
          go={go}
        />
        {message && (
          <p className="field-error" role="alert">
            {message}
          </p>
        )}
        <div className="form-actions">
          <button className="button quiet" type="button" onClick={() => go('/librarian/books')}>
            {locale === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button className="button primary" disabled={saving}>
            {saving
              ? locale === 'ar'
                ? 'جارٍ الحفظ…'
                : 'Saving…'
              : locale === 'ar'
                ? 'حفظ الكتاب'
                : 'Save book'}
          </button>
        </div>
      </form>
    </ManagementPage>
  );
}

function CopiesManager({
  path,
  token,
  locale,
  go,
  notify,
}: {
  path: string;
  token: string;
  locale: 'ar' | 'en';
  go: (to: string) => void;
  notify: (message: string) => void;
}): JSX.Element {
  const editing = /^\/librarian\/book-copies\/[^/]+\/edit$/.test(path);
  const creating = path.endsWith('/create');
  const id = editing ? path.split('/')[3]! : '';
  if (creating || editing)
    return <CopyForm id={id} token={token} locale={locale} go={go} notify={notify} />;
  return <CopiesTable token={token} locale={locale} go={go} notify={notify} />;
}

async function loadCopies(
  token: string,
  query = '',
  page = 1,
  archiveState: 'active' | 'archived' | 'all' = 'active',
): Promise<CopyResult> {
  return apiRequest<CopyResult>(
    managementListQuery('/book-copies', query, page, archiveState),
    {},
    token,
  );
}

function CopiesTable({
  token,
  locale,
  go,
  notify,
}: {
  token: string;
  locale: 'ar' | 'en';
  go: (to: string) => void;
  notify: (message: string) => void;
}): JSX.Element {
  const [data, setData] = useState<CopyResult | null>(null);
  const [query, setQuery] = useState('');
  const [archiveState, setArchiveState] = useState<'active' | 'archived' | 'all'>('active');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<Copy | null>(null);
  const load = useCallback(
    async (q = query, page = 1, state = archiveState) => {
      setError('');
      try {
        setData(await loadCopies(token, q, page, state));
      } catch (reason) {
        setError(requestMessage(reason));
      }
    },
    [archiveState, query, token],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const archive = async () => {
    if (!confirm) return;
    try {
      await apiRequest(`/book-copies/${confirm.id}/archive`, { method: 'POST' }, token);
      notify(
        locale === 'ar' ? `تمت أرشفة النسخة ${confirm.copyCode}.` : `${confirm.copyCode} archived.`,
      );
      setConfirm(null);
      await load();
    } catch (reason) {
      setError(requestMessage(reason));
    }
  };
  return (
    <ManagementPage
      locale={locale}
      go={go}
      activePath="/librarian/book-copies"
      title={locale === 'ar' ? 'النسخ والمقتنيات' : 'Book copies'}
      description={
        locale === 'ar'
          ? 'تابع كل نسخة وموقعها وحالتها داخل المكتبة.'
          : 'Track each physical copy, its location, condition, and availability.'
      }
      action={
        <button className="button primary" onClick={() => go('/librarian/book-copies/create')}>
          <span aria-hidden="true">＋</span> {locale === 'ar' ? 'إضافة نسخة' : 'Add copy'}
        </button>
      }
    >
      <div className="filter-row">
        <Search
          value={query}
          onChange={setQuery}
          onSearch={() => void load(query, 1)}
          locale={locale}
        />
        <ArchiveFilter
          value={archiveState}
          change={(state) => {
            setArchiveState(state);
            void load(query, 1, state);
          }}
          locale={locale}
        />
      </div>
      {!data && !error ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : !data?.items.length ? (
        <EmptyState
          title={locale === 'ar' ? 'لم تتم إضافة نسخ بعد' : 'No book copies found'}
          action={
            <button className="button primary" onClick={() => go('/librarian/book-copies/create')}>
              <span aria-hidden="true">＋</span> {locale === 'ar' ? 'إضافة نسخة' : 'Add copy'}
            </button>
          }
        />
      ) : (
        <>
          <Table
            headers={
              locale === 'ar'
                ? ['النسخة', 'الكتاب', 'الموقع', 'الحالة', 'الإجراءات']
                : ['Copy', 'Book', 'Location', 'Status', 'Actions']
            }
          >
            {data.items.map((copy) => (
              <tr key={copy.id}>
                <td>
                  <strong>{copy.copyCode}</strong>
                  <br />
                  <span className="muted metadata-ltr">
                    {copy.barcode || (locale === 'ar' ? 'بدون باركود' : 'No barcode')}
                  </span>
                </td>
                <td>{copy.book?.title}</td>
                <td>
                  <span className="metadata-ltr">
                    {copy.section?.code || copy.sectionId} / {copy.shelf?.code || copy.shelfId}
                  </span>
                </td>
                <td>
                  {copy.isArchived ? (
                    <Badge value={locale === 'ar' ? 'مؤرشف' : 'Archived'} tone="warning" />
                  ) : (
                    <StatusSelect
                      copy={copy}
                      locale={locale}
                      token={token}
                      done={async () => {
                        notify(locale === 'ar' ? 'تم تحديث حالة النسخة.' : 'Copy status updated.');
                        await load();
                      }}
                      fail={setError}
                    />
                  )}
                </td>
                <td className="row-actions">
                  {copy.isArchived ? (
                    <button
                      className="button quiet"
                      onClick={() =>
                        void apiRequest(
                          `/book-copies/${copy.id}/restore`,
                          { method: 'POST' },
                          token,
                        )
                          .then(async () => {
                            notify(
                              locale === 'ar'
                                ? `تمت استعادة النسخة ${copy.copyCode}.`
                                : `${copy.copyCode} restored.`,
                            );
                            await load();
                          })
                          .catch((reason: unknown) => setError(requestMessage(reason)))
                      }
                    >
                      {locale === 'ar' ? 'استعادة' : 'Restore'}
                    </button>
                  ) : (
                    <>
                      <button
                        className="button quiet"
                        onClick={() => go(`/librarian/book-copies/${copy.id}/edit`)}
                      >
                        {locale === 'ar' ? 'تعديل' : 'Edit'}
                      </button>
                      <button className="button danger" onClick={() => setConfirm(copy)}>
                        {locale === 'ar' ? 'أرشفة' : 'Archive'}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={data.page}
            pages={data.totalPages}
            change={(page) => void load(query, page)}
          />
        </>
      )}
      {confirm && (
        <ConfirmDialog
          title={locale === 'ar' ? 'أرشفة نسخة الكتاب؟' : 'Archive book copy?'}
          message={
            locale === 'ar'
              ? `ستُستبعد النسخة ${confirm.copyCode} من عدد النسخ المتاحة.`
              : `This removes ${confirm.copyCode} from availability counts.`
          }
          confirm={locale === 'ar' ? 'أرشفة' : 'Archive'}
          onConfirm={() => void archive()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </ManagementPage>
  );
}

function StatusSelect({
  copy,
  locale,
  token,
  done,
  fail,
}: {
  copy: Copy;
  locale: 'ar' | 'en';
  token: string;
  done: () => Promise<void>;
  fail: (message: string) => void;
}): JSX.Element {
  const [saving, setSaving] = useState(false);
  const change = async (status: CopyStatus) => {
    setSaving(true);
    try {
      await apiRequest(
        `/book-copies/${copy.id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
        token,
      );
      await done();
    } catch (reason) {
      fail(requestMessage(reason));
    } finally {
      setSaving(false);
    }
  };
  return (
    <label className="inline-control">
      <span className="sr-only">Copy status</span>
      <select
        value={copy.status}
        disabled={saving}
        onChange={(event) => void change(event.target.value as CopyStatus)}
      >
        {statuses.map((status) => (
          <option value={status} key={status}>
            {copyStatusLabel(status, locale)}
          </option>
        ))}
      </select>
    </label>
  );
}

function copyStatusLabel(status: CopyStatus, locale: 'ar' | 'en'): string {
  if (locale === 'ar') {
    return (
      {
        AVAILABLE: 'متاح',
        BORROWED: 'مُعار',
        RESERVED: 'محجوز',
        LOST: 'مفقود',
        DAMAGED: 'تالف',
        MAINTENANCE: 'قيد الصيانة',
        ARCHIVED: 'مؤرشف',
      } satisfies Record<CopyStatus, string>
    )[status];
  }
  return status === 'AVAILABLE'
    ? 'Available'
    : status === 'BORROWED'
      ? 'Borrowed'
      : status === 'RESERVED'
        ? 'Reserved'
        : status === 'LOST'
          ? 'Lost'
          : status === 'DAMAGED'
            ? 'Damaged'
            : status === 'MAINTENANCE'
              ? 'Maintenance'
              : 'Archived';
}

function copyConditionLabel(condition: CopyCondition, locale: 'ar' | 'en'): string {
  if (locale === 'ar') {
    return (
      {
        NEW: 'جديدة',
        GOOD: 'جيدة',
        FAIR: 'مقبولة',
        POOR: 'ضعيفة',
        DAMAGED: 'تالف',
      } satisfies Record<CopyCondition, string>
    )[condition];
  }
  return condition === 'NEW'
    ? 'New'
    : condition === 'GOOD'
      ? 'Good'
      : condition === 'FAIR'
        ? 'Fair'
        : condition === 'POOR'
          ? 'Poor'
          : 'Damaged';
}

function CopyForm({
  id,
  token,
  locale,
  go,
  notify,
}: {
  id: string;
  token: string;
  locale: 'ar' | 'en';
  go: (to: string) => void;
  notify: (message: string) => void;
}): JSX.Element {
  const [masters, setMasters] = useState<{
    books: Book[];
    sections: Section[];
    shelves: Shelf[];
  } | null>(null);
  const [copy, setCopy] = useState({
    bookId: '',
    sectionId: '',
    shelfId: '',
    copyCode: '',
    barcode: '',
    status: 'AVAILABLE' as CopyStatus,
    condition: 'GOOD' as CopyCondition,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void Promise.all([
      apiRequest<CatalogResult>('/books?limit=50&page=1'),
      apiRequest<Section[]>('/sections'),
      apiRequest<Shelf[]>('/shelves'),
    ])
      .then(([books, sections, shelves]) => setMasters({ books: books.items, sections, shelves }))
      .catch((reason: unknown) => setMessage(requestMessage(reason)));
    if (id)
      void apiRequest<Copy>(`/book-copies/${id}`, {}, token)
        .then((item) => {
          setCopy({
            bookId: item.bookId || item.book?.id || '',
            sectionId: item.sectionId,
            shelfId: item.shelfId,
            copyCode: item.copyCode,
            barcode: item.barcode || '',
            status: item.status,
            condition: item.condition,
          });
        })
        .catch((reason: unknown) => setMessage(requestMessage(reason)));
  }, [id, token]);
  const options = masters ? shelvesForSection(masters.shelves, copy.sectionId) : [];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateCopyForm(copy);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...copy,
        copyCode: copy.copyCode || undefined,
        barcode: copy.barcode || undefined,
      };
      await apiRequest(
        id ? `/book-copies/${id}` : '/book-copies',
        { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
        token,
      );
      notify(id ? 'Book copy updated.' : 'Book copy created.');
      go('/librarian/book-copies');
    } catch (reason) {
      setMessage(requestMessage(reason));
    } finally {
      setSaving(false);
    }
  };
  if (!masters)
    return (
      <section className="page">
        <Loading />
      </section>
    );
  return (
    <ManagementPage
      locale={locale}
      go={go}
      activePath="/librarian/book-copies"
      title={id ? 'Edit book copy' : 'Create book copy'}
      description={
        locale === 'ar'
          ? 'اربط النسخة بموقع فعلي داخل المكتبة وحدد حالتها.'
          : 'A shelf is always selected from the chosen section.'
      }
    >
      <form className="form-grid librarian-form" onSubmit={(event) => void submit(event)}>
        <section className="form-section">
          <div className="form-section__heading">
            <span className="form-section__icon">
              <PublicIcon name="book" />
            </span>
            <div>
              <p className="form-section__eyebrow">
                {locale === 'ar' ? 'مقتنيات المكتبة' : 'Library inventory'}
              </p>
              <h2>{locale === 'ar' ? 'موقع النسخة' : 'Copy location'}</h2>
              <p>
                {locale === 'ar'
                  ? 'اختر الكتاب والقسم والرف بدقة.'
                  : 'Choose the book, section, and shelf precisely.'}
              </p>
            </div>
          </div>
          <div className="form-section__grid">
            <Field label={locale === 'ar' ? 'الكتاب' : 'Book'} error={errors.bookId}>
              <select
                disabled={!!id}
                value={copy.bookId}
                onChange={(event) => setCopy({ ...copy, bookId: event.target.value })}
              >
                <option value="">{locale === 'ar' ? 'اختر الكتاب' : 'Choose book'}</option>
                {masters.books.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={locale === 'ar' ? 'القسم' : 'Section'} error={errors.sectionId}>
              <select
                value={copy.sectionId}
                onChange={(event) =>
                  setCopy({ ...copy, sectionId: event.target.value, shelfId: '' })
                }
              >
                <option value="">{locale === 'ar' ? 'اختر القسم' : 'Choose section'}</option>
                {masters.sections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.nameEn}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={locale === 'ar' ? 'الرف' : 'Shelf'} error={errors.shelfId}>
              <select
                value={copy.shelfId}
                disabled={!copy.sectionId}
                onChange={(event) => setCopy({ ...copy, shelfId: event.target.value })}
              >
                <option value="">{locale === 'ar' ? 'اختر الرف' : 'Choose shelf'}</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.nameEn}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
        <section className="form-section">
          <div className="form-section__heading">
            <span className="form-section__icon form-section__icon--accent">
              <PublicIcon name="categories" />
            </span>
            <div>
              <p className="form-section__eyebrow">
                {locale === 'ar' ? 'التعريف والحالة' : 'Identification & status'}
              </p>
              <h2>{locale === 'ar' ? 'بيانات النسخة' : 'Copy details'}</h2>
              <p>
                {locale === 'ar'
                  ? 'استخدم رموزًا واضحة ليسهل العثور على النسخة.'
                  : 'Use clear identifiers so the copy is easy to find.'}
              </p>
            </div>
          </div>
          <div className="form-section__grid">
            <Field label={locale === 'ar' ? 'رمز النسخة' : 'Copy code'}>
              <input
                value={copy.copyCode}
                disabled={!!id}
                onChange={(event) => setCopy({ ...copy, copyCode: event.target.value })}
              />
            </Field>
            <Field label={locale === 'ar' ? 'الباركود' : 'Barcode'}>
              <input
                value={copy.barcode}
                onChange={(event) => setCopy({ ...copy, barcode: event.target.value })}
              />
            </Field>
            <Field label={locale === 'ar' ? 'الحالة' : 'Status'}>
              <select
                value={copy.status}
                onChange={(event) => setCopy({ ...copy, status: event.target.value as CopyStatus })}
              >
                {statuses.map((item) => (
                  <option value={item} key={item}>
                    {copyStatusLabel(item, locale)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={locale === 'ar' ? 'حالة النسخة' : 'Condition'}>
              <select
                value={copy.condition}
                onChange={(event) =>
                  setCopy({ ...copy, condition: event.target.value as CopyCondition })
                }
              >
                {conditions.map((item) => (
                  <option value={item} key={item}>
                    {copyConditionLabel(item, locale)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
        {message && (
          <p className="field-error" role="alert">
            {message}
          </p>
        )}
        <div className="form-actions">
          <button
            className="button quiet"
            type="button"
            onClick={() => go('/librarian/book-copies')}
          >
            {locale === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button className="button primary" disabled={saving}>
            {saving
              ? locale === 'ar'
                ? 'جارٍ الحفظ…'
                : 'Saving…'
              : locale === 'ar'
                ? 'حفظ النسخة'
                : 'Save copy'}
          </button>
        </div>
      </form>
    </ManagementPage>
  );
}

type MasterItem = Category | Author | Publisher | Section | Shelf;
const masterConfig: Record<
  Exclude<ManagementArea, 'books' | 'book-copies'>,
  { title: string; path: string; fields: string[] }
> = {
  categories: { title: 'Categories', path: '/categories', fields: ['nameEn', 'nameAr', 'slug'] },
  authors: { title: 'Authors', path: '/authors', fields: ['name', 'nameAr'] },
  publishers: { title: 'Publishers', path: '/publishers', fields: ['name', 'nameAr', 'website'] },
  locations: {
    title: 'Library sections',
    path: '/sections',
    fields: ['nameEn', 'nameAr', 'code', 'floor', 'room'],
  },
  shelves: {
    title: 'Shelves',
    path: '/shelves',
    fields: ['sectionId', 'code', 'nameEn', 'nameAr'],
  },
};

function MasterManager({
  area,
  token,
  notify,
}: {
  area: ManagementArea;
  token: string;
  notify: (message: string) => void;
}): JSX.Element {
  const config = masterConfig[area as Exclude<ManagementArea, 'books' | 'book-copies'>];
  const [items, setItems] = useState<MasterItem[] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const [confirm, setConfirm] = useState<MasterItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try {
      const result = await apiRequest<MasterItem[]>(`${config.path}?includeArchived=true`);
      setItems(result);
      if (area === 'shelves') setSections(await apiRequest<Section[]>('/sections'));
    } catch (reason) {
      setError(requestMessage(reason));
    }
  }, [area, config.path]);
  useEffect(() => {
    void load();
  }, [load]);
  const archive = async () => {
    if (!confirm) return;
    try {
      await apiRequest(`${config.path}/${confirm.id}/archive`, { method: 'POST' }, token);
      notify(`${config.title.slice(0, -1)} archived.`);
      setConfirm(null);
      await load();
    } catch (reason) {
      setError(requestMessage(reason));
    }
  };
  const restore = async (item: MasterItem) => {
    try {
      await apiRequest(`${config.path}/${item.id}/restore`, { method: 'POST' }, token);
      notify(`${config.title.slice(0, -1)} restored.`);
      await load();
    } catch (reason) {
      setError(requestMessage(reason));
    }
  };
  const filtered = (items || []).filter((item) =>
    JSON.stringify(item).toLowerCase().includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const visible = pageSlice(filtered, Math.min(page, pages));
  return (
    <ManagementPage
      title={config.title}
      description={`Create, edit, archive, and restore ${config.title.toLowerCase()}.`}
      action={
        <button
          className="button primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          Add {config.title.slice(0, -1)}
        </button>
      }
    >
      <Search
        value={query}
        onChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onSearch={() => undefined}
      />
      {!items && !error ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : !filtered.length ? (
        <EmptyState
          title={`No ${config.title.toLowerCase()} found`}
          action={
            <button className="button primary" onClick={() => setShowForm(true)}>
              Add {config.title.slice(0, -1)}
            </button>
          }
        />
      ) : (
        <>
          <Table headers={['Name', 'Code / details', 'Status', 'Actions']}>
            {visible.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{displayName(item)}</strong>
                  <br />
                  <span className="muted">{displayArabic(item)}</span>
                </td>
                <td>{displayDetail(item)}</td>
                <td>
                  <Badge
                    value={item.isArchived ? 'Archived' : 'Active'}
                    tone={item.isArchived ? 'warning' : 'success'}
                  />
                </td>
                <td className="row-actions">
                  {item.isArchived ? (
                    <button className="button quiet" onClick={() => void restore(item)}>
                      Restore
                    </button>
                  ) : (
                    <>
                      <button
                        className="button quiet"
                        onClick={() => {
                          setEditing(item);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </button>
                      <button className="button danger" onClick={() => setConfirm(item)}>
                        Archive
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={Math.min(page, pages)} pages={pages} change={setPage} />
        </>
      )}
      {showForm && (
        <MasterForm
          config={config}
          initial={editing}
          sections={sections}
          token={token}
          close={() => {
            setShowForm(false);
            setEditing(null);
          }}
          done={async (text) => {
            notify(text);
            await load();
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={`Archive ${config.title.slice(0, -1)}?`}
          message="This record will be hidden from active selection lists. You can restore it later."
          confirm="Archive"
          onConfirm={() => void archive()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </ManagementPage>
  );
}

function MasterForm({
  config,
  initial,
  sections,
  token,
  close,
  done,
}: {
  config: { title: string; path: string; fields: string[] };
  initial: MasterItem | null;
  sections: Section[];
  token: string;
  close: () => void;
  done: (message: string) => Promise<void>;
}): JSX.Element {
  const initialValues = Object.fromEntries(
    config.fields.map((field) => [
      field,
      initial && field in initial ? String(initial[field as keyof MasterItem] ?? '') : '',
    ]),
  ) as Record<string, string>;
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      config.fields.some(
        (field) => !['nameAr', 'website', 'room'].includes(field) && !values[field]?.trim(),
      )
    ) {
      setError('Complete all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiRequest(
        initial ? `${config.path}/${initial.id}` : config.path,
        { method: initial ? 'PATCH' : 'POST', body: JSON.stringify(values) },
        token,
      );
      await done(
        initial ? `${config.title.slice(0, -1)} updated.` : `${config.title.slice(0, -1)} created.`,
      );
      close();
    } catch (reason) {
      setError(requestMessage(reason));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-form-title"
      >
        <div className="modal-heading">
          <h2 id="master-form-title">
            {initial ? 'Edit' : 'Add'} {config.title.slice(0, -1)}
          </h2>
          <button className="text-button" onClick={close}>
            Close
          </button>
        </div>
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          {config.fields.map((field) => (
            <Field key={field} label={fieldLabel(field)}>
              {field === 'sectionId' ? (
                <select
                  value={values[field]}
                  onChange={(event) => setValues({ ...values, [field]: event.target.value })}
                >
                  <option value="">Choose section</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.code} — {section.nameEn}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={values[field]}
                  type={field === 'website' ? 'url' : 'text'}
                  onChange={(event) => setValues({ ...values, [field]: event.target.value })}
                />
              )}
            </Field>
          ))}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button quiet" type="button" onClick={close}>
              Cancel
            </button>
            <button className="button primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function displayName(item: MasterItem): string {
  return 'nameEn' in item ? item.nameEn : item.name;
}
function displayArabic(item: MasterItem): string {
  return 'nameAr' in item ? item.nameAr || '' : '';
}
function displayDetail(item: MasterItem): string {
  if ('slug' in item) return item.slug;
  if ('code' in item) return item.code;
  if ('website' in item) return typeof item.website === 'string' ? item.website : '—';
  return '—';
}
function fieldLabel(field: string): string {
  return (
    {
      nameEn: 'English name',
      nameAr: 'Arabic name',
      slug: 'Slug',
      name: 'Name',
      website: 'Website',
      code: 'Code',
      floor: 'Floor',
      room: 'Room',
      sectionId: 'Section',
    }[field] || field
  );
}

function ManagementPage({
  title,
  description,
  action,
  locale = 'en',
  go,
  activePath,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  locale?: 'ar' | 'en';
  go?: (to: string) => void;
  activePath?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="page management-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {locale === 'ar' ? 'إدارة مكتبة جامعة الدلتا' : 'Delta University Library'}
          </p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </div>
      {go && <LibrarianWorkspaceNav locale={locale} activePath={activePath || ''} go={go} />}
      {children}
    </section>
  );
}

function LibrarianWorkspaceNav({
  locale,
  activePath,
  go,
}: {
  locale: 'ar' | 'en';
  activePath: string;
  go: (to: string) => void;
}): JSX.Element {
  const items = [
    { path: '/librarian', icon: 'categories' as const, ar: 'لوحة التحكم', en: 'Overview' },
    { path: '/librarian/books', icon: 'book' as const, ar: 'الكتب', en: 'Books' },
    {
      path: '/librarian/book-copies',
      icon: 'categories' as const,
      ar: 'النسخ والمقتنيات',
      en: 'Copies & inventory',
    },
    {
      path: '/librarian/reservations',
      icon: 'history' as const,
      ar: 'الحجوزات',
      en: 'Reservations',
    },
    { path: '/librarian/loans', icon: 'return' as const, ar: 'الإعارات', en: 'Loans' },
  ];
  return (
    <nav
      className="librarian-workspace-nav"
      aria-label={locale === 'ar' ? 'مساحة عمل المكتبي' : 'Librarian workspace'}
    >
      {items.map((item) => {
        const active =
          activePath === item.path ||
          (item.path !== '/librarian' && activePath.startsWith(`${item.path}/`));
        return (
          <button
            type="button"
            key={item.path}
            aria-current={active ? 'page' : undefined}
            className={active ? 'active' : ''}
            onClick={() => go(item.path)}
          >
            <PublicIcon name={item.icon} />
            <span>{locale === 'ar' ? item.ar : item.en}</span>
          </button>
        );
      })}
    </nav>
  );
}
function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      {children}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
function Search({
  value,
  onChange,
  onSearch,
  locale = 'en',
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  locale?: 'ar' | 'en';
}): JSX.Element {
  return (
    <form
      className="management-search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <label className="sr-only" htmlFor="management-search">
        {locale === 'ar' ? 'بحث في السجلات' : 'Search records'}
      </label>
      <input
        id="management-search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          locale === 'ar' ? 'ابحث باسم الكتاب أو الرمز…' : 'Search by title, author, or code…'
        }
      />
      <button className="button quiet">{locale === 'ar' ? 'بحث' : 'Search'}</button>
    </form>
  );
}
function ArchiveFilter({
  value,
  change,
  locale = 'en',
}: {
  value: 'active' | 'archived' | 'all';
  change: (value: 'active' | 'archived' | 'all') => void;
  locale?: 'ar' | 'en';
}): JSX.Element {
  return (
    <label className="archive-filter">
      <span>{locale === 'ar' ? 'حالة الأرشفة' : 'Archive state'}</span>
      <select
        value={value}
        onChange={(event) => change(event.target.value as 'active' | 'archived' | 'all')}
      >
        <option value="active">{locale === 'ar' ? 'نشط' : 'Active'}</option>
        <option value="archived">{locale === 'ar' ? 'مؤرشف' : 'Archived'}</option>
        <option value="all">{locale === 'ar' ? 'الكل' : 'All'}</option>
      </select>
    </label>
  );
}
function Table({ headers, children }: { headers: string[]; children: JSX.Element[] }): JSX.Element {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Badge({
  value,
  tone,
}: {
  value: string;
  tone: 'success' | 'warning' | 'error';
}): JSX.Element {
  return <span className={`badge ${tone}`}>{value}</span>;
}
function Pagination({
  page,
  pages,
  change,
}: {
  page: number;
  pages: number;
  change: (page: number) => void;
}): JSX.Element {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="button quiet" disabled={page <= 1} onClick={() => change(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button className="button quiet" disabled={page >= pages} onClick={() => change(page + 1)}>
        Next
      </button>
    </nav>
  );
}
function ConfirmDialog({
  title,
  message,
  confirm,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="form-actions">
          <button className="button quiet" onClick={onCancel}>
            Cancel
          </button>
          <button className="button danger" onClick={onConfirm}>
            {confirm}
          </button>
        </div>
      </section>
    </div>
  );
}
function Loading(): JSX.Element {
  return (
    <div className="state" role="status">
      <span className="spinner" />
      Loading…
    </div>
  );
}
function EmptyState({ title, action }: { title: string; action?: ReactNode }): JSX.Element {
  return (
    <div className="state">
      <h2>{title}</h2>
      <p>Adjust your search or add a new record.</p>
      {action}
    </div>
  );
}
function ErrorState({ message, retry }: { message: string; retry: () => void }): JSX.Element {
  return (
    <div className="state error">
      <h2>Something needs attention</h2>
      <p>{message}</p>
      <button className="button primary" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
function AccessDenied({ message }: { message: string }): JSX.Element {
  return (
    <section className="page narrow">
      <div className="state error">
        <h1>Access restricted</h1>
        <p>{message}</p>
      </div>
    </section>
  );
}
export default App;
