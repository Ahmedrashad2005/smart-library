export type Role = 'MEMBER' | 'LIBRARIAN' | 'ADMIN';
export const validateLogin = (email: string, password: string): Record<string, string> => ({
  ...(email.includes('@') ? {} : { email: 'Enter a valid email address' }),
  ...(password ? {} : { password: 'Password is required' }),
});
export const canAccess = (
  authenticated: boolean,
  role: Role | undefined,
  roles: Role[] = [],
): boolean => authenticated && (!roles.length || (!!role && roles.includes(role)));
export const navigationFor = (role: Role): string[] =>
  role === 'ADMIN'
    ? ['/dashboard', '/admin/users', '/profile']
    : role === 'LIBRARIAN'
      ? ['/dashboard', '/librarian/dashboard', '/profile']
      : ['/dashboard', '/profile'];

export function safeReturnPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return fallback;
  try {
    const url = new URL(value, 'https://nawa.local');
    if (url.origin !== 'https://nawa.local' || url.pathname === '/auth/login') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginPath(returnTo: string): string {
  return `/auth/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo, '/'))}`;
}
