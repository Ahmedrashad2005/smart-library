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
    account: 'تسجيل الدخول إلى حساب الطالب',
    signOut: 'تسجيل الخروج',
    accountMenu: 'قائمة حساب الطالب',
    accountArea: 'الذهاب إلى مساحة العمل',
    myLoans: 'إعاراتي',
    myReservations: 'حجوزاتي',
    faculties: 'كليات جامعة الدلتا',
    campus: 'المكتبة الجامعية',
    utilityNavigation: 'روابط مكتبة جامعة الدلتا',
  },
  en: {
    language: 'العربية',
    account: 'Student account sign in',
    signOut: 'Sign out',
    accountMenu: 'Student account menu',
    accountArea: 'Go to workspace',
    myLoans: 'My loans',
    myReservations: 'My reservations',
    faculties: 'Delta University faculties',
    campus: 'University Library',
    utilityNavigation: 'Delta University Library links',
  },
} as const;

export function PublicTopUtilityBar({
  locale,
  session,
  go,
  onLanguageChange,
  onSignOut,
}: Props): JSX.Element {
  const [accountOpen, setAccountOpen] = useState(false);
  const labels = copy[locale];
  const accountPath =
    session?.role === 'ADMIN'
      ? '/admin/categories'
      : session?.role === 'LIBRARIAN'
        ? '/librarian/books'
        : '/my-loans';
  const navigate = (to: string) => {
    setAccountOpen(false);
    go(to);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') setAccountOpen(false);
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
                {session.role === 'MEMBER' ? labels.myLoans : labels.accountArea}
              </button>
              {session.role === 'MEMBER' && (
                <button type="button" role="menuitem" onClick={() => navigate('/my-reservations')}>
                  <PublicIcon name="book" />
                  {labels.myReservations}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAccountOpen(false);
                  onSignOut();
                }}
              >
                <PublicIcon name="return" />
                {labels.signOut}
              </button>
            </div>
          )}
        </div>

        {session?.role === 'MEMBER' && (
          <div className="utility-slot utility-slot--orders">
            <UtilityHeaderItem
              icon="history"
              label={labels.myLoans}
              onClick={() => navigate('/my-loans')}
            />
          </div>
        )}

        {session?.role === 'MEMBER' && (
          <div className="utility-slot utility-slot--reservations">
            <UtilityHeaderItem
              icon="book"
              label={labels.myReservations}
              onClick={() => navigate('/my-reservations')}
            />
          </div>
        )}

        <div className="utility-slot utility-slot--faculties">
          <UtilityHeaderItem
            icon="categories"
            label={labels.faculties}
            onClick={() => navigate('/faculties')}
          />
        </div>

        <div className="utility-slot utility-slot--campus">
          <UtilityHeaderItem
            icon="book"
            label={labels.campus}
            onClick={() => navigate('/campus')}
          />
        </div>

        <div className="utility-slot utility-slot--language">
          <UtilityHeaderItem icon="globe" label={labels.language} onClick={onLanguageChange} />
        </div>
      </nav>
    </div>
  );
}
