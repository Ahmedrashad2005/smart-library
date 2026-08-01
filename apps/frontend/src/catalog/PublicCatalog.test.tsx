import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api';
import { PublicCatalog } from './PublicCatalog';
import type { PublicBook, PublicCatalogResult, PublicCategory } from './public.types';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  requestMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

const mockedApi = vi.mocked(apiRequest);
const categories: PublicCategory[] = [
  { id: 'category-history', nameEn: 'History', nameAr: 'التاريخ', slug: 'history' },
  { id: 'category-science', nameEn: 'Science', nameAr: 'العلوم', slug: 'science' },
];
const availableBook: PublicBook = {
  id: 'book-blue',
  slug: 'the-blue-book',
  title: 'The Blue Book',
  titleAr: 'الكتاب الأزرق',
  coverImageUrl: 'https://images.test/blue-book.jpg',
  totalCopies: 4,
  availableCopies: 2,
  borrowCount: 12,
  category: categories[0],
  authors: [{ author: { id: 'author-one', name: 'Maya Stone', nameAr: 'مايا ستون' } }],
};
const unavailableBook: PublicBook = {
  id: 'book-moon',
  slug: 'moon-atlas',
  title: 'Moon Atlas',
  titleAr: 'أطلس القمر',
  totalCopies: 2,
  availableCopies: 0,
  borrowCount: 3,
  category: categories[1],
  authors: [{ author: { id: 'author-two', name: 'Omar Noor', nameAr: 'عمر نور' } }],
};

function result(
  items: PublicBook[],
  options: Partial<Pick<PublicCatalogResult, 'page' | 'total' | 'totalPages'>> = {},
): PublicCatalogResult {
  return {
    items,
    page: options.page ?? 1,
    limit: 8,
    total: options.total ?? items.length,
    totalPages: options.totalPages ?? (items.length ? 1 : 0),
  };
}

function successfulApi(fullCatalog = result([availableBook, unavailableBook])): void {
  mockedApi.mockImplementation(async (path: string) => {
    if (path === '/categories') return categories;
    if (path.includes('limit=5&available=true')) return result([availableBook]);
    if (path.includes('limit=5&sort=newest')) return result([unavailableBook]);
    if (path.includes('limit=12')) return result([unavailableBook, availableBook]);
    return fullCatalog;
  });
}

function fullCatalogRegion(): HTMLElement {
  return screen.getByRole('heading', { name: 'Full catalog' }).closest('.full-catalog')!;
}

describe('PublicCatalog', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('renders loading cards, real books, covers, placeholders, availability, and accessible actions', async () => {
    successfulApi();
    const go = vi.fn();
    render(<PublicCatalog locale="en" go={go} />);

    expect(screen.getAllByRole('status', { name: 'Loading books' }).length).toBeGreaterThan(0);
    const catalog = fullCatalogRegion();
    expect(
      await within(catalog).findByRole('heading', { name: 'The Blue Book' }),
    ).toBeInTheDocument();
    expect(within(catalog).getByAltText('Cover of The Blue Book')).toHaveAttribute(
      'src',
      availableBook.coverImageUrl,
    );
    expect(within(catalog).getByRole('img', { name: 'No cover available' })).toBeInTheDocument();
    expect(within(catalog).getByLabelText('2 available · 4 copies')).toBeInTheDocument();
    expect(within(catalog).getByLabelText('Currently unavailable · 2 copies')).toBeInTheDocument();

    await userEvent.click(
      within(catalog).getByRole('button', { name: 'View details: The Blue Book' }),
    );
    expect(go).toHaveBeenCalledWith('/books/the-blue-book');
  });

  it('submits the search form to the real catalog query boundary', async () => {
    successfulApi();
    const user = userEvent.setup();
    render(<PublicCatalog locale="en" go={vi.fn()} />);
    await within(fullCatalogRegion()).findByRole('heading', { name: 'The Blue Book' });

    await user.type(screen.getByLabelText('Search the NAWA catalog'), 'world history');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('q=world+history')),
    );
  });

  it('selects a real category and reloads the catalog with its id', async () => {
    successfulApi();
    const user = userEvent.setup();
    render(<PublicCatalog locale="en" go={vi.fn()} />);
    const history = await screen.findByRole('button', { name: 'Browse by category: History' });

    await user.click(history);

    expect(history).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        expect.stringContaining('categoryId=category-history'),
      ),
    );
  });

  it('opens the mobile filter panel, filters by language, and exposes a removable active filter', async () => {
    successfulApi();
    const user = userEvent.setup();
    render(<PublicCatalog locale="en" go={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: 'Show filters' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.selectOptions(screen.getByLabelText('Book language'), 'ar');

    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('language=ar')),
    );
    const remove = screen.getByRole('button', { name: 'Remove filter: Arabic' });
    expect(remove).toBeInTheDocument();
    await user.click(remove);
    expect(screen.getByLabelText('Book language')).toHaveValue('');
  });

  it('renders a friendly no-category state', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === '/categories') return [];
      return result([]);
    });
    render(<PublicCatalog locale="en" go={vi.fn()} />);

    expect(await screen.findByText('Categories are not available yet.')).toBeInTheDocument();
  });

  it('renders and resets an empty filtered catalog state', async () => {
    successfulApi(result([]));
    const user = userEvent.setup();
    render(<PublicCatalog locale="en" go={vi.fn()} />);
    await user.click(await screen.findByLabelText('Available copies only'));

    const emptyHeading = await screen.findByRole('heading', {
      name: 'No books match your search',
    });
    const empty = emptyHeading.closest('.catalog-empty') as HTMLElement;
    await user.click(within(empty).getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByLabelText('Available copies only')).not.toBeChecked();
  });

  it('renders a catalog error with an operable retry action', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === '/categories') return categories;
      if (path.includes('limit=8')) throw new Error('Catalog service is unavailable');
      return result([availableBook]);
    });
    const user = userEvent.setup();
    render(<PublicCatalog locale="en" go={vi.fn()} />);

    expect(await screen.findByText('Catalog service is unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(
        mockedApi.mock.calls.filter(([path]) => String(path).includes('limit=8')),
      ).toHaveLength(2),
    );
  });

  it('moves to the next catalog page through the supported page query', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === '/categories') return categories;
      if (path.includes('limit=4')) return result([availableBook]);
      if (path.includes('page=2'))
        return result([unavailableBook], { page: 2, total: 9, totalPages: 2 });
      return result([availableBook], { page: 1, total: 9, totalPages: 2 });
    });
    const user = userEvent.setup();
    render(<PublicCatalog locale="en" go={vi.fn()} />);
    const catalog = fullCatalogRegion();

    await user.click(await within(catalog).findByRole('button', { name: /Next page/ }));

    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('page=2')));
    expect(await within(catalog).findByRole('heading', { name: 'Moon Atlas' })).toBeInTheDocument();
    expect(within(catalog).getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('renders localized titles, author names, and category controls in Arabic', async () => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    successfulApi();
    render(<PublicCatalog locale="ar" go={vi.fn()} />);
    const catalog = screen
      .getByRole('heading', { name: 'الفهرس الكامل' })
      .closest('.full-catalog') as HTMLElement;

    expect(
      await within(catalog).findByRole('heading', { name: 'الكتاب الأزرق' }),
    ).toBeInTheDocument();
    expect(within(catalog).getByText('مايا ستون')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'تصفح حسب التصنيف: التاريخ' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('renders the approved Arabic-first homepage structure with real discovery shelves', async () => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    successfulApi();
    const { container } = render(
      <PublicCatalog locale="ar" go={vi.fn()} showFullCatalog={false} />,
    );

    expect(
      screen.getByRole('heading', { name: 'اكتشف عالم المعرفة بين يديك' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'إصدارات جديدة' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'الأكثر قراءة' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'متاح الآن' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'خدمات نَوَى' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'الفهرس الكامل' })).not.toBeInTheDocument();
    expect(container.querySelector('.nawa-hero__illustration')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('derives the most-read shelf from the existing borrow count data', async () => {
    successfulApi();
    render(<PublicCatalog locale="en" go={vi.fn()} />);

    const popularShelf = (await screen.findByRole('heading', { name: 'Most read' })).closest(
      '.book-shelf-section',
    ) as HTMLElement;
    expect(within(popularShelf).getAllByRole('article')[0]).toHaveAccessibleName(/The Blue Book/);
  });

  it('synchronizes a same-route header search through the real navigation event', async () => {
    successfulApi();
    render(<PublicCatalog locale="en" go={vi.fn()} />);
    await within(fullCatalogRegion()).findByRole('heading', { name: 'The Blue Book' });

    window.history.pushState({}, '', '/books?q=knowledge');
    window.dispatchEvent(new Event('nawa:navigation'));

    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('q=knowledge')),
    );
    expect(screen.getByLabelText('Search the NAWA catalog')).toHaveValue('knowledge');
  });
});
