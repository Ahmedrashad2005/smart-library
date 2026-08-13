import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api';
import { BookDetail, type BookDetailRecord } from './BookDetail';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  requestMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

const mockedApi = vi.mocked(apiRequest);
const go = vi.fn();

function campusBook(overrides: Partial<BookDetailRecord> = {}): BookDetailRecord {
  return {
    id: 'book-os',
    slug: 'campus-source-17-operating-system-concepts',
    title: 'Operating System Concepts',
    publicationYear: 2016,
    sourcePublicationInfo: 'India',
    totalCopies: 1,
    availableCopies: 1,
    category: {
      id: 'ai',
      slug: 'campus-ai',
      nameEn: 'AI / General Programming / ML-DL / Processing',
      nameAr: 'الذكاء الاصطناعي والبرمجة',
    },
    authors: [{ author: { id: 'author-os', name: 'SILBERSCHATZ, ABRAHAM' } }],
    campusAvailability: {
      hasPhysicalCopies: true,
      totalCopies: 1,
      availableCopies: 1,
      availabilityStatus: 'AVAILABLE',
      copies: [
        {
          id: 'copy-os',
          status: 'AVAILABLE',
          condition: 'GOOD',
          campusLocation: {
            library: {
              id: 'library',
              code: 'NAWA-COLLEGE-LIBRARY',
              nameEn: 'College Library',
              nameAr: 'مكتبة الكلية',
            },
            floor: {
              id: 'floor',
              number: 3,
              nameEn: 'Third Floor',
              nameAr: 'الدور الثالث',
            },
            room: { id: 'room', number: '315', nameEn: 'Room 315', nameAr: 'غرفة 315' },
            shelfLocationCode: '2/1',
            sourceCollection: 'AI / General Programming / ML-DL / Processing',
          },
        },
      ],
    },
    ...overrides,
  };
}

describe('NAWA Campus Book Details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  });

  it('keeps loading and Book Details content while rendering real Campus availability', async () => {
    let resolve!: (book: BookDetailRecord) => void;
    mockedApi.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    render(<BookDetail slug="campus-source-17-operating-system-concepts" locale="ar" go={go} />);
    expect(screen.getByRole('status')).toHaveTextContent('جارٍ تحميل تفاصيل الكتاب');
    resolve(campusBook());
    const heading = await screen.findByRole('heading', { name: 'Operating System Concepts' });
    expect(heading).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'لا توجد صورة غلاف: Operating System Concepts' }),
    ).toHaveTextContent('نَوَى');
    expect(
      within(heading.closest('.book-detail-content') as HTMLElement).getAllByText(
        'SILBERSCHATZ, ABRAHAM',
      ),
    ).toHaveLength(2);
    expect(screen.getByText('متاح للاستعارة')).toBeVisible();
    expect(screen.getByText('الدور الثالث — غرفة 315')).toBeVisible();
    expect(screen.getByText('2/1')).toBeVisible();
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('opens an accessible location dialog with hierarchy and source collection', async () => {
    const user = userEvent.setup();
    mockedApi.mockResolvedValueOnce(campusBook());
    render(<BookDetail slug="operating-system-concepts" locale="ar" go={go} />);
    const trigger = await screen.findByRole('button', { name: 'عرض المكان' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'تفاصيل مكان الكتاب' });
    expect(within(dialog).getByText('مكتبة الكلية')).toBeVisible();
    expect(within(dialog).getByText('الدور الثالث')).toBeVisible();
    expect(within(dialog).getByText('غرفة 315')).toBeVisible();
    expect(within(dialog).getByText('AI / General Programming / ML-DL / Processing')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'إغلاق' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('preserves and renders the Big Java shelf code 1,2/1 exactly', async () => {
    const book = campusBook({
      id: 'big-java',
      slug: 'campus-source-18-big-java',
      title: 'Big Java',
      publicationYear: 2006,
      sourcePublicationInfo: 'Hoboken, N.J',
    });
    book.campusAvailability.copies[0]!.campusLocation.shelfLocationCode = '1,2/1';
    mockedApi.mockResolvedValueOnce(book);
    render(<BookDetail slug="campus-source-18-big-java" locale="ar" go={go} />);
    expect(await screen.findByText('1,2/1')).toBeVisible();
  });

  it('omits missing publication/year safely while retaining DDC', async () => {
    mockedApi.mockResolvedValueOnce(
      campusBook({
        title: 'Introduction to Biomedical Engineering',
        publicationYear: null,
        sourcePublicationInfo: null,
        ddc: '621',
      }),
    );
    render(<BookDetail slug="biomedical" locale="ar" go={go} />);
    expect(
      await screen.findByRole('heading', { name: 'Introduction to Biomedical Engineering' }),
    ).toBeVisible();
    expect(screen.queryByText('سنة النشر')).not.toBeInTheDocument();
    expect(screen.queryByText('بيانات النشر الأصلية')).not.toBeInTheDocument();
    expect(screen.getByText('تصنيف DDC')).toBeVisible();
    expect(screen.getByText('621')).toBeVisible();
  });

  it('shows a loaned Campus copy as unavailable while retaining its home location', async () => {
    const book = campusBook();
    book.campusAvailability.availableCopies = 0;
    book.campusAvailability.availabilityStatus = 'UNAVAILABLE';
    book.campusAvailability.copies[0]!.status = 'BORROWED';
    mockedApi.mockResolvedValueOnce(book);
    render(<BookDetail slug="operating-system-concepts" locale="ar" go={go} />);
    expect(await screen.findByText('مُعار حاليًا')).toBeVisible();
    expect(screen.queryByText('متاح للاستعارة')).not.toBeInTheDocument();
    expect(screen.getByText('الدور الثالث — غرفة 315')).toBeVisible();
    expect(screen.getByText('2/1')).toBeVisible();
  });

  it('renders a neutral state for a Store book without Campus copies', async () => {
    mockedApi.mockResolvedValueOnce(
      campusBook({
        title: 'Store-only Book',
        campusAvailability: {
          hasPhysicalCopies: false,
          totalCopies: 0,
          availableCopies: 0,
          availabilityStatus: 'NOT_HELD',
          copies: [],
        },
      }),
    );
    render(<BookDetail slug="store-only" locale="ar" go={go} />);
    expect(await screen.findByText('هذا الكتاب غير متوفر حاليًا في مكتبة الكلية.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'عرض المكان' })).not.toBeInTheDocument();
  });
});
