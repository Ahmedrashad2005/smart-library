import { Injectable, Logger } from '@nestjs/common';
import { BookCopyStatus, Prisma, ReservationStatus } from '@prisma/client';
import { performance } from 'node:perf_hooks';
import { PrismaService } from '../../database/prisma.service';
import {
  RecommendationClient,
  type RankCandidateBook,
  type RankHistoryBook,
  type RankRequest,
} from './recommendation.client';

const presentationInclude = {
  category: {
    select: { id: true, nameEn: true, nameAr: true, slug: true },
  },
  authors: {
    include: { author: { select: { id: true, name: true, nameAr: true } } },
  },
  faculties: {
    include: {
      faculty: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
    },
  },
  copies: {
    where: {
      isArchived: false,
      deletedAt: null,
      homeLibraryRoomId: { not: null },
    },
    select: { status: true },
  },
} satisfies Prisma.BookInclude;

type PresentationBook = Prisma.BookGetPayload<{ include: typeof presentationInclude }>;
type InterestBook = Pick<
  PresentationBook,
  | 'id'
  | 'title'
  | 'titleAr'
  | 'description'
  | 'descriptionAr'
  | 'category'
  | 'authors'
  | 'faculties'
>;

type RecommendationMode = 'personalized' | 'cold_start' | 'fallback';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: RecommendationClient,
  ) {}

  async mine(
    user: { id: string; preferredLanguage?: string },
    requestedLimit?: number,
    requestedLocale?: 'ar' | 'en',
  ) {
    const started = performance.now();
    const configuredLimit = Number(process.env.RECOMMENDATION_LIMIT ?? 4);
    const limit = Math.min(8, Math.max(1, requestedLimit ?? configuredLimit));
    const locale: 'ar' | 'en' = requestedLocale ?? (user.preferredLanguage === 'en' ? 'en' : 'ar');
    const candidateLimit = Math.min(
      30,
      Math.max(limit, Number(process.env.RECOMMENDATION_CANDIDATE_LIMIT ?? 30)),
    );

    const [loans, reservations, activeLoans, activeReservations] = await Promise.all([
      this.prisma.loan.findMany({
        where: { memberId: user.id },
        orderBy: { borrowedAt: 'desc' },
        take: 5,
        include: {
          bookCopy: { include: { book: { include: presentationInclude } } },
        },
      }),
      this.prisma.reservation.findMany({
        where: {
          memberId: user.id,
          status: {
            in: [ReservationStatus.ACTIVE, ReservationStatus.COLLECTED, ReservationStatus.EXPIRED],
          },
        },
        orderBy: { reservedAt: 'desc' },
        take: 5,
        include: { book: { include: presentationInclude } },
      }),
      this.prisma.loan.findMany({
        where: { memberId: user.id, status: 'ACTIVE', returnedAt: null },
        select: { bookCopy: { select: { bookId: true } } },
      }),
      this.prisma.reservation.findMany({
        where: { memberId: user.id, status: ReservationStatus.ACTIVE },
        select: { bookId: true },
      }),
    ]);

    const historyBooks = this.uniqueBooks([
      ...loans.map((loan) => loan.bookCopy.book),
      ...reservations.map((reservation) => reservation.book),
    ]);
    const historyIds = new Set(historyBooks.map((book) => book.id));
    const currentIds = new Set([
      ...activeLoans.map((loan) => loan.bookCopy.bookId),
      ...activeReservations.map((reservation) => reservation.bookId),
    ]);
    const baseWhere: Prisma.BookWhereInput = {
      isArchived: false,
      deletedAt: null,
      category: { isArchived: false, deletedAt: null },
      copies: {
        some: {
          isArchived: false,
          deletedAt: null,
          homeLibraryRoomId: { not: null },
        },
      },
    };

    let candidates = await this.prisma.book.findMany({
      where: { ...baseWhere, id: { notIn: [...new Set([...historyIds, ...currentIds])] } },
      include: presentationInclude,
      orderBy: [
        { availableCopies: 'desc' },
        { borrowCount: 'desc' },
        { createdAt: 'desc' },
        { title: 'asc' },
      ],
      take: candidateLimit,
    });

    if (candidates.length < limit) {
      const existing = new Set(candidates.map((book) => book.id));
      const relaxed = await this.prisma.book.findMany({
        where: {
          ...baseWhere,
          id: { notIn: [...new Set([...currentIds, ...existing])] },
        },
        include: presentationInclude,
        orderBy: [
          { availableCopies: 'desc' },
          { borrowCount: 'desc' },
          { createdAt: 'desc' },
          { title: 'asc' },
        ],
        take: candidateLimit - candidates.length,
      });
      candidates = [...candidates, ...relaxed].slice(0, candidateLimit);
    }

    const history = historyBooks.map((book) => this.toInterest(book, locale));
    let mode: RecommendationMode = history.length ? 'fallback' : 'cold_start';
    let ranked = this.fallbackRanking(candidates, limit, mode, locale);
    const enabled = process.env.RECOMMENDATION_ENABLED?.toLowerCase() === 'true';

    if (history.length && enabled && candidates.length) {
      const request: RankRequest = {
        history,
        academicContext: {},
        candidateBooks: candidates.map((book) => this.toCandidate(book, locale)),
        limit,
        locale,
      };
      try {
        const response = await this.client.rank(request);
        const validated = this.validateRankResponse(
          response,
          new Set(candidates.map((book) => book.id)),
          limit,
        );
        if (validated.length) {
          ranked = validated;
          mode = 'personalized';
        }
      } catch (error) {
        this.logger.warn(`Recommendation ranking failed safely: ${this.errorName(error)}`);
      }
    }

    const ids = ranked.map(({ bookId }) => bookId);
    const authoritative = ids.length
      ? await this.prisma.book.findMany({
          where: { ...baseWhere, id: { in: ids } },
          include: presentationInclude,
        })
      : [];
    const booksById = new Map(authoritative.map((book) => [book.id, book]));
    const items = ranked.flatMap(({ bookId, reason }) => {
      const book = booksById.get(bookId);
      return book ? [{ book: this.presentBook(book), reason }] : [];
    });

    this.logger.log(
      `Recommendation completed mode=${mode} history=${history.length} candidates=${candidates.length} results=${items.length} latencyMs=${Math.round(performance.now() - started)}`,
    );
    return { mode, generatedAt: new Date().toISOString(), items };
  }

  private uniqueBooks(books: InterestBook[]): InterestBook[] {
    const seen = new Set<string>();
    return books.filter((book) => {
      if (seen.has(book.id)) return false;
      seen.add(book.id);
      return true;
    });
  }

  private toInterest(book: InterestBook, locale: 'ar' | 'en'): RankHistoryBook {
    const localized = locale === 'ar';
    const description = (
      localized ? book.descriptionAr || book.description : book.description
    )?.slice(0, 420);
    return {
      title: localized ? book.titleAr || book.title : book.title,
      authors: book.authors.map(({ author }) =>
        localized ? author.nameAr || author.name : author.name,
      ),
      category: localized ? book.category.nameAr : book.category.nameEn,
      ...(description ? { description } : {}),
      faculties: book.faculties.map(({ faculty }) =>
        localized ? faculty.nameAr : faculty.nameEn || faculty.nameAr,
      ),
    };
  }

  private toCandidate(book: PresentationBook, locale: 'ar' | 'en'): RankCandidateBook {
    return {
      id: book.id,
      ...this.toInterest(book, locale),
      available: book.copies.some(({ status }) => status === BookCopyStatus.AVAILABLE),
    };
  }

  private validateRankResponse(response: unknown, candidateIds: Set<string>, limit: number) {
    if (!response || typeof response !== 'object' || !('recommendations' in response)) return [];
    const recommendations = (response as { recommendations?: unknown }).recommendations;
    if (!Array.isArray(recommendations)) return [];
    const seen = new Set<string>();
    const valid: Array<{ bookId: string; reason: string }> = [];
    for (const item of recommendations) {
      if (!item || typeof item !== 'object') continue;
      const { bookId, reason } = item as { bookId?: unknown; reason?: unknown };
      if (
        typeof bookId !== 'string' ||
        typeof reason !== 'string' ||
        !candidateIds.has(bookId) ||
        seen.has(bookId) ||
        !reason.trim()
      )
        continue;
      seen.add(bookId);
      valid.push({ bookId, reason: reason.trim().slice(0, 240) });
      if (valid.length === limit) break;
    }
    return valid;
  }

  private fallbackRanking(
    books: PresentationBook[],
    limit: number,
    mode: RecommendationMode,
    locale: 'ar' | 'en',
  ) {
    const reason =
      locale === 'ar'
        ? mode === 'cold_start'
          ? 'كتاب متاح من مقتنيات مكتبة جامعة الدلتا قد يهمك.'
          : 'اختيار موثوق من فهرس المكتبة يرتبط باهتماماتك الدراسية.'
        : mode === 'cold_start'
          ? 'An available Delta University Library book you may find useful.'
          : 'A reliable catalog choice related to your academic interests.';
    return books.slice(0, limit).map((book) => ({ bookId: book.id, reason }));
  }

  private presentBook(book: PresentationBook) {
    const availableCampusCopies = book.copies.filter(
      ({ status }) => status === BookCopyStatus.AVAILABLE,
    ).length;
    return {
      id: book.id,
      slug: book.slug,
      title: book.title,
      titleAr: book.titleAr,
      description: book.description,
      descriptionAr: book.descriptionAr,
      coverImageUrl: book.coverImageUrl,
      borrowCount: book.borrowCount,
      isFeatured: book.isFeatured,
      createdAt: book.createdAt,
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
      category: book.category,
      authors: book.authors,
      faculties: book.faculties,
      campusAvailability: {
        hasPhysicalCopies: book.copies.length > 0,
        totalCopies: book.copies.length,
        availableCopies: availableCampusCopies,
        availabilityStatus:
          book.copies.length === 0
            ? 'NOT_HELD'
            : availableCampusCopies > 0
              ? 'AVAILABLE'
              : 'UNAVAILABLE',
      },
    };
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
