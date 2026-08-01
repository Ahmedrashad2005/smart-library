import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { apiRequest } from './lib/api';

vi.mock('./lib/api', () => ({
  apiRequest: vi.fn(),
  requestMessage: (error: unknown) => String(error),
}));
const mockedApi = vi.mocked(apiRequest);
const signIn = async (role: 'MEMBER' | 'LIBRARIAN' | 'ADMIN') => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), `${role.toLowerCase()}@test.local`);
  await user.type(screen.getByLabelText('Password'), 'Password1');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
};
const renderAt = (path: string) => {
  window.history.replaceState({}, '', path);
  return render(<App />);
};
describe('loan routes in the real application router', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    mockedApi.mockImplementation(async (path: string) =>
      path === '/auth/login'
        ? { accessToken: 'token', user: { role: 'LIBRARIAN', fullName: 'Staff' } }
        : { items: [], page: 1, totalPages: 0, total: 0 },
    );
  });
  it('redirects unauthenticated staff access to login', () => {
    renderAt('/librarian/loans');
    expect(
      screen.getByRole('heading', { name: 'Sign in to manage the library' }),
    ).toBeInTheDocument();
  });
  it('denies MEMBER staff access', async () => {
    mockedApi.mockImplementation(async (path: string) =>
      path === '/auth/login'
        ? { accessToken: 'token', user: { role: 'MEMBER', fullName: 'Member' } }
        : { items: [], page: 1, totalPages: 0, total: 0 },
    );
    renderAt('/librarian/loans');
    await signIn('MEMBER');
    expect(
      await screen.findByText('Member accounts cannot access catalog management.'),
    ).toBeInTheDocument();
  });
  it.each(['LIBRARIAN', 'ADMIN'] as const)('%s renders staff loans', async (role) => {
    mockedApi.mockImplementation(async (path: string) =>
      path === '/auth/login'
        ? { accessToken: 'token', user: { role, fullName: 'Staff' } }
        : { items: [], page: 1, totalPages: 0, total: 0 },
    );
    renderAt('/librarian/loans');
    await signIn(role);
    expect(await screen.findByRole('heading', { name: 'Loans' })).toBeInTheDocument();
  });
  it('MEMBER renders my loans', async () => {
    mockedApi.mockImplementation(async (path: string) =>
      path === '/auth/login'
        ? { accessToken: 'token', user: { role: 'MEMBER', fullName: 'Member' } }
        : { items: [], page: 1, totalPages: 0, total: 0 },
    );
    renderAt('/my-loans');
    await signIn('MEMBER');
    expect(await screen.findByRole('heading', { name: 'My loans' })).toBeInTheDocument();
  });
});
