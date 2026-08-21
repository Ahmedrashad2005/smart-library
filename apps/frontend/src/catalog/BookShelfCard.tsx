import { BookCoverMedia } from './BookCoverMedia';
import type { PublicBook, PublicLocale } from './public.types';
import { PublicIcon } from './PublicIcon';

type Props = {
  book: PublicBook;
  locale: PublicLocale;
  go: (to: string) => void;
  isNew?: boolean;
  campusScope?: boolean;
};

export function BookShelfCard({
  book,
  locale,
  go,
  isNew = false,
  campusScope = false,
}: Props): JSX.Element {
  const title = locale === 'ar' ? book.titleAr || book.title : book.title;
  const authors = book.authors
    .map(({ author }) => (locale === 'ar' ? author.nameAr || author.name : author.name))
    .join(locale === 'ar' ? '، ' : ', ');
  const authorText = authors || (locale === 'ar' ? 'مؤلف غير محدد' : 'Author not listed');
  const firstAuthor = book.authors[0]?.author;
  const fallbackAuthor = firstAuthor
    ? locale === 'ar'
      ? firstAuthor.nameAr || firstAuthor.name
      : firstAuthor.name
    : '';
  const campus = book.campusAvailability?.hasPhysicalCopies === true;
  const campusAvailable = (book.campusAvailability?.availableCopies ?? 0) > 0;
  const available = campusScope ? campusAvailable : book.availableCopies > 0;
  const labels =
    locale === 'ar'
      ? {
          available: 'متوفر',
          unavailable: 'غير متوفر',
          details: 'تفاصيل الكتاب',
          new: 'جديد',
          noCover: 'لا يوجد غلاف',
          campusAvailable: 'في المكتبة الجامعية',
          campusUnavailable: 'غير متاح في المكتبة الجامعية',
        }
      : {
          available: 'Available',
          unavailable: 'Unavailable',
          details: 'Book details',
          new: 'New',
          noCover: 'No cover',
          campusAvailable: 'University Library',
          campusUnavailable: 'Unavailable at the University Library',
        };

  return (
    <article
      className="book-shelf-card"
      aria-label={`${title}. ${available ? labels.available : labels.unavailable}`}
    >
      <div className="book-shelf-card__cover">
        {isNew && <span className="new-book-badge">{labels.new}</span>}
        <BookCoverMedia
          key={book.coverImageUrl || 'fallback'}
          url={book.coverImageUrl}
          title={title}
          author={fallbackAuthor}
          noCoverLabel={`${labels.noCover}: ${title}`}
          coverLabel={`${title} ${locale === 'ar' ? 'غلاف' : 'cover'}`}
          variantKey={book.id}
        />
      </div>
      <div className="book-shelf-card__content">
        {campus && (
          <span
            className={`shelf-campus-badge${campusAvailable ? ' is-available' : ' is-unavailable'}`}
          >
            <PublicIcon name="book" />
            {campusAvailable ? labels.campusAvailable : labels.campusUnavailable}
          </span>
        )}
        <h3 dir="auto" title={title}>
          {title}
        </h3>
        <p dir="auto" title={authorText}>
          {authorText}
        </p>
        <span className={available ? 'shelf-available' : 'shelf-unavailable'}>
          <i aria-hidden="true" />
          {available ? labels.available : labels.unavailable}
        </span>
      </div>
      <button
        type="button"
        className="book-shelf-card__action"
        aria-label={`${labels.details}: ${title}`}
        onClick={() => go(`/books/${book.slug}`)}
      >
        <PublicIcon name="arrow" />
      </button>
    </article>
  );
}
