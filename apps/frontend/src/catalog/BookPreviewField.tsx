import { useRef, useState } from 'react';
import { apiRequest, requestMessage } from '../lib/api';
import type { PublicLocale } from './public.types';

export type PreviewMetadata = {
  available: boolean;
  url: string | null;
  originalName: string | null;
  size: number | null;
  updatedAt: string | null;
};

type Props = {
  locale: PublicLocale;
  bookId?: string;
  slug?: string;
  token: string;
  preview: PreviewMetadata;
  selected: File | null;
  onSelect: (file: File | null) => void;
  onRemoved: () => void;
  go: (to: string) => void;
};

const MAX_BYTES = 20 * 1024 * 1024;

function validatePreviewFile(file: File): string {
  if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf')
    return 'PDF files only.';
  if (!file.size) return 'The PDF file cannot be empty.';
  if (file.size > MAX_BYTES) return 'The PDF file must not exceed 20 MB.';
  return '';
}

export function BookPreviewField(props: Props): JSX.Element {
  const { locale, bookId, slug, token, preview, selected, onSelect, onRemoved, go } = props;
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ar = locale === 'ar';
  const select = (file: File | undefined) => {
    if (!file) return;
    const issue = validatePreviewFile(file);
    setError(issue);
    onSelect(issue ? null : file);
  };
  const remove = async () => {
    if (!bookId) return;
    setRemoving(true);
    setError('');
    try {
      await apiRequest(`/books/${bookId}/preview-pdf`, { method: 'DELETE' }, token);
      setConfirming(false);
      onRemoved();
    } catch (reason) {
      setError(requestMessage(reason));
    } finally {
      setRemoving(false);
    }
  };
  return (
    <section className="book-preview-field form-wide" aria-labelledby="preview-pdf-heading">
      <div>
        <p className="book-preview-field__eyebrow">
          {ar ? 'أصل رقمي اختياري' : 'Optional digital asset'}
        </p>
        <h2 id="preview-pdf-heading">{ar ? 'ملف معاينة الكتاب' : 'Book Preview PDF'}</h2>
        <p>
          {ar
            ? 'ارفع ملف PDF يحتوي على غلاف الكتاب وفهرس المحتويات أو صفحات المعاينة المعتمدة.'
            : 'Upload a PDF containing the cover, table of contents, or approved preview pages.'}
        </p>
        <small>
          {ar
            ? 'ارفع فقط ملف معاينة أو محتوى مصرحًا للجامعة باستخدامه. الحد الأقصى 20 ميجابايت.'
            : 'Upload only preview material or content the university is authorized to provide. Maximum 20 MB.'}
        </small>
      </div>
      {preview.available && !selected && (
        <div className="book-preview-existing" role="status">
          <strong>{ar ? 'تم رفع ملف معاينة' : 'Preview PDF uploaded'}</strong>
          <span>{preview.originalName}</span>
          {preview.size != null && <small>{(preview.size / 1024 / 1024).toFixed(1)} MB</small>}
        </div>
      )}
      {selected && (
        <div className="book-preview-existing" role="status">
          <strong>{ar ? 'الملف المحدد' : 'Selected file'}</strong>
          <span>{selected.name}</span>
          <small>{(selected.size / 1024 / 1024).toFixed(1)} MB</small>
        </div>
      )}
      <div className="book-preview-field__actions">
        <input
          ref={input}
          className="visually-hidden"
          type="file"
          accept="application/pdf,.pdf"
          aria-label={ar ? 'اختيار ملف معاينة PDF' : 'Choose preview PDF'}
          onChange={(event) => select(event.target.files?.[0])}
        />
        <button className="button quiet" type="button" onClick={() => input.current?.click()}>
          {preview.available ? (ar ? 'استبدال' : 'Replace') : ar ? 'اختيار PDF' : 'Choose PDF'}
        </button>
        {preview.available && slug && (
          <button
            className="button quiet"
            type="button"
            onClick={() => go(`/books/${slug}/preview`)}
          >
            {ar ? 'معاينة' : 'Preview'}
          </button>
        )}
        {preview.available && bookId && (
          <button className="button danger" type="button" onClick={() => setConfirming(true)}>
            {ar ? 'حذف' : 'Remove'}
          </button>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {confirming && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-preview-title"
          >
            <h2 id="remove-preview-title">{ar ? 'حذف ملف المعاينة؟' : 'Remove preview PDF?'}</h2>
            <p>
              {ar
                ? 'سيظل سجل الكتاب ونسخه وإعاراته كما هو.'
                : 'The book, its copies, and loans will remain unchanged.'}
            </p>
            <div className="form-actions">
              <button className="button quiet" type="button" onClick={() => setConfirming(false)}>
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="button danger"
                type="button"
                disabled={removing}
                onClick={() => void remove()}
              >
                {removing
                  ? ar
                    ? 'جارٍ الحذف…'
                    : 'Removing…'
                  : ar
                    ? 'تأكيد الحذف'
                    : 'Confirm removal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
