import { BookCoverMedia } from './BookCoverMedia';
import { publicCategoryName, type PublicBook, type PublicLocale } from './public.types';
import { PublicIcon } from './PublicIcon';

type BookCardProps = {
  book: PublicBook;
  locale: PublicLocale;
  go: (to: string) => void;
  compact?: boolean;
  availabilityScope?: 'catalog' | 'campus';
};

const text = {
  en: {
    available: 'available',
    unavailable: 'Currently unavailable',
    copies: 'copies',
    copy: 'copy',
    details: 'View details',
    by: 'By',
    noAuthor: 'Author not listed',
    noCover: 'No cover available',
    coverOf: 'Cover of',
    category: 'Uncategorized',
    campusAvailable: 'Available in the University Library',
    campusUnavailable: 'Currently unavailable in the University Library',
  },
  ar: {
    available: 'متاح',
    unavailable: 'غير متاح حالياً',
    copies: 'نسخ',
    copy: 'نسخة',
    details: 'عرض التفاصيل',
    by: 'تأليف',
    noAuthor: 'المؤلف غير مذكور',
    noCover: 'لا توجد صورة غلاف',
    coverOf: 'غلاف كتاب',
    category: 'غير مصنف',
    campusAvailable: 'متاح في المكتبة الجامعية',
    campusUnavailable: 'غير متاح حاليًا في المكتبة الجامعية',
  },
} as const;

function localTitle(book: PublicBook, locale: PublicLocale): string {
  return locale === 'ar' ? book.titleAr || book.title : book.title;
}

function authorNames(book: PublicBook, locale: PublicLocale): string {
  return book.authors
    .map(({ author }) => (locale === 'ar' ? author.nameAr || author.name : author.name))
    .join(locale === 'ar' ? '، ' : ', ');
}

export function BookCard({
  book,
  locale,
  go,
  compact = false,
  availabilityScope = 'catalog',
}: BookCardProps): JSX.Element {
  const labels = text[locale];
  const title = localTitle(book, locale);
  const authors = authorNames(book, locale) || labels.noAuthor;
  const firstAuthor = book.authors[0]?.author;
  const fallbackAuthor = firstAuthor
    ? locale === 'ar'
      ? firstAuthor.nameAr || firstAuthor.name
      : firstAuthor.name
    : '';
  const category = (book.category && publicCategoryName(book.category, locale)) || labels.category;
  const campus = book.campusAvailability?.hasPhysicalCopies === true;
  const campusAvailable = (book.campusAvailability?.availableCopies ?? 0) > 0;
  const availableCopies =
    availabilityScope === 'campus'
      ? (book.campusAvailability?.availableCopies ?? 0)
      : book.availableCopies;
  const totalCopies =
    availabilityScope === 'campus' ? (book.campusAvailability?.totalCopies ?? 0) : book.totalCopies;
  const available = availableCopies > 0;
  const availability = available
    ? `${availableCopies} ${labels.available} · ${totalCopies} ${totalCopies === 1 ? labels.copy : labels.copies}`
    : `${labels.unavailable} · ${totalCopies} ${totalCopies === 1 ? labels.copy : labels.copies}`;

  return (
    <article
      className={`catalog-book-card${compact ? ' catalog-book-card--compact' : ''}`}
      aria-label={`${title}. ${availability}`}
    >
      <div className="catalog-book-card__cover">
        <BookCoverMedia
          key={book.coverImageUrl || 'fallback'}
          url={book.coverImageUrl}
          title={title}
          author={fallbackAuthor}
          coverLabel={`${labels.coverOf} ${title}`}
          noCoverLabel={`${labels.noCover}: ${title}`}
          variantKey={book.id}
        />
      </div>
      <div className="catalog-book-card__body">
        {campus && (
          <span
            className={`campus-book-badge${campusAvailable ? ' is-available' : ' is-unavailable'}`}
          >
            <PublicIcon name="book" />
            {campusAvailable ? labels.campusAvailable : labels.campusUnavailable}
          </span>
        )}
        <span className="category-label">{category}</span>
        <h3 dir="auto" title={title}>
          {title}
        </h3>
        <p className="catalog-book-card__authors" dir="auto" title={authors}>
          <span className="sr-only">{labels.by} </span>
          {authors}
        </p>
        <p
          className={`availability-label ${available ? 'is-available' : 'is-unavailable'}`}
          aria-label={availability}
        >
          <span aria-hidden="true" className="availability-dot" />
          {availability}
        </p>
        <button
          type="button"
          className="catalog-book-card__action"
          aria-label={`${labels.details}: ${title}`}
          onClick={() => go(`/books/${book.slug}`)}
        >
          {labels.details}
          <span aria-hidden="true" className="directional-arrow">
            →
          </span>
        </button>
      </div>
    </article>
  );
}
