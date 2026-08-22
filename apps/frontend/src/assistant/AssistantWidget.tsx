import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { loginPath } from '../auth/access';
import { BookCoverMedia } from '../catalog/BookCoverMedia';
import type { PublicBook, PublicLocale } from '../catalog/public.types';
import { AssistantMark } from './AssistantMark';
import {
  sendAssistantMessage,
  type AssistantResponse,
  type AssistantSuggestion,
  type AssistantTurn,
} from './api';

type Props = {
  locale: PublicLocale;
  accessToken?: string;
  go: (to: string) => void;
};

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  response?: AssistantResponse;
};

const copy = {
  ar: {
    launcher: 'تحتاج مساعدة؟ أنا هنا للمساعدة',
    launcherAction: 'افتح المساعد الذكي',
    title: 'كيف أقدر أساعدك اليوم؟',
    subtitle: 'مساعد مكتبة جامعة الدلتا',
    welcome:
      'أهلاً! أنا مساعد مكتبة جامعة الدلتا الذكي. أقدر أساعدك في البحث عن الكتب، الترشيحات، الإعارات والحجوزات، وكمان أسئلة دراسية بسيطة.',
    close: 'إغلاق المساعد',
    input: 'اكتب سؤالك هنا…',
    send: 'إرسال السؤال',
    thinking: 'بجهز لك الإجابة…',
    thinkingAcademic: 'بجهز لك شرح مبسط…',
    thinkingCatalog: 'بدور في فهرس مكتبة جامعة الدلتا…',
    thinkingRecommendations: 'بختار لك كتب مناسبة…',
    retry: 'واجهت مشكلة مؤقتة. جرّب مرة ثانية.',
    retryAcademic: 'واجهت مشكلة مؤقتة أثناء تجهيز الشرح. جرّب مرة ثانية.',
    retryCatalog: 'واجهت مشكلة مؤقتة أثناء البحث في فهرس المكتبة. جرّب مرة ثانية.',
    quick: ['رشح لي كتاب', 'اعرض الكتب المتاحة', 'اعرض إعاراتي', 'اعرض حجوزاتي'],
    viewBook: 'عرض الكتاب',
    viewLoan: 'عرض الإعارة',
    viewReservation: 'عرض الحجز',
    signIn: 'تسجيل الدخول',
    available: 'متاح',
    unavailable: 'غير متاح حاليًا',
    due: 'موعد الإرجاع',
    expires: 'ينتهي الحجز',
    quickDefinition: 'تعريف سريع',
    keyPoints: 'أهم النقاط',
    example: 'مثال مبسط',
    useCase: 'لماذا يهم؟',
    topics: 'موضوعات الكتاب',
    level: 'المستوى المناسب',
    whyUseful: 'لماذا يفيدك؟',
    catalogNote: 'ملاحظة عن المصدر',
  },
  en: {
    launcher: 'Need help? I am here for you',
    launcherAction: 'Open the AI assistant',
    title: 'How can I help today?',
    subtitle: 'Delta University Library Assistant',
    welcome:
      'Welcome! I can help you search the Delta University Library, find recommendations, review loans and reservations, and answer simple study questions.',
    close: 'Close assistant',
    input: 'Type your question…',
    send: 'Send question',
    thinking: 'Preparing your answer…',
    thinkingAcademic: 'Preparing a simple explanation…',
    thinkingCatalog: 'Searching the Delta University Library catalog…',
    thinkingRecommendations: 'Choosing suitable books…',
    retry: 'I encountered a temporary problem. Please try again.',
    retryAcademic: 'I encountered a temporary problem while preparing the explanation. Try again.',
    retryCatalog: 'I encountered a temporary catalog search problem. Try again.',
    quick: ['Recommend a book', 'Show available books', 'Show my loans', 'Show my reservations'],
    viewBook: 'View book',
    viewLoan: 'View loan',
    viewReservation: 'View reservation',
    signIn: 'Sign in',
    available: 'Available',
    unavailable: 'Currently unavailable',
    due: 'Due',
    expires: 'Reservation expires',
    quickDefinition: 'Quick definition',
    keyPoints: 'Key points',
    example: 'Example',
    useCase: 'Why it matters',
    topics: 'Book topics',
    level: 'Suitable level',
    whyUseful: 'Why it may help',
    catalogNote: 'Source note',
  },
} as const;

export function AssistantWidget({ locale, accessToken, go }: Props): JSX.Element {
  const labels = copy[locale];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<string>(labels.thinking);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const nextId = useRef(1);
  const pendingRef = useRef(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    const latest = conversationRef.current?.lastElementChild;
    if (latest && 'scrollIntoView' in latest)
      (latest as HTMLElement).scrollIntoView({ block: 'nearest' });
  }, [messages, pending]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  };
  const panelKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = [
      ...panelRef.current.querySelectorAll<HTMLElement>('button, textarea, a'),
    ].filter((item) => !item.hasAttribute('disabled'));
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const history = (): AssistantTurn[] =>
    messages.slice(-10).map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.response?.context?.referencedBookIds.length || message.response?.books?.length
        ? {
            bookIds:
              message.response.context?.referencedBookIds ??
              message.response.books?.slice(0, 4).map(({ id }) => id),
          }
        : {}),
    }));

  const conversationContext = () =>
    [...messages].reverse().find(({ response }) => response?.context)?.response?.context;

  const loadingFor = (message: string) => {
    if (/رشح|اقترح|recommend|suggest/i.test(message)) return labels.thinkingRecommendations;
    if (/كتاب|كتب|فهرس|ابحث|دور|book|catalog|search|find/i.test(message))
      return labels.thinkingCatalog;
    if (/اشرح|يعني|الفرق|explain|difference|what is/i.test(message)) return labels.thinkingAcademic;
    return labels.thinking;
  };

  const errorFor = (message: string) => {
    if (/كتاب|كتب|فهرس|ابحث|دور|book|catalog|search|find/i.test(message))
      return labels.retryCatalog;
    if (/اشرح|يعني|الفرق|explain|difference|what is/i.test(message)) return labels.retryAcademic;
    return labels.retry;
  };

  const submit = async (value = input) => {
    const message = value.trim();
    if (!message || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setPendingLabel(loadingFor(message));
    setInput('');
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: 'user', content: message },
    ]);
    try {
      const currentContext = conversationContext();
      const response = currentContext
        ? await sendAssistantMessage(message, locale, history(), accessToken, currentContext)
        : await sendAssistantMessage(message, locale, history(), accessToken);
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: 'assistant',
          content: response.message,
          response,
        },
      ]);
    } catch {
      const safeError = errorFor(message);
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: 'assistant',
          content: safeError,
          response: { type: 'ERROR', message: safeError },
        },
      ]);
    } finally {
      pendingRef.current = false;
      setPending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  if (!open)
    return (
      <button
        ref={launcherRef}
        type="button"
        className="assistant-launcher"
        aria-label={labels.launcherAction}
        onClick={() => setOpen(true)}
      >
        <AssistantMark />
        <span>{labels.launcher}</span>
      </button>
    );

  return (
    <aside
      ref={panelRef}
      className="assistant-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="assistant-title"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      onKeyDown={panelKeyDown}
    >
      <header className="assistant-panel__header">
        <AssistantMark />
        <div>
          <h2 id="assistant-title">{labels.title}</h2>
          <p>{labels.subtitle}</p>
        </div>
        <button type="button" className="assistant-close" aria-label={labels.close} onClick={close}>
          ×
        </button>
      </header>
      <div className="assistant-conversation" ref={conversationRef} aria-live="polite">
        <div className="assistant-message assistant-message--welcome">
          <p>{labels.welcome}</p>
        </div>
        {!messages.length && (
          <div
            className="assistant-quick-actions"
            aria-label={locale === 'ar' ? 'إجراءات سريعة' : 'Quick actions'}
          >
            {labels.quick.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => void submit(label)}
                disabled={pending}
              >
                <span aria-hidden="true">{['✦', '⌕', '↗', '◷'][index]}</span>
                {label}
              </button>
            ))}
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`assistant-message assistant-message--${message.role}${message.response && ['ACADEMIC_EXPLANATION', 'BOOK_EXPLANATION'].includes(message.response.type) ? ' assistant-message--structured' : ''}`}
          >
            {(!message.response ||
              !['ACADEMIC_EXPLANATION', 'BOOK_EXPLANATION'].includes(message.response.type)) && (
              <p>{message.content}</p>
            )}
            {message.response && (
              <AssistantRichResult
                result={message.response}
                locale={locale}
                labels={labels}
                go={go}
                submit={(value) => void submit(value)}
                login={() => go(loginPath(`${window.location.pathname}${window.location.search}`))}
              />
            )}
          </div>
        ))}
        {pending && (
          <div className="assistant-thinking" role="status">
            <span aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {pendingLabel}
          </div>
        )}
      </div>
      <form
        className="assistant-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="sr-only" htmlFor="assistant-input">
          {labels.input}
        </label>
        <textarea
          ref={inputRef}
          id="assistant-input"
          rows={1}
          maxLength={1000}
          value={input}
          placeholder={labels.input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button type="submit" aria-label={labels.send} disabled={pending || !input.trim()}>
          <span aria-hidden="true">➤</span>
        </button>
      </form>
    </aside>
  );
}

function AssistantRichResult({
  result,
  locale,
  labels,
  go,
  submit,
  login,
}: {
  result: AssistantResponse;
  locale: PublicLocale;
  labels: (typeof copy)[PublicLocale];
  go: (to: string) => void;
  submit: (value: string) => void;
  login: () => void;
}): JSX.Element | null {
  if (result.type === 'LOGIN_REQUIRED')
    return (
      <button className="assistant-inline-action" onClick={login}>
        {labels.signIn}
      </button>
    );
  if (result.type === 'ACADEMIC_EXPLANATION')
    return (
      <AssistantAcademicCard
        result={result}
        locale={locale}
        labels={labels}
        submit={submit}
        go={go}
      />
    );
  if (result.type === 'BOOK_EXPLANATION' && result.books?.[0])
    return (
      <AssistantBookExplanationCard
        result={result}
        book={result.books[0]}
        locale={locale}
        labels={labels}
        submit={submit}
        go={go}
      />
    );
  return (
    <>
      {result.books?.map((book) => (
        <AssistantBookCard key={book.id} book={book} locale={locale} labels={labels} go={go} />
      ))}
      {result.loans?.map((loan) => (
        <article className="assistant-activity-card" key={loan.id}>
          <strong>
            {locale === 'ar'
              ? loan.bookCopy.book.titleAr || loan.bookCopy.book.title
              : loan.bookCopy.book.title}
          </strong>
          <span>{loan.effectiveStatus}</span>
          <small>
            {labels.due}:{' '}
            <bdi>
              {new Date(loan.dueAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB')}
            </bdi>
          </small>
          <button onClick={() => go(`/my-loans/${loan.id}`)}>{labels.viewLoan}</button>
        </article>
      ))}
      {result.reservations?.map((reservation) => (
        <article className="assistant-activity-card" key={reservation.id}>
          <strong>
            {locale === 'ar'
              ? reservation.book.titleAr || reservation.book.title
              : reservation.book.title}
          </strong>
          <span>{reservation.status}</span>
          <small>
            {labels.expires}:{' '}
            <bdi>
              {new Date(reservation.expiresAt).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB')}
            </bdi>
          </small>
          <button onClick={() => go(`/my-reservations/${reservation.id}`)}>
            {labels.viewReservation}
          </button>
        </article>
      ))}
    </>
  );
}

function AssistantAcademicCard({
  result,
  locale,
  labels,
  submit,
  go,
}: {
  result: AssistantResponse;
  locale: PublicLocale;
  labels: (typeof copy)[PublicLocale];
  submit: (value: string) => void;
  go: (to: string) => void;
}): JSX.Element {
  return (
    <article className="assistant-explanation-card assistant-explanation-card--academic">
      <header>
        <span aria-hidden="true">✦</span>
        <h3 dir="auto">{result.title}</h3>
      </header>
      <section aria-label={labels.quickDefinition}>
        <h4>{labels.quickDefinition}</h4>
        <p dir="auto">{result.summary}</p>
      </section>
      {Boolean(result.keyPoints?.length) && (
        <section aria-label={labels.keyPoints}>
          <h4>{labels.keyPoints}</h4>
          <ul>
            {result.keyPoints?.map((point) => (
              <li key={point} dir="auto">
                {point}
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.example && (
        <section aria-label={labels.example}>
          <h4>{labels.example}</h4>
          <div className="assistant-example" dir="ltr">
            <code>{result.example}</code>
          </div>
        </section>
      )}
      {result.useCase && (
        <section aria-label={labels.useCase}>
          <h4>{labels.useCase}</h4>
          <p dir="auto">{result.useCase}</p>
        </section>
      )}
      <AssistantSuggestions
        suggestions={result.suggestions}
        locale={locale}
        submit={submit}
        go={go}
      />
    </article>
  );
}

function AssistantBookExplanationCard({
  result,
  book,
  locale,
  labels,
  submit,
  go,
}: {
  result: AssistantResponse;
  book: PublicBook & { reason?: string };
  locale: PublicLocale;
  labels: (typeof copy)[PublicLocale];
  submit: (value: string) => void;
  go: (to: string) => void;
}): JSX.Element {
  const title = locale === 'ar' ? book.titleAr || book.title : book.title;
  const author = book.authors
    .map(({ author: item }) => (locale === 'ar' ? item.nameAr || item.name : item.name))
    .join('، ');
  const availableCopies = book.campusAvailability?.hasPhysicalCopies
    ? book.campusAvailability.availableCopies
    : book.availableCopies;
  const levelLabels = {
    ar: {
      BEGINNER: 'مبتدئ',
      BEGINNER_INTERMEDIATE: 'مبتدئ إلى متوسط',
      INTERMEDIATE: 'متوسط',
      ADVANCED: 'متقدم',
      UNKNOWN: 'غير محدد من بيانات الفهرس',
    },
    en: {
      BEGINNER: 'Beginner',
      BEGINNER_INTERMEDIATE: 'Beginner to intermediate',
      INTERMEDIATE: 'Intermediate',
      ADVANCED: 'Advanced',
      UNKNOWN: 'Not established from catalog data',
    },
  } as const;
  return (
    <article className="assistant-explanation-card assistant-explanation-card--book">
      <header className="assistant-book-explanation__header">
        <div className="assistant-book-card__cover">
          <BookCoverMedia
            url={book.coverImageUrl}
            title={title}
            author={author}
            variantKey={book.id}
            coverLabel={locale === 'ar' ? `غلاف ${title}` : `${title} cover`}
            noCoverLabel={locale === 'ar' ? `لا يوجد غلاف لكتاب ${title}` : `No cover for ${title}`}
          />
        </div>
        <div>
          <h3 dir="auto">{title}</h3>
          {author && <p dir="auto">{author}</p>}
          <span className={availableCopies > 0 ? 'is-available' : 'is-unavailable'}>
            {availableCopies > 0 ? labels.available : labels.unavailable}
          </span>
        </div>
      </header>
      <section aria-label={labels.quickDefinition}>
        <h4>{labels.quickDefinition}</h4>
        <p dir="auto">{result.overview}</p>
      </section>
      {Boolean(result.topics?.length) && (
        <section aria-label={labels.topics}>
          <h4>{labels.topics}</h4>
          <ul>
            {result.topics?.map((topic) => (
              <li key={topic} dir="auto">
                {topic}
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.level && (
        <section className="assistant-inline-fact" aria-label={labels.level}>
          <h4>{labels.level}</h4>
          <span>{levelLabels[locale][result.level]}</span>
        </section>
      )}
      {result.whyUseful && (
        <section aria-label={labels.whyUseful}>
          <h4>{labels.whyUseful}</h4>
          <p dir="auto">{result.whyUseful}</p>
        </section>
      )}
      {result.caveat && (
        <aside className="assistant-catalog-note" aria-label={labels.catalogNote}>
          <strong>{labels.catalogNote}</strong>
          <p dir="auto">{result.caveat}</p>
        </aside>
      )}
      <AssistantSuggestions
        suggestions={result.suggestions}
        locale={locale}
        submit={submit}
        go={go}
      />
    </article>
  );
}

function AssistantSuggestions({
  suggestions,
  locale,
  submit,
  go,
}: {
  suggestions?: Array<string | AssistantSuggestion>;
  locale: PublicLocale;
  submit: (value: string) => void;
  go: (to: string) => void;
}): JSX.Element | null {
  const structured = suggestions
    ?.filter(
      (suggestion): suggestion is AssistantSuggestion =>
        typeof suggestion !== 'string' &&
        ((suggestion.action === 'VIEW_BOOK' && Boolean(suggestion.path)) ||
          (suggestion.action !== 'VIEW_BOOK' && Boolean(suggestion.query))),
    )
    .slice(0, 3);
  if (!structured?.length) return null;
  return (
    <div
      className="assistant-context-actions"
      aria-label={locale === 'ar' ? 'اقتراحات للمتابعة' : 'Follow-up suggestions'}
    >
      {structured.map((suggestion) => (
        <button
          type="button"
          key={`${suggestion.action}-${suggestion.label}`}
          onClick={() => {
            if (suggestion.action === 'VIEW_BOOK' && suggestion.path) go(suggestion.path);
            else if (suggestion.query) submit(suggestion.query);
          }}
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}

function AssistantBookCard({
  book,
  locale,
  labels,
  go,
}: {
  book: PublicBook & { reason?: string };
  locale: PublicLocale;
  labels: (typeof copy)[PublicLocale];
  go: (to: string) => void;
}): JSX.Element {
  const title = locale === 'ar' ? book.titleAr || book.title : book.title;
  const author = book.authors
    .map(({ author }) => (locale === 'ar' ? author.nameAr || author.name : author.name))
    .join('، ');
  const available =
    (book.campusAvailability?.hasPhysicalCopies
      ? book.campusAvailability.availableCopies
      : book.availableCopies) > 0;
  return (
    <article className="assistant-book-card">
      <div className="assistant-book-card__cover">
        <BookCoverMedia
          url={book.coverImageUrl}
          title={title}
          author={author}
          variantKey={book.id}
          coverLabel={locale === 'ar' ? `غلاف ${title}` : `${title} cover`}
          noCoverLabel={locale === 'ar' ? `لا يوجد غلاف لكتاب ${title}` : `No cover for ${title}`}
        />
      </div>
      <div>
        <strong dir="auto">{title}</strong>
        <small dir="auto">{author}</small>
        {book.reason && <p>{book.reason}</p>}
        <span className={available ? 'is-available' : 'is-unavailable'}>
          {available ? labels.available : labels.unavailable}
        </span>
        <button onClick={() => go(`/books/${book.slug}`)}>{labels.viewBook}</button>
      </div>
    </article>
  );
}
