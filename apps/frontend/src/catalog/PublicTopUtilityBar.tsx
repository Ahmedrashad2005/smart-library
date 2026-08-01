import type { PublicLocale, PublicSession } from './public.types';
import { PublicIcon } from './PublicIcon';

type Props = {
  locale: PublicLocale;
  session: PublicSession | null;
  go: (to: string) => void;
  onLanguageChange: () => void;
  onSignOut: () => void;
};

const copy = {
  ar: {
    language: 'العربية',
    favorites: 'المفضلة',
    account: 'حسابي',
    offers: 'عروض الأسبوع',
    tracking: 'متابعة الإعارات',
    help: 'المساعدة',
    location: 'متاح في: الرياض',
    signOut: 'خروج',
    unavailable: 'ستتوفر في مرحلة لاحقة',
  },
  en: {
    language: 'English',
    favorites: 'Favorites',
    account: 'My account',
    offers: 'Weekly picks',
    tracking: 'Track loans',
    help: 'Help',
    location: 'Available in: Riyadh',
    signOut: 'Sign out',
    unavailable: 'Available in a later phase',
  },
} as const;

export function PublicTopUtilityBar({
  locale,
  session,
  go,
  onLanguageChange,
  onSignOut,
}: Props): JSX.Element {
  const labels = copy[locale];
  const accountPath =
    session?.role === 'ADMIN'
      ? '/admin/categories'
      : session?.role === 'LIBRARIAN'
        ? '/librarian/books'
        : '/my-loans';

  return (
    <div className="public-utility">
      <div className="public-utility__inner">
        <div className="public-utility__group">
          <button
            className="utility-action"
            title={locale === 'ar' ? 'Switch language to English' : 'تغيير اللغة إلى العربية'}
            onClick={onLanguageChange}
          >
            <PublicIcon name="globe" />
            <span>{labels.language}</span>
            <span aria-hidden="true" className="utility-chevron">
              ⌄
            </span>
          </button>
          <span className="utility-divider" aria-hidden="true" />
          <span className="utility-static" title={labels.unavailable}>
            <PublicIcon name="heart" />
            {labels.favorites}
          </span>
          <span className="utility-divider" aria-hidden="true" />
          <button className="utility-action" onClick={() => go(accountPath)}>
            <PublicIcon name="account" />
            <span>{session?.fullName || labels.account}</span>
          </button>
          {session && (
            <button className="utility-signout" onClick={onSignOut}>
              {labels.signOut}
            </button>
          )}
        </div>
        <div className="public-utility__group public-utility__support">
          <span className="utility-offer" title={labels.unavailable}>
            {labels.offers}
          </span>
          <button className="utility-action" onClick={() => go('/my-loans')}>
            <PublicIcon name="history" />
            {labels.tracking}
          </button>
          <span className="utility-static" title={labels.unavailable}>
            <PublicIcon name="help" />
            {labels.help}
          </span>
          <span className="utility-static">
            <PublicIcon name="delivery" />
            {labels.location}
          </span>
        </div>
      </div>
    </div>
  );
}
