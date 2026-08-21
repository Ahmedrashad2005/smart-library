import type { PublicLocale } from './public.types';
import { PublicIcon, type PublicIconName } from './PublicIcon';

const services: Record<
  PublicLocale,
  Array<{ icon: PublicIconName; title: string; text: string }>
> = {
  ar: [
    { icon: 'book', title: 'فهرس جامعي', text: 'كتب ومراجع لخدمة الدراسة والبحث' },
    { icon: 'categories', title: 'تصفح حسب الكلية', text: 'مسارات أكاديمية منظمة وواضحة' },
    { icon: 'history', title: 'استعارة سهلة', text: 'تابع إعاراتك وحجوزاتك من حسابك' },
    { icon: 'location', title: 'موقع دقيق', text: 'اعرف مكان النسخة داخل المكتبة' },
  ],
  en: [
    {
      icon: 'book',
      title: 'University catalog',
      text: 'Books and references for study and research',
    },
    { icon: 'categories', title: 'Browse by faculty', text: 'Clear, organized academic paths' },
    {
      icon: 'history',
      title: 'Simple borrowing',
      text: 'Track loans and reservations in your account',
    },
    { icon: 'location', title: 'Precise location', text: 'Find each copy inside the library' },
  ],
};

export function BottomServiceStrip({ locale }: { locale: PublicLocale }): JSX.Element {
  return (
    <footer className="delta-library-footer">
      <section
        className="bottom-service-strip"
        aria-label={
          locale === 'ar' ? 'مزايا مكتبة جامعة الدلتا' : 'Delta University Library features'
        }
      >
        {services[locale].map((service) => (
          <div className="service-feature" key={service.title}>
            <span>
              <PublicIcon name={service.icon} />
            </span>
            <div>
              <h2>{service.title}</h2>
              <p>{service.text}</p>
            </div>
          </div>
        ))}
      </section>
      <p className="powered-by-nawa">Powered by NAWA · نَوَى</p>
    </footer>
  );
}
