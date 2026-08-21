import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { apiRequest } from '../lib/api';
import type { Faculty } from './api';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  requestMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

const faculties: Faculty[] = Array.from({ length: 13 }, (_, index) => ({
  id: `faculty-${index + 1}`,
  slug: `faculty-${index + 1}`,
  nameAr: index === 0 ? 'كلية الطب البشري' : `كلية مؤكدة ${index + 1}`,
  nameEn: null,
  displayOrder: index + 1,
  bookCount: 0,
}));

describe('faculty routes in the real application', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (path === '/auth/refresh') return {};
      if (path === '/faculties') return faculties;
      if (path === '/faculties/faculty-1') return faculties[0];
      if (path.includes('facultySlug=faculty-1'))
        return { items: [], total: 0, page: 1, limit: 12, totalPages: 0 };
      return [];
    });
  });

  it('renders /faculties through the actual router and opens a faculty route', async () => {
    window.history.replaceState({}, '', '/faculties');
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findAllByRole('button', { name: /استعرض كتب كلية/ })).toHaveLength(13);
    await user.click(screen.getByRole('button', { name: 'استعرض كتب كلية الطب البشري' }));
    expect(window.location.pathname).toBe('/faculties/faculty-1');
    expect(
      await screen.findByRole('heading', { name: 'لا توجد كتب مرتبطة بهذه الكلية حتى الآن' }),
    ).toBeInTheDocument();
  });

  it('keeps the university faculty route public without exposing staff navigation', async () => {
    window.history.replaceState({}, '', '/faculties/faculty-1');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'كلية الطب البشري' })).toBeInTheDocument();
    expect(screen.queryByText(/Create, edit, archive/i)).not.toBeInTheDocument();
  });
});
