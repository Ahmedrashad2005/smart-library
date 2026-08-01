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
