import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Role } from './auth/access';
import { apiRequest, requestMessage } from './lib/api';
import { canAccessLoanRoute, isMemberLoanRoute, isStaffLoanRoute } from './loans/access';
import { LoanRoute } from './loans/pages';
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
  setPath(to);
}
function bookTitle(book: Book): string {
  return document.documentElement.dir === 'rtl' ? book.titleAr || book.title : book.title;
}

function App(): JSX.Element {
  const [path, setPath] = useState(pathNow());
  const [session, setSession] = useState<Session>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const listener = () => setPath(pathNow());
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
  const go = (to: string) => navigate(to, setPath);
  const arabic = document.documentElement.dir === 'rtl';
  const language = () => {
    document.documentElement.dir = arabic ? 'ltr' : 'rtl';
    document.documentElement.lang = arabic ? 'en' : 'ar';
    setPath(pathNow());
  };
  const area = routeArea(path);
  const management = !!area;
  const loanRoute = isStaffLoanRoute(path) || isMemberLoanRoute(path);
  let page: JSX.Element;
  if (loanRoute && !canAccessLoanRoute(!!session, session?.role, path))
    page = <LoginGate session={session} setSession={setSession} />;
  else if (loanRoute)
    page = (
      <LoanRoute
        path={path}
        token={session!.token}
        staff={isStaffLoanRoute(path)}
        go={go}
        notify={setNotice}
      />
    );
  else if (management && !canManageRoute(session?.role, path))
    page = <LoginGate session={session} setSession={setSession} />;
  else if (
    path === '/librarian/books' ||
    path === '/librarian/books/create' ||
    /^\/librarian\/books\/[^/]+\/edit$/.test(path)
  )
    page = <BooksManager path={path} token={session!.token} go={go} notify={setNotice} />;
  else if (
    path === '/librarian/book-copies' ||
    path === '/librarian/book-copies/create' ||
    /^\/librarian\/book-copies\/[^/]+\/edit$/.test(path)
  )
    page = <CopiesManager path={path} token={session!.token} go={go} notify={setNotice} />;
  else if (area) page = <MasterManager area={area} token={session!.token} notify={setNotice} />;
  else if (path.startsWith('/books/'))
    page = <BookDetail slug={path.split('/').at(-1) || ''} go={go} />;
  else page = <Catalog go={go} />;
  return (
    <main className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => go('/books')}>
          Smart Library <span>مكتبة ذكية</span>
        </button>
        <nav aria-label="Main navigation">
          <button onClick={() => go('/books')}>Catalog</button>
          {session && session.role !== 'MEMBER' && (
            <button onClick={() => go('/librarian/books')}>Management</button>
          )}
          {session && session.role !== 'MEMBER' && (
            <button onClick={() => go('/librarian/loans')}>Circulation</button>
          )}
          {session?.role === 'MEMBER' && <button onClick={() => go('/my-loans')}>My loans</button>}
          {session?.role === 'ADMIN' && (
            <button onClick={() => go('/admin/categories')}>Administration</button>
          )}
          {session && <button onClick={() => setSession(null)}>Sign out</button>}
          <button onClick={language}>{arabic ? 'English' : 'العربية'}</button>
        </nav>
      </header>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
      {page}
    </main>
  );
}

function LoginGate({
  session,
  setSession,
}: {
  session: Session;
  setSession: (session: Session) => void;
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
    } catch (reason) {
      setError(requestMessage(reason));
    } finally {
      setSaving(false);
    }
  };
  if (session?.role === 'MEMBER')
    return <AccessDenied message="Member accounts cannot access catalog management." />;
  return (
    <section className="page narrow">
      <div className="panel">
        <p className="eyebrow">Protected area</p>
        <h1>Sign in to manage the library</h1>
        <p>Your access token is held only for this browser session.</p>
        <form className="stack" onSubmit={(event) => void submit(event)}>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
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
          <button className="button primary" disabled={saving}>
            {saving ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}

function Catalog({ go }: { go: (to: string) => void }): JSX.Element {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<CatalogResult | null>(null);
  const [error, setError] = useState('');
  const load = async (q = '') => {
    setError('');
    try {
      setData(await apiRequest<CatalogResult>(`/books?limit=12&q=${encodeURIComponent(q)}`));
    } catch (reason) {
      setError(requestMessage(reason));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="page">
      <div className="hero">
        <p className="eyebrow">Discover the collection</p>
        <h1>Find a book, then find it easily.</h1>
        <p>Search the library’s bilingual catalog and see availability at a glance.</p>
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            void load(query);
          }}
        >
          <label className="sr-only" htmlFor="catalog-search">
            Search books
          </label>
          <input
            id="catalog-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, author, or ISBN"
          />
          <button className="button primary">Search</button>
        </form>
      </div>
      {!data && !error ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={() => void load(query)} />
      ) : !data?.items.length ? (
        <EmptyState title="No books match these filters" />
      ) : (
        <div className="book-grid">
          {data.items.map((book) => (
            <article className="book-card" key={book.id}>
              <div className="cover">{bookTitle(book).slice(0, 1)}</div>
              <div>
                <p className="muted">{book.category?.nameEn}</p>
                <h2>{bookTitle(book)}</h2>
                <p className="clamp">{book.description || 'A library title ready to explore.'}</p>
                <Badge
                  value={book.availableCopies ? `${book.availableCopies} available` : 'Unavailable'}
                  tone={book.availableCopies ? 'success' : 'warning'}
                />
                <button className="text-button" onClick={() => go(`/books/${book.slug}`)}>
                  View details
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function BookDetail({ slug, go }: { slug: string; go: (to: string) => void }): JSX.Element {
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void apiRequest<Book>(`/books/slug/${encodeURIComponent(slug)}`)
      .then(setBook)
      .catch((reason: unknown) => setError(requestMessage(reason)));
  }, [slug]);
  if (error)
    return (
      <section className="page">
        <ErrorState message={error} retry={() => go('/books')} />
      </section>
    );
  if (!book)
    return (
      <section className="page">
        <Loading />
      </section>
    );
  return (
    <section className="page detail">
      <button className="text-button" onClick={() => go('/books')}>
        ← Back to catalog
      </button>
      <div className="detail-grid">
        <div className="cover large">{bookTitle(book).slice(0, 1)}</div>
        <div>
          <p className="eyebrow">{book.category?.nameEn}</p>
          <h1>{bookTitle(book)}</h1>
          <p>{book.description || 'No description has been added yet.'}</p>
          <dl>
            <div>
              <dt>Availability</dt>
              <dd>
                {book.availableCopies} of {book.totalCopies} copies available
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function BooksManager({
  path,
  token,
  go,
  notify,
}: {
  path: string;
  token: string;
  go: (to: string) => void;
  notify: (message: string) => void;
}): JSX.Element {
  const editing = /^\/librarian\/books\/[^/]+\/edit$/.test(path);
  const creating = path.endsWith('/create');
  const id = editing ? path.split('/')[3]! : '';
  if (creating || editing) return <BookForm id={id} token={token} go={go} notify={notify} />;
  return <BooksTable token={token} go={go} notify={notify} />;
}

function BooksTable({
  token,
  go,
  notify,
}: {
  token: string;
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
      notify(`“${confirm.title}” archived.`);
      setConfirm(null);
      await load(query, data?.page, archiveState);
    } catch (reason) {
      setError(requestMessage(reason));
    }
  };
  return (
    <ManagementPage
      title="Books"
      description="Create, update, and archive catalog records."
      action={
        <button className="button primary" onClick={() => go('/librarian/books/create')}>
          Add book
        </button>
      }
    >
      <div className="filter-row">
        <Search value={query} onChange={setQuery} onSearch={() => void load(query)} />
        <ArchiveFilter
          value={archiveState}
          change={(state) => {
            setArchiveState(state);
            void load(query, 1, state);
          }}
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
              Add book
            </button>
          }
        />
      ) : (
        <>
          <Table headers={['Title', 'Authors', 'Availability', 'Actions']}>
            {data.items.map((book) => (
              <tr key={book.id}>
                <td>
                  <strong>{book.title}</strong>
                  <br />
                  <span className="muted">{book.isbn13 || 'No ISBN'}</span>
                </td>
                <td>{book.authors.map(({ author }) => author.name).join(', ')}</td>
                <td>
                  <Badge
                    value={`${book.availableCopies}/${book.totalCopies} available`}
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
                            notify(`“${book.title}” restored.`);
                            await load(query, data?.page, archiveState);
                          })
                          .catch((reason: unknown) => setError(requestMessage(reason)))
                      }
                    >
                      Restore
                    </button>
                  ) : (
                    <>
                      <button
                        className="button quiet"
                        onClick={() => go(`/librarian/books/${book.id}/edit`)}
                      >
                        Edit
                      </button>
                      <button className="button danger" onClick={() => setConfirm(book)}>
                        Archive
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
          title="Archive book?"
          message={`This hides “${confirm.title}” from the active catalog. You can restore it during this session.`}
          confirm="Archive"
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
  go,
  notify,
}: {
  id: string;
  token: string;
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
        .then((item) =>
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
          }),
        )
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
      await apiRequest(
        id ? `/books/${id}` : '/books',
        { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
        token,
      );
      notify(id ? 'Book updated.' : 'Book created.');
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
      title={id ? 'Edit book' : 'Create book'}
      description="Required fields are marked clearly. Authors can be selected together."
    >
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <Field label="Title" error={errors.title}>
          <input
            value={book.title}
            onChange={(event) => setBook({ ...book, title: event.target.value })}
            required
          />
        </Field>
        <Field label="Arabic title">
          <input
            value={book.titleAr}
            onChange={(event) => setBook({ ...book, titleAr: event.target.value })}
          />
        </Field>
        <Field label="Slug" error={errors.slug}>
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
        <Field label="Category" error={errors.categoryId}>
          <select
            value={book.categoryId}
            onChange={(event) => setBook({ ...book, categoryId: event.target.value })}
          >
            <option value="">Choose category</option>
            {masters.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Publisher">
          <select
            value={book.publisherId}
            onChange={(event) => setBook({ ...book, publisherId: event.target.value })}
          >
            <option value="">No publisher</option>
            {masters.publishers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Language">
          <select
            value={book.language}
            onChange={(event) => setBook({ ...book, language: event.target.value })}
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
          </select>
        </Field>
        <Field label="Authors" error={errors.authorIds}>
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
          <span className="hint">Use Ctrl/Cmd to select more than one author.</span>
        </Field>
        <Field label="Description" wide>
          <textarea
            value={book.description}
            onChange={(event) => setBook({ ...book, description: event.target.value })}
          />
        </Field>
        {message && (
          <p className="field-error" role="alert">
            {message}
          </p>
        )}
        <div className="form-actions">
          <button className="button quiet" type="button" onClick={() => go('/librarian/books')}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save book'}
          </button>
        </div>
      </form>
    </ManagementPage>
  );
}

function CopiesManager({
  path,
  token,
  go,
  notify,
}: {
  path: string;
  token: string;
  go: (to: string) => void;
  notify: (message: string) => void;
}): JSX.Element {
  const editing = /^\/librarian\/book-copies\/[^/]+\/edit$/.test(path);
  const creating = path.endsWith('/create');
  const id = editing ? path.split('/')[3]! : '';
  if (creating || editing) return <CopyForm id={id} token={token} go={go} notify={notify} />;
  return <CopiesTable token={token} go={go} notify={notify} />;
}

async function loadCopies(
  query = '',
  page = 1,
  archiveState: 'active' | 'archived' | 'all' = 'active',
): Promise<CopyResult> {
  return apiRequest<CopyResult>(managementListQuery('/book-copies', query, page, archiveState));
}

function CopiesTable({
  token,
  go,
  notify,
}: {
  token: string;
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
        setData(await loadCopies(q, page, state));
      } catch (reason) {
        setError(requestMessage(reason));
      }
    },
    [archiveState, query],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const archive = async () => {
    if (!confirm) return;
    try {
      await apiRequest(`/book-copies/${confirm.id}/archive`, { method: 'POST' }, token);
      notify(`${confirm.copyCode} archived.`);
      setConfirm(null);
      await load();
    } catch (reason) {
      setError(requestMessage(reason));
    }
  };
  return (
    <ManagementPage
      title="Book copies"
      description="Track each physical copy, its location, condition, and availability."
      action={
        <button className="button primary" onClick={() => go('/librarian/book-copies/create')}>
          Add copy
        </button>
      }
    >
      <div className="filter-row">
        <Search value={query} onChange={setQuery} onSearch={() => void load(query, 1)} />
        <ArchiveFilter
          value={archiveState}
          change={(state) => {
            setArchiveState(state);
            void load(query, 1, state);
          }}
        />
      </div>
      {!data && !error ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={() => void load()} />
      ) : !data?.items.length ? (
        <EmptyState
          title="No book copies found"
          action={
            <button className="button primary" onClick={() => go('/librarian/book-copies/create')}>
              Add copy
            </button>
          }
        />
      ) : (
        <>
          <Table headers={['Copy', 'Book', 'Location', 'Status', 'Actions']}>
            {data.items.map((copy) => (
              <tr key={copy.id}>
                <td>
                  <strong>{copy.copyCode}</strong>
                  <br />
                  <span className="muted">{copy.barcode || 'No barcode'}</span>
                </td>
                <td>{copy.book?.title}</td>
                <td>
                  {copy.section?.code || copy.sectionId} / {copy.shelf?.code || copy.shelfId}
                </td>
                <td>
                  {copy.isArchived ? (
                    <Badge value="Archived" tone="warning" />
                  ) : (
                    <StatusSelect
                      copy={copy}
                      token={token}
                      done={async () => {
                        notify('Copy status updated.');
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
                            notify(`${copy.copyCode} restored.`);
                            await load();
                          })
                          .catch((reason: unknown) => setError(requestMessage(reason)))
                      }
                    >
                      Restore
                    </button>
                  ) : (
                    <>
                      <button
                        className="button quiet"
                        onClick={() => go(`/librarian/book-copies/${copy.id}/edit`)}
                      >
                        Edit
                      </button>
                      <button className="button danger" onClick={() => setConfirm(copy)}>
                        Archive
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
          title="Archive book copy?"
          message={`This removes ${confirm.copyCode} from availability counts.`}
          confirm="Archive"
          onConfirm={() => void archive()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </ManagementPage>
  );
}

function StatusSelect({
  copy,
  token,
  done,
  fail,
}: {
  copy: Copy;
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
            {status}
          </option>
        ))}
      </select>
    </label>
  );
}

function CopyForm({
  id,
  token,
  go,
  notify,
}: {
  id: string;
  token: string;
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
      title={id ? 'Edit book copy' : 'Create book copy'}
      description="A shelf is always selected from the chosen section."
    >
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <Field label="Book" error={errors.bookId}>
          <select
            disabled={!!id}
            value={copy.bookId}
            onChange={(event) => setCopy({ ...copy, bookId: event.target.value })}
          >
            <option value="">Choose book</option>
            {masters.books.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Section" error={errors.sectionId}>
          <select
            value={copy.sectionId}
            onChange={(event) => setCopy({ ...copy, sectionId: event.target.value, shelfId: '' })}
          >
            <option value="">Choose section</option>
            {masters.sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shelf" error={errors.shelfId}>
          <select
            value={copy.shelfId}
            disabled={!copy.sectionId}
            onChange={(event) => setCopy({ ...copy, shelfId: event.target.value })}
          >
            <option value="">Choose shelf</option>
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} — {item.nameEn}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Copy code">
          <input
            value={copy.copyCode}
            disabled={!!id}
            onChange={(event) => setCopy({ ...copy, copyCode: event.target.value })}
          />
        </Field>
        <Field label="Barcode">
          <input
            value={copy.barcode}
            onChange={(event) => setCopy({ ...copy, barcode: event.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            value={copy.status}
            onChange={(event) => setCopy({ ...copy, status: event.target.value as CopyStatus })}
          >
            {statuses.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Condition">
          <select
            value={copy.condition}
            onChange={(event) =>
              setCopy({ ...copy, condition: event.target.value as CopyCondition })
            }
          >
            {conditions.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
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
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save copy'}
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
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Catalog management</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
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
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
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
        Search records
      </label>
      <input
        id="management-search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search records"
      />
      <button className="button quiet">Search</button>
    </form>
  );
}
function ArchiveFilter({
  value,
  change,
}: {
  value: 'active' | 'archived' | 'all';
  change: (value: 'active' | 'archived' | 'all') => void;
}): JSX.Element {
  return (
    <label className="archive-filter">
      <span>Archive state</span>
      <select
        value={value}
        onChange={(event) => change(event.target.value as 'active' | 'archived' | 'all')}
      >
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="all">All</option>
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
