import { useEffect, useState } from 'react';
import type { Role } from '../auth/access';
import { apiRequest, requestMessage } from '../lib/api';
import { ReservationAction } from '../reservations/ReservationAction';
import { BookCoverMedia } from './BookCoverMedia';
import { CampusAvailabilityCard, type CampusAvailability } from './CampusAvailabilityCard';
import type { PreviewMetadata } from './BookPreviewField';
import {
  publicCategoryName,
  type PublicAuthor,
  type PublicCategory,
  type PublicLocale,
} from './public.types';

export type BookDetailRecord = {
  id: string;
  slug: string;
  title: string;
  titleAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  coverImageUrl?: string | null;
  publicationYear?: number | null;
  sourcePublicationInfo?: string | null;
  ddc?: string | null;
  totalCopies: number;
  availableCopies: number;
  category?: PublicCategory;
  authors: Array<{ author: PublicAuthor }>;
  campusAvailability: CampusAvailability;
  preview?: PreviewMetadata;
};

type Props = {
  slug: string;
  locale: PublicLocale;
  go: (to: string) => void;
  session?: { token: string; role: Role } | null;
  sessionReady?: boolean;
  onLoginRequired?: () => void;
};

const copy = {
  ar: {
    back: 'العودة إلى الكتب',
    noDescription: 'لم تتم إضافة وصف لهذا الكتاب بعد.',
    author: 'المؤلف',
    year: 'سنة النشر',
    publication: 'بيانات النشر الأصلية',
    ddc: 'تصنيف DDC',
    coverAlt: 'غلاف كتاب',
    noCover: 'لا توجد صورة غلاف',
    campusAvailability: 'خيارات توفر الكتاب في المكتبة الجامعية',
    loading: 'جارٍ تحميل تفاصيل الكتاب…',
    retry: 'العودة إلى الكتب',
    preview: 'معاينة الكتاب',
    previewDescription: 'استعرض غلاف الكتاب وفهرس المحتويات.',
    openPreview: 'فتح معاينة الكتاب',
  },
  en: {
    back: 'Back to books',
    noDescription: 'No description has been added for this book yet.',
    author: 'Author',
    year: 'Publication year',
    publication: 'Source publication information',
    ddc: 'DDC classification',
    coverAlt: 'Book cover',
    noCover: 'No cover available',
    campusAvailability: 'University Library availability',
    loading: 'Loading book details…',
    retry: 'Back to books',
    preview: 'Book Preview',
    previewDescription: 'Preview the cover and table of contents.',
    openPreview: 'Open book preview',
  },
} as const;

export function BookDetail({
  slug,
  locale,
  go,
  session = null,
  sessionReady = true,
  onLoginRequired = () => undefined,
}: Props): JSX.Element {
  const [book, setBook] = useState<BookDetailRecord | null>(null);
  const [error, setError] = useState('');
  const labels = copy[locale];
  useEffect(() => {
    setBook(null);
    setError('');
    void apiRequest<BookDetailRecord>(`/books/slug/${encodeURIComponent(slug)}`)
      .then((result) => {
        if (!result) throw new Error(locale === 'ar' ? 'الكتاب غير موجود.' : 'Book not found.');
        setBook(result);
      })
      .catch((reason: unknown) => setError(requestMessage(reason)));
  }, [locale, slug]);
  if (error)
    return (
      <section className="page book-detail-page">
        <div className="state error" role="alert">
          <h2>{error}</h2>
          <button className="button quiet" onClick={() => go('/books')}>
            {labels.retry}
          </button>
        </div>
      </section>
    );
  if (!book)
    return (
      <section className="page book-detail-page">
        <div className="state" role="status">
          <span className="spinner" aria-hidden="true" />
          {labels.loading}
        </div>
      </section>
    );

  const title = locale === 'ar' ? book.titleAr || book.title : book.title;
  const description = locale === 'ar' ? book.descriptionAr || book.description : book.description;
  const authorNames = book.authors
    .map(({ author }) => (locale === 'ar' ? author.nameAr || author.name : author.name))
    .join(locale === 'ar' ? '، ' : ', ');
  const fallbackAuthor = book.authors[0]
    ? locale === 'ar'
      ? book.authors[0].author.nameAr || book.authors[0].author.name
      : book.authors[0].author.name
    : '';
  return (
    <section className="page detail book-detail-page">
      <button className="book-detail-back" onClick={() => go('/books')}>
        <span aria-hidden="true">{locale === 'ar' ? '→' : '←'}</span>
        {labels.back}
      </button>
      <div className="book-detail-surface">
        <div className="book-detail-cover">
          <BookCoverMedia
            key={book.coverImageUrl || 'fallback'}
            url={book.coverImageUrl}
            title={title}
            author={fallbackAuthor}
            coverLabel={`${labels.coverAlt}: ${title}`}
            noCoverLabel={`${labels.noCover}: ${title}`}
            variantKey={book.id}
            loading="eager"
          />
        </div>
        <div className="book-detail-content">
          <p className="book-detail-eyebrow">
            {book.category ? publicCategoryName(book.category, locale) : ''}
          </p>
          <h1>{title}</h1>
          {authorNames && <p className="book-detail-authors">{authorNames}</p>}
          <p className="book-detail-description">{description || labels.noDescription}</p>
          <dl className="book-detail-metadata">
            {authorNames && (
              <div>
                <dt>{labels.author}</dt>
                <dd>{authorNames}</dd>
              </div>
            )}
            {book.publicationYear != null && (
              <div>
                <dt>{labels.year}</dt>
                <dd>{book.publicationYear}</dd>
              </div>
            )}
            {book.sourcePublicationInfo && (
              <div>
                <dt>{labels.publication}</dt>
                <dd>{book.sourcePublicationInfo}</dd>
              </div>
            )}
            {book.ddc && (
              <div>
                <dt>{labels.ddc}</dt>
                <dd>{book.ddc}</dd>
              </div>
            )}
          </dl>
          {book.preview?.available && (
            <section className="book-detail-preview" aria-labelledby="book-preview-title">
              <div>
                <h2 id="book-preview-title">{labels.preview}</h2>
                <p>{labels.previewDescription}</p>
              </div>
              <button className="button quiet" onClick={() => go(`/books/${book.slug}/preview`)}>
                {labels.openPreview}
              </button>
            </section>
          )}
        </div>
        <aside className="book-detail-acquisition" aria-label={labels.campusAvailability}>
          <CampusAvailabilityCard availability={book.campusAvailability} locale={locale} />
          {book.campusAvailability.hasPhysicalCopies && (
            <ReservationAction
              bookId={book.id}
              bookTitle={title}
              locale={locale}
              availability={book.campusAvailability}
              session={session}
              sessionReady={sessionReady}
              onLoginRequired={onLoginRequired}
              go={go}
            />
          )}
        </aside>
      </div>
    </section>
  );
}
