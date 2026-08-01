export type PublicIconName =
  | 'account'
  | 'arrow'
  | 'book'
  | 'categories'
  | 'delivery'
  | 'globe'
  | 'heart'
  | 'help'
  | 'history'
  | 'offer'
  | 'quality'
  | 'return'
  | 'search'
  | 'security'
  | 'sparkles'
  | 'users';

export function PublicIcon({ name }: { name: PublicIconName }): JSX.Element {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };
  const paths: Record<PublicIconName, JSX.Element> = {
    account: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </>
    ),
    arrow: (
      <>
        <path d="m9 18 6-6-6-6" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23V5.5Z" />
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23V5.5Z" />
      </>
    ),
    categories: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    delivery: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
      </>
    ),
    heart: (
      <>
        <path d="M20.8 5.8a5.2 5.2 0 0 0-7.4 0L12 7.2l-1.4-1.4a5.2 5.2 0 1 0-7.4 7.4L12 22l8.8-8.8a5.2 5.2 0 0 0 0-7.4Z" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-.8 1-.8 1.6M12 17h.01" />
      </>
    ),
    history: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2M3.5 7H7V3.5" />
      </>
    ),
    offer: (
      <>
        <path d="M4 7.5V4h3.5L20 16.5 16.5 20 4 7.5Z" />
        <circle cx="7.5" cy="7.5" r="1" />
      </>
    ),
    quality: (
      <>
        <circle cx="12" cy="10" r="6" />
        <path d="m9 10 2 2 4-4M8 15l-1 7 5-3 5 3-1-7" />
      </>
    ),
    return: (
      <>
        <path d="M9 7H4v-5M4 7a9 9 0 1 1-1 9" />
        <path d="M12 8v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    security: (
      <>
        <path d="M12 2 4.5 5v5.5c0 5 3 9 7.5 11.5 4.5-2.5 7.5-6.5 7.5-11.5V5L12 2Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15ZM5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 4 5" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
      {paths[name]}
    </svg>
  );
}
