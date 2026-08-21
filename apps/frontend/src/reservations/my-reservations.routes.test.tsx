import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { ApiError, apiRequest } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, apiRequest: vi.fn() };
});

const mockedApi = vi.mocked(apiRequest);
const emptyReservations = { items: [], total: 0, page: 1, limit: 12, totalPages: 0 };

function renderAt(path: string) {
  window.history.replaceState({}, '', path);
  return render(<App />);
}

async function completeLogin(role: 'MEMBER' | 'LIBRARIAN' | 'ADMIN' = 'MEMBER') {
  const user = userEvent.setup();
  mockedApi.mockImplementation(async (path: string) => {
    if (path === '/auth/login')
      return { accessToken: 'member-token', user: { role, fullName: 'Nawa Member' } };
    if (path.startsWith('/reservations/me')) return emptyReservations;
    if (path === '/auth/refresh') throw new ApiError('No session', 401);
    return emptyReservations;
  });
  await user.type(screen.getByLabelText('Email'), 'member@nawa.test');
  await user.type(screen.getByLabelText('Password'), 'Password1');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('My Reservations routing and authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    mockedApi.mockRejectedValue(new ApiError('No session', 401));
  });

  it('redirects an unauthenticated member to the existing login with a safe return path', async () => {
    renderAt('/my-reservations?status=expired&page=2');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/auth/login');
    expect(new URLSearchParams(window.location.search).get('returnTo')).toBe(
      '/my-reservations?status=expired&page=2',
    );
  });

  it('returns to My Reservations immediately after successful member login', async () => {
    renderAt('/my-reservations');
    await screen.findByRole('heading', { name: 'Sign in' });
    await completeLogin();
    expect(await screen.findByRole('heading', { name: 'My Reservations' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/my-reservations');
    expect(mockedApi).toHaveBeenCalledWith(
      '/reservations/me?status=active&page=1&limit=12',
      {},
      'member-token',
    );
  });

  it('restores the existing member refresh-cookie session before rendering the route', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === '/auth/refresh') return { accessToken: 'restored-token' };
      if (path === '/auth/me') return { role: 'MEMBER', fullName: 'Restored Member' };
      if (path.startsWith('/reservations/me')) return emptyReservations;
      throw new Error(`Unexpected request: ${path}`);
    });
    renderAt('/my-reservations');
    expect(await screen.findByRole('heading', { name: 'My Reservations' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith(
      '/reservations/me?status=active&page=1&limit=12',
      {},
      'restored-token',
    );
  });

  it.each(['LIBRARIAN', 'ADMIN'] as const)(
    'denies an authenticated %s without requesting member reservations',
    async (role) => {
      mockedApi.mockImplementation(async (path: string) => {
        if (path === '/auth/refresh') return { accessToken: 'staff-token' };
        if (path === '/auth/me') return { role, fullName: 'Staff User' };
        throw new Error(`Unexpected request: ${path}`);
      });
      renderAt('/my-reservations');
      expect(
        await screen.findByText('My Reservations is available to member accounts only.'),
      ).toBeInTheDocument();
      expect(
        mockedApi.mock.calls.some(([path]) => String(path).startsWith('/reservations/me')),
      ).toBe(false);
    },
  );

  it('routes an owned detail URL through the real member route', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === '/auth/refresh') return { accessToken: 'restored-token' };
      if (path === '/auth/me') return { role: 'MEMBER', fullName: 'Member' };
      if (path === '/reservations/reservation-route-id')
        return {
          id: 'reservation-route-id',
          status: 'ACTIVE',
          reservedAt: '2029-08-13T09:00:00Z',
          expiresAt: '2030-08-14T09:00:00Z',
          book: {
            id: 'book',
            slug: 'route-book',
            title: 'Route Reservation Book',
            authors: [],
          },
          bookCopy: { id: 'copy', copyCode: 'ROUTE-COPY', status: 'RESERVED', condition: 'GOOD' },
          pickupLocation: null,
          availability: { totalCopies: 1, availableCopies: 0 },
        };
      throw new Error(`Unexpected request: ${path}`);
    });
    renderAt('/my-reservations/reservation-route-id');
    expect(
      await screen.findByRole('heading', { name: 'Route Reservation Book' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        '/reservations/reservation-route-id',
        {},
        'restored-token',
      ),
    );
  });
});
