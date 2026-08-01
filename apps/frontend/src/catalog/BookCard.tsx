import type { PublicBook, PublicLocale } from './public.types';

type BookCardProps = {
  book: PublicBook;
  locale: PublicLocale;
  go: (to: string) => void;
  compact?: boolean;
};

const text = {
  en: {
    available: 'available',
    unavailable: 'Currently unavailable',
    copies: 'copies',
    details: 'View details',
    by: 'By',
    noAuthor: 'Author not listed',
    noCover: 'No cover available',
    coverOf: 'Cover of',
    category: 'Uncategorized',
  },
  ar: {
    available: 'متاح',
    unavailable: 'غير متاح حالياً',
    copies: 'نسخ',
    details: 'عرض التفاصيل',
    by: 'تأليف',
    noAuthor: 'المؤلف غير مذكور',
    noCover: 'لا توجد صورة غلاف',
    coverOf: 'غلاف كتاب',
    category: 'غير مصنف',
  },
} as const;

function localTitle(book: PublicBook, locale: PublicLocale): string {
  return locale === 'ar' ? book.titleAr || book.title : book.title;
}

function authorNames(book: PublicBook, locale: PublicLocale): string {
  return book.authors
    .map(({ author }) => (locale === 'ar' ? author.nameAr || author.name : author.name))
    .join('، ');
}

export function BookCard({ book, locale, go, compact = false }: BookCardProps): JSX.Element {
  const labels = text[locale];
  const title = localTitle(book, locale);
  const authors = authorNames(book, locale) || labels.noAuthor;
  const category =
    locale === 'ar'
      ? book.category?.nameAr || book.category?.nameEn || labels.category
      : book.category?.nameEn || labels.category;
  const available = book.availableCopies > 0;
  const availability = available
    ? `${book.availableCopies} ${labels.available} · ${book.totalCopies} ${labels.copies}`
    : `${labels.unavailable} · ${book.totalCopies} ${labels.copies}`;

  return (
    <article
      className={`catalog-book-card${compact ? ' catalog-book-card--compact' : ''}`}
      aria-label={`${title}. ${availability}`}
    >
      <div className="catalog-book-card__cover">
        {book.coverImageUrl ? (
          <img src={book.coverImageUrl} alt={`${labels.coverOf} ${title}`} />
        ) : (
          <span className="no-cover" role="img" aria-label={labels.noCover}>
            <span aria-hidden="true">{title.slice(0, 1)}</span>
            <small>{labels.noCover}</small>
          </span>
        )}
      </div>
      <div className="catalog-book-card__body">
        <span className="category-label">{category}</span>
        <h3>{title}</h3>
        <p className="catalog-book-card__authors">
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
