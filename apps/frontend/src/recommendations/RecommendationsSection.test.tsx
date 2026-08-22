import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicBook } from '../catalog/public.types';
import { getMyRecommendations } from './api';
import { RecommendationsSection } from './RecommendationsSection';

vi.mock('./api', () => ({ getMyRecommendations: vi.fn() }));

const mockedRecommendations = vi.mocked(getMyRecommendations);
const book: PublicBook = {
  id: 'book-1',
  slug: 'data-structures',
  title: 'Data Structures',
  titleAr: 'هياكل البيانات',
  coverImageUrl: 'https://images.test/data-structures.jpg',
  totalCopies: 3,
  availableCopies: 2,
  authors: [{ author: { id: 'author-1', name: 'Mark Allen', nameAr: 'مارك ألين' } }],
  campusAvailability: {
    hasPhysicalCopies: true,
    totalCopies: 3,
    availableCopies: 2,
    availabilityStatus: 'AVAILABLE',
  },
};

function result(
  mode: 'personalized' | 'cold_start' | 'fallback',
  items = [{ book, reason: 'مناسب لاهتمامك بالبرمجة.' }],
) {
  return { mode, generatedAt: '2026-08-22T10:00:00.000Z', items };
}

describe('RecommendationsSection', () => {
  beforeEach(() => mockedRecommendations.mockReset());

  it('renders a bounded loading state while the API is pending', async () => {
    let finish: ((value: ReturnType<typeof result>) => void) | undefined;
    mockedRecommendations.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'جارٍ تجهيز كتب مقترحة لك' })).toBeInTheDocument();
    finish?.(result('personalized'));
    expect(await screen.findByRole('heading', { name: 'مقترحة لك' })).toBeInTheDocument();
  });

  it('renders personalized recommendations from the API', async () => {
    mockedRecommendations.mockResolvedValue(result('personalized'));
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'هياكل البيانات' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'مقترحة لك' })).toBeInTheDocument();
  });

  it('uses an honest cold-start heading', async () => {
    mockedRecommendations.mockResolvedValue(result('cold_start'));
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'كتب قد تهمك' })).toBeInTheDocument();
    expect(screen.queryByText(/استعاراتك السابقة/)).not.toBeInTheDocument();
  });

  it('renders the recommendation reason as secondary card copy', async () => {
    mockedRecommendations.mockResolvedValue(result('personalized'));
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={vi.fn()} />);
    const reason = await screen.findByText('مناسب لاهتمامك بالبرمجة.');
    expect(reason).toHaveClass('book-shelf-card__reason');
  });

  it('opens the existing book details route', async () => {
    mockedRecommendations.mockResolvedValue(result('personalized'));
    const go = vi.fn();
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={go} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'تفاصيل الكتاب: هياكل البيانات' }),
    );
    expect(go).toHaveBeenCalledWith('/books/data-structures');
  });

  it('labels deterministic fallback without claiming AI personalization', async () => {
    mockedRecommendations.mockResolvedValue(result('fallback'));
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={vi.fn()} />);
    expect(
      await screen.findByRole('heading', { name: 'اختيارات من فهرس المكتبة' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('من فهرس المكتبة', { exact: false, selector: '.recommendations-kicker' }),
    ).toBeInTheDocument();
  });

  it('degrades API failure without throwing and retries on demand', async () => {
    mockedRecommendations
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(result('fallback'));
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل المقترحات الآن');
    await userEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(
      await screen.findByRole('heading', { name: 'اختيارات من فهرس المكتبة' }),
    ).toBeInTheDocument();
    expect(mockedRecommendations).toHaveBeenCalledTimes(2);
  });

  it('shows a compact empty state instead of a broken gap', async () => {
    mockedRecommendations.mockResolvedValue(result('cold_start', []));
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={vi.fn()} />);
    expect(await screen.findByText('لا توجد مقترحات متاحة الآن.')).toBeInTheDocument();
  });

  it('renders polished Arabic content within the document RTL direction', async () => {
    document.documentElement.dir = 'rtl';
    mockedRecommendations.mockResolvedValue(result('personalized'));
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={vi.fn()} />);
    const section = await screen.findByTestId('recommendations-section');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(section).toHaveClass('recommendations-section--personalized');
  });

  it('renders English LTR labels and reasons', async () => {
    document.documentElement.dir = 'ltr';
    mockedRecommendations.mockResolvedValue(
      result('personalized', [{ book, reason: 'Relevant to your programming interests.' }]),
    );
    render(<RecommendationsSection accessToken="member-token" locale="en" go={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Recommended for You' })).toBeInTheDocument();
    expect(screen.getByText('Relevant to your programming interests.')).toBeInTheDocument();
  });

  it('keeps the reusable responsive shelf container at a mobile viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    mockedRecommendations.mockResolvedValue(result('personalized'));
    render(<RecommendationsSection accessToken="member-token" locale="ar" go={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('recommendations-section')).toBeInTheDocument());
    expect(document.querySelector('.recommendations-grid .book-shelf-card')).toBeInTheDocument();
  });
});
