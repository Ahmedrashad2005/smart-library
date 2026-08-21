import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, requestMessage } from '../lib/api';
import { BookCard } from './BookCard';
import { PublicIcon } from './PublicIcon';
import type { PublicCatalogResult, PublicLocale } from './public.types';

type CampusLibrarySummary = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
};

type CampusLibrary = CampusLibrarySummary & {
  floors: Array<{
    id: string;
    floorNumber: number;
    nameEn: string;
    nameAr: string;
    rooms: Array<{
      id: string;
      roomNumber: string;
      nameEn: string;
      nameAr: string;
    }>;
  }>;
};

type Props = {
  locale: PublicLocale;
  go: (to: string) => void;
};

const copy = {
  ar: {
    eyebrow: 'مكتبة جامعة الدلتا',
    title: 'المكتبة الجامعية',
    introduction: 'اكتشف كتب جامعة الدلتا المتاحة واعرف مكان كل نسخة قبل زيارتك للمكتبة.',
    location: 'موقع المكتبة',
    locationLoading: 'جارٍ تحميل موقع المكتبة',
    locationError: 'تعذر تحميل موقع المكتبة.',
    summary: 'ملخص مكتبة جامعة الدلتا',
    catalogCount: 'مجموعة المكتبة الجامعية',
    catalogCountLoading: 'جارٍ تحميل عدد الكتب',
    catalogCountUnavailable: 'عدد الكتب غير متاح حاليًا',
    searchLabel: 'البحث في كتب المكتبة الجامعية',
    searchPlaceholder: 'ابحث عن كتاب أو مؤلف...',
    search: 'بحث',
    availableOnly: 'متاح الآن',
    collection: 'المجموعة',
    allCollections: 'كل المجموعات',
    books: 'كتب المكتبة الجامعية',
    result: 'كتاب',
    results: 'كتاب',
    loading: 'جارٍ تحميل كتب المكتبة الجامعية',
    empty: 'لا توجد كتب مطابقة حاليًا.',
    emptyHint: 'جرّب عبارة بحث أخرى أو غيّر المرشحات.',
    error: 'تعذر تحميل كتب المكتبة الجامعية.',
    retry: 'إعادة المحاولة',
    previous: 'الصفحة السابقة',
    next: 'الصفحة التالية',
    page: 'صفحة',
    of: 'من',
    home: 'الرئيسية',
    breadcrumb: 'مسار التنقل',
    filters: 'مرشحات المكتبة الجامعية',
  },
  en: {
    eyebrow: 'DELTA UNIVERSITY LIBRARY',
    title: 'University Library',
    introduction:
      'Explore books held in Delta University Library and know where to find each one before you visit.',
    location: 'Library location',
    locationLoading: 'Loading library location',
    locationError: 'We could not load the library location.',
    summary: 'Delta University Library summary',
    catalogCount: 'Delta University Library collection',
    catalogCountLoading: 'Loading book count',
    catalogCountUnavailable: 'Book count is currently unavailable',
    searchLabel: 'Search University Library books',
    searchPlaceholder: 'Search for a book or author...',
    search: 'Search',
    availableOnly: 'Available now',
    collection: 'Collection',
    allCollections: 'All collections',
    books: 'University Library Books',
    result: 'book',
    results: 'books',
    loading: 'Loading University Library books',
    empty: 'No matching books are available right now.',
    emptyHint: 'Try another search phrase or change the filters.',
    error: 'We could not load the University Library books.',
    retry: 'Try again',
    previous: 'Previous page',
    next: 'Next page',
    page: 'Page',
    of: 'of',
    home: 'Home',
    breadcrumb: 'Breadcrumb',
    filters: 'University Library filters',
  },
} as const;

function campusBooksPath(options: {
  query: string;
  availableOnly: boolean;
  sourceCollection: string;
  page: number;
}): string {
  const params = new URLSearchParams({
    campus: 'true',
    page: String(options.page),
    limit: '8',
  });
  if (options.query) params.set('q', options.query);
  if (options.availableOnly) params.set('available', 'true');
  if (options.sourceCollection) params.set('sourceCollection', options.sourceCollection);
  return `/books?${params.toString()}`;
}

export function CampusPage({ locale, go }: Props): JSX.Element {
  const labels = copy[locale];
  const [library, setLibrary] = useState<CampusLibrary | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locationRetry, setLocationRetry] = useState(0);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sourceCollection, setSourceCollection] = useState('');
  const [sourceCollections, setSourceCollections] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<PublicCatalogResult | null>(null);
  const [campusCatalogTotal, setCampusCatalogTotal] = useState<number | null>(null);
  const [catalogCountError, setCatalogCountError] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLibrary(null);
    setLocationError('');
    void apiRequest<CampusLibrarySummary[]>('/libraries')
      .then((libraries) => {
        const collegeLibrary =
          libraries.find(({ code }) => code === 'NAWA-COLLEGE-LIBRARY') ?? libraries[0];
        if (!collegeLibrary) throw new Error(labels.locationError);
        return apiRequest<CampusLibrary>(`/libraries/${collegeLibrary.id}`);
      })
      .then((result) => {
        if (active) setLibrary(result);
      })
      .catch((reason: unknown) => {
        if (active) setLocationError(requestMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [labels.locationError, locationRetry]);

  const loadBooks = useCallback(() => {
    let active = true;
    setCatalog(null);
    setCatalogError('');
    void apiRequest<PublicCatalogResult>(
      campusBooksPath({ query, availableOnly, sourceCollection, page }),
    )
      .then((result) => {
        if (active) {
          setCatalog(result);
          if (result.sourceCollections) setSourceCollections(result.sourceCollections);
        }
      })
      .catch((reason: unknown) => {
        if (active) setCatalogError(requestMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [availableOnly, page, query, sourceCollection]);

  useEffect(() => loadBooks(), [catalogRetry, loadBooks]);

  useEffect(() => {
    let active = true;
    setCatalogCountError(false);
    void apiRequest<PublicCatalogResult>('/books?campus=true&page=1&limit=1')
      .then((result) => {
        if (active) setCampusCatalogTotal(result.total);
      })
      .catch(() => {
        if (active) setCatalogCountError(true);
      });
    return () => {
      active = false;
    };
  }, [catalogRetry]);

  const floor = library?.floors[0];
  const room = floor?.rooms[0];
  const libraryName = labels.title;
  const floorName = floor ? (locale === 'ar' ? floor.nameAr : floor.nameEn) : '';
  const roomName = room ? (locale === 'ar' ? room.nameAr : room.nameEn) : '';
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  };

  return (
    <section className="campus-page" aria-labelledby="campus-page-heading">
      <nav className="campus-breadcrumb" aria-label={labels.breadcrumb}>
        <button type="button" onClick={() => go('/')}>
          {labels.home}
        </button>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{labels.title}</span>
      </nav>
      <header className="campus-page__intro">
        <div className="campus-page__intro-copy">
          <p className="campus-page__eyebrow">{labels.eyebrow}</p>
          <h1 id="campus-page-heading">{libraryName}</h1>
          <p>{labels.introduction}</p>
        </div>
        <div className="campus-page__summary" role="group" aria-label={labels.summary}>
          <div className="campus-page__location" aria-live="polite">
            <span className="campus-page__location-icon" aria-hidden="true">
              <PublicIcon name="location" />
            </span>
            <div>
              <b>{labels.location}</b>
              {floor && room ? (
                <p>
                  {floorName} <span aria-hidden="true">·</span> {roomName}
                </p>
              ) : locationError ? (
                <>
                  <p role="alert">{labels.locationError}</p>
                  <button
                    className="campus-inline-action"
                    onClick={() => setLocationRetry((v) => v + 1)}
                  >
                    {labels.retry}
                  </button>
                </>
              ) : (
                <p role="status">{labels.locationLoading}</p>
              )}
            </div>
          </div>
          <div className="campus-page__count">
            <span className="campus-page__location-icon" aria-hidden="true">
              <PublicIcon name="book" />
            </span>
            <div>
              <b>{labels.catalogCount}</b>
              <p>
                {campusCatalogTotal === null
                  ? catalogCountError
                    ? labels.catalogCountUnavailable
                    : labels.catalogCountLoading
                  : `${campusCatalogTotal} ${campusCatalogTotal === 1 ? labels.result : labels.results}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="campus-page__catalog" aria-labelledby="campus-books-heading">
        <div className="campus-page__heading">
          <div>
            <h2 id="campus-books-heading">{labels.books}</h2>
            {catalog && (
              <p aria-live="polite">
                {catalog.total} {catalog.total === 1 ? labels.result : labels.results}
              </p>
            )}
          </div>
        </div>

        <div className="campus-filters" role="group" aria-label={labels.filters}>
          <form role="search" className="campus-search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="campus-search-input">
              {labels.searchLabel}
            </label>
            <PublicIcon name="search" />
            <input
              id="campus-search-input"
              value={queryInput}
              placeholder={labels.searchPlaceholder}
              onChange={(event) => setQueryInput(event.target.value)}
            />
            <button>{labels.search}</button>
          </form>
          <label className="campus-available-filter">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(event) => {
                setPage(1);
                setAvailableOnly(event.target.checked);
              }}
            />
            <span>{labels.availableOnly}</span>
          </label>
          <label className="campus-collection-filter">
            <span>{labels.collection}</span>
            <select
              value={sourceCollection}
              onChange={(event) => {
                setPage(1);
                setSourceCollection(event.target.value);
              }}
            >
              <option value="">{labels.allCollections}</option>
              {sourceCollections.map((collection) => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
          </label>
        </div>

        {catalogError ? (
          <div className="campus-page-state is-error" role="alert">
            <PublicIcon name="book" />
            <div>
              <h3>{labels.error}</h3>
              <button className="button quiet" onClick={() => setCatalogRetry((v) => v + 1)}>
                {labels.retry}
              </button>
            </div>
          </div>
        ) : catalog === null ? (
          <div
            className="catalog-loading campus-page__loading"
            role="status"
            aria-label={labels.loading}
          >
            {Array.from({ length: 8 }, (_, index) => (
              <div className="catalog-skeleton" key={index} aria-hidden="true">
                <span />
                <div>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            ))}
          </div>
        ) : catalog.items.length === 0 ? (
          <div className="campus-page-state" role="status">
            <PublicIcon name="book" />
            <div>
              <h3>{labels.empty}</h3>
              <p>{labels.emptyHint}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="catalog-book-grid campus-book-grid">
              {catalog.items.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  locale={locale}
                  go={go}
                  availabilityScope="campus"
                />
              ))}
            </div>
            {catalog.totalPages > 1 && (
              <nav className="catalog-pagination" aria-label={`${labels.books} — ${labels.page}`}>
                <button
                  className="button quiet"
                  disabled={catalog.page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  {labels.previous}
                </button>
                <span aria-live="polite">
                  {labels.page} {catalog.page} {labels.of} {catalog.totalPages}
                </span>
                <button
                  className="button quiet"
                  disabled={catalog.page >= catalog.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {labels.next}
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
