import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { loginPath, safeReturnPath } from '../auth/access';
import { ApiError, apiRequest } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, apiRequest: vi.fn() };
});

const mockedApi = vi.mocked(apiRequest);

const book = {
  id: 'book-return',
  slug: 'book-return',
  title: 'Return Path Book',
  totalCopies: 1,
  availableCopies: 1,
  authors: [],
  campusAvailability: {
    hasPhysicalCopies: true,
    totalCopies: 1,
    availableCopies: 1,
    availabilityStatus: 'AVAILABLE',
    copies: [
      {
        id: 'copy',
        status: 'AVAILABLE',
        condition: 'GOOD',
        campusLocation: {
          library: {
            id: 'library',
            code: 'NAWA',
            nameEn: 'College Library',
            nameAr: 'مكتبة الكلية',
          },
          floor: { id: 'floor', number: 3, nameEn: 'Floor 3', nameAr: 'الدور الثالث' },
          room: { id: 'room', number: '315', nameEn: 'Room 315', nameAr: 'غرفة 315' },
          shelfLocationCode: '1/1',
          sourceCollection: null,
        },
      },
    ],
  },
};

describe('reservation authentication and safe return flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    mockedApi.mockImplementation(async (path: string) => {
      if (path === '/auth/refresh') throw new ApiError('No session', 401);
      if (path === '/auth/login')
        return { accessToken: 'member-token', user: { role: 'MEMBER', fullName: 'Nawa Member' } };
      if (path === '/books/slug/book-return') return book;
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  it('preserves the exact internal Book Details destination through login', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/books/book-return?source=campus');
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Reserve for pickup' }));
    expect(window.location.pathname).toBe('/auth/login');
    expect(new URLSearchParams(window.location.search).get('returnTo')).toBe(
      '/books/book-return?source=campus',
    );
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByText(/access your loans and College Library reservations/i)).toBeVisible();
    expect(
      screen.queryByText(/protected area|access token|manage the library/i),
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'member@nawa.test');
    await user.type(screen.getByLabelText('Password'), 'SmartLib123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(window.location.pathname).toBe('/books/book-return'));
    expect(window.location.search).toBe('?source=campus');
    expect(await screen.findByRole('heading', { name: 'Return Path Book' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reserve for pickup' })).toBeEnabled();
  });

  it('accepts only internal return destinations and rejects redirect tricks', () => {
    expect(safeReturnPath('/books/safe?source=campus#availability')).toBe(
      '/books/safe?source=campus#availability',
    );
    expect(safeReturnPath('https://evil.example/steal', '/my-loans')).toBe('/my-loans');
    expect(safeReturnPath('//evil.example/steal', '/my-loans')).toBe('/my-loans');
    expect(safeReturnPath('/\\evil.example/steal', '/my-loans')).toBe('/my-loans');
    expect(safeReturnPath('/auth/login?returnTo=/auth/login', '/my-loans')).toBe('/my-loans');
    expect(loginPath('/books/safe')).toBe('/auth/login?returnTo=%2Fbooks%2Fsafe');
  });

  it('renders a normal Arabic RTL account flow without developer-oriented wording', () => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    window.history.replaceState({}, '', '/auth/login?returnTo=%2Fcampus');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
    expect(screen.getByLabelText('البريد الإلكتروني')).toBeVisible();
    expect(screen.getByLabelText('كلمة المرور')).toBeVisible();
    expect(screen.getByText(/استعاراتك وحجوزاتك من مكتبة الكلية/)).toBeVisible();
    expect(
      screen.queryByText(/protected area|access token|manage the library/i),
    ).not.toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });
});
