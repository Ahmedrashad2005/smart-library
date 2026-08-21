import type { PublicLocale } from './public.types';
import { NawaHeroIllustration } from './NawaHeroIllustration';
import { PublicIcon } from './PublicIcon';

type Props = {
  locale: PublicLocale;
  onBrowseBooks: () => void;
  onFaculties: () => void;
};

const copy = {
  ar: {
    firstLine: 'مكتبة جامعة الدلتا',
    secondLine: 'معرفة تدعم مستقبلك',
    introduction: 'اكتشف كتب الجامعة ومراجعها الأكاديمية، واعثر على ما تحتاجه حسب تخصصك.',
    actions: 'استكشف مكتبة جامعة الدلتا',
    browseBooks: 'تصفح فهرس الكتب',
    faculties: 'استعرض الكليات',
    campus: 'مكتبة جامعية فعلية',
    collection: 'مراجع أكاديمية',
    borrowing: 'استعارة منظمة',
    location: 'موقع نسخة واضح',
  },
  en: {
    firstLine: 'Delta University Library',
    secondLine: 'Knowledge for your future',
    introduction:
      'Discover university books and academic references organized around your studies.',
    actions: 'Explore Delta University Library',
    browseBooks: 'Browse the book catalog',
    faculties: 'Explore faculties',
    campus: 'Physical university library',
    collection: 'Academic references',
    borrowing: 'Organized borrowing',
    location: 'Clear copy location',
  },
} as const;

export function HeroBanner({ locale, onBrowseBooks, onFaculties }: Props): JSX.Element {
  const labels = copy[locale];

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
        <div className="nawa-hero__actions" role="group" aria-label={labels.actions}>
          <button type="button" className="nawa-hero__action is-primary" onClick={onBrowseBooks}>
            <PublicIcon name="categories" />
            {labels.browseBooks}
          </button>
          <button type="button" className="nawa-hero__action is-secondary" onClick={onFaculties}>
            <PublicIcon name="categories" />
            {labels.faculties}
          </button>
        </div>
        <div
          className="hero-trust-row"
          role="list"
          aria-label={locale === 'ar' ? 'مزايا الخدمة' : 'Service benefits'}
        >
          <span role="listitem">
            <PublicIcon name="book" />
            {labels.campus}
          </span>
          <span role="listitem">
            <PublicIcon name="quality" />
            {labels.collection}
          </span>
          <span role="listitem">
            <PublicIcon name="history" />
            {labels.borrowing}
          </span>
          <span role="listitem">
            <PublicIcon name="location" />
            {labels.location}
          </span>
        </div>
      </div>
    </section>
  );
}
