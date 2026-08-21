import type { PublicLocale } from '../catalog/public.types';

type Props = {
  locale: PublicLocale;
  currentPath: string;
  go: (to: string) => void;
};

const copy = {
  ar: { label: 'التنقل في حساب العضو', loans: 'إعاراتي', reservations: 'حجوزاتي' },
  en: {
    label: 'Member account navigation',
    loans: 'My Loans',
    reservations: 'My Reservations',
  },
} as const;

export function MemberAreaNav({ locale, currentPath, go }: Props): JSX.Element {
  const labels = copy[locale];
  const items = [
    { path: '/my-loans', label: labels.loans, icon: '▣' },
    { path: '/my-reservations', label: labels.reservations, icon: '◇' },
  ];

  return (
    <nav className="member-area-nav" aria-label={labels.label}>
      {items.map((item) => {
        const current = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
        return (
          <button
            key={item.path}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => go(item.path)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
