import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, requestMessage } from '../lib/api';
import { BookShelfSection } from './BookShelfSection';
import { BottomServiceStrip } from './BottomServiceStrip';
import { BookCard } from './BookCard';
import { CategoryStrip } from './CategoryStrip';
import { HeroBanner } from './HeroBanner';
import type { PublicBook, PublicCatalogResult, PublicCategory, PublicLocale } from './public.types';

type SortValue = '' | 'newest' | 'title-desc';
type LanguageValue = '' | 'en' | 'ar';

type PublicCatalogProps = {
  locale: PublicLocale;
  go: (to: string) => void;
  showFullCatalog?: boolean;
};

const copy = {
  en: {
    categories: 'Browse by category',
    allCategories: 'All books',
    noCategories: 'Categories are not available yet.',
    availableNow: 'Available now',
    newBooks: 'New releases',
    mostRead: 'Most read',
    fullCatalog: 'Full catalog',
    results: 'books found',
    filters: 'Catalog filters',
    showFilters: 'Show filters',
    hideFilters: 'Hide filters',
    activeFilters: 'Active filters',
    removeFilter: 'Remove filter',
    availableOnly: 'Available copies only',
    language: 'Book language',
    allLanguages: 'All languages',
    englishBooks: 'English',
    arabicBooks: 'Arabic',
    sort: 'Sort books',
    featured: 'Featured first',
    newest: 'Newest first',
    titleDesc: 'Title Z–A',
    reset: 'Reset filters',
    empty: 'No books match your search',
    emptyHint: 'Try another phrase or clear one of the active filters.',
    error: 'We could not load the catalog.',
    retry: 'Try again',
    previous: 'Previous page',
    next: 'Next page',
    page: 'Page',
    of: 'of',
    loading: 'Loading books',
    pagination: 'Catalog pagination',
  },
  ar: {
    categories: 'تصفح حسب التصنيف',
    allCategories: 'كل الكتب',
    noCategories: 'لا توجد تصنيفات متاحة بعد.',
    availableNow: 'متاح الآن',
    newBooks: 'إصدارات جديدة',
    mostRead: 'الأكثر قراءة',
    fullCatalog: 'الفهرس الكامل',
    results: 'كتاب',
    filters: 'مرشحات الفهرس',
    showFilters: 'عرض المرشحات',
    hideFilters: 'إخفاء المرشحات',
    activeFilters: 'المرشحات النشطة',
    removeFilter: 'إزالة المرشح',
    availableOnly: 'النسخ المتاحة فقط',
    language: 'لغة الكتاب',
    allLanguages: 'كل اللغات',
    englishBooks: 'الإنجليزية',
    arabicBooks: 'العربية',
    sort: 'ترتيب الكتب',
    featured: 'المميزة أولاً',
    newest: 'الأحدث أولاً',
    titleDesc: 'العنوان ي–أ',
    reset: 'إعادة ضبط المرشحات',
    empty: 'لا توجد كتب تطابق بحثك',
    emptyHint: 'جرّب عبارة أخرى أو أزل أحد المرشحات النشطة.',
    error: 'تعذر تحميل الفهرس.',
    retry: 'إعادة المحاولة',
    previous: 'الصفحة السابقة',
    next: 'الصفحة التالية',
    page: 'صفحة',
    of: 'من',
    loading: 'جارٍ تحميل الكتب',
    pagination: 'ترقيم صفحات الفهرس',
  },
} as const;

function booksPath(options: {
  limit: number;
  page?: number;
  q?: string;
  categoryId?: string;
  available?: boolean;
  sort?: SortValue;
  language?: LanguageValue;
}): string {
  const params = new URLSearchParams({ limit: String(options.limit) });
  if (options.page) params.set('page', String(options.page));
  if (options.q) params.set('q', options.q);
  if (options.categoryId) params.set('categoryId', options.categoryId);
  if (options.available) params.set('available', 'true');
  if (options.sort) params.set('sort', options.sort);
  if (options.language) params.set('language', options.language);
  return `/books?${params.toString()}`;
}

function LoadingCards({ label, count = 4 }: { label: string; count?: number }): JSX.Element {
  return (
    <div className="catalog-loading" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
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
  );
}

export function PublicCatalog({
  locale,
  go,
  showFullCatalog = true,
}: PublicCatalogProps): JSX.Element {
  const labels = copy[locale];
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<SortValue>('');
  const [language, setLanguage] = useState<LanguageValue>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<PublicCategory[] | null>(null);
  const [availableBooks, setAvailableBooks] = useState<PublicBook[] | null>(null);
  const [newBooks, setNewBooks] = useState<PublicBook[] | null>(null);
  const [popularBooks, setPopularBooks] = useState<PublicBook[] | null>(null);
  const [catalog, setCatalog] = useState<PublicCatalogResult | null>(null);
  const [discoveryError, setDiscoveryError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [discoveryRetry, setDiscoveryRetry] = useState(0);
  const [catalogRetry, setCatalogRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setDiscoveryError('');
    void Promise.all([
      apiRequest<PublicCategory[]>('/categories'),
      apiRequest<PublicCatalogResult>(booksPath({ limit: 5, available: true })),
      apiRequest<PublicCatalogResult>(booksPath({ limit: 5, sort: 'newest' })),
      apiRequest<PublicCatalogResult>(booksPath({ limit: 12 })),
    ])
      .then(([categoryData, availableData, newData, popularData]) => {
        if (!active) return;
        setCategories(categoryData);
        setAvailableBooks(availableData.items);
        setNewBooks(newData.items);
        setPopularBooks(
          [...popularData.items]
            .sort((first, second) => (second.borrowCount || 0) - (first.borrowCount || 0))
            .slice(0, 5),
        );
      })
      .catch((reason: unknown) => {
        if (active) setDiscoveryError(requestMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [discoveryRetry]);

  useEffect(() => {
    const syncUrlQuery = () => {
      if (!showFullCatalog) return;
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get('q') || '';
      const urlCategoryId = params.get('categoryId') || '';
      setQueryInput(urlQuery);
      setQuery(urlQuery);
      setCategoryId(urlCategoryId);
      setPage(1);
    };
    syncUrlQuery();
    window.addEventListener('nawa:navigation', syncUrlQuery);
    return () => window.removeEventListener('nawa:navigation', syncUrlQuery);
  }, [showFullCatalog]);

  const loadCatalog = useCallback(() => {
    let active = true;
    setCatalog(null);
    setCatalogError('');
    void apiRequest<PublicCatalogResult>(
      booksPath({
        limit: 8,
        page,
        q: query,
        categoryId,
        available: availableOnly,
        sort,
        language,
      }),
    )
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch((reason: unknown) => {
        if (active) setCatalogError(requestMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [availableOnly, categoryId, language, page, query, sort]);

  useEffect(() => {
    if (!showFullCatalog) return undefined;
    return loadCatalog();
  }, [catalogRetry, loadCatalog, showFullCatalog]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    const nextQuery = queryInput.trim();
    setQuery(nextQuery);
    if (!showFullCatalog) go(nextQuery ? `/books?q=${encodeURIComponent(nextQuery)}` : '/books');
  };
  const chooseCategory = (id: string) => {
    setPage(1);
    setCategoryId(id);
    if (!showFullCatalog) go('/books');
  };
  const resetFilters = () => {
    setQueryInput('');
    setQuery('');
    setCategoryId('');
    setAvailableOnly(false);
    setSort('');
    setLanguage('');
    setPage(1);
  };
  const hasFilters = Boolean(query || categoryId || availableOnly || sort || language);
  const selectedCategory = categories?.find((category) => category.id === categoryId);

  return (
    <section className="public-catalog">
      <HeroBanner
        locale={locale}
        query={queryInput}
        categoryId={categoryId}
        categories={categories}
        onQueryChange={setQueryInput}
        onCategoryChange={chooseCategory}
        onSubmit={submitSearch}
      />

      {discoveryError ? (
        <CatalogError
          message={discoveryError || labels.error}
          retry={() => setDiscoveryRetry((value) => value + 1)}
          retryLabel={labels.retry}
        />
      ) : (
        <CategoryStrip
          locale={locale}
          categories={categories}
          selectedId={categoryId}
          loadingLabel={labels.loading}
          emptyLabel={labels.noCategories}
          heading={labels.categories}
          onSelect={chooseCategory}
        />
      )}

      {!discoveryError && (
        <>
          <BookShelfSection
            id="new-releases"
            title={labels.newBooks}
            books={newBooks}
            locale={locale}
            go={go}
            loadingLabel={labels.loading}
            tone="new"
          />
          <BookShelfSection
            id="most-read"
            title={labels.mostRead}
            books={popularBooks}
            locale={locale}
            go={go}
            loadingLabel={labels.loading}
            tone="popular"
          />
          <BookShelfSection
            id="available-now"
            title={labels.availableNow}
            books={availableBooks}
            locale={locale}
            go={go}
            loadingLabel={labels.loading}
            tone="available"
          />
        </>
      )}

      {showFullCatalog && (
        <div className="catalog-section full-catalog" aria-labelledby="full-catalog-heading">
          <div className="catalog-section__heading full-catalog__heading">
            <div>
              <h2 id="full-catalog-heading">{labels.fullCatalog}</h2>
              {catalog && (
                <p aria-live="polite">
                  {catalog.total} {labels.results}
                </p>
              )}
            </div>
            {hasFilters && (
              <button className="reset-filters" onClick={resetFilters}>
                {labels.reset}
              </button>
            )}
          </div>

          <button
            className="catalog-filter-toggle button quiet"
            aria-controls="catalog-filter-controls"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {filtersOpen ? labels.hideFilters : labels.showFilters}
          </button>

          {hasFilters && (
            <div className="active-filters" aria-label={labels.activeFilters}>
              {query && (
                <button
                  aria-label={`${labels.removeFilter}: ${query}`}
                  onClick={() => {
                    setQuery('');
                    setQueryInput('');
                    setPage(1);
                  }}
                >
                  “{query}” <span aria-hidden="true">×</span>
                </button>
              )}
              {categoryId && (
                <button
                  aria-label={`${labels.removeFilter}: ${locale === 'ar' ? selectedCategory?.nameAr : selectedCategory?.nameEn}`}
                  onClick={() => chooseCategory('')}
                >
                  {locale === 'ar' ? selectedCategory?.nameAr : selectedCategory?.nameEn}{' '}
                  <span aria-hidden="true">×</span>
                </button>
              )}
              {availableOnly && (
                <button
                  aria-label={`${labels.removeFilter}: ${labels.availableOnly}`}
                  onClick={() => {
                    setAvailableOnly(false);
                    setPage(1);
                  }}
                >
                  {labels.availableOnly} <span aria-hidden="true">×</span>
                </button>
              )}
              {language && (
                <button
                  aria-label={`${labels.removeFilter}: ${language === 'en' ? labels.englishBooks : labels.arabicBooks}`}
                  onClick={() => {
                    setLanguage('');
                    setPage(1);
                  }}
                >
                  {language === 'en' ? labels.englishBooks : labels.arabicBooks}{' '}
                  <span aria-hidden="true">×</span>
                </button>
              )}
              {sort && (
                <button
                  aria-label={`${labels.removeFilter}: ${sort === 'newest' ? labels.newest : labels.titleDesc}`}
                  onClick={() => {
                    setSort('');
                    setPage(1);
                  }}
                >
                  {sort === 'newest' ? labels.newest : labels.titleDesc}{' '}
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}

          <div
            id="catalog-filter-controls"
            className={`catalog-filters${filtersOpen ? ' is-open' : ''}`}
            aria-label={labels.filters}
          >
            <label className="availability-filter">
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
            <div className="catalog-filter-selects">
              <label className="catalog-sort">
                <span>{labels.language}</span>
                <select
                  value={language}
                  onChange={(event) => {
                    setPage(1);
                    setLanguage(event.target.value as LanguageValue);
                  }}
                >
                  <option value="">{labels.allLanguages}</option>
                  <option value="en">{labels.englishBooks}</option>
                  <option value="ar">{labels.arabicBooks}</option>
                </select>
              </label>
              <label className="catalog-sort">
                <span>{labels.sort}</span>
                <select
                  value={sort}
                  onChange={(event) => {
                    setPage(1);
                    setSort(event.target.value as SortValue);
                  }}
                >
                  <option value="">{labels.featured}</option>
                  <option value="newest">{labels.newest}</option>
                  <option value="title-desc">{labels.titleDesc}</option>
                </select>
              </label>
            </div>
          </div>

          {catalogError ? (
            <CatalogError
              message={catalogError || labels.error}
              retry={() => setCatalogRetry((value) => value + 1)}
              retryLabel={labels.retry}
            />
          ) : catalog === null ? (
            <LoadingCards label={labels.loading} count={8} />
          ) : catalog.items.length === 0 ? (
            <div className="catalog-empty" role="status">
              <span aria-hidden="true">⌕</span>
              <h3>{labels.empty}</h3>
              <p>{labels.emptyHint}</p>
              {hasFilters && (
                <button className="button quiet" onClick={resetFilters}>
                  {labels.reset}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="catalog-book-grid">
                {catalog.items.map((book) => (
                  <BookCard book={book} locale={locale} go={go} key={book.id} />
                ))}
              </div>
              {catalog.totalPages > 1 && (
                <nav className="catalog-pagination" aria-label={labels.pagination}>
                  <button
                    className="button quiet"
                    disabled={catalog.page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    <span aria-hidden="true" className="directional-arrow reverse">
                      ←
                    </span>{' '}
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
                    {labels.next}{' '}
                    <span aria-hidden="true" className="directional-arrow">
                      →
                    </span>
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      )}

      <BottomServiceStrip locale={locale} />
    </section>
  );
}

function CatalogError({
  message,
  retry,
  retryLabel,
}: {
  message: string;
  retry: () => void;
  retryLabel: string;
}): JSX.Element {
  return (
    <div className="catalog-error" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <p>{message}</p>
        <button className="button quiet" onClick={retry}>
          {retryLabel}
        </button>
      </div>
    </div>
  );
}
