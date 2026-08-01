import type { PublicLocale } from './public.types';
import { PublicIcon, type PublicIconName } from './PublicIcon';

const services: Record<
  PublicLocale,
  Array<{ icon: PublicIconName; title: string; text: string }>
> = {
  ar: [
    { icon: 'delivery', title: 'توصيل سريع', text: 'إلى جميع مناطق المملكة' },
    { icon: 'security', title: 'دفع آمن', text: 'خيارات دفع متعددة وآمنة' },
    { icon: 'quality', title: 'جودة مضمونة', text: 'كتب منتقاة من أفضل دور النشر' },
    { icon: 'return', title: 'إرجاع سهل', text: 'إرجاع خلال 7 أيام بكل سهولة' },
  ],
  en: [
    { icon: 'delivery', title: 'Fast delivery', text: 'Across all regions' },
    { icon: 'security', title: 'Secure payment', text: 'Multiple safe payment options' },
    { icon: 'quality', title: 'Quality guaranteed', text: 'Curated from leading publishers' },
    { icon: 'return', title: 'Easy returns', text: 'Simple returns within 7 days' },
  ],
};

export function BottomServiceStrip({ locale }: { locale: PublicLocale }): JSX.Element {
  return (
    <section
      className="bottom-service-strip"
      aria-label={locale === 'ar' ? 'خدمات نَوَى' : 'NAWA services'}
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
  );
}
