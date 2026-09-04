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
    launcher: 'المساعد الذكي للمكتبة',
    launcherAction: 'فتح مساعد مكتبة جامعة الدلتا',
    title: 'مساعد مكتبة جامعة الدلتا',
    subtitle: 'متصل بفهرس المكتبة',
    welcomeTitle: 'مرحبًا بك',
    welcome: 'كيف يمكنني مساعدتك في مكتبة جامعة الدلتا؟',
    welcomeSupport: 'يمكنك البحث في الفهرس، ومتابعة الإعارات والحجوزات، وطلب شرح أكاديمي مبسط.',
    close: 'إغلاق المساعد',
    input: 'اكتب استفسارك هنا…',
    send: 'إرسال الاستفسار',
    thinking: 'جارٍ إعداد الإجابة…',
    thinkingAcademic: 'جارٍ إعداد شرح أكاديمي مبسط…',
    thinkingCatalog: 'جارٍ البحث في فهرس مكتبة جامعة الدلتا…',
    thinkingRecommendations: 'جارٍ اختيار الكتب المناسبة…',
    thinkingLoans: 'جارٍ تحميل بيانات الإعارات…',
    thinkingReservations: 'جارٍ تحميل بيانات الحجوزات…',
    retry: 'تعذر إكمال الطلب مؤقتًا. يرجى المحاولة مرة أخرى.',
    retryAcademic: 'تعذر إعداد الشرح مؤقتًا. يرجى المحاولة مرة أخرى.',
    retryCatalog: 'تعذر البحث في فهرس المكتبة مؤقتًا. يرجى المحاولة مرة أخرى.',
    quick: ['البحث عن كتاب', 'اقتراح كتاب', 'إعاراتي', 'حجوزاتي', 'شرح موضوع أكاديمي'],
    viewBook: 'عرض الكتاب',
    viewLoan: 'عرض الإعارة',
    viewReservation: 'عرض الحجز',
    signIn: 'تسجيل الدخول',
    available: 'متاح',
    unavailable: 'غير متاح',
    due: 'موعد الإرجاع',
    expires: 'ينتهي الحجز',
    quickDefinition: 'تعريف سريع',
    keyPoints: 'أهم النقاط',
    example: 'مثال مبسط',
    useCase: 'الأهمية التطبيقية',
    topics: 'موضوعات الكتاب',
    level: 'المستوى المناسب',
    whyUseful: 'الفائدة الأكاديمية',
    overview: 'نبذة',
    catalogNote: 'ملاحظة عن المصدر',
    activeContext: 'موضوع المحادثة',
    emptyTitle: 'لم يتم العثور على نتائج مناسبة',
    emptySupport: 'يمكنك توسيع نطاق الموضوع أو البحث باستخدام اسم كتاب محدد.',
    broaderTopic: 'البحث بموضوع أوسع',
    searchByTitle: 'البحث باسم الكتاب',
    errorTitle: 'تعذر إكمال الطلب',
  },
  en: {
    launcher: 'Library AI Assistant',
    launcherAction: 'Open the Delta University Library Assistant',
    title: 'Delta University Library Assistant',
    subtitle: 'Connected to the library catalog',
    welcomeTitle: 'Welcome',
    welcome: 'How may I assist you at Delta University Library?',
    welcomeSupport: 'Search the catalog, review loans and reservations, or request a concise academic explanation.',
    close: 'Close assistant',
    input: 'Type your question…',
    send: 'Send question',
    thinking: 'Preparing your answer…',
    thinkingAcademic: 'Preparing a simple explanation…',
    thinkingCatalog: 'Searching the Delta University Library catalog…',
    thinkingRecommendations: 'Choosing suitable books…',
    thinkingLoans: 'Loading your loans…',
    thinkingReservations: 'Loading your reservations…',
    retry: 'I encountered a temporary problem. Please try again.',
    retryAcademic: 'I encountered a temporary problem while preparing the explanation. Try again.',
    retryCatalog: 'I encountered a temporary catalog search problem. Try again.',
    quick: ['Find a book', 'Recommend a book', 'My loans', 'My reservations', 'Explain a topic'],
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
    overview: 'Overview',
    catalogNote: 'Source note',
    activeContext: 'Discussing',
    emptyTitle: 'No suitable results',
    emptySupport: 'Try a broader subject or search for a specific book title.',
    broaderTopic: 'Try a broader topic',
    searchByTitle: 'Search by book title',
    errorTitle: 'Could not complete the request',
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

  const activeBook = (() => {
    const selectedBookId = conversationContext()?.selectedBookId;
    if (!selectedBookId) return undefined;
    return [...messages]
      .reverse()
      .flatMap(({ response }) => response?.books ?? [])
      .find(({ id }) => id === selectedBookId);
  })();

  const loadingFor = (message: string) => {
    if (/رشح|اقترح|recommend|suggest/i.test(message)) return labels.thinkingRecommendations;
    if (/حجوز|reservations?/i.test(message)) return labels.thinkingReservations;
    if (/إعارات|اعارات|مستعار|loans?|borrowed/i.test(message)) return labels.thinkingLoans;
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
      requestAnimationFrame(() => {
        if (inputRef.current) inputRef.current.style.height = '';
        inputRef.current?.focus();
      });
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
        <div className="assistant-panel__identity">
          <h2 id="assistant-title">{labels.title}</h2>
          <p>
            <span aria-hidden="true" />
            {labels.subtitle}
          </p>
        </div>
        <button type="button" className="assistant-close" aria-label={labels.close} onClick={close}>
          ×
        </button>
      </header>
      <div className="assistant-conversation" ref={conversationRef} aria-live="polite">
        {!messages.length && (
          <section className="assistant-welcome" aria-labelledby="assistant-welcome-title">
            <p className="assistant-welcome__eyebrow">{labels.welcomeTitle}</p>
            <h3 id="assistant-welcome-title">{labels.welcome}</h3>
            <p>{labels.welcomeSupport}</p>
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
                  <AssistantQuickIcon index={index} />
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`assistant-message assistant-message--${message.role}${message.response && usesDedicatedPresentation(message.response) ? ' assistant-message--structured' : ''}`}
          >
            {message.role === 'assistant' && (
              <span className="assistant-message__mark" aria-hidden="true">
                <AssistantMark />
              </span>
            )}
            <div className="assistant-message__content">
              {(!message.response || !usesDedicatedPresentation(message.response)) && (
                <p dir="auto">{message.content}</p>
              )}
              {message.response && (
                <AssistantRichResult
                  result={message.response}
                  locale={locale}
                  labels={labels}
                  go={go}
                  submit={(value) => void submit(value)}
                  draft={(value) => {
                    setInput(value);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  login={() =>
                    go(loginPath(`${window.location.pathname}${window.location.search}`))
                  }
                />
              )}
            </div>
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
      <div className="assistant-composer-shell">
        {activeBook && (
          <div className="assistant-active-context" role="status">
            <span aria-hidden="true">●</span>
            {labels.activeContext}:{' '}
            <bdi>{locale === 'ar' ? activeBook.titleAr || activeBook.title : activeBook.title}</bdi>
          </div>
        )}
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
            dir="auto"
            rows={1}
            maxLength={1000}
            value={input}
            placeholder={labels.input}
            onChange={(event) => {
              setInput(event.target.value);
              event.currentTarget.style.height = 'auto';
              event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 112)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <button type="submit" aria-label={labels.send} disabled={pending || !input.trim()}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 14-7-4.6 14-2.8-5.6L5 12Z" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}

function AssistantRichResult({
  result,
  locale,
  labels,
  go,
  submit,
  draft,
  login,
}: {
  result: AssistantResponse;
  locale: PublicLocale;
  labels: (typeof copy)[PublicLocale];
  go: (to: string) => void;
  submit: (value: string) => void;
  draft: (value: string) => void;
  login: () => void;
}): JSX.Element | null {
  if (result.type === 'ERROR')
    return (
      <section className="assistant-feedback assistant-feedback--error" role="alert">
        <span className="assistant-feedback__icon" aria-hidden="true">
          !
        </span>
        <div>
          <h3>{labels.errorTitle}</h3>
          <p dir="auto">{result.message}</p>
        </div>
      </section>
    );
  if (result.type === 'BOOK_SEARCH_RESULTS' && !result.books?.length)
    return (
      <section
        className="assistant-feedback assistant-feedback--empty"
        aria-labelledby="assistant-empty-title"
      >
        <span className="assistant-feedback__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4V5.5Zm16 11.5h-3a3 3 0 0 0-3 3V6a3 3 0 0 1 3-3h.5A2.5 2.5 0 0 1 20 5.5V17Z" />
          </svg>
        </span>
        <div>
          <h3 id="assistant-empty-title">{labels.emptyTitle}</h3>
          <p dir="auto">{result.message}</p>
          <small>{labels.emptySupport}</small>
          <div className="assistant-feedback__actions">
            <button
              type="button"
              onClick={() => draft(locale === 'ar' ? 'أبحث عن كتب حول ' : 'Find books about ')}
            >
              {labels.broaderTopic}
            </button>
            <button
              type="button"
              onClick={() => draft(locale === 'ar' ? 'البحث عن كتاب بعنوان ' : 'Find the book ')}
            >
              {labels.searchByTitle}
            </button>
          </div>
        </div>
      </section>
    );
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
        <AssistantActivityCard
          key={loan.id}
          title={
            locale === 'ar'
              ? loan.bookCopy.book.titleAr || loan.bookCopy.book.title
              : loan.bookCopy.book.title
          }
          status={localizedLoanStatus[locale][loan.effectiveStatus]}
          statusKey={loan.effectiveStatus}
          dateLabel={labels.due}
          date={loan.dueAt}
          locale={locale}
          actionLabel={labels.viewLoan}
          onAction={() => go(`/my-loans/${loan.id}`)}
        />
      ))}
      {result.reservations?.map((reservation) => (
        <AssistantActivityCard
          key={reservation.id}
          title={
            locale === 'ar'
              ? reservation.book.titleAr || reservation.book.title
              : reservation.book.title
          }
          status={localizedReservationStatus[locale][reservation.status]}
          statusKey={reservation.status}
          dateLabel={labels.expires}
          date={reservation.expiresAt}
          locale={locale}
          actionLabel={labels.viewReservation}
          onAction={() => go(`/my-reservations/${reservation.id}`)}
        />
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
  book: PublicBook & { reason?: string; semanticReason?: string };
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
          <span
            className={`assistant-status-chip ${availableCopies > 0 ? 'is-available' : 'is-unavailable'}`}
          >
            <i aria-hidden="true" />
            {availableCopies > 0 ? labels.available : labels.unavailable}
          </span>
        </div>
      </header>
      <section aria-label={labels.overview}>
        <h4>{labels.overview}</h4>
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
  book: PublicBook & { reason?: string; semanticReason?: string };
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
        {(book.semanticReason || book.reason) && (
          <p dir="auto">{book.semanticReason || book.reason}</p>
        )}
        <div className="assistant-book-card__footer">
          <span
            className={`assistant-status-chip ${available ? 'is-available' : 'is-unavailable'}`}
          >
            <i aria-hidden="true" />
            {available ? labels.available : labels.unavailable}
          </span>
          <button onClick={() => go(`/books/${book.slug}`)}>{labels.viewBook}</button>
        </div>
      </div>
    </article>
  );
}

function usesDedicatedPresentation(result: AssistantResponse): boolean {
  return (
    result.type === 'ACADEMIC_EXPLANATION' ||
    result.type === 'BOOK_EXPLANATION' ||
    result.type === 'ERROR' ||
    (result.type === 'BOOK_SEARCH_RESULTS' && !result.books?.length)
  );
}

function AssistantQuickIcon({ index }: { index: number }): JSX.Element {
  const paths = [
    'M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4V5.5Zm16 11.5h-3a3 3 0 0 0-3 3V6a3 3 0 0 1 3-3h.5A2.5 2.5 0 0 1 20 5.5V17Z',
    'm12 3 1.3 4.2L17.5 8.5l-4.2 1.3L12 14l-1.3-4.2-4.2-1.3 4.2-1.3L12 3Zm6 11 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z',
    'M5 7h14M7 3v4m10-4v4M5 7v12h14V7M8 11h3m2 0h3m-8 4h3',
    'M6 4h12v16H6V4Zm3 4h6m-6 4h6m-6 4h4',
    'M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.4 1.5 2.4V17h4v-.7c0-1 .7-1.8 1.5-2.4A6 6 0 0 0 12 3Zm-2 17h4',
  ];
  return (
    <svg className="assistant-quick-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[index] ?? paths[0]} />
    </svg>
  );
}

const localizedLoanStatus = {
  ar: { ACTIVE: 'نشط', OVERDUE: 'متأخر', RETURNED: 'تم الإرجاع' },
  en: { ACTIVE: 'Active', OVERDUE: 'Overdue', RETURNED: 'Returned' },
} as const;

const localizedReservationStatus = {
  ar: { ACTIVE: 'نشط', CANCELLED: 'ملغي', EXPIRED: 'منتهي', COLLECTED: 'تم الاستلام' },
  en: { ACTIVE: 'Active', CANCELLED: 'Cancelled', EXPIRED: 'Expired', COLLECTED: 'Collected' },
} as const;

function AssistantActivityCard({
  title,
  status,
  statusKey,
  dateLabel,
  date,
  locale,
  actionLabel,
  onAction,
}: {
  title: string;
  status: string;
  statusKey: string;
  dateLabel: string;
  date: string;
  locale: PublicLocale;
  actionLabel: string;
  onAction: () => void;
}): JSX.Element {
  return (
    <article className="assistant-activity-card">
      <div>
        <strong dir="auto">{title}</strong>
        <span className={`assistant-status-chip is-${statusKey.toLowerCase()}`}>
          <i aria-hidden="true" />
          {status}
        </span>
      </div>
      <small>
        {dateLabel}: <bdi>{formatAssistantDate(date, locale)}</bdi>
      </small>
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </article>
  );
}

function formatAssistantDate(value: string, locale: PublicLocale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(value.includes('T') ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value));
}
