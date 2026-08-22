import { useEffect, useState } from 'react';
import { BookShelfCard } from '../catalog/BookShelfCard';
import type { PublicLocale } from '../catalog/public.types';
import { requestMessage } from '../lib/api';
import { getMyRecommendations, type RecommendationResult } from './api';

type Props = {
  accessToken: string;
  locale: PublicLocale;
  go: (to: string) => void;
};

const copy = {
  ar: {
    personalized: 'مقترحة لك',
    cold_start: 'كتب قد تهمك',
    fallback: 'اختيارات من فهرس المكتبة',
    personalizedDescription: 'اختيارات ذكية بناءً على اهتماماتك واستعاراتك السابقة',
    coldDescription: 'ابدأ استكشاف مقتنيات مكتبة جامعة الدلتا المتاحة لك.',
    fallbackDescription: 'اختيارات موثوقة ومتاحة من فهرس مكتبة جامعة الدلتا.',
    loading: 'جارٍ تجهيز كتب مقترحة لك',
    error: 'تعذر تحميل المقترحات الآن. بقية الصفحة ما زالت متاحة.',
    empty: 'لا توجد مقترحات متاحة الآن.',
    retry: 'إعادة المحاولة',
    smart: 'اختيارات ذكية',
    catalog: 'من فهرس المكتبة',
  },
  en: {
    personalized: 'Recommended for You',
    cold_start: 'Books You May Like',
    fallback: 'Library Catalog Picks',
    personalizedDescription: 'Smart choices based on your interests and borrowing history.',
    coldDescription: 'Start exploring books available from Delta University Library.',
    fallbackDescription: 'Reliable available choices from the Delta University Library catalog.',
    loading: 'Preparing book recommendations',
    error: 'Recommendations are unavailable right now. The rest of the page is still available.',
    empty: 'No recommendations are available right now.',
    retry: 'Try again',
    smart: 'Smart choices',
    catalog: 'From the library catalog',
  },
} as const;

export function RecommendationsSection({ accessToken, locale, go }: Props): JSX.Element {
  const labels = copy[locale];
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setResult(null);
    setError('');
    void getMyRecommendations(accessToken, 4, locale)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(requestMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [accessToken, locale, retry]);

  const mode = result?.mode ?? 'personalized';
  const title = labels[mode];
  const description =
    mode === 'personalized'
      ? labels.personalizedDescription
      : mode === 'cold_start'
        ? labels.coldDescription
        : labels.fallbackDescription;

  return (
    <section
      className={`recommendations-section recommendations-section--${mode}`}
      aria-labelledby="recommendations-heading"
      data-testid="recommendations-section"
    >
      <div className="book-shelf-heading recommendations-heading">
        <div>
          <span className="recommendations-kicker" aria-hidden="true">
            ✦ {mode === 'personalized' ? labels.smart : labels.catalog}
          </span>
          <h2 id="recommendations-heading">{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {!result && !error && (
        <div className="recommendations-loading" role="status" aria-label={labels.loading}>
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </div>
      )}
      {error && (
        <div className="recommendations-state recommendations-state--error" role="alert">
          <p>{labels.error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {labels.retry}
          </button>
          <span className="sr-only">{error}</span>
        </div>
      )}
      {result?.items.length === 0 && (
        <p className="recommendations-state" role="status">
          {labels.empty}
        </p>
      )}
      {result && result.items.length > 0 && (
        <div className="recommendations-grid">
          {result.items.map(({ book, reason }) => (
            <BookShelfCard
              key={book.id}
              book={book}
              locale={locale}
              go={go}
              campusScope
              recommendationReason={reason}
            />
          ))}
        </div>
      )}
    </section>
  );
}
