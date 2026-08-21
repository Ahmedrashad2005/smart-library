import type { PublicLocale } from '../catalog/public.types';
import { PublicIcon } from '../catalog/PublicIcon';
import type { Faculty } from './api';
import { facultyBranding, facultyName } from './faculty.utils';

type Props = {
  faculties: Faculty[];
  locale: PublicLocale;
  go: (to: string) => void;
};

export function FacultyGrid({ faculties, locale, go }: Props): JSX.Element {
  return (
    <div className="faculty-grid">
      {faculties.map((faculty, index) => {
        const name = facultyName(faculty, locale);
        const branding = facultyBranding(faculty, locale);
        const arabicFallback = locale === 'en' && !faculty.nameEn;
        const openLabel = locale === 'ar' ? `استعرض كتب ${name}` : `Browse faculty books: ${name}`;
        return (
          <button
            type="button"
            className={`faculty-card faculty-card--${(index % 5) + 1}`}
            aria-label={openLabel}
            onClick={() => go(`/faculties/${faculty.slug}`)}
            key={faculty.id}
          >
            <span className={`faculty-card__icon${branding ? ' has-logo' : ''}`}>
              {branding ? (
                <img src={branding.logoSrc} alt={branding.logoAlt} />
              ) : (
                <span aria-hidden="true">
                  <PublicIcon name={index === 9 ? 'categories' : 'book'} />
                </span>
              )}
            </span>
            <span className="faculty-card__copy">
              <strong
                dir={arabicFallback ? 'rtl' : 'auto'}
                lang={arabicFallback ? 'ar' : undefined}
              >
                {name}
              </strong>
              <small>
                {faculty.bookCount > 0
                  ? locale === 'ar'
                    ? `${faculty.bookCount} كتاب مرتبط`
                    : `${faculty.bookCount} assigned ${faculty.bookCount === 1 ? 'book' : 'books'}`
                  : locale === 'ar'
                    ? 'بانتظار الربط الأكاديمي المعتمد'
                    : 'Awaiting approved academic mapping'}
              </small>
            </span>
            <span className="faculty-card__arrow" aria-hidden="true">
              ←
            </span>
          </button>
        );
      })}
    </div>
  );
}
