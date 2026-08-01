import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicCategory, PublicLocale } from './public.types';
import { PublicIcon, type PublicIconName } from './PublicIcon';

type Props = {
  locale: PublicLocale;
  categories: PublicCategory[] | null;
  selectedId: string;
  loadingLabel: string;
  emptyLabel: string;
  heading: string;
  onSelect: (id: string) => void;
};

const icons: PublicIconName[] = [
  'categories',
  'book',
  'sparkles',
  'users',
  'quality',
  'heart',
  'history',
  'offer',
];

export function CategoryStrip({
  locale,
  categories,
  selectedId,
  loadingLabel,
  emptyLabel,
  heading,
  onSelect,
}: Props): JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const allLabel = locale === 'ar' ? 'شاهد الكل' : 'View all';
  const previousLabel = locale === 'ar' ? 'التصنيفات السابقة' : 'Previous categories';
  const nextLabel = locale === 'ar' ? 'التصنيفات التالية' : 'Next categories';
  const name = (category: PublicCategory) => (locale === 'ar' ? category.nameAr : category.nameEn);

  const updateEdges = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const maximum = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const distance = Math.abs(scroller.scrollLeft);
    setAtStart(distance <= 1);
    setAtEnd(maximum <= 1 || distance >= maximum - 1);
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [categories, updateEdges]);

  const scroll = (towardEnd: boolean) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const step = Math.max(240, Math.round(scroller.clientWidth * 0.75));
    const rtlDirection = locale === 'ar' ? -1 : 1;
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollBy({
      left: step * rtlDirection * (towardEnd ? 1 : -1),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <section id="categories" className="category-strip" aria-labelledby="category-heading">
      <h2 id="category-heading" className="sr-only">
        {heading}
      </h2>
      {categories === null ? (
        <div className="category-loading" aria-label={loadingLabel} role="status">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <p className="catalog-inline-empty">{emptyLabel}</p>
      ) : (
        <div className="category-strip__navigation">
          <button
            type="button"
            className="category-nav category-nav--previous"
            aria-label={previousLabel}
            aria-controls="category-scroller"
            disabled={atStart}
            onClick={() => scroll(false)}
          >
            <PublicIcon name="arrow" />
          </button>
          <div
            id="category-scroller"
            className="category-scroller"
            role="group"
            aria-label={heading}
            ref={scrollerRef}
            tabIndex={0}
            onScroll={updateEdges}
          >
            <button
              className={`category-tile category-tile--all${selectedId === '' ? ' is-selected' : ''}`}
              aria-pressed={selectedId === ''}
              onClick={() => onSelect('')}
            >
              <span>
                <PublicIcon name="categories" />
              </span>
              <b>{allLabel}</b>
            </button>
            {categories.slice(0, 10).map((category, index) => (
              <button
                className={`category-tile category-tile--${(index % 8) + 1}${selectedId === category.id ? ' is-selected' : ''}`}
                key={category.id}
                aria-label={`${heading}: ${name(category)}`}
                aria-pressed={selectedId === category.id}
                onClick={() => onSelect(category.id)}
              >
                <span>
                  <PublicIcon name={icons[index % icons.length]!} />
                </span>
                <b>{name(category)}</b>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="category-nav category-nav--next"
            aria-label={nextLabel}
            aria-controls="category-scroller"
            disabled={atEnd}
            onClick={() => scroll(true)}
          >
            <PublicIcon name="arrow" />
          </button>
        </div>
      )}
    </section>
  );
}
