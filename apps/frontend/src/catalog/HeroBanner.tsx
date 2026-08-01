import type { FormEvent } from 'react';
import type { PublicCategory, PublicLocale } from './public.types';
import { NawaHeroIllustration } from './NawaHeroIllustration';
import { PublicIcon } from './PublicIcon';

type Props = {
  locale: PublicLocale;
  query: string;
  categoryId: string;
  categories: PublicCategory[] | null;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

const copy = {
  ar: {
    firstLine: 'اكتشف عالم المعرفة',
    secondLine: 'بين يديك',
    introduction: 'آلاف الكتب المختارة بعناية لتلهم فكرك وتثري معرفتك',
    label: 'البحث في فهرس نَوَى',
    placeholder: 'ابحث عن كتاب، مؤلف أو موضوع...',
    categories: 'جميع الأقسام',
    search: 'بحث',
    delivery: 'توصيل سريع',
    secure: 'دفع آمن',
    return: 'إرجاع سهل',
    quality: 'جودة مضمونة',
  },
  en: {
    firstLine: 'Discover a world of knowledge',
    secondLine: 'within your reach',
    introduction:
      'Thousands of carefully selected books to inspire your thinking and enrich your knowledge',
    label: 'Search the NAWA catalog',
    placeholder: 'Search for a book, author, or topic...',
    categories: 'All categories',
    search: 'Search',
    delivery: 'Fast delivery',
    secure: 'Secure payment',
    return: 'Easy returns',
    quality: 'Quality guaranteed',
  },
} as const;

export function HeroBanner({
  locale,
  query,
  categoryId,
  categories,
  onQueryChange,
  onCategoryChange,
  onSubmit,
}: Props): JSX.Element {
  const labels = copy[locale];
  const categoryName = (category: PublicCategory) =>
    locale === 'ar' ? category.nameAr : category.nameEn;

  return (
    <section className="nawa-hero" aria-labelledby="nawa-hero-heading">
      <div className="nawa-hero__visual" aria-hidden="true">
        <NawaHeroIllustration />
      </div>
      <div className="nawa-hero__content">
        <h1 id="nawa-hero-heading">
          <span>{labels.firstLine}</span>
          <strong>{labels.secondLine}</strong>
        </h1>
        <p>{labels.introduction}</p>
        <form className="hero-search" role="search" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="catalog-search">
            {labels.label}
          </label>
          <select
            aria-label={labels.categories}
            value={categoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="">{labels.categories}</option>
            {(categories || []).map((category) => (
              <option value={category.id} key={category.id}>
                {categoryName(category)}
              </option>
            ))}
          </select>
          <input
            id="catalog-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={labels.placeholder}
          />
          <button className="hero-search__submit" aria-label={labels.search}>
            <PublicIcon name="search" />
          </button>
        </form>
        <div
          className="hero-trust-row"
          aria-label={locale === 'ar' ? 'مزايا الخدمة' : 'Service benefits'}
        >
          <span>
            <PublicIcon name="delivery" />
            {labels.delivery}
          </span>
          <span>
            <PublicIcon name="security" />
            {labels.secure}
          </span>
          <span>
            <PublicIcon name="return" />
            {labels.return}
          </span>
          <span>
            <PublicIcon name="quality" />
            {labels.quality}
          </span>
        </div>
      </div>
    </section>
  );
}
