import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantWidget } from './AssistantWidget';
import { sendAssistantMessage } from './api';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, sendAssistantMessage: vi.fn() };
});

const sendMock = vi.mocked(sendAssistantMessage);
const book = {
  id: 'book-1',
  slug: 'big-java',
  title: 'Big Java',
  titleAr: 'جافا الكبير',
  coverImageUrl: null,
  totalCopies: 1,
  availableCopies: 1,
  authors: [{ author: { id: 'author-1', name: 'Cay Horstmann', nameAr: 'كاي هورستمان' } }],
  campusAvailability: {
    hasPhysicalCopies: true,
    totalCopies: 1,
    availableCopies: 1,
    availabilityStatus: 'AVAILABLE' as const,
  },
};

function response(overrides: Record<string, unknown> = {}) {
  return { type: 'TEXT' as const, message: 'تمت الإجابة بنجاح.', ...overrides };
}

function setup(locale: 'ar' | 'en' = 'ar', token?: string) {
  const go = vi.fn();
  const user = userEvent.setup();
  render(<AssistantWidget locale={locale} accessToken={token} go={go} />);
  return { user, go };
}

async function openAndSend(value: string, token?: string) {
  const context = setup('ar', token);
  await context.user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
  const input = screen.getByLabelText('اكتب سؤالك هنا…');
  await context.user.type(input, value);
  await context.user.click(screen.getByRole('button', { name: 'إرسال السؤال' }));
  return { ...context, input };
}

describe('Delta University Library AI Assistant widget', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue(response());
  });

  it('renders the compact floating launcher', () => {
    setup();
    expect(screen.getByRole('button', { name: 'افتح المساعد الذكي' })).toBeVisible();
    expect(screen.getByText('تحتاج مساعدة؟ أنا هنا للمساعدة')).toBeVisible();
  });

  it('opens a real named dialog and moves focus to the composer', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    expect(screen.getByRole('dialog', { name: 'كيف أقدر أساعدك اليوم؟' })).toBeVisible();
    expect(screen.getByLabelText('اكتب سؤالك هنا…')).toHaveFocus();
  });

  it('closes with the named close control and returns launcher focus', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    await user.click(screen.getByRole('button', { name: 'إغلاق المساعد' }));
    const launcher = screen.getByRole('button', { name: 'افتح المساعد الذكي' });
    await waitFor(() => expect(launcher).toHaveFocus());
  });

  it('closes on Escape', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the Arabic welcome state', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    expect(screen.getByText(/أنا مساعد مكتبة جامعة الدلتا الذكي/)).toBeVisible();
  });

  it('renders four functional quick actions', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    for (const label of ['رشح لي كتاب', 'اعرض الكتب المتاحة', 'اعرض إعاراتي', 'اعرض حجوزاتي'])
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeVisible();
  });

  it('submits the recommendation quick action through the API boundary', async () => {
    const { user } = setup('ar', 'member-token');
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    await user.click(screen.getByRole('button', { name: /رشح لي كتاب/ }));
    expect(sendMock).toHaveBeenCalledWith('رشح لي كتاب', 'ar', [], 'member-token');
  });

  it('sends a typed user message with Enter', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    await user.type(screen.getByLabelText('اكتب سؤالك هنا…'), 'Big Java متاح؟{enter}');
    expect(sendMock).toHaveBeenCalledWith('Big Java متاح؟', 'ar', [], undefined);
    expect(screen.getByText('Big Java متاح؟')).toBeVisible();
  });

  it('uses Shift+Enter as a newline instead of submitting', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    const input = screen.getByLabelText('اكتب سؤالك هنا…');
    await user.type(input, 'سطر{shift>}{enter}{/shift}ثان');
    expect(sendMock).not.toHaveBeenCalled();
    expect(input).toHaveValue('سطر\nثان');
  });

  it('renders the bounded thinking state', async () => {
    sendMock.mockReturnValue(new Promise(() => undefined));
    await openAndSend('اشرح linked list');
    expect(screen.getByRole('status')).toHaveTextContent('بجهز لك شرح مبسط');
  });

  it('uses separate catalog and recommendation loading messages', async () => {
    sendMock.mockReturnValue(new Promise(() => undefined));
    await openAndSend('دور على كتاب');
    expect(screen.getByRole('status')).toHaveTextContent('بدور في فهرس مكتبة جامعة الدلتا');
  });

  it('prevents duplicate submissions while pending', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    sendMock.mockReturnValue(new Promise((done) => (resolve = done)));
    const { user } = await openAndSend('رشح لي كتاب');
    const send = screen.getByRole('button', { name: 'إرسال السؤال' });
    await user.click(send);
    fireEvent.submit(send.closest('form')!);
    expect(sendMock).toHaveBeenCalledTimes(1);
    resolve(response());
    await screen.findByText('تمت الإجابة بنجاح.');
  });

  it('renders real recommendation cards and reasons', async () => {
    sendMock.mockResolvedValue(
      response({
        type: 'BOOK_RECOMMENDATIONS',
        books: [{ ...book, reason: 'مناسب لدراسة Java.' }],
      }),
    );
    await openAndSend('رشح لي كتاب', 'member-token');
    expect((await screen.findAllByText('جافا الكبير')).at(-1)).toBeVisible();
    expect(screen.getByText('مناسب لدراسة Java.')).toBeVisible();
  });

  it('renders a structured Arabic academic explanation with hierarchy and bidi-safe example', async () => {
    sendMock.mockResolvedValue(
      response({
        type: 'ACADEMIC_EXPLANATION',
        message: 'القائمة المرتبطة بنية بيانات مرنة.',
        title: 'Linked List — القائمة المرتبطة',
        summary: 'القائمة المرتبطة بنية بيانات مرنة تتكون من عقد مترابطة.',
        keyPoints: [
          'كل عنصر يسمى العقدة (Node).',
          'تحتوي العقدة على البيانات.',
          'يصل المؤشر (Pointer) بالعقدة التالية.',
        ],
        example: '10 → 20 → 30 → NULL',
        useCase: 'تفيد عند تكرار الإضافة والحذف.',
      }),
    );
    await openAndSend('اشرح linked list');
    expect(
      await screen.findByRole('heading', { name: 'Linked List — القائمة المرتبطة' }),
    ).toBeVisible();
    expect(screen.getByRole('region', { name: 'تعريف سريع' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'أهم النقاط' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('كل عنصر يسمى العقدة (Node).')).toHaveAttribute('dir', 'auto');
    expect(screen.getByText('10 → 20 → 30 → NULL').closest('.assistant-example')).toHaveAttribute(
      'dir',
      'ltr',
    );
    expect(
      screen.getAllByText('القائمة المرتبطة بنية بيانات مرنة تتكون من عقد مترابطة.'),
    ).toHaveLength(1);
  });

  it('runs real structured academic follow-up suggestion actions', async () => {
    sendMock
      .mockResolvedValueOnce(
        response({
          type: 'ACADEMIC_EXPLANATION',
          title: 'Data Structures',
          summary: 'شرح مختصر.',
          keyPoints: ['نقطة 1', 'نقطة 2', 'نقطة 3'],
          suggestions: [
            {
              action: 'SEARCH_BOOKS',
              label: 'ابحث عن كتب عن الموضوع',
              query: 'ابحث عن كتب عن Data Structures',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ type: 'BOOK_SEARCH_RESULTS', books: [book] }));
    const { user } = await openAndSend('اشرح Data Structures');
    await user.click(await screen.findByRole('button', { name: 'ابحث عن كتب عن الموضوع' }));
    await waitFor(() =>
      expect(sendMock).toHaveBeenLastCalledWith(
        'ابحث عن كتب عن Data Structures',
        'ar',
        expect.any(Array),
        undefined,
      ),
    );
  });

  it('renders a compact Book explanation from real Book data without invented content', async () => {
    sendMock.mockResolvedValue(
      response({
        type: 'BOOK_EXPLANATION',
        message: 'نبذة حذرة عن Big Java.',
        overview: 'نبذة حذرة عن Big Java مبنية على بيانات الفهرس.',
        topics: ['Java', 'البرمجة كائنية التوجه'],
        level: 'BEGINNER_INTERMEDIATE',
        whyUseful: 'يساعد على بناء أساس برمجي منظم.',
        caveat: 'لا يتوفر وصف أو معاينة؛ لم تتم قراءة محتوى الكتاب الكامل.',
        books: [book],
        suggestions: [
          { action: 'VIEW_BOOK', label: 'عرض الكتاب', path: '/books/big-java' },
          { action: 'BOOK_AVAILABILITY', label: 'هل الكتاب متاح؟', query: 'Big Java متاح؟' },
          {
            action: 'SIMILAR_BOOKS',
            label: 'كتب مشابهة',
            query: 'رشح لي كتب مشابهة لكتاب Big Java',
          },
        ],
      }),
    );
    const { user, go } = await openAndSend('اشرح لي كتاب Big Java');
    expect(await screen.findByRole('heading', { name: 'جافا الكبير' })).toBeVisible();
    expect(screen.getByText('Java')).toBeVisible();
    expect(screen.getByText('مبتدئ إلى متوسط')).toBeVisible();
    expect(screen.getByText(/لم تتم قراءة محتوى الكتاب الكامل/)).toBeVisible();
    expect(screen.queryByText(/الفصل الأول|جدول المحتويات/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'عرض الكتاب' }));
    expect(go).toHaveBeenCalledWith('/books/big-java');
  });

  it('submits Book availability from the structured Book explanation card', async () => {
    sendMock
      .mockResolvedValueOnce(
        response({
          type: 'BOOK_EXPLANATION',
          overview: 'نبذة.',
          topics: [],
          level: 'UNKNOWN',
          books: [book],
          suggestions: [
            { action: 'BOOK_AVAILABILITY', label: 'هل الكتاب متاح؟', query: 'Big Java متاح؟' },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ type: 'BOOK_AVAILABILITY', books: [book] }));
    const { user } = await openAndSend('اشرح Big Java');
    await user.click(await screen.findByRole('button', { name: 'هل الكتاب متاح؟' }));
    await waitFor(() =>
      expect(sendMock).toHaveBeenLastCalledWith(
        'Big Java متاح؟',
        'ar',
        expect.any(Array),
        undefined,
      ),
    );
  });

  it('opens the existing Book Details route from search results', async () => {
    sendMock.mockResolvedValue(response({ type: 'BOOK_SEARCH_RESULTS', books: [book] }));
    const { user, go } = await openAndSend('دور على Java');
    await user.click(await screen.findByRole('button', { name: 'عرض الكتاب' }));
    expect(go).toHaveBeenCalledWith('/books/big-java');
  });

  it('renders compact loan cards with authoritative due date', async () => {
    sendMock.mockResolvedValue(
      response({
        type: 'LOANS',
        loans: [
          {
            id: 'loan-1',
            borrowedAt: '2026-08-01',
            dueAt: '2026-09-01',
            effectiveStatus: 'ACTIVE',
            renewedCount: 0,
            bookCopy: { copyCode: 'C-1', book },
          },
        ],
      }),
    );
    await openAndSend('اعرض إعاراتي', 'member-token');
    expect(await screen.findByText('ACTIVE')).toBeVisible();
    expect(screen.getByText(/موعد الإرجاع/)).toBeVisible();
  });

  it('renders compact reservation cards with authoritative expiration', async () => {
    sendMock.mockResolvedValue(
      response({
        type: 'RESERVATIONS',
        reservations: [
          {
            id: 'res-1',
            status: 'ACTIVE',
            reservedAt: '2026-08-01',
            expiresAt: '2026-09-01',
            book,
            bookCopy: { copyCode: 'C-1' },
          },
        ],
      }),
    );
    await openAndSend('اعرض حجوزاتي', 'member-token');
    expect(await screen.findByText(/ينتهي الحجز/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'عرض الحجز' })).toBeVisible();
  });

  it('renders authoritative availability responses', async () => {
    sendMock.mockResolvedValue(
      response({ type: 'BOOK_AVAILABILITY', message: 'يوجد نسخة متاحة.', books: [book] }),
    );
    await openAndSend('Big Java متاح؟');
    expect(await screen.findByText('يوجد نسخة متاحة.')).toBeVisible();
    expect(screen.getByText('متاح')).toBeVisible();
  });

  it('renders authoritative location responses', async () => {
    sendMock.mockResolvedValue(
      response({ type: 'BOOK_LOCATION', message: 'الدور 3، غرفة 315، رف A-1.', books: [book] }),
    );
    await openAndSend('Big Java فين؟');
    expect(await screen.findByText('الدور 3، غرفة 315، رف A-1.')).toBeVisible();
  });

  it('keeps structured Book references and selected intent for a follow-up', async () => {
    sendMock
      .mockResolvedValueOnce(
        response({
          type: 'BOOK_AVAILABILITY',
          message: 'يوجد نسخة متاحة.',
          books: [book],
          context: {
            referencedBookIds: ['book-1'],
            selectedBookId: 'book-1',
            lastIntent: 'BOOK_AVAILABILITY',
          },
        }),
      )
      .mockResolvedValueOnce(response({ type: 'BOOK_LOCATION', message: 'الدور الثالث.' }));
    const { user, input } = await openAndSend('Big Java متاح؟');
    await screen.findByText('يوجد نسخة متاحة.');
    await user.type(input, 'موجود فين؟');
    await user.click(screen.getByRole('button', { name: 'إرسال السؤال' }));
    expect(sendMock).toHaveBeenLastCalledWith(
      'موجود فين؟',
      'ar',
      expect.arrayContaining([expect.objectContaining({ role: 'assistant', bookIds: ['book-1'] })]),
      undefined,
      {
        referencedBookIds: ['book-1'],
        selectedBookId: 'book-1',
        lastIntent: 'BOOK_AVAILABILITY',
      },
    );
  });

  it('renders a clean empty-result response without fake cards', async () => {
    sendMock.mockResolvedValue(
      response({ type: 'BOOK_SEARCH_RESULTS', message: 'لم أجد كتبًا مطابقة.', books: [] }),
    );
    await openAndSend('كتاب غير موجود');
    expect(await screen.findByText('لم أجد كتبًا مطابقة.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'عرض الكتاب' })).not.toBeInTheDocument();
  });

  it('renders a safe network failure state', async () => {
    sendMock.mockRejectedValue(new Error('secret stack'));
    await openAndSend('اشرح stack');
    expect(
      await screen.findByText('واجهت مشكلة مؤقتة أثناء تجهيز الشرح. جرّب مرة ثانية.'),
    ).toBeVisible();
    expect(screen.queryByText(/secret stack/)).not.toBeInTheDocument();
  });

  it('offers the real login flow for guest-only private capabilities', async () => {
    sendMock.mockResolvedValue(
      response({ type: 'LOGIN_REQUIRED', message: 'سجّل الدخول إلى حساب الطالب.' }),
    );
    const { user, go } = await openAndSend('اعرض إعاراتي');
    await user.click(await screen.findByRole('button', { name: 'تسجيل الدخول' }));
    expect(go).toHaveBeenCalledWith(expect.stringMatching(/^\/auth\/login\?returnTo=/));
  });

  it('uses polished Arabic RTL semantics', async () => {
    const { user } = setup('ar');
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('dir', 'rtl');
  });

  it('uses coherent English LTR labels and semantics', async () => {
    const { user } = setup('en');
    await user.click(screen.getByRole('button', { name: 'Open the AI assistant' }));
    expect(screen.getByRole('dialog', { name: 'How can I help today?' })).toHaveAttribute(
      'dir',
      'ltr',
    );
    expect(screen.getByLabelText('Type your question…')).toBeVisible();
  });

  it('fits the 390px mobile viewport without changing the interaction model', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    expect(screen.getByRole('dialog')).toHaveClass('assistant-panel');
    expect(screen.getByLabelText('اكتب سؤالك هنا…')).toBeVisible();
  });

  it('keeps a long structured explanation scannable at the 390px viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    sendMock.mockResolvedValue(
      response({
        type: 'ACADEMIC_EXPLANATION',
        title: 'Stack و Queue — المكدس والطابور',
        summary: 'هما بنيتان لتنظيم البيانات بترتيبين مختلفين.',
        keyPoints: ['Stack يعمل بمبدأ LIFO.', 'Queue يعمل بمبدأ FIFO.', 'لكل بنية استخدام مناسب.'],
        example: 'Stack: C ← B ← A\nQueue: A → B → C',
        useCase: 'يستخدم Stack في التراجع وQueue في جدولة المهام.',
      }),
    );
    await openAndSend('اشرح الفرق بين stack و queue');
    const card = (await screen.findByRole('heading', { name: /Stack و Queue/ })).closest(
      '.assistant-explanation-card',
    );
    expect(card).toBeVisible();
    expect(screen.getByRole('dialog')).toHaveAttribute('dir', 'rtl');
  });

  it('keeps focus trapped within the open panel', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'افتح المساعد الذكي' }));
    const close = screen.getByRole('button', { name: 'إغلاق المساعد' });
    close.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByLabelText('اكتب سؤالك هنا…')).toHaveFocus();
  });
});
