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
  tone: 'new' | 'popular' | 'available' | 'campus';
  description?: string;
  actionPath?: string;
};

export function BookShelfSection({
  id,
  title,
  books,
  locale,
  go,
  loadingLabel,
  tone,
  description,
  actionPath = '/books',
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
        <div>
          <h2 id={`${id}-heading`}>
            {tone === 'popular' && <PublicIcon name="sparkles" />}
            {tone === 'campus' && <PublicIcon name="book" />}
            {title}
          </h2>
          {description && <p>{description}</p>}
        </div>
        <button onClick={() => go(actionPath)}>{viewAll}</button>
      </div>
      {books === null ? (
        <div className="shelf-loading" role="status" aria-label={loadingLabel}>
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </div>
      ) : (
        <div className="book-shelf-row">
          {books.slice(0, 6).map((book) => (
            <BookShelfCard
              book={book}
              locale={locale}
              go={go}
              isNew={tone === 'new'}
              campusScope={tone === 'campus'}
              key={book.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
