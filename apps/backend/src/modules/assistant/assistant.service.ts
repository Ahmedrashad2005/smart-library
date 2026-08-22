import { Injectable, Logger } from '@nestjs/common';
import { BookCopyStatus, LoanStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import {
  AssistantClient,
  assistantIntents,
  type AssistantIntent,
  type AssistantInterpretation,
} from './assistant.client';
import type { AssistantHistoryTurnDto, AssistantMessageDto } from './assistant.dto';

type AssistantUser = {
  id: string;
  role: UserRole;
  preferredLanguage?: string;
};

type AssistantResult = {
  type: string;
  message: string;
  books?: Array<{ id: string }>;
  suggestions?: Array<string | AssistantSuggestion>;
  [key: string]: unknown;
};

type AssistantSuggestion = {
  action: 'SEARCH_BOOKS' | 'ASK_FOLLOW_UP' | 'VIEW_BOOK' | 'BOOK_AVAILABILITY' | 'SIMILAR_BOOKS';
  label: string;
  query?: string;
  path?: string;
};

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly recommendations: RecommendationsService,
    private readonly client: AssistantClient,
  ) {}

  async message(dto: AssistantMessageDto, user?: AssistantUser) {
    const locale = dto.locale ?? (user?.preferredLanguage === 'en' ? 'en' : 'ar');
    const history = (dto.history ?? []).slice(-10).map((turn) => ({
      role: turn.role,
      content: turn.content,
      bookIds: (turn.bookIds ?? []).slice(0, 4),
    }));
    const historicalBookIds = [...new Set(history.flatMap(({ bookIds }) => bookIds))].slice(-20);
    const referencedBookIds = (dto.context?.referencedBookIds ?? []).filter((id) =>
      historicalBookIds.includes(id),
    );
    const selectedBookId = historicalBookIds.includes(dto.context?.selectedBookId ?? '')
      ? dto.context?.selectedBookId
      : undefined;
    const context = {
      referencedBookIds,
      selectedBookId,
      lastIntent: dto.context?.lastIntent,
    };
    const interpretation = await this.interpret(
      dto.message,
      locale,
      history,
      historicalBookIds,
      context,
    );
    this.logger.log(
      `Assistant request intent=${interpretation.intent} authenticated=${Boolean(user)} history=${history.length} references=${historicalBookIds.length}`,
    );
    let result: AssistantResult;
    switch (interpretation.intent) {
      case 'RECOMMEND_BOOKS':
        result = await this.recommend(user, locale);
        break;
      case 'SEARCH_BOOKS':
        result = await this.search(interpretation.query ?? this.extractQuery(dto.message), locale);
        break;
      case 'BOOK_DETAILS':
        result = await this.bookDetails(interpretation, dto.message, locale, history, context);
        break;
      case 'BOOK_AVAILABILITY':
        result = await this.availability(interpretation, dto.message, locale, history, context);
        break;
      case 'BOOK_LOCATION':
        result = await this.location(interpretation, dto.message, locale, history, context);
        break;
      case 'MY_LOANS':
        result = await this.loans(user, locale);
        break;
      case 'MY_RESERVATIONS':
        result = await this.reservations(user, locale);
        break;
      case 'UNIVERSITY_INFO':
        result = this.universityInfo(dto.message, locale);
        break;
      case 'ACADEMIC_HELP':
        result = await this.academicHelp(dto.message, locale, history);
        break;
      case 'OUT_OF_SCOPE':
        result = this.scopeGuidance(locale);
        break;
      default:
        result = {
          type: 'TEXT',
          message:
            interpretation.answer ??
            (locale === 'ar'
              ? 'أنا مساعد مكتبة جامعة الدلتا، وأقدر أساعدك في الكتب والمراجع والدراسة والإعارات والحجوزات.'
              : 'I am the Delta University Library assistant. I can help with books, study topics, loans, and reservations.'),
          suggestions: this.suggestions(locale),
        };
    }
    const resultBookIds = (result.books ?? []).map(({ id }) => id).slice(0, 4);
    const resolvedBookId =
      interpretation.referencedBookId ??
      (['BOOK_DETAILS', 'BOOK_AVAILABILITY', 'BOOK_LOCATION'].includes(interpretation.intent)
        ? resultBookIds[0]
        : undefined);
    return {
      ...result,
      context: {
        referencedBookIds: resultBookIds.length ? resultBookIds : referencedBookIds,
        selectedBookId: resolvedBookId ?? selectedBookId ?? resultBookIds[0],
        lastIntent: interpretation.intent,
      },
    };
  }

  private async interpret(
    message: string,
    locale: 'ar' | 'en',
    history: Array<{ role: 'user' | 'assistant'; content: string; bookIds: string[] }>,
    allowedBookIds: string[],
    context: {
      referencedBookIds: string[];
      selectedBookId?: string;
      lastIntent?: AssistantIntent;
    },
  ): Promise<AssistantInterpretation> {
    if (this.assistantAiEnabled()) {
      try {
        const result = this.validateInterpretation(
          await this.client.interpret({
            message: this.redact(message),
            locale,
            history: history.map((turn) => ({ ...turn, content: this.redact(turn.content) })),
            context,
            allowedBookIds,
          }),
          new Set(allowedBookIds),
        );
        if (result) return result;
      } catch (error) {
        this.logger.warn(
          `Assistant interpretation failed safely: ${error instanceof Error ? error.name : 'UnknownError'}`,
        );
      }
    }
    return this.fallbackInterpretation(message, history, context);
  }

  private validateInterpretation(value: unknown, allowed: Set<string>) {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    if (
      typeof item.intent !== 'string' ||
      !assistantIntents.includes(item.intent as AssistantIntent)
    )
      return null;
    const query = typeof item.query === 'string' ? item.query.trim().slice(0, 300) : undefined;
    const answer = typeof item.answer === 'string' ? item.answer.trim().slice(0, 1200) : undefined;
    const confidence = ['low', 'medium', 'high'].includes(String(item.confidence))
      ? (item.confidence as 'low' | 'medium' | 'high')
      : undefined;
    const referencedBookId =
      typeof item.referencedBookId === 'string' && allowed.has(item.referencedBookId)
        ? item.referencedBookId
        : undefined;
    return { intent: item.intent as AssistantIntent, query, answer, referencedBookId, confidence };
  }

  private fallbackInterpretation(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string; bookIds: string[] }>,
    context: {
      referencedBookIds: string[];
      selectedBookId?: string;
      lastIntent?: AssistantIntent;
    },
  ): AssistantInterpretation {
    const normalized = message.toLocaleLowerCase();
    const referencedBookId = this.historyReference(normalized, history, context.selectedBookId);
    const match = (pattern: RegExp) => pattern.test(normalized);
    const broadAvailableSearch = match(/الكتب المتاحة|كتب متاحة|available books/);
    let intent: AssistantIntent;
    if (match(/جامعة الدلتا|اسم الجامعة|delta university/)) intent = 'UNIVERSITY_INFO';
    else if (match(/رشح|اقترح|recommend|suggest/)) intent = 'RECOMMEND_BOOKS';
    else if (broadAvailableSearch) intent = 'SEARCH_BOOKS';
    else if (match(/إعارات|اعارات|مستعار|موعد.*رجع|my loans|borrowed|due date/))
      intent = 'MY_LOANS';
    else if (match(/حجوز|حجزي|reservations?|reserved/)) intent = 'MY_RESERVATIONS';
    else if (
      match(/فين|مكان|موقع|location|where/) &&
      (referencedBookId || match(/كتاب|book|big java|نسخة/))
    )
      intent = 'BOOK_LOCATION';
    else if (match(/متاح|موجود|نسخة|available|availability|in stock/)) intent = 'BOOK_AVAILABILITY';
    else if (match(/(?:اشرح|شرح|explain).*(?:كتاب|book)|(?:كتاب|book).*(?:اشرح|شرح|explain)/))
      intent = 'BOOK_DETAILS';
    else if (match(/اشرح|يعني ايه|يعني إيه|الفرق بين|explain|difference between|what is/))
      intent = 'ACADEMIC_HELP';
    else if (match(/كتاب|كتب|ابحث|دور|فهرس|search|find/)) intent = 'SEARCH_BOOKS';
    else if (match(/ماتش|طقس|سياسة|كرة|match|weather|politics/)) intent = 'OUT_OF_SCOPE';
    else
      return {
        intent: 'GENERAL_LIBRARY_HELP',
        answer: /^(ليه|لماذا|why)[؟?\s]*$/.test(normalized.trim())
          ? 'ممكن توضّح سؤالك أكتر؟'
          : undefined,
        referencedBookId,
        confidence: 'low',
      };
    return {
      intent,
      query: broadAvailableSearch ? '' : this.extractQuery(message),
      referencedBookId,
      confidence: 'high',
    };
  }

  private historyReference(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string; bookIds: string[] }>,
    selectedBookId?: string,
  ) {
    const ids = [...history]
      .reverse()
      .find(({ role, bookIds }) => role === 'assistant' && bookIds.length)?.bookIds;
    if (!ids?.length) return selectedBookId;
    return /التاني|الثاني|second/.test(message)
      ? ids[1]
      : /الثالث|التالت|third/.test(message)
        ? ids[2]
        : /ده|هذا|الأول|first/.test(message)
          ? ids[0]
          : selectedBookId;
  }

  private extractQuery(message: string) {
    const cleaned = message
      .replace(/[؟?]/g, '')
      .replace(
        /(رشح|اقترح|ابحث|دور|اشرح|شرح|عايز|أريد|كتاب|كتب|عن|هل|في|فين|مكان|موقع|متاح|موجود|نسخة|لي|لـ)/g,
        ' ',
      )
      .replace(/\b(search|find|book|books|about|available|where|is|the|a)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.length >= 2 ? cleaned.slice(0, 300) : '';
  }

  private redact(value: string) {
    return value
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email removed]')
      .replace(/(?:\+?20|0)1[0125]\d{8}/g, '[phone removed]')
      .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, '[token removed]');
  }

  private assistantAiEnabled() {
    const configured = process.env.ASSISTANT_AI_ENABLED;
    return (configured ?? process.env.RECOMMENDATION_ENABLED)?.toLowerCase() === 'true';
  }

  private async recommend(user: AssistantUser | undefined, locale: 'ar' | 'en') {
    if (!this.isMember(user)) return this.loginRequired(locale, 'recommendations');
    const result = await this.recommendations.mine(user, 4, locale);
    return {
      type: 'BOOK_RECOMMENDATIONS',
      message:
        locale === 'ar'
          ? result.mode === 'personalized'
            ? 'اخترت لك كتبًا حقيقية من المكتبة بناءً على اهتماماتك السابقة.'
            : 'هذه اختيارات متاحة من فهرس مكتبة جامعة الدلتا.'
          : result.mode === 'personalized'
            ? 'I selected real library books based on your recent interests.'
            : 'Here are available choices from the Delta University Library catalog.',
      mode: result.mode,
      books: result.items.map(({ book, reason }) => ({ ...book, reason })),
      suggestions: this.suggestions(locale),
    };
  }

  private async search(query: string, locale: 'ar' | 'en') {
    const result = await this.catalog.listBooks({
      q: query || undefined,
      limit: '4',
    });
    return {
      type: 'BOOK_SEARCH_RESULTS',
      message: result.items.length
        ? locale === 'ar'
          ? `وجدت ${result.items.length} من كتب مكتبة جامعة الدلتا.`
          : `I found ${result.items.length} Delta University Library books.`
        : locale === 'ar'
          ? 'لم أجد كتبًا مطابقة في فهرس المكتبة.'
          : 'I could not find matching books in the library catalog.',
      books: result.items,
      suggestions: this.suggestions(locale),
    };
  }

  private async resolveBook(
    interpretation: AssistantInterpretation,
    message: string,
    history: AssistantHistoryTurnDto[],
    context: { selectedBookId?: string },
  ) {
    const referenced =
      interpretation.referencedBookId ??
      this.historyReference(
        message,
        history.map((x) => ({ ...x, bookIds: x.bookIds ?? [] })),
        context.selectedBookId,
      );
    if (referenced) return this.catalog.book(referenced);
    const interpretedQuery = interpretation.query?.trim();
    const messageQuery = this.extractQuery(message);
    let result = await this.catalog.listBooks({
      q: interpretedQuery || messageQuery || undefined,
      limit: '1',
    });
    if (!result.items.length && messageQuery && messageQuery !== interpretedQuery) {
      result = await this.catalog.listBooks({ q: messageQuery, limit: '1' });
    }
    return result.items[0] ? this.catalog.book(result.items[0].id) : null;
  }

  private async bookDetails(
    interpretation: AssistantInterpretation,
    message: string,
    locale: 'ar' | 'en',
    history: AssistantHistoryTurnDto[],
    context: { selectedBookId?: string },
  ): Promise<AssistantResult> {
    const book = await this.resolveBook(interpretation, message, history, context);
    if (!book) return this.bookNotFound(locale);
    const title = locale === 'ar' ? book.titleAr || book.title : book.title;
    const authors = book.authors.map(({ author }) =>
      locale === 'ar' ? author.nameAr || author.name : author.name,
    );
    const category =
      locale === 'ar' ? book.category?.nameAr || book.category?.nameEn : book.category?.nameEn;
    const description =
      locale === 'ar'
        ? book.descriptionAr || book.description
        : book.description || book.descriptionAr;
    let explanation:
      | {
          overview: string;
          topics: string[];
          level: 'BEGINNER' | 'BEGINNER_INTERMEDIATE' | 'INTERMEDIATE' | 'ADVANCED' | 'UNKNOWN';
          whyUseful?: string;
          caveat?: string;
        }
      | undefined;
    if (this.assistantAiEnabled()) {
      try {
        const response = await this.client.explainBook({
          message: this.redact(message),
          locale,
          history: history.slice(-10).map((turn) => ({
            role: turn.role,
            content: this.redact(turn.content),
            bookIds: (turn.bookIds ?? []).slice(0, 4),
          })),
          book: {
            id: book.id,
            title: book.title,
            titleAr: book.titleAr,
            authors,
            category,
            description: description?.slice(0, 1200),
            language: book.language,
            publicationYear: book.publicationYear,
            previewAvailable: book.preview?.available ?? false,
            previewOriginalName: book.preview?.originalName,
          },
        });
        if (response && typeof response === 'object') {
          const item = response as Record<string, unknown>;
          const overview = typeof item.overview === 'string' ? item.overview.trim() : '';
          const topics = Array.isArray(item.topics)
            ? item.topics
                .filter(
                  (topic): topic is string => typeof topic === 'string' && Boolean(topic.trim()),
                )
                .slice(0, 4)
                .map((topic) => topic.trim().slice(0, 180))
            : [];
          const supportedLevels = [
            'BEGINNER',
            'BEGINNER_INTERMEDIATE',
            'INTERMEDIATE',
            'ADVANCED',
            'UNKNOWN',
          ] as const;
          const level = supportedLevels.includes(item.level as (typeof supportedLevels)[number])
            ? (item.level as (typeof supportedLevels)[number])
            : 'UNKNOWN';
          if (overview) {
            explanation = {
              overview: overview.slice(0, 900),
              topics,
              level,
              whyUseful:
                typeof item.whyUseful === 'string'
                  ? item.whyUseful.trim().slice(0, 500) || undefined
                  : undefined,
              caveat:
                typeof item.caveat === 'string'
                  ? item.caveat.trim().slice(0, 400) || undefined
                  : undefined,
            };
          }
        }
      } catch (error) {
        this.logger.warn(
          `Assistant book explanation failed safely: ${error instanceof Error ? error.name : 'UnknownError'}`,
        );
      }
    }
    const fallbackOverview =
      locale === 'ar'
        ? `${title}${book.titleAr && book.titleAr !== book.title ? ` (${book.title})` : ''}${authors.length ? ` للمؤلف ${authors.join('، ')}` : ''}${category ? `، وينتمي إلى مجال ${category}` : ''}.${description ? ` ${description}` : ' لا يتوفر وصف تفصيلي مؤكد لهذه النسخة في الفهرس حاليًا.'}`
        : `${title}${authors.length ? ` by ${authors.join(', ')}` : ''}${category ? ` is cataloged under ${category}` : ''}.${description ? ` ${description}` : ' No confirmed detailed description is currently available for this edition.'}`;
    const fallbackCaveat = description
      ? undefined
      : locale === 'ar'
        ? 'هذه نبذة حذرة مبنية على بيانات الفهرس المتاحة فقط، وليست وصفًا لمحتوى الكتاب الكامل.'
        : 'This cautious overview uses available catalog metadata only; it is not a description of the complete book.';
    const suggestions: AssistantSuggestion[] = [
      {
        action: 'VIEW_BOOK',
        label: locale === 'ar' ? 'عرض الكتاب' : 'View book',
        path: `/books/${book.slug}`,
      },
      {
        action: 'BOOK_AVAILABILITY',
        label: locale === 'ar' ? 'هل الكتاب متاح؟' : 'Is this book available?',
        query: `${book.title} ${locale === 'ar' ? 'متاح؟' : 'available?'}`,
      },
      {
        action: 'SIMILAR_BOOKS',
        label: locale === 'ar' ? 'كتب مشابهة' : 'Similar books',
        query:
          locale === 'ar'
            ? `رشح لي كتب مشابهة لكتاب ${book.title}`
            : `Recommend books similar to ${book.title}`,
      },
    ];
    return {
      type: 'BOOK_EXPLANATION',
      message: explanation?.overview ?? fallbackOverview,
      books: [book],
      overview: explanation?.overview ?? fallbackOverview,
      topics: explanation?.topics ?? (category ? [category] : []),
      level: explanation?.level ?? 'UNKNOWN',
      whyUseful: explanation?.whyUseful,
      caveat: explanation?.caveat ?? fallbackCaveat,
      suggestions,
    };
  }

  private async academicHelp(
    message: string,
    locale: 'ar' | 'en',
    history: AssistantHistoryTurnDto[],
  ): Promise<AssistantResult> {
    if (this.assistantAiEnabled()) {
      try {
        const response = await this.client.explainAcademic({
          message: this.redact(message),
          locale,
          history: history.slice(-10).map((turn) => ({
            role: turn.role,
            content: this.redact(turn.content),
            bookIds: (turn.bookIds ?? []).slice(0, 4),
          })),
        });
        if (response && typeof response === 'object') {
          const item = response as Record<string, unknown>;
          const title = typeof item.title === 'string' ? item.title.trim().slice(0, 140) : '';
          const summary = typeof item.summary === 'string' ? item.summary.trim().slice(0, 700) : '';
          const keyPoints = Array.isArray(item.keyPoints)
            ? item.keyPoints
                .filter(
                  (point): point is string => typeof point === 'string' && Boolean(point.trim()),
                )
                .slice(0, 5)
                .map((point) => point.trim().slice(0, 220))
            : [];
          if (title && summary && keyPoints.length >= 3) {
            const topic = this.extractQuery(message) || title;
            const suggestions: AssistantSuggestion[] = [
              {
                action: 'SEARCH_BOOKS',
                label: locale === 'ar' ? 'ابحث عن كتب عن الموضوع' : 'Find books on this topic',
                query: locale === 'ar' ? `ابحث عن كتب عن ${topic}` : `Find books about ${topic}`,
              },
              {
                action: 'ASK_FOLLOW_UP',
                label: locale === 'ar' ? 'اشرح بمثال أبسط' : 'Explain with a simpler example',
                query:
                  locale === 'ar'
                    ? `اشرح ${topic} بمثال أبسط`
                    : `Explain ${topic} with a simpler example`,
              },
            ];
            return {
              type: 'ACADEMIC_EXPLANATION',
              message: summary,
              title,
              summary,
              keyPoints,
              example:
                typeof item.example === 'string'
                  ? item.example.trim().slice(0, 360) || undefined
                  : undefined,
              useCase:
                typeof item.useCase === 'string'
                  ? item.useCase.trim().slice(0, 420) || undefined
                  : undefined,
              suggestions,
            };
          }
        }
        this.logger.warn('Assistant academic explanation failed safely: STRUCTURED_OUTPUT_INVALID');
      } catch (error) {
        this.logger.warn(
          `Assistant academic explanation failed safely: ${error instanceof Error ? error.name : 'UnknownError'}`,
        );
      }
    }
    return {
      type: 'TEXT',
      message:
        locale === 'ar'
          ? 'واجهت مشكلة مؤقتة أثناء تجهيز الشرح. جرّب مرة ثانية، أو اطلب مني البحث عن مراجع في المكتبة.'
          : 'I encountered a temporary problem while preparing the explanation. Try again, or ask me to find library references.',
      suggestions: this.suggestions(locale),
    };
  }

  private async availability(
    interpretation: AssistantInterpretation,
    message: string,
    locale: 'ar' | 'en',
    history: AssistantHistoryTurnDto[],
    context: { selectedBookId?: string },
  ) {
    const book = await this.resolveBook(interpretation, message, history, context);
    if (!book) return this.bookNotFound(locale);
    const available = book.campusAvailability.hasPhysicalCopies
      ? book.campusAvailability.availableCopies
      : book.availableCopies;
    return {
      type: 'BOOK_AVAILABILITY',
      message:
        locale === 'ar'
          ? available > 0
            ? `نعم، يوجد حاليًا ${available} نسخة متاحة من «${book.titleAr || book.title}».`
            : `الكتاب «${book.titleAr || book.title}» موجود، لكن لا توجد نسخة متاحة حاليًا.`
          : available > 0
            ? `${available} copy of “${book.title}” is currently available.`
            : `“${book.title}” is held by the library, but no copy is currently available.`,
      books: [book],
      availability: {
        ...book.campusAvailability,
        availableCopies: available,
      },
      suggestions: this.suggestions(locale),
    };
  }

  private async location(
    interpretation: AssistantInterpretation,
    message: string,
    locale: 'ar' | 'en',
    history: AssistantHistoryTurnDto[],
    context: { selectedBookId?: string },
  ) {
    const book = await this.resolveBook(interpretation, message, history, context);
    if (!book) return this.bookNotFound(locale);
    const copy =
      book.campusAvailability.copies.find(({ status }) => status === BookCopyStatus.AVAILABLE) ??
      book.campusAvailability.copies[0];
    const location = copy?.campusLocation;
    return {
      type: 'BOOK_LOCATION',
      message: location
        ? locale === 'ar'
          ? `مكان «${book.titleAr || book.title}»: ${location.library.nameAr}، الدور ${location.floor.number}، غرفة ${location.room.number}${copy.shelf.code ? `، رف ${copy.shelf.code}` : ''}.`
          : `“${book.title}” is in ${location.library.nameEn}, floor ${location.floor.number}, room ${location.room.number}${copy.shelf.code ? `, shelf ${copy.shelf.code}` : ''}.`
        : locale === 'ar'
          ? 'الكتاب موجود، لكن لا يوجد موقع مؤكد يمكن عرضه الآن.'
          : 'The book exists, but no confirmed location is available right now.',
      books: [book],
      location: location ?? null,
      suggestions: this.suggestions(locale),
    };
  }

  private async loans(user: AssistantUser | undefined, locale: 'ar' | 'en') {
    if (!this.isMember(user)) return this.loginRequired(locale, 'loans');
    const rows = await this.prisma.loan.findMany({
      where: { memberId: user.id },
      orderBy: { borrowedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        borrowedAt: true,
        dueAt: true,
        returnedAt: true,
        status: true,
        renewedCount: true,
        bookCopy: {
          select: {
            copyCode: true,
            book: {
              select: {
                id: true,
                slug: true,
                title: true,
                titleAr: true,
                coverImageUrl: true,
                authors: { select: { author: { select: { id: true, name: true, nameAr: true } } } },
              },
            },
          },
        },
      },
    });
    const now = new Date();
    const loans = rows.map((loan) => ({
      ...loan,
      effectiveStatus: loan.returnedAt
        ? LoanStatus.RETURNED
        : loan.dueAt < now
          ? LoanStatus.OVERDUE
          : LoanStatus.ACTIVE,
    }));
    return {
      type: 'LOANS',
      message:
        locale === 'ar'
          ? loans.length
            ? `لديك ${loans.length} إعارة حديثة.`
            : 'لا توجد إعارات في حسابك.'
          : loans.length
            ? `You have ${loans.length} recent loans.`
            : 'There are no loans on your account.',
      loans,
      suggestions: this.suggestions(locale),
    };
  }

  private async reservations(user: AssistantUser | undefined, locale: 'ar' | 'en') {
    if (!this.isMember(user)) return this.loginRequired(locale, 'reservations');
    const reservations = await this.prisma.reservation.findMany({
      where: { memberId: user.id },
      orderBy: { reservedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        reservedAt: true,
        expiresAt: true,
        book: {
          select: {
            id: true,
            slug: true,
            title: true,
            titleAr: true,
            coverImageUrl: true,
            authors: { select: { author: { select: { id: true, name: true, nameAr: true } } } },
          },
        },
        bookCopy: {
          select: {
            copyCode: true,
            homeLibraryRoom: {
              select: {
                roomNumber: true,
                nameEn: true,
                nameAr: true,
                floor: {
                  select: {
                    floorNumber: true,
                    library: { select: { nameEn: true, nameAr: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    return {
      type: 'RESERVATIONS',
      message:
        locale === 'ar'
          ? reservations.length
            ? `لديك ${reservations.length} حجز حديث.`
            : 'لا توجد حجوزات في حسابك.'
          : reservations.length
            ? `You have ${reservations.length} recent reservations.`
            : 'There are no reservations on your account.',
      reservations,
      suggestions: this.suggestions(locale),
    };
  }

  private isMember(user?: AssistantUser): user is AssistantUser {
    return user?.role === UserRole.MEMBER;
  }

  private universityInfo(message: string, locale: 'ar' | 'en'): AssistantResult {
    const asksWhere = /فين|أين|عنوان|مكان|where|address|location/i.test(message);
    return {
      type: 'TEXT',
      message:
        locale === 'ar'
          ? asksWhere
            ? 'الاسم الرسمي هو جامعة الدلتا للعلوم والتكنولوجيا، وهذه الخدمة تخص مكتبة جامعة الدلتا. العنوان الفعلي المؤكد للجامعة غير متاح حاليًا ضمن بيانات المكتبة، لذلك لن أخمّنه.'
            : 'الاسم الرسمي هو جامعة الدلتا للعلوم والتكنولوجيا، وهذه الخدمة هي المساعد الذكي لمكتبة جامعة الدلتا.'
          : asksWhere
            ? 'The official name is Delta University for Science and Technology, and this service supports Delta University Library. A confirmed physical university address is not currently available in the library data, so I will not guess it.'
            : 'The official name is Delta University for Science and Technology, and this is the Delta University Library AI Assistant.',
      suggestions: this.suggestions(locale),
    };
  }

  private scopeGuidance(locale: 'ar' | 'en'): AssistantResult {
    return {
      type: 'TEXT',
      message:
        locale === 'ar'
          ? 'أنا مساعد مكتبة جامعة الدلتا، وأقدر أساعدك في الكتب والمراجع والدراسة والإعارات والحجوزات.'
          : 'I am the Delta University Library assistant. I can help with books, references, study topics, loans, and reservations.',
      suggestions: this.suggestions(locale),
    };
  }

  private loginRequired(locale: 'ar' | 'en', capability: string) {
    return {
      type: 'LOGIN_REQUIRED',
      capability,
      message:
        locale === 'ar'
          ? 'سجّل الدخول إلى حساب الطالب لاستخدام هذه الميزة.'
          : 'Sign in to your student account to use this feature.',
      loginPath: '/auth/login',
    };
  }

  private bookNotFound(locale: 'ar' | 'en') {
    return {
      type: 'BOOK_SEARCH_RESULTS',
      message:
        locale === 'ar'
          ? 'لم أجد هذا الكتاب في فهرس مكتبة جامعة الدلتا.'
          : 'I could not find that book in the Delta University Library catalog.',
      books: [],
      suggestions: this.suggestions(locale),
    };
  }

  private suggestions(locale: 'ar' | 'en') {
    return locale === 'ar'
      ? ['رشح لي كتاب', 'اعرض الكتب المتاحة']
      : ['Recommend a book', 'Show available books'];
  }
}
