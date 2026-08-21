import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api';
import { CampusPage } from './CampusPage';
import type { PublicBook, PublicCatalogResult } from './public.types';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  requestMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

const mockedApi = vi.mocked(apiRequest);
const campusBook: PublicBook = {
  id: 'campus-book-one',
  slug: 'campus-knowledge',
  title: 'Campus Knowledge',
  titleAr: 'معرفة الحرم الجامعي',
  totalCopies: 3,
  availableCopies: 2,
  authors: [{ author: { id: 'author-one', name: 'Salma Adel', nameAr: 'سلمى عادل' } }],
  campusAvailability: {
    hasPhysicalCopies: true,
    totalCopies: 1,
    availableCopies: 1,
    availabilityStatus: 'AVAILABLE',
  },
};
const librarySummary = {
  id: 'campus-library',
  code: 'NAWA-COLLEGE-LIBRARY',
  nameEn: 'College Library',
  nameAr: 'مكتبة الكلية',
};
const library = {
  ...librarySummary,
  floors: [
    {
      id: 'floor-three',
      floorNumber: 3,
      nameEn: 'Floor 3',
      nameAr: 'الطابق الثالث',
      rooms: [
        {
          id: 'room-315',
          roomNumber: '315',
          nameEn: 'Room 315',
          nameAr: 'غرفة 315',
        },
      ],
    },
  ],
};

function catalog(
  items: PublicBook[] = [campusBook],
  options: Partial<PublicCatalogResult> = {},
): PublicCatalogResult {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 8,
    totalPages: items.length ? 1 : 0,
    sourceCollections: ['AI, Machine Learning & Data Science', 'Cyber Security'],
    ...options,
  };
}

function installSuccessfulApi(
  bookResult = catalog([campusBook], { total: 23, totalPages: 3 }),
): void {
  mockedApi.mockImplementation(async (path: string) => {
    if (path === '/libraries') return [librarySummary];
    if (path === '/libraries/campus-library') return library;
    if (path.startsWith('/books?')) return bookResult;
    throw new Error(`Unexpected request: ${path}`);
  });
}

describe('CampusPage', () => {
  beforeEach(() => {
    mockedApi.mockReset();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('renders safe loading states followed by real location, book, availability, and details action', async () => {
    installSuccessfulApi();
    const go = vi.fn();
    render(<CampusPage locale="en" go={go} />);

    expect(
      screen.getByRole('status', { name: 'Loading University Library books' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Loading library location')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'University Library' })).toBeInTheDocument();
    const summary = screen.getByRole('group', { name: 'Delta University Library summary' });
    expect(within(summary).getByText(/Floor 3/)).toHaveTextContent('Floor 3 · Room 315');
    expect(within(summary).getByText('23 books')).toBeInTheDocument();
    expect(mockedApi).toHaveBeenCalledWith('/books?campus=true&page=1&limit=1');
    expect(screen.getByRole('heading', { name: 'Campus Knowledge' })).toBeInTheDocument();
    expect(screen.getByText('Available in the University Library')).toBeInTheDocument();
    expect(screen.getByLabelText('1 available · 1 copy')).toBeInTheDocument();
    expect(screen.queryByText(/Reserve|احجز/)).not.toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', {
        name: 'Home',
      }),
    );
    expect(go).toHaveBeenCalledWith('/');
    go.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'View details: Campus Knowledge' }));
    expect(go).toHaveBeenCalledWith('/books/campus-knowledge');
    expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('campus=true'));
  });

  it('renders the real Floor 3 and Room 315 location in polished Arabic RTL copy', async () => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    installSuccessfulApi();
    render(<CampusPage locale="ar" go={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'المكتبة الجامعية' })).toBeInTheDocument();
    const summary = screen.getByRole('group', { name: 'ملخص مكتبة جامعة الدلتا' });
    expect(within(summary).getByText(/الطابق الثالث/)).toHaveTextContent(
      'الطابق الثالث · غرفة 315',
    );
    expect(within(summary).getByText('23 كتاب')).toBeInTheDocument();
    expect(screen.getByText('متاح في المكتبة الجامعية')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('keeps the real unfiltered holdings total separate from filtered results', async () => {
    mockedApi.mockImplementation(async (path: string) => {
      if (path === '/libraries') return [librarySummary];
      if (path === '/libraries/campus-library') return library;
      if (path === '/books?campus=true&page=1&limit=1') {
        return catalog([campusBook], { total: 17, totalPages: 17 });
      }
      if (path.startsWith('/books?')) {
        return path.includes('q=focused')
          ? catalog([campusBook], { total: 1, totalPages: 1 })
          : catalog([campusBook], { total: 17, totalPages: 3 });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    render(<CampusPage locale="en" go={vi.fn()} />);

    const summary = await screen.findByRole('group', { name: 'Delta University Library summary' });
    expect(within(summary).getByText('17 books')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search University Library books'), 'focused');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('q=focused')),
    );
    expect(within(summary).getByText('17 books')).toBeInTheDocument();
    expect(screen.getByText('1 book')).toBeInTheDocument();
  });

  it('connects search, availability, source collection, and pagination to Campus queries', async () => {
    installSuccessfulApi(catalog([campusBook], { total: 9, totalPages: 2 }));
    const user = userEvent.setup();
    render(<CampusPage locale="en" go={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Campus Knowledge' });

    await user.type(screen.getByLabelText('Search University Library books'), 'machine learning');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('q=machine+learning')),
    );

    await user.click(screen.getByLabelText('Available now'));
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('available=true')),
    );

    await user.selectOptions(screen.getByLabelText('Collection'), 'Cyber Security');
    await waitFor(() =>
      expect(mockedApi).toHaveBeenCalledWith(
        expect.stringContaining('sourceCollection=Cyber+Security'),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(mockedApi).toHaveBeenCalledWith(expect.stringContaining('page=2')));
  });

  it('renders a clear empty state for a valid query with no Campus matches', async () => {
    installSuccessfulApi(catalog([]));
    render(<CampusPage locale="en" go={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { name: 'No matching books are available right now.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Try another search phrase or change the filters.'),
    ).toBeInTheDocument();
  });

  it('renders an operable catalog error and retries the same real API boundary', async () => {
    let bookAttempts = 0;
    mockedApi.mockImplementation(async (path: string) => {
      if (path === '/libraries') return [librarySummary];
      if (path === '/libraries/campus-library') return library;
      if (path === '/books?campus=true&page=1&limit=1') {
        return catalog([campusBook], { total: 23, totalPages: 23 });
      }
      if (path.startsWith('/books?')) {
        bookAttempts += 1;
        if (bookAttempts === 1) throw new Error('Campus catalog unavailable');
        return catalog();
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();
    render(<CampusPage locale="en" go={vi.fn()} />);

    expect(
      await screen.findByRole('heading', {
        name: 'We could not load the University Library books.',
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Campus Knowledge' })).toBeInTheDocument();
    expect(bookAttempts).toBe(2);
  });
});
