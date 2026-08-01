import { useState } from 'react';
import type { PublicBook, PublicLocale } from './public.types';
import { PublicIcon } from './PublicIcon';

type Props = { book: PublicBook; locale: PublicLocale; go: (to: string) => void; isNew?: boolean };

function coverVariant(id: string): number {
  return Array.from(id).reduce((total, character) => total + character.codePointAt(0)!, 0) % 4;
}

function coverTitle(title: string): string {
  const characters = Array.from(title.trim());
  return characters.length > 28 ? `${characters.slice(0, 27).join('')}…` : title;
}

function BrandedFallback({
  title,
  author,
  label,
  variant,
}: {
  title: string;
  author: string;
  label: string;
  variant: number;
}): JSX.Element {
  return (
    <span className={`shelf-no-cover shelf-no-cover--${variant + 1}`} role="img" aria-label={label}>
      <span className="fallback-cover__brand" aria-hidden="true">
        <i />
        <b>نَوَى</b>
      </span>
      <strong aria-hidden="true">{coverTitle(title)}</strong>
      {author && <small aria-hidden="true">{author}</small>}
      <span className="fallback-cover__lines" aria-hidden="true" />
    </span>
  );
}

function ShelfCover({
  url,
  title,
  author,
  noCoverLabel,
  coverLabel,
  variant,
}: {
  url?: string;
  title: string;
  author: string;
  noCoverLabel: string;
  coverLabel: string;
  variant: number;
}): JSX.Element {
  const [failed, setFailed] = useState(false);

  return url && !failed ? (
    <img
      src={url}
      alt={coverLabel}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : (
    <BrandedFallback title={title} author={author} label={noCoverLabel} variant={variant} />
  );
}

export function BookShelfCard({ book, locale, go, isNew = false }: Props): JSX.Element {
  const title = locale === 'ar' ? book.titleAr || book.title : book.title;
  const authors = book.authors
    .map(({ author }) => (locale === 'ar' ? author.nameAr || author.name : author.name))
    .join('، ');
  const firstAuthor = book.authors[0]?.author;
  const fallbackAuthor = firstAuthor
    ? locale === 'ar'
      ? firstAuthor.nameAr || firstAuthor.name
      : firstAuthor.name
    : '';
  const available = book.availableCopies > 0;
  const labels =
    locale === 'ar'
      ? {
          available: 'متوفر',
          unavailable: 'غير متوفر',
          details: 'تفاصيل الكتاب',
          new: 'جديد',
          noCover: 'لا يوجد غلاف',
        }
      : {
          available: 'Available',
          unavailable: 'Unavailable',
          details: 'Book details',
          new: 'New',
          noCover: 'No cover',
        };

  return (
    <article
      className="book-shelf-card"
      aria-label={`${title}. ${available ? labels.available : labels.unavailable}`}
    >
      <div className="book-shelf-card__cover">
        {isNew && <span className="new-book-badge">{labels.new}</span>}
        <ShelfCover
          key={book.coverImageUrl || 'fallback'}
          url={book.coverImageUrl}
          title={title}
          author={fallbackAuthor}
          noCoverLabel={`${labels.noCover}: ${title}`}
          coverLabel={`${title} ${locale === 'ar' ? 'غلاف' : 'cover'}`}
          variant={coverVariant(book.id)}
        />
      </div>
      <div className="book-shelf-card__content">
        <h3>{title}</h3>
        <p>{authors || (locale === 'ar' ? 'مؤلف غير محدد' : 'Author not listed')}</p>
        <span className={available ? 'shelf-available' : 'shelf-unavailable'}>
          <i aria-hidden="true" />
          {available ? labels.available : labels.unavailable}
        </span>
      </div>
      <button
        className="book-shelf-card__action"
        aria-label={`${labels.details}: ${title}`}
        onClick={() => go(`/books/${book.slug}`)}
      >
        <PublicIcon name="arrow" />
      </button>
    </article>
  );
}
