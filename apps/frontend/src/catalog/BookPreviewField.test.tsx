import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../lib/api';
import { BookPreviewField, type PreviewMetadata } from './BookPreviewField';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
  requestMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

const existing: PreviewMetadata = {
  available: true,
  url: '/books/book-1/preview-pdf',
  originalName: 'approved-preview.pdf',
  size: 2048,
  updatedAt: '2026-08-22T00:00:00.000Z',
};

describe('Librarian Book Preview PDF field', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts a valid PDF selection and displays its filename and size', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    render(
      <BookPreviewField
        locale="en"
        token="token"
        preview={{ ...existing, available: false }}
        selected={null}
        onSelect={onSelect}
        onRemoved={vi.fn()}
        go={vi.fn()}
      />,
    );
    const file = new File(['%PDF-preview'], 'antenna.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Choose preview PDF'), file);
    expect(onSelect).toHaveBeenCalledWith(file);
  });

  it('rejects an invalid client-side file with accessible feedback', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(
      <BookPreviewField
        locale="en"
        token="token"
        preview={{ ...existing, available: false }}
        selected={null}
        onSelect={vi.fn()}
        onRemoved={vi.fn()}
        go={vi.fn()}
      />,
    );
    await user.upload(
      screen.getByLabelText('Choose preview PDF'),
      new File(['x'], 'malware.exe', { type: 'application/x-msdownload' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('PDF files only');
  });

  it('offers working preview and replace controls for an existing asset', async () => {
    const go = vi.fn();
    const user = userEvent.setup();
    render(
      <BookPreviewField
        locale="ar"
        bookId="book-1"
        slug="antenna-theory"
        token="token"
        preview={existing}
        selected={null}
        onSelect={vi.fn()}
        onRemoved={vi.fn()}
        go={go}
      />,
    );
    expect(screen.getByText('تم رفع ملف معاينة')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'معاينة' }));
    expect(go).toHaveBeenCalledWith('/books/antenna-theory/preview');
    expect(screen.getByRole('button', { name: 'استبدال' })).toBeVisible();
  });

  it('requires accessible confirmation and deletes without touching the Book form', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ removed: true });
    const onRemoved = vi.fn();
    const user = userEvent.setup();
    render(
      <BookPreviewField
        locale="en"
        bookId="book-1"
        slug="antenna-theory"
        token="token"
        preview={existing}
        selected={null}
        onSelect={vi.fn()}
        onRemoved={onRemoved}
        go={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove preview PDF?' });
    expect(apiRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(apiRequest).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: 'Confirm removal' }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledOnce());
    expect(apiRequest).toHaveBeenCalledWith(
      '/books/book-1/preview-pdf',
      { method: 'DELETE' },
      'token',
    );
    expect(dialog).not.toBeInTheDocument();
  });
});
