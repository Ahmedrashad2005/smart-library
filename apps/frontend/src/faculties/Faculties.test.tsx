import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import type { PublicBook, PublicCatalogResult } from '../catalog/public.types';
import { FacultiesPage } from './FacultiesPage';
import { FacultiesSection } from './FacultiesSection';
import { facultyBooks, facultyDetail, listFaculties, type Faculty } from './api';

vi.mock('./api', () => ({
  listFaculties: vi.fn(),
  facultyDetail: vi.fn(),
  facultyBooks: vi.fn(),
}));

const names = [
  'كلية الطب البشري',
  'كلية طب الفم والأسنان',
  'كلية الطب البيطري',
  'كلية العلاج الطبيعي',
  'كلية الصيدلة',
  'كلية تكنولوجيا العلوم الصحية',
  'كلية التمريض',
  'كلية هندسة الطاقة والبترول',
  'كلية الهندسة',
  'كلية الذكاء الاصطناعي',
  'كلية الحقوق',
  'كلية الإدارة',
  'كلية الآداب',
];
const faculties: Faculty[] = names.map((nameAr, index) => ({
  id: `faculty-${index + 1}`,
  slug: `faculty-${index + 1}`,
  nameAr,
  nameEn: null,
  displayOrder: index + 1,
  bookCount: 0,
}));
const book: PublicBook = {
  id: 'book-1',
  slug: 'academic-book',
  title: 'Academic Book',
  titleAr: 'كتاب أكاديمي',
  totalCopies: 2,
  availableCopies: 1,
  authors: [{ author: { id: 'author-1', name: 'Academic Author', nameAr: 'مؤلف أكاديمي' } }],
};
const books = (items: PublicBook[]): PublicCatalogResult => ({
  items,
  total: items.length,
  page: 1,
  limit: 12,
  totalPages: items.length ? 1 : 0,
});

describe('Delta University faculties experience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    vi.mocked(listFaculties).mockResolvedValue(faculties);
    vi.mocked(facultyDetail).mockResolvedValue(faculties[9]!);
    vi.mocked(facultyBooks).mockResolvedValue(books([]));
  });

  it('renders a compact Arabic homepage preview of the first 8 confirmed faculties', async () => {
    render(<FacultiesSection locale="ar" go={vi.fn()} />);
    expect(
      screen.getByRole('status', { name: 'جارٍ تحميل كليات جامعة الدلتا' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'كليات جامعة الدلتا' })).toBeInTheDocument();
    const facultyButtons = screen.getAllByRole('button', { name: /استعرض كتب كلية/ });
    expect(facultyButtons).toHaveLength(8);
    for (const name of names.slice(0, 8)) expect(screen.getByText(name)).toBeInTheDocument();
    for (const name of names.slice(8)) expect(screen.queryByText(name)).not.toBeInTheDocument();
    expect(screen.queryByText(/الكلية الرابعة عشرة|14th/i)).not.toBeInTheDocument();
  });

  it('uses the official medicine logo only for the Faculty of Medicine card', async () => {
    render(<FacultiesSection locale="ar" go={vi.fn()} />);
    const medicine = await screen.findByRole('button', {
      name: 'استعرض كتب كلية الطب البشري',
    });
    expect(
      within(medicine).getByRole('img', {
        name: 'شعار كلية الطب البشري - جامعة الدلتا',
      }),
    ).toHaveAttribute('src', '/branding/faculties/medicine.png');

    const dentistry = screen.getByRole('button', {
      name: 'استعرض كتب كلية طب الفم والأسنان',
    });
    expect(within(dentistry).queryByRole('img')).not.toBeInTheDocument();
  });

  it('uses a real accessible faculty destination from the homepage', async () => {
    const go = vi.fn();
    const user = userEvent.setup();
    render(<FacultiesSection locale="ar" go={go} />);
    await user.click(
      await screen.findByRole('button', { name: 'استعرض كتب كلية هندسة الطاقة والبترول' }),
    );
    expect(go).toHaveBeenCalledWith('/faculties/faculty-8');
  });

  it('keeps official Arabic names deliberate inside the English LTR experience', async () => {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    render(<FacultiesSection locale="en" go={vi.fn()} />);
    const medicine = await screen.findByRole('button', {
      name: 'Browse faculty books: كلية الطب البشري',
    });
    expect(within(medicine).getByText('كلية الطب البشري')).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  it('renders all faculties on the real list page and routes the all-faculties action', async () => {
    const go = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<FacultiesSection locale="en" go={go} />);
    await user.click(await screen.findByRole('button', { name: 'View all faculties' }));
    expect(go).toHaveBeenCalledWith('/faculties');
    unmount();

    render(<FacultiesPage locale="ar" go={go} />);
    expect(await screen.findAllByRole('button', { name: /استعرض كتب كلية/ })).toHaveLength(13);
  });

  it('shows a truthful empty faculty collection without invented book associations', async () => {
    const go = vi.fn();
    const user = userEvent.setup();
    render(<FacultiesPage locale="ar" slug="faculty-10" go={go} />);
    expect(
      await screen.findByRole('heading', { name: 'لا توجد كتب مرتبطة بهذه الكلية حتى الآن' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/لم نُنشئ ارتباطات افتراضية/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'تصفح فهرس المكتبة' }));
    expect(go).toHaveBeenCalledWith('/books');
  });

  it('shows the same official logo in the Faculty of Medicine detail identity', async () => {
    vi.mocked(facultyDetail).mockResolvedValue(faculties[0]!);
    render(<FacultiesPage locale="en" slug="faculty-1" go={vi.fn()} />);
    expect(
      await screen.findByRole('img', {
        name: 'Faculty of Medicine - Delta University logo',
      }),
    ).toHaveAttribute('src', '/branding/faculties/medicine.png');
  });

  it('renders genuinely assigned books from the faculty API response', async () => {
    vi.mocked(facultyBooks).mockResolvedValue(books([book]));
    const go = vi.fn();
    const user = userEvent.setup();
    render(<FacultiesPage locale="en" slug="faculty-10" go={go} />);
    expect(await screen.findByRole('heading', { name: 'Academic Book' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View details: Academic Book' }));
    expect(go).toHaveBeenCalledWith('/books/academic-book');
  });

  it('renders a safe missing state and retryable loading error', async () => {
    vi.mocked(facultyDetail).mockRejectedValueOnce(new ApiError('Private backend detail', 404));
    const { unmount } = render(<FacultiesPage locale="en" slug="missing" go={vi.fn()} />);
    expect(
      await screen.findByRole('heading', { name: 'The requested faculty could not be found.' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Private backend detail')).not.toBeInTheDocument();
    unmount();

    vi.mocked(listFaculties).mockRejectedValueOnce(new Error('Private network detail'));
    render(<FacultiesSection locale="en" go={vi.fn()} />);
    expect(await screen.findByText('Faculties could not be loaded right now.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(listFaculties).toHaveBeenCalledTimes(2));
  });
});
