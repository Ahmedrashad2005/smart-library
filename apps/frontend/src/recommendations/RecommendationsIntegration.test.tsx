import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicCatalog } from '../catalog/PublicCatalog';
import type { PublicBook, PublicCatalogResult } from '../catalog/public.types';
import { apiRequest } from '../lib/api';
import { getMyRecommendations } from './api';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  requestMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));
vi.mock('./api', () => ({ getMyRecommendations: vi.fn() }));

const book: PublicBook = {
  id: 'book-1',
  slug: 'engineering-book',
  title: 'Engineering Book',
  titleAr: 'كتاب هندسي',
  totalCopies: 2,
  availableCopies: 1,
  authors: [{ author: { id: 'author-1', name: 'Author' } }],
};
const catalog: PublicCatalogResult = {
  items: [book],
  total: 1,
  page: 1,
  limit: 6,
  totalPages: 1,
};

describe('homepage recommendation integration', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(getMyRecommendations).mockReset();
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (path === '/categories') return [];
      if (path === '/faculties') return [];
      return catalog;
    });
    vi.mocked(getMyRecommendations).mockResolvedValue({
      mode: 'personalized',
      generatedAt: '2026-08-22T10:00:00.000Z',
      items: [{ book, reason: 'مرتبط باهتماماتك الهندسية.' }],
    });
  });

  it('adds recommendations for an authenticated member without replacing existing shelves', async () => {
    render(
      <PublicCatalog locale="ar" go={vi.fn()} showFullCatalog={false} memberToken="member-token" />,
    );
    expect(await screen.findByRole('heading', { name: 'مقترحة لك' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'إصدارات جديدة' })).toBeInTheDocument();
    expect(vi.mocked(getMyRecommendations)).toHaveBeenCalledWith('member-token', 4, 'ar');
  });

  it('does not request or show personalized data for anonymous visitors', async () => {
    render(<PublicCatalog locale="ar" go={vi.fn()} showFullCatalog={false} />);
    expect(await screen.findByRole('heading', { name: 'إصدارات جديدة' })).toBeInTheDocument();
    expect(screen.queryByTestId('recommendations-section')).not.toBeInTheDocument();
    expect(getMyRecommendations).not.toHaveBeenCalled();
  });
});
