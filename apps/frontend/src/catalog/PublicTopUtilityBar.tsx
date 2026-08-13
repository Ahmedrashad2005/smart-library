import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { PublicLocale, PublicSession } from './public.types';
import { PublicIcon } from './PublicIcon';
import { UtilityHeaderItem } from './UtilityHeaderItem';

type Props = {
  locale: PublicLocale;
  session: PublicSession | null;
  go: (to: string) => void;
  onLanguageChange: () => void;
  onSignOut: () => void;
};

const copy = {
  ar: {
    language: 'English',
    favorites: 'المفضلة',
    account: 'ادخل لحسابك أو سجل الآن',
    orders: 'طلباتي',
    services: 'خدمات نَوَى',
    help: 'المساعدة',
    branches: 'فروعنا',
    location: 'حدد موقعك للتوصيل',
    signOut: 'تسجيل الخروج',
    comingSoon: 'قريبًا',
    accountMenu: 'قائمة الحساب',
    accountArea: 'الذهاب إلى حسابي',
    servicesMenu: 'قائمة خدمات نَوَى',
    books: 'الكتب',
    borrowing: 'الاستعارة',
    categories: 'الأقسام',
    campus: 'مكتبة الكلية',
    utilityNavigation: 'روابط وخدمات نَوَى',
  },
  en: {
    language: 'العربية',
    favorites: 'Favorites',
    account: 'Sign in or create an account',
    orders: 'My loans',
    services: 'NAWA services',
    help: 'Help',
    branches: 'Branches',
    location: 'Choose your delivery location',
    signOut: 'Sign out',
    comingSoon: 'Coming soon',
    accountMenu: 'Account menu',
    accountArea: 'Go to my account',
    servicesMenu: 'NAWA services menu',
    books: 'Books',
    borrowing: 'Borrowing',
    categories: 'Categories',
    campus: 'Campus Library',
    utilityNavigation: 'NAWA utility navigation',
  },
} as const;

export function PublicTopUtilityBar({
  locale,
  session,
  go,
  onLanguageChange,
  onSignOut,
}: Props): JSX.Element {
  const [servicesOpen, setServicesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const labels = copy[locale];
  const accountPath =
    session?.role === 'ADMIN'
      ? '/admin/categories'
      : session?.role === 'LIBRARIAN'
        ? '/librarian/books'
        : '/my-loans';
  const closeMenus = () => {
    setServicesOpen(false);
    setAccountOpen(false);
  };
  const navigate = (to: string) => {
    closeMenus();
    go(to);
    if (to.includes('#categories'))
      window.setTimeout(() => document.getElementById('categories')?.scrollIntoView?.(), 0);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') closeMenus();
  };

  return (
    <div className="public-utility" onKeyDown={handleKeyDown}>
      <nav className="public-utility__inner" aria-label={labels.utilityNavigation}>
        <div className="utility-slot utility-slot--account">
          <UtilityHeaderItem
            icon="account"
            label={session?.fullName || labels.account}
            expanded={session ? accountOpen : undefined}
            controls={session ? 'utility-account-menu' : undefined}
            onClick={() => (session ? setAccountOpen((open) => !open) : navigate(accountPath))}
          />
          {session && accountOpen && (
            <div
              id="utility-account-menu"
              className="utility-popover"
              role="menu"
              aria-label={labels.accountMenu}
            >
              <button type="button" role="menuitem" onClick={() => navigate(accountPath)}>
                <PublicIcon name="account" />
                {labels.accountArea}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenus();
                  onSignOut();
                }}
              >
                <PublicIcon name="return" />
                {labels.signOut}
              </button>
            </div>
          )}
        </div>

        <div className="utility-slot utility-slot--favorites">
          <UtilityHeaderItem
            icon="heart"
            label={labels.favorites}
            title={labels.comingSoon}
            suffix={
              <>
                <span className="utility-count" aria-label="0">
                  0
                </span>
                <span className="sr-only">— {labels.comingSoon}</span>
              </>
            }
          />
        </div>

        <div className="utility-slot utility-slot--orders">
          <UtilityHeaderItem
            icon="delivery"
            label={labels.orders}
            onClick={() => navigate('/my-loans')}
          />
        </div>

        <div className="utility-slot utility-slot--services">
          <UtilityHeaderItem
            icon="categories"
            label={labels.services}
            expanded={servicesOpen}
            controls="utility-services-menu"
            onClick={() => setServicesOpen((open) => !open)}
            suffix={<PublicIcon name="chevron" />}
          />
          {servicesOpen && (
            <div
              id="utility-services-menu"
              className="utility-popover"
              role="menu"
              aria-label={labels.servicesMenu}
            >
              <button type="button" role="menuitem" onClick={() => navigate('/books')}>
                <PublicIcon name="book" />
                {labels.books}
              </button>
              <button type="button" role="menuitem" onClick={() => navigate('/campus')}>
                <PublicIcon name="book" />
                {labels.campus}
              </button>
              <button type="button" role="menuitem" onClick={() => navigate('/my-loans')}>
                <PublicIcon name="history" />
                {labels.borrowing}
              </button>
              <button type="button" role="menuitem" onClick={() => navigate('/books#categories')}>
                <PublicIcon name="categories" />
                {labels.categories}
              </button>
            </div>
          )}
        </div>

        <div className="utility-slot utility-slot--help">
          <UtilityHeaderItem icon="help" label={labels.help} title={labels.comingSoon} />
        </div>

        <div className="utility-slot utility-slot--branches">
          <UtilityHeaderItem icon="location" label={labels.branches} title={labels.comingSoon} />
        </div>

        <div className="utility-slot utility-slot--location">
          <UtilityHeaderItem icon="location" label={labels.location} />
        </div>

        <div className="utility-slot utility-slot--language">
          <UtilityHeaderItem icon="globe" label={labels.language} onClick={onLanguageChange} />
        </div>
      </nav>
    </div>
  );
}
