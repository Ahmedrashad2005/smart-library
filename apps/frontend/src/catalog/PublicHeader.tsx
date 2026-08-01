import type { PublicLocale, PublicSession } from './public.types';
import { MainHeader } from './MainHeader';
import { PublicTopUtilityBar } from './PublicTopUtilityBar';

type PublicHeaderProps = {
  locale: PublicLocale;
  currentPath: string;
  session: PublicSession | null;
  go: (to: string) => void;
  onLanguageChange: () => void;
  onSignOut: () => void;
};

export function PublicHeader({
  locale,
  currentPath,
  session,
  go,
  onLanguageChange,
  onSignOut,
}: PublicHeaderProps): JSX.Element {
  return (
    <header className="public-header">
      <PublicTopUtilityBar
        locale={locale}
        session={session}
        go={go}
        onLanguageChange={onLanguageChange}
        onSignOut={onSignOut}
      />
      <MainHeader locale={locale} currentPath={currentPath} session={session} go={go} />
    </header>
  );
}
