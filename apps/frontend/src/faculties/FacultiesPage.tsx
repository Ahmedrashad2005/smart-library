import { useEffect, useState } from 'react';
import { BookCard } from '../catalog/BookCard';
import type { PublicCatalogResult, PublicLocale } from '../catalog/public.types';
import { ApiError } from '../lib/api';
import { FacultyGrid } from './FacultyGrid';
import { facultyBooks, facultyDetail, listFaculties, type Faculty } from './api';
import { facultyBranding, facultyName } from './faculty.utils';

type Props = {
  locale: PublicLocale;
  slug?: string;
  go: (to: string) => void;
};

const copy = {
  ar: {
    eyebrow: 'مكتبة جامعة الدلتا',
    heading: 'كليات جامعة الدلتا',
    description: 'استكشف المسارات الأكاديمية المؤكدة واختر كليتك للوصول إلى مجموعتها.',
    back: 'العودة إلى الكليات',
    loading: 'جارٍ تحميل بيانات الكليات',
    error: 'تعذر تحميل بيانات الكليات.',
    missing: 'تعذر العثور على الكلية المطلوبة.',
    retry: 'إعادة المحاولة',
    collection: 'كتب الكلية',
    empty: 'لا توجد كتب مرتبطة بهذه الكلية حتى الآن',
    emptyHint: 'لم نُنشئ ارتباطات افتراضية. ستظهر الكتب هنا بعد اعتماد بيانات الكلية رسميًا.',
    browse: 'تصفح فهرس المكتبة',
    pagination: 'صفحات كتب الكلية',
    previous: 'السابق',
    next: 'التالي',
    page: 'صفحة',
    of: 'من',
  },
  en: {
    eyebrow: 'Delta University Library',
    heading: 'Delta University Faculties',
    description: 'Explore the confirmed academic paths and choose a faculty collection.',
    back: 'Back to faculties',
    loading: 'Loading faculty information',
    error: 'Faculty information could not be loaded.',
    missing: 'The requested faculty could not be found.',
    retry: 'Try again',
    collection: 'Faculty books',
    empty: 'No books are assigned to this faculty yet',
    emptyHint:
      'No associations were invented. Books will appear after official mapping is approved.',
    browse: 'Browse the library catalog',
    pagination: 'Faculty book pages',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    of: 'of',
  },
} as const;

export function FacultiesPage({ locale, slug, go }: Props): JSX.Element {
  const labels = copy[locale];
  const [faculties, setFaculties] = useState<Faculty[] | null>(null);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [books, setBooks] = useState<PublicCatalogResult | null>(null);
  const [error, setError] = useState<'missing' | 'error' | ''>('');
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const branding = faculty ? facultyBranding(faculty, locale) : null;

  useEffect(() => setPage(1), [slug]);
  useEffect(() => {
    let active = true;
    setError('');
    if (!slug) {
      setFaculties(null);
      void listFaculties()
        .then((result) => {
          if (active) setFaculties(result);
        })
        .catch(() => {
          if (active) setError('error');
        });
    } else {
      setFaculty(null);
      setBooks(null);
      void Promise.all([facultyDetail(slug), facultyBooks(slug, page)])
        .then(([facultyResult, bookResult]) => {
          if (!active) return;
          setFaculty(facultyResult);
          setBooks(bookResult);
        })
        .catch((reason: unknown) => {
          if (active)
            setError(reason instanceof ApiError && reason.status === 404 ? 'missing' : 'error');
        });
    }
    return () => {
      active = false;
    };
  }, [page, retry, slug]);

  return (
    <section className="faculties-page">
      <header className={`faculties-page__intro${branding ? ' has-faculty-logo' : ''}`}>
        <div className="faculties-page__intro-copy">
          <p>{labels.eyebrow}</p>
          <h1 dir={faculty && locale === 'en' && !faculty.nameEn ? 'rtl' : undefined}>
            {faculty ? facultyName(faculty, locale) : labels.heading}
          </h1>
          <span>{faculty ? labels.collection : labels.description}</span>
        </div>
        {branding && (
          <span className="faculties-page__logo">
            <img src={branding.logoSrc} alt={branding.logoAlt} />
          </span>
        )}
      </header>

      {slug && (
        <button className="faculty-back" type="button" onClick={() => go('/faculties')}>
          <span aria-hidden="true">→</span>
          {labels.back}
        </button>
      )}

      {error ? (
        <div className="faculty-state is-error" role="alert">
          <h2>{error === 'missing' ? labels.missing : labels.error}</h2>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {labels.retry}
          </button>
        </div>
      ) : !slug && faculties ? (
        <FacultyGrid faculties={faculties} locale={locale} go={go} />
      ) : slug && faculty && books ? (
        books.items.length ? (
          <>
            <div className="catalog-book-grid faculty-book-grid">
              {books.items.map((book) => (
                <BookCard book={book} locale={locale} go={go} key={book.id} />
              ))}
            </div>
            {books.totalPages > 1 && (
              <nav className="catalog-pagination" aria-label={labels.pagination}>
                <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  {labels.previous}
                </button>
                <span aria-live="polite">
                  {labels.page} {books.page} {labels.of} {books.totalPages}
                </span>
                <button
                  disabled={page >= books.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {labels.next}
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="faculty-state is-empty" role="status">
            <span aria-hidden="true">⌁</span>
            <h2>{labels.empty}</h2>
            <p>{labels.emptyHint}</p>
            <button type="button" onClick={() => go('/books')}>
              {labels.browse}
            </button>
          </div>
        )
      ) : (
        <div
          className="faculty-loading faculty-loading--page"
          role="status"
          aria-label={labels.loading}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </div>
      )}
    </section>
  );
}
