import type { PublicLocale } from './public.types';
import { NawaHeroIllustration } from './NawaHeroIllustration';
import { PublicIcon } from './PublicIcon';

type Props = {
  locale: PublicLocale;
  onBrowseBooks: () => void;
  onCampus: () => void;
};

const copy = {
  ar: {
    firstLine: 'اكتشف كل ما ينمّي',
    secondLine: 'معرفتك',
    introduction: 'كتب، أدوات وتقنيات مختارة بعناية تساعدك تتعلم وتتطور.',
    actions: 'استكشف نَوَى',
    browseBooks: 'تصفح الكتب',
    campus: 'مكتبة الكلية',
    delivery: 'توصيل سريع',
    secure: 'دفع آمن',
    return: 'إرجاع سهل',
    quality: 'جودة مضمونة',
  },
  en: {
    firstLine: 'Discover everything that grows',
    secondLine: 'your knowledge',
    introduction: 'Carefully selected books, tools, and technology to help you learn and grow.',
    actions: 'Explore NAWA',
    browseBooks: 'Browse books',
    campus: 'Campus Library',
    delivery: 'Fast delivery',
    secure: 'Secure payment',
    return: 'Easy returns',
    quality: 'Quality guaranteed',
  },
} as const;

export function HeroBanner({ locale, onBrowseBooks, onCampus }: Props): JSX.Element {
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
          <button type="button" className="nawa-hero__action is-secondary" onClick={onCampus}>
            <PublicIcon name="book" />
            {labels.campus}
          </button>
        </div>
        <div
          className="hero-trust-row"
          role="list"
          aria-label={locale === 'ar' ? 'مزايا الخدمة' : 'Service benefits'}
        >
          <span role="listitem">
            <PublicIcon name="delivery" />
            {labels.delivery}
          </span>
          <span role="listitem">
            <PublicIcon name="security" />
            {labels.secure}
          </span>
          <span role="listitem">
            <PublicIcon name="return" />
            {labels.return}
          </span>
          <span role="listitem">
            <PublicIcon name="quality" />
            {labels.quality}
          </span>
        </div>
      </div>
    </section>
  );
}
