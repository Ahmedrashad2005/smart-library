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
  it('opens the return route while preserving the selected-loan query', async () => {
    const loan = {
      id: 'loan-return-route',
      status: 'ACTIVE',
      borrowedAt: '2026-08-01T00:00:00Z',
      dueAt: '2026-08-15T00:00:00Z',
      renewedCount: 0,
      member: { id: 'member', fullName: 'Member', email: 'member@test.local' },
      bookCopy: {
        id: 'copy',
        copyCode: 'COPY-RETURN',
        status: 'BORROWED',
        condition: 'GOOD',
        book: { id: 'book', title: 'Return Route Book', authors: [] },
      },
    };
    mockedApi.mockImplementation(async (path: string) => {
      if (path === '/auth/login')
        return { accessToken: 'token', user: { role: 'LIBRARIAN', fullName: 'Staff' } };
      if (path === '/loans/loan-return-route') return loan;
      return { items: [loan], page: 1, totalPages: 1, total: 1, limit: 10 };
    });
    const user = userEvent.setup();
    renderAt('/librarian/loans');
    await signIn('LIBRARIAN');
    await user.click(await screen.findByRole('button', { name: 'Return' }));

    expect(await screen.findByRole('heading', { name: 'Return a copy' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/librarian/returns');
    expect(window.location.search).toBe('?loan=loan-return-route');
    expect(
      await screen.findByRole('heading', { name: 'Return Route Book — COPY-RETURN' }),
    ).toBeInTheDocument();
  });
});
