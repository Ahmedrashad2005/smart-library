import { BookCopyStatus } from '@prisma/client';
import type { PrismaService } from '../src/database/prisma.service';
import type {
  RecommendationClient,
  RankRequest,
} from '../src/modules/recommendations/recommendation.client';
import { RecommendationsService } from '../src/modules/recommendations/recommendations.service';

const category = {
  id: 'category-1',
  nameEn: 'Engineering',
  nameAr: 'الهندسة',
  slug: 'engineering',
};

function book(number: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `book-${number}`,
    slug: `book-${number}`,
    title: `Book ${number}`,
    titleAr: `كتاب ${number}`,
    subtitle: null,
    subtitleAr: null,
    isbn10: null,
    isbn13: null,
    description: `Description ${number}`,
    descriptionAr: `وصف ${number}`,
    coverImageUrl: `https://images.test/book-${number}.jpg`,
    previewPdfKey: null,
    previewPdfOriginalName: null,
    previewPdfMimeType: null,
    previewPdfSize: null,
    previewPdfUpdatedAt: null,
    publicationYear: 2024,
    sourcePublicationInfo: null,
    ddc: null,
    edition: null,
    language: 'en',
    pageCount: 300,
    publisherId: null,
    categoryId: category.id,
    averageRating: 0,
    ratingsCount: 0,
    totalCopies: 2,
    availableCopies: 1,
    borrowCount: 10 - number,
    isFeatured: false,
    isArchived: false,
    createdAt: new Date(`2026-08-${String(number).padStart(2, '0')}T00:00:00Z`),
    updatedAt: new Date('2026-08-22T00:00:00Z'),
    deletedAt: null,
    category,
    authors: [
      { author: { id: `author-${number}`, name: `Author ${number}`, nameAr: `مؤلف ${number}` } },
    ],
    faculties: [
      {
        faculty: {
          id: 'faculty-1',
          slug: 'engineering',
          nameAr: 'كلية الهندسة',
          nameEn: 'Engineering',
        },
      },
    ],
    copies: [{ status: BookCopyStatus.AVAILABLE }],
    ...overrides,
  };
}

describe('AI recommendation orchestration', () => {
  const loanFindMany = jest.fn();
  const reservationFindMany = jest.fn();
  const bookFindMany = jest.fn();
  const rank = jest.fn();
  const prisma = {
    loan: { findMany: loanFindMany },
    reservation: { findMany: reservationFindMany },
    book: { findMany: bookFindMany },
  } as unknown as PrismaService;
  const client = { rank } as unknown as RecommendationClient;
  const service = new RecommendationsService(prisma, client);
  const candidates = [book(1), book(2), book(3), book(4), book(5)];

  function arrange(
    options: {
      history?: boolean;
      reservationHistory?: boolean;
      activeLoanId?: string;
      activeReservationId?: string;
      candidateBooks?: ReturnType<typeof book>[];
      authoritativeBooks?: ReturnType<typeof book>[];
    } = {},
  ) {
    const historyBook = book(90);
    const reservedBook = book(91);
    loanFindMany
      .mockResolvedValueOnce(
        options.history === false
          ? []
          : [{ borrowedAt: new Date(), bookCopy: { book: historyBook } }],
      )
      .mockResolvedValueOnce(
        options.activeLoanId ? [{ bookCopy: { bookId: options.activeLoanId } }] : [],
      );
    reservationFindMany
      .mockResolvedValueOnce(
        options.reservationHistory === false
          ? []
          : [
              {
                reservedAt: new Date(),
                book: options.history === false ? reservedBook : historyBook,
              },
            ],
      )
      .mockResolvedValueOnce(
        options.activeReservationId ? [{ bookId: options.activeReservationId }] : [],
      );
    const selected = options.candidateBooks ?? candidates;
    bookFindMany
      .mockResolvedValueOnce(selected)
      .mockResolvedValueOnce(options.authoritativeBooks ?? selected);
    rank.mockResolvedValue({
      recommendations: selected.slice(0, 4).map((item) => ({
        bookId: item.id,
        reason: `Reason ${item.id}`,
      })),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RECOMMENDATION_ENABLED = 'true';
    process.env.RECOMMENDATION_CANDIDATE_LIMIT = '30';
  });

  it('loads the latest five loans newest-first for the authenticated member', async () => {
    arrange();
    await service.mine({ id: 'member-1', preferredLanguage: 'ar' });
    expect(loanFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { memberId: 'member-1' },
      orderBy: { borrowedAt: 'desc' },
      take: 5,
    });
  });

  it('loads only meaningful recent reservations and excludes cancelled signals', async () => {
    arrange();
    await service.mine({ id: 'member-1' });
    expect(reservationFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { memberId: 'member-1', status: { in: ['ACTIVE', 'COLLECTED', 'EXPIRED'] } },
      orderBy: { reservedAt: 'desc' },
      take: 5,
    });
  });

  it('deduplicates the same book across loan and reservation history', async () => {
    arrange();
    await service.mine({ id: 'member-1' });
    const request = rank.mock.calls[0]?.[0] as RankRequest;
    expect(request.history).toHaveLength(1);
  });

  it('never sends PII or authentication fields to the ranking service', async () => {
    arrange();
    await service.mine({ id: 'private-member-id', preferredLanguage: 'ar' });
    const payload = JSON.stringify(rank.mock.calls[0]?.[0]);
    expect(payload).not.toContain('private-member-id');
    expect(payload).not.toMatch(/email|phone|membership|password|token/i);
  });

  it('sends only bounded safe history and candidate presentation fields', async () => {
    arrange();
    await service.mine({ id: 'member-1' });
    const request = rank.mock.calls[0]?.[0] as RankRequest;
    expect(Object.keys(request.history[0]!).sort()).toEqual(
      ['authors', 'category', 'description', 'faculties', 'title'].sort(),
    );
    expect(Object.keys(request.candidateBooks[0]!).sort()).toEqual(
      ['authors', 'available', 'category', 'description', 'faculties', 'id', 'title'].sort(),
    );
  });

  it('enforces the configured candidate maximum of thirty', async () => {
    arrange();
    process.env.RECOMMENDATION_CANDIDATE_LIMIT = '200';
    await service.mine({ id: 'member-1' });
    expect(bookFindMany.mock.calls[0]?.[0]).toMatchObject({ take: 30 });
  });

  it('queries only active non-archived Delta University Library catalog books', async () => {
    arrange();
    await service.mine({ id: 'member-1' });
    expect(bookFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        isArchived: false,
        deletedAt: null,
        category: { isArchived: false, deletedAt: null },
        copies: { some: { isArchived: false, deletedAt: null, homeLibraryRoomId: { not: null } } },
      },
    });
  });

  it('excludes books in current active loans and reservations', async () => {
    arrange({ activeLoanId: 'active-loan-book', activeReservationId: 'active-reservation-book' });
    await service.mine({ id: 'member-1' });
    const query = bookFindMany.mock.calls[0]?.[0] as { where: { id: { notIn: string[] } } };
    expect(query.where.id.notIn).toEqual(
      expect.arrayContaining(['active-loan-book', 'active-reservation-book']),
    );
  });

  it('returns a valid ranked Gemini result in supplied order', async () => {
    arrange();
    const result = await service.mine({ id: 'member-1' });
    expect(result.mode).toBe('personalized');
    expect(result.items.map((item) => item.book.id)).toEqual([
      'book-1',
      'book-2',
      'book-3',
      'book-4',
    ]);
  });

  it('discards hallucinated IDs while retaining valid recommendations', async () => {
    arrange();
    rank.mockResolvedValue({
      recommendations: [
        { bookId: 'invented', reason: 'Invented' },
        { bookId: 'book-2', reason: 'Valid' },
      ],
    });
    const result = await service.mine({ id: 'member-1' });
    expect(result.items.map((item) => item.book.id)).toEqual(['book-2']);
  });

  it('discards duplicate Gemini IDs', async () => {
    arrange();
    rank.mockResolvedValue({
      recommendations: [
        { bookId: 'book-1', reason: 'First' },
        { bookId: 'book-1', reason: 'Duplicate' },
        { bookId: 'book-2', reason: 'Second' },
      ],
    });
    const result = await service.mine({ id: 'member-1' });
    expect(result.items.map((item) => item.book.id)).toEqual(['book-1', 'book-2']);
  });

  it('caps valid AI output at the requested result count', async () => {
    arrange();
    rank.mockResolvedValue({
      recommendations: candidates.map((item) => ({ bookId: item.id, reason: 'Valid' })),
    });
    const result = await service.mine({ id: 'member-1' }, 2);
    expect(result.items).toHaveLength(2);
  });

  it('reloads and returns authoritative PostgreSQL book presentation data', async () => {
    arrange({
      authoritativeBooks: candidates.map((item) =>
        item.id === 'book-1' ? book(1, { title: 'Authoritative title' }) : item,
      ),
    });
    const result = await service.mine({ id: 'member-1' });
    expect(result.items[0]?.book.title).toBe('Authoritative title');
    expect(result.items[0]?.book).not.toHaveProperty('previewPdfKey');
  });

  it('uses deterministic cold-start books without calling Gemini when history is empty', async () => {
    arrange({ history: false, reservationHistory: false });
    const result = await service.mine({ id: 'member-1', preferredLanguage: 'en' });
    expect(result.mode).toBe('cold_start');
    expect(result.items).toHaveLength(4);
    expect(rank).not.toHaveBeenCalled();
  });

  it('falls back deterministically when Gemini fails', async () => {
    arrange();
    rank.mockRejectedValue(new Error('service unavailable'));
    const result = await service.mine({ id: 'member-1' });
    expect(result.mode).toBe('fallback');
    expect(result.items.map((item) => item.book.id)).toEqual([
      'book-1',
      'book-2',
      'book-3',
      'book-4',
    ]);
  });

  it('falls back on recommendation timeouts', async () => {
    arrange();
    rank.mockRejectedValue(new DOMException('Timed out', 'AbortError'));
    expect((await service.mine({ id: 'member-1' })).mode).toBe('fallback');
  });

  it('falls back on malformed AI response shape', async () => {
    arrange();
    rank.mockResolvedValue({ recommendations: 'not-an-array' });
    expect((await service.mine({ id: 'member-1' })).mode).toBe('fallback');
  });

  it('falls back when Gemini returns an empty result', async () => {
    arrange();
    rank.mockResolvedValue({ recommendations: [] });
    expect((await service.mine({ id: 'member-1' })).mode).toBe('fallback');
  });

  it('returns deterministic results without calling Python when the feature is disabled', async () => {
    arrange();
    process.env.RECOMMENDATION_ENABLED = 'false';
    const result = await service.mine({ id: 'member-1' });
    expect(result.mode).toBe('fallback');
    expect(rank).not.toHaveBeenCalled();
  });

  it('returns an empty safe response when no eligible catalog candidates exist', async () => {
    arrange({ candidateBooks: [], authoritativeBooks: [] });
    bookFindMany.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await service.mine({ id: 'member-1' });
    expect(result.items).toEqual([]);
    expect(rank).not.toHaveBeenCalled();
  });

  it('localizes safe context and reasons using the authenticated member preference', async () => {
    arrange();
    const result = await service.mine({ id: 'member-1', preferredLanguage: 'en' }, undefined, 'ar');
    const request = rank.mock.calls[0]?.[0] as RankRequest;
    expect(request.locale).toBe('ar');
    expect(request.history[0]?.title).toBe('كتاب 90');
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
