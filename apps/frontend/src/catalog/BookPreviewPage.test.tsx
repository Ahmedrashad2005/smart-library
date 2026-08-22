import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiBlob, apiRequest } from '../lib/api';
import { BookPreviewPage } from './BookPreviewPage';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  apiBlob: vi.fn(),
  requestMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

const book = {
  id: 'book-1',
  slug: 'antenna-theory',
  title: 'Antenna Theory',
  titleAr: 'نظرية الهوائيات',
  totalCopies: 1,
  availableCopies: 1,
  authors: [{ author: { id: 'a-1', name: 'Constantine Balanis', nameAr: 'كونستانتين بالانيس' } }],
  campusAvailability: {
    hasPhysicalCopies: true,
    totalCopies: 1,
    availableCopies: 1,
    availabilityStatus: 'AVAILABLE' as const,
    copies: [],
  },
  preview: {
    available: true,
    url: '/books/book-1/preview-pdf',
    originalName: 'antenna.pdf',
    size: 1200,
    updatedAt: '2026-08-22T00:00:00.000Z',
  },
};

describe('Book Preview page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:book-preview'),
      revokeObjectURL: vi.fn(),
    });
    vi.mocked(apiRequest).mockResolvedValue(book);
    vi.mocked(apiBlob).mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }));
  });

  it('renders a loading state then the native PDF viewer', async () => {
    render(<BookPreviewPage slug="antenna-theory" token="member-token" locale="ar" go={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('جارٍ تحميل معاينة الكتاب');
    expect(await screen.findByLabelText('معاينة الكتاب: نظرية الهوائيات')).toHaveAttribute(
      'data',
      'blob:book-preview',
    );
    expect(apiBlob).toHaveBeenCalledWith('/books/book-1/preview-pdf', 'member-token');
  });

  it('renders polished Arabic RTL title and author information', async () => {
    const { container } = render(
      <BookPreviewPage slug="antenna-theory" token="token" locale="ar" go={vi.fn()} />,
    );
    expect(await screen.findByRole('heading', { name: 'نظرية الهوائيات' })).toBeVisible();
    expect(screen.getByText('كونستانتين بالانيس')).toBeVisible();
    expect(container.querySelector('.book-preview-page')).toHaveAttribute('dir', 'rtl');
  });

  it('renders coherent English LTR presentation', async () => {
    const { container } = render(
      <BookPreviewPage slug="antenna-theory" token="token" locale="en" go={vi.fn()} />,
    );
    expect(await screen.findByRole('heading', { name: 'Antenna Theory' })).toBeVisible();
    expect(screen.getByText('Constantine Balanis')).toBeVisible();
    expect(container.querySelector('.book-preview-page')).toHaveAttribute('dir', 'ltr');
  });

  it('provides a secured blob link as the native-viewer fallback', async () => {
    render(<BookPreviewPage slug="antenna-theory" token="token" locale="ar" go={vi.fn()} />);
    expect(await screen.findByRole('link', { name: 'فتح ملف PDF' })).toHaveAttribute(
      'href',
      'blob:book-preview',
    );
  });

  it('shows a visible viewer error instead of a blank frame', async () => {
    vi.mocked(apiBlob).mockRejectedValueOnce(new Error('Preview unavailable'));
    render(<BookPreviewPage slug="antenna-theory" token="token" locale="ar" go={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر عرض المعاينة داخل الصفحة');
    expect(screen.queryByTitle(/معاينة/)).not.toBeInTheDocument();
  });

  it('keeps navigation accessible and releases the PDF blob', async () => {
    const go = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(
      <BookPreviewPage slug="antenna-theory" token="token" locale="ar" go={go} />,
    );
    await screen.findByRole('link', { name: 'فتح ملف PDF' });
    await user.click(screen.getByRole('button', { name: 'العودة إلى الكتاب' }));
    expect(go).toHaveBeenCalledWith('/books/antenna-theory');
    unmount();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:book-preview'));
  });
});
