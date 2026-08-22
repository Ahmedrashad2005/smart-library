import { useEffect, useState } from 'react';
import { apiBlob, apiRequest, requestMessage } from '../lib/api';
import type { BookDetailRecord } from './BookDetail';
import type { PublicLocale } from './public.types';

type Props = {
  slug: string;
  token: string;
  locale: PublicLocale;
  go: (to: string) => void;
};

const words = {
  ar: {
    back: 'العودة إلى الكتاب',
    heading: 'معاينة الكتاب',
    loading: 'جارٍ تحميل معاينة الكتاب…',
    failed: 'تعذر عرض المعاينة داخل الصفحة.',
    open: 'فتح ملف PDF',
  },
  en: {
    back: 'Back to book',
    heading: 'Book Preview',
    loading: 'Loading book preview…',
    failed: 'The preview could not be displayed inside the page.',
    open: 'Open PDF',
  },
} as const;

export function BookPreviewPage({ slug, token, locale, go }: Props): JSX.Element {
  const [book, setBook] = useState<BookDetailRecord | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState('');
  const labels = words[locale];
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setError('');
    setPdfUrl('');
    void apiRequest<BookDetailRecord>(`/books/slug/${encodeURIComponent(slug)}`)
      .then(async (result) => {
        if (!result?.preview?.available || !result.preview.url) throw new Error(labels.failed);
        if (active) setBook(result);
        const blob = await apiBlob(result.preview.url, token);
        if (blob.type && blob.type !== 'application/pdf') throw new Error(labels.failed);
        objectUrl = URL.createObjectURL(blob);
        if (active) setPdfUrl(objectUrl);
      })
      .catch((reason: unknown) => active && setError(requestMessage(reason)))
      .finally(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [labels.failed, slug, token]);
  const title = book ? (locale === 'ar' ? book.titleAr || book.title : book.title) : '';
  const authors =
    book?.authors
      .map(({ author }) => (locale === 'ar' ? author.nameAr || author.name : author.name))
      .join(locale === 'ar' ? '، ' : ', ') ?? '';
  return (
    <section className="page book-preview-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <button className="book-detail-back" onClick={() => go(`/books/${slug}`)}>
        <span aria-hidden="true">{locale === 'ar' ? '→' : '←'}</span>
        {labels.back}
      </button>
      <header className="book-preview-heading">
        <p>{labels.heading}</p>
        <h1>{title || labels.heading}</h1>
        {authors && <span>{authors}</span>}
      </header>
      {!pdfUrl && !error && (
        <div className="state book-preview-state" role="status">
          <span className="spinner" aria-hidden="true" />
          {labels.loading}
        </div>
      )}
      {error && (
        <div className="state error book-preview-state" role="alert">
          <h2>{labels.failed}</h2>
          <p>{error}</p>
        </div>
      )}
      {pdfUrl && (
        <div className="book-preview-viewer">
          <object data={pdfUrl} type="application/pdf" aria-label={`${labels.heading}: ${title}`}>
            <p>{labels.failed}</p>
          </object>
          <a
            className="button quiet book-preview-open"
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
          >
            {labels.open}
          </a>
        </div>
      )}
    </section>
  );
}
