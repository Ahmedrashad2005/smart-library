import { useEffect, useState } from 'react';
import type { PublicLocale } from '../catalog/public.types';
import { FacultyGrid } from './FacultyGrid';
import { listFaculties, type Faculty } from './api';

type Props = {
  locale: PublicLocale;
  go: (to: string) => void;
};

const copy = {
  ar: {
    eyebrow: 'تعلّم حسب تخصصك',
    heading: 'كليات جامعة الدلتا',
    description: 'بوابتك إلى المراجع والكتب الأكاديمية المرتبطة بكل كلية.',
    all: 'عرض كل الكليات',
    loading: 'جارٍ تحميل كليات جامعة الدلتا',
    error: 'تعذر تحميل الكليات الآن.',
    retry: 'إعادة المحاولة',
  },
  en: {
    eyebrow: 'Learn by discipline',
    heading: 'Delta University Faculties',
    description: 'Your gateway to academic references and books organized by faculty.',
    all: 'View all faculties',
    loading: 'Loading Delta University faculties',
    error: 'Faculties could not be loaded right now.',
    retry: 'Try again',
  },
} as const;

export function FacultiesSection({ locale, go }: Props): JSX.Element {
  const labels = copy[locale];
  const [faculties, setFaculties] = useState<Faculty[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setFaculties(null);
    setError(false);
    void listFaculties()
      .then((result) => {
        if (active) setFaculties(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  return (
    <section className="faculties-section" aria-labelledby="faculties-home-heading">
      <div className="faculties-section__heading">
        <div>
          <p>{labels.eyebrow}</p>
          <h2 id="faculties-home-heading">{labels.heading}</h2>
          <span>{labels.description}</span>
        </div>
        <button type="button" onClick={() => go('/faculties')}>
          {labels.all}
          <span aria-hidden="true">←</span>
        </button>
      </div>
      {error ? (
        <div className="faculty-state is-error" role="alert">
          <p>{labels.error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            {labels.retry}
          </button>
        </div>
      ) : faculties === null ? (
        <div className="faculty-loading" role="status" aria-label={labels.loading}>
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} aria-hidden="true" />
          ))}
        </div>
      ) : (
        <FacultyGrid faculties={faculties.slice(0, 8)} locale={locale} go={go} />
      )}
    </section>
  );
}
