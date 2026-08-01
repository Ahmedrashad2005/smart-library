import type { PublicBook, PublicLocale } from './public.types';
import { BookShelfCard } from './BookShelfCard';
import { PublicIcon } from './PublicIcon';

type Props = {
  id: string;
  title: string;
  books: PublicBook[] | null;
  locale: PublicLocale;
  go: (to: string) => void;
  loadingLabel: string;
  tone: 'new' | 'popular' | 'available';
};

export function BookShelfSection({
  id,
  title,
  books,
  locale,
  go,
  loadingLabel,
  tone,
}: Props): JSX.Element | null {
  if (books?.length === 0) return null;
  const viewAll = locale === 'ar' ? 'عرض الكل' : 'View all';
  return (
    <section
      id={id}
      className={`book-shelf-section book-shelf-section--${tone}`}
      aria-labelledby={`${id}-heading`}
    >
      <div className="book-shelf-heading">
        <h2 id={`${id}-heading`}>
          {tone === 'popular' && <PublicIcon name="sparkles" />}
          {title}
        </h2>
        <button onClick={() => go('/books')}>{viewAll}</button>
      </div>
      {books === null ? (
        <div className="shelf-loading" role="status" aria-label={loadingLabel}>
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </div>
      ) : (
        <div className="book-shelf-row">
          {books.slice(0, 5).map((book) => (
            <BookShelfCard
              book={book}
              locale={locale}
              go={go}
              isNew={tone === 'new'}
              key={book.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
