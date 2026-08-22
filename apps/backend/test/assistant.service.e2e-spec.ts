import { UserRole } from '@prisma/client';
import { AssistantService } from '../src/modules/assistant/assistant.service';

const book = {
  id: 'book-1',
  slug: 'big-java',
  title: 'Big Java',
  titleAr: 'جافا الكبير',
  coverImageUrl: null,
  totalCopies: 1,
  availableCopies: 1,
  authors: [{ author: { id: 'author-1', name: 'Cay Horstmann', nameAr: null } }],
  campusAvailability: {
    hasPhysicalCopies: true,
    totalCopies: 1,
    availableCopies: 1,
    availabilityStatus: 'AVAILABLE',
    copies: [
      {
        status: 'AVAILABLE',
        shelf: { code: 'A-1' },
        campusLocation: {
          library: { nameAr: 'مكتبة الكلية', nameEn: 'College Library' },
          floor: { number: '3' },
          room: { number: '315' },
        },
      },
    ],
  },
};

describe('AssistantService read-only orchestration', () => {
  const prisma = {
    loan: { findMany: jest.fn() },
    reservation: { findMany: jest.fn() },
  };
  const catalog = {
    listBooks: jest.fn(),
    book: jest.fn(),
  };
  const recommendations = { mine: jest.fn() };
  const client = { interpret: jest.fn(), explainBook: jest.fn(), explainAcademic: jest.fn() };
  const service = new AssistantService(
    prisma as never,
    catalog as never,
    recommendations as never,
    client as never,
  );
  const member = { id: 'member-1', role: UserRole.MEMBER, preferredLanguage: 'ar' };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RECOMMENDATION_ENABLED = 'false';
    process.env.ASSISTANT_AI_ENABLED = 'false';
    catalog.listBooks.mockResolvedValue({ items: [book], total: 1 });
    catalog.book.mockResolvedValue(book);
    recommendations.mine.mockResolvedValue({
      mode: 'personalized',
      items: [{ book, reason: 'مناسب لاهتمامك بالبرمجة.' }],
    });
    prisma.loan.findMany.mockResolvedValue([]);
    prisma.reservation.findMany.mockResolvedValue([]);
  });

  it('allows unauthenticated public catalog search', async () => {
    const result = await service.message({ message: 'دور على كتاب Big Java', locale: 'ar' });
    expect(result.type).toBe('BOOK_SEARCH_RESULTS');
    expect(catalog.listBooks).toHaveBeenCalledWith(expect.objectContaining({ limit: '4' }));
  });

  it('never accepts a client member identity for recommendations', async () => {
    const result = await service.message(
      { message: 'رشح لي كتاب', locale: 'ar', memberId: 'attacker' } as never,
      member,
    );
    expect(result.type).toBe('BOOK_RECOMMENDATIONS');
    expect(recommendations.mine).toHaveBeenCalledWith(member, 4, 'ar');
  });

  it('reuses the existing recommendation service', async () => {
    const result = await service.message({ message: 'رشح لي كتاب', locale: 'ar' }, member);
    expect(result).toMatchObject({ books: [expect.objectContaining({ id: 'book-1' })] });
    expect(recommendations.mine).toHaveBeenCalledTimes(1);
  });

  it('uses real CatalogService results for book search', async () => {
    await service.message({ message: 'عايز كتاب Java', locale: 'ar' });
    expect(catalog.listBooks).toHaveBeenCalledWith(
      expect.objectContaining({ q: expect.stringContaining('Java'), limit: '4' }),
    );
  });

  it('uses authoritative availability counts', async () => {
    const result = await service.message({ message: 'Big Java متاح؟', locale: 'ar' });
    expect(result.type).toBe('BOOK_AVAILABILITY');
    expect(result.message).toContain('1 نسخة متاحة');
  });

  it('reports authoritative unavailable state', async () => {
    catalog.book.mockResolvedValue({
      ...book,
      campusAvailability: { ...book.campusAvailability, availableCopies: 0 },
    });
    const result = await service.message({ message: 'Big Java متاح؟', locale: 'ar' });
    expect(result.message).toContain('لا توجد نسخة متاحة');
  });

  it('uses authoritative floor, room, and shelf location', async () => {
    const result = await service.message({ message: 'Big Java فين؟', locale: 'ar' });
    expect(result.type).toBe('BOOK_LOCATION');
    expect(result.message).toContain('الدور 3، غرفة 315، رف A-1');
  });

  it('does not invent a missing location', async () => {
    catalog.book.mockResolvedValue({
      ...book,
      campusAvailability: { ...book.campusAvailability, copies: [] },
    });
    const result = await service.message({ message: 'Big Java فين؟', locale: 'ar' });
    expect(result.message).toContain('لا يوجد موقع مؤكد');
  });

  it('loads only the authenticated member loans and safe fields', async () => {
    prisma.loan.findMany.mockResolvedValue([
      {
        id: 'loan-1',
        borrowedAt: new Date('2026-08-01'),
        dueAt: new Date('2099-09-01'),
        returnedAt: null,
        status: 'ACTIVE',
        renewedCount: 0,
        bookCopy: { copyCode: 'COPY-1', book },
      },
    ]);
    const result = await service.message({ message: 'اعرض إعاراتي', locale: 'ar' }, member);
    expect(prisma.loan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { memberId: 'member-1' } }),
    );
    expect(JSON.stringify(result)).not.toMatch(/email|membershipNumber|password/);
  });

  it('loads only the authenticated member reservations without lifecycle writes', async () => {
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: 'reservation-1',
        status: 'ACTIVE',
        reservedAt: new Date(),
        expiresAt: new Date(),
        book,
      },
    ]);
    const result = await service.message({ message: 'اعرض حجوزاتي', locale: 'ar' }, member);
    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { memberId: 'member-1' } }),
    );
    expect(result.type).toBe('RESERVATIONS');
  });

  it('uses Gemini interpretation for concise academic help', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockResolvedValue({
      intent: 'ACADEMIC_HELP',
      query: 'linked list',
      referencedBookId: null,
    });
    client.explainAcademic.mockResolvedValue({
      title: 'Linked List — القائمة المرتبطة',
      summary: 'القائمة المرتبطة بنية بيانات تتكون من عقد مترابطة.',
      keyPoints: ['كل عنصر عقدة.', 'العقدة تحمل البيانات.', 'المؤشر يصل العقدة التالية.'],
      example: '10 → 20 → NULL',
      useCase: 'تفيد عند تكرار الإضافة والحذف.',
    });
    const result = await service.message({ message: 'اشرح linked list', locale: 'ar' });
    expect(result.type).toBe('ACADEMIC_EXPLANATION');
    expect(result.message).toContain('عقد مترابطة');
    expect(result).toMatchObject({
      title: 'Linked List — القائمة المرتبطة',
      keyPoints: expect.arrayContaining(['كل عنصر عقدة.']),
      example: '10 → 20 → NULL',
    });
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'SEARCH_BOOKS',
          query: expect.stringContaining('linked'),
        }),
        expect.objectContaining({ action: 'ASK_FOLLOW_UP' }),
      ]),
    );
    expect(client.explainAcademic).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'اشرح linked list', locale: 'ar' }),
    );
  });

  it('uses the independent Assistant AI flag even when recommendations are disabled', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    process.env.RECOMMENDATION_ENABLED = 'false';
    client.interpret.mockResolvedValue({
      intent: 'ACADEMIC_HELP',
      query: 'database normalization',
      referencedBookId: null,
      confidence: 'high',
    });
    client.explainAcademic.mockResolvedValue({
      title: 'Database normalization',
      summary: 'Normalization organizes database tables to reduce duplication.',
      keyPoints: ['Separate concerns.', 'Reduce repetition.', 'Protect consistency.'],
      example: null,
      useCase: 'Useful when designing relational databases.',
    });
    const result = await service.message({
      message: 'Explain database normalization',
      locale: 'en',
    });
    expect(result.message).toContain('reduce duplication');
    expect(client.interpret).toHaveBeenCalledTimes(1);
    expect(client.explainAcademic).toHaveBeenCalledTimes(1);
  });

  it('keeps Arabic locale for the separate academic generation request', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockResolvedValue({
      intent: 'ACADEMIC_HELP',
      query: 'linked list',
      referencedBookId: null,
    });
    client.explainAcademic.mockResolvedValue({
      title: 'شرح عربي',
      summary: 'شرح عربي موجز.',
      keyPoints: ['نقطة أولى.', 'نقطة ثانية.', 'نقطة ثالثة.'],
      example: null,
      useCase: null,
    });
    await service.message({ message: 'اشرح linked list', locale: 'ar' });
    expect(client.explainAcademic).toHaveBeenCalledWith(expect.objectContaining({ locale: 'ar' }));
  });

  it('uses the honest academic fallback when Gemini generation is unavailable', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockResolvedValue({
      intent: 'ACADEMIC_HELP',
      query: 'linked list',
      referencedBookId: null,
    });
    client.explainAcademic.mockRejectedValue(
      Object.assign(new Error('Assistant service returned 503 (AI_UNAVAILABLE)'), {
        name: 'AssistantServiceError',
      }),
    );
    const result = await service.message({ message: 'اشرح linked list', locale: 'ar' });
    expect(result.message).toContain('واجهت مشكلة مؤقتة أثناء تجهيز الشرح');
  });

  it('routes Delta University questions to trusted information rather than catalog search', async () => {
    const result = await service.message({ message: 'هي جامعة الدلتا دي فين؟', locale: 'ar' });
    expect(result.type).toBe('TEXT');
    expect(result.message).toContain('العنوان الفعلي المؤكد');
    expect(catalog.listBooks).not.toHaveBeenCalled();
  });

  it('routes a real Book explanation through catalog metadata and Gemini', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockResolvedValue({ intent: 'BOOK_DETAILS', query: 'Big Java' });
    client.explainBook.mockResolvedValue({
      overview: 'Big Java يقدم مدخلًا منظمًا إلى Java والبرمجة كائنية التوجه.',
      topics: ['أساسيات Java', 'البرمجة كائنية التوجه'],
      level: 'BEGINNER_INTERMEDIATE',
      whyUseful: 'مفيد لبناء أساس برمجي منظم.',
      caveat: null,
    });
    const result = await service.message({ message: 'اشرح لي كتاب Big Java', locale: 'ar' });
    expect(result.type).toBe('BOOK_EXPLANATION');
    expect(result.message).toContain('البرمجة كائنية التوجه');
    expect(result).toMatchObject({
      topics: ['أساسيات Java', 'البرمجة كائنية التوجه'],
      level: 'BEGINNER_INTERMEDIATE',
      whyUseful: 'مفيد لبناء أساس برمجي منظم.',
    });
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'VIEW_BOOK', path: '/books/big-java' }),
        expect.objectContaining({ action: 'BOOK_AVAILABILITY' }),
        expect.objectContaining({ action: 'SIMILAR_BOOKS' }),
      ]),
    );
    expect(catalog.listBooks).toHaveBeenCalledWith(expect.objectContaining({ q: 'Big Java' }));
    expect(client.explainBook).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'ar',
        book: expect.objectContaining({ id: 'book-1', title: 'Big Java' }),
      }),
    );
  });

  it('retries a decorated Gemini Book query with the clean user-title query', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockResolvedValue({
      intent: 'BOOK_DETAILS',
      query: 'كتاب بعنوان «Big Java»',
      referencedBookId: null,
    });
    client.explainBook.mockResolvedValue({
      overview: 'شرح كتاب حقيقي.',
      topics: [],
      level: 'UNKNOWN',
      whyUseful: null,
      caveat: null,
    });
    catalog.listBooks
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [book], total: 1 });
    const result = await service.message({ message: 'اشرح لي كتاب Big Java', locale: 'ar' });
    expect(result.type).toBe('BOOK_EXPLANATION');
    expect(catalog.listBooks).toHaveBeenNthCalledWith(2, { q: 'Big Java', limit: '1' });
  });

  it('uses a truthful catalog summary for Book details when Gemini is disabled', async () => {
    const result = await service.message({ message: 'اشرح لي كتاب Big Java', locale: 'ar' });
    expect(result.type).toBe('BOOK_EXPLANATION');
    expect(result.message).toContain('Big Java');
    expect(result.message).toContain('Cay Horstmann');
    expect(result).toMatchObject({
      caveat: expect.stringContaining('بيانات الفهرس المتاحة فقط'),
    });
    expect(client.explainBook).not.toHaveBeenCalled();
  });

  it('does not fabricate missing Book content in the deterministic response', async () => {
    catalog.book.mockResolvedValue({
      ...book,
      description: null,
      descriptionAr: null,
      category: null,
    });
    const result = await service.message({ message: 'اشرح لي كتاب Big Java', locale: 'ar' });
    expect(result.type).toBe('BOOK_EXPLANATION');
    expect(result.message).toContain('لا يتوفر وصف تفصيلي مؤكد');
    expect(result).toMatchObject({
      caveat: expect.stringContaining('ليست وصفًا لمحتوى الكتاب الكامل'),
    });
    expect(JSON.stringify(result)).not.toMatch(/فصل|chapter|table of contents/i);
  });

  it('asks for clarification for an ambiguous fallback instead of searching books', async () => {
    const result = await service.message({ message: 'ليه', locale: 'ar' });
    expect(result.message).toBe('ممكن توضّح سؤالك أكتر؟');
    expect(catalog.listBooks).not.toHaveBeenCalled();
  });

  it('resolves the second structured Book reference for availability', async () => {
    await service.message({
      message: 'طب التاني متاح؟',
      locale: 'ar',
      history: [{ role: 'assistant', content: 'وجدت كتابين', bookIds: ['book-1', 'book-2'] }],
      context: {
        referencedBookIds: ['book-1', 'book-2'],
        selectedBookId: 'book-1',
        lastIntent: 'RECOMMEND_BOOKS',
      },
    });
    expect(catalog.book).toHaveBeenCalledWith('book-2');
  });

  it('keeps the selected Book for a location follow-up', async () => {
    await service.message({
      message: 'موجود فين؟',
      locale: 'ar',
      history: [{ role: 'assistant', content: 'الكتاب متاح', bookIds: ['book-1'] }],
      context: {
        referencedBookIds: ['book-1'],
        selectedBookId: 'book-1',
        lastIntent: 'BOOK_AVAILABILITY',
      },
    });
    expect(catalog.book).toHaveBeenCalledWith('book-1');
  });

  it('redacts private text from both classification and Book explanation calls', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockResolvedValue({ intent: 'BOOK_DETAILS', query: 'Big Java' });
    client.explainBook.mockResolvedValue({
      overview: 'A safe explanation.',
      topics: [],
      level: 'UNKNOWN',
      whyUseful: null,
      caveat: null,
    });
    await service.message({
      message: 'Explain Big Java to ahmed@example.com Bearer secret.token.value',
      locale: 'en',
    });
    expect(JSON.stringify(client.interpret.mock.calls[0]![0])).not.toMatch(
      /ahmed@example|secret\.token/,
    );
    expect(JSON.stringify(client.explainBook.mock.calls[0]![0])).not.toMatch(
      /ahmed@example|secret\.token/,
    );
  });

  it('keeps unrelated questions within library and study scope', async () => {
    const result = await service.message({ message: 'مين كسب الماتش؟', locale: 'ar' });
    expect(result.message).toContain('مساعد مكتبة جامعة الدلتا');
  });

  it('falls back safely from malformed Gemini intent output', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockResolvedValue({ intent: 'DELETE_ALL_BOOKS' });
    const result = await service.message({ message: 'دور على كتاب Java', locale: 'ar' });
    expect(result.type).toBe('BOOK_SEARCH_RESULTS');
  });

  it('falls back safely when Gemini times out or fails', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockRejectedValue(Object.assign(new Error('timeout'), { name: 'AbortError' }));
    const result = await service.message({ message: 'Big Java متاح؟', locale: 'ar' });
    expect(result.type).toBe('BOOK_AVAILABILITY');
  });

  it('redacts email, phone, and bearer tokens before the AI boundary', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockResolvedValue({ intent: 'GENERAL_LIBRARY_HELP' });
    await service.message({
      message: 'email me at ahmed@example.com 01012345678 Bearer secret.token.value',
      locale: 'en',
    });
    const payload = client.interpret.mock.calls[0]![0];
    expect(JSON.stringify(payload)).not.toMatch(/ahmed@example|01012345678|secret\.token/);
  });

  it('discards Gemini book references outside bounded conversation references', async () => {
    process.env.ASSISTANT_AI_ENABLED = 'true';
    client.interpret.mockResolvedValue({
      intent: 'BOOK_AVAILABILITY',
      referencedBookId: 'hallucinated-book',
      query: 'Big Java',
    });
    await service.message({
      message: 'الكتاب ده متاح؟',
      history: [{ role: 'assistant', content: 'وجدت كتبًا', bookIds: ['book-1'] }],
    });
    expect(catalog.book).toHaveBeenCalledWith('book-1');
  });

  it('returns a friendly login requirement for private guest tools', async () => {
    const loans = await service.message({ message: 'اعرض إعاراتي', locale: 'ar' });
    const reservations = await service.message({ message: 'اعرض حجوزاتي', locale: 'ar' });
    expect(loans.type).toBe('LOGIN_REQUIRED');
    expect(reservations.type).toBe('LOGIN_REQUIRED');
  });

  it('does not expose or call any write operation', async () => {
    await service.message({ message: 'احجز أو رجع Big Java', locale: 'ar' }, member);
    expect(Object.keys(prisma.loan)).toEqual(['findMany']);
    expect(Object.keys(prisma.reservation)).toEqual(['findMany']);
  });
});
