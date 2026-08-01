import { describe, expect, it } from 'vitest';
import { canAccess, navigationFor, validateLogin } from './access';
describe('Phase 2 auth UI rules', () => {
  it('validates required login fields', () => {
    expect(validateLogin('invalid', '')).toEqual({
      email: 'Enter a valid email address',
      password: 'Password is required',
    });
    expect(validateLogin('member@example.test', 'secret')).toEqual({});
  });
  it('protects routes and enforces roles', () => {
    expect(canAccess(false, undefined)).toBe(false);
    expect(canAccess(true, 'MEMBER', ['ADMIN'])).toBe(false);
    expect(canAccess(true, 'ADMIN', ['ADMIN'])).toBe(true);
  });
  it('shows role-appropriate navigation', () => {
    expect(navigationFor('MEMBER')).not.toContain('/admin/users');
    expect(navigationFor('LIBRARIAN')).toContain('/librarian/dashboard');
    expect(navigationFor('ADMIN')).toContain('/admin/users');
  });
});
