import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookShelfCard } from './BookShelfCard';
import type { PublicBook } from './public.types';

const book: PublicBook = {
  id: 'book-knowledge-01',
  slug: 'knowledge-journey',
  title: 'A Journey Through Knowledge',
  titleAr: 'رحلة طويلة جدًا عبر عوالم المعرفة والاكتشاف والتعلّم',
  coverImageUrl: 'https://images.test/knowledge.jpg',
  totalCopies: 5,
  availableCopies: 2,
  authors: [{ author: { id: 'author-1', name: 'Maya Stone', nameAr: 'مايا ستون' } }],
};

describe('BookShelfCard', () => {
  it('prioritizes the real portrait cover and opens the real details route', async () => {
    const go = vi.fn();
    render(<BookShelfCard book={book} locale="en" go={go} isNew />);

    expect(screen.getByAltText('A Journey Through Knowledge cover')).toHaveAttribute(
      'src',
      book.coverImageUrl,
    );
    expect(screen.getByText('New')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Book details: A Journey Through Knowledge' }),
    );
    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith('/books/knowledge-journey');
  });

  it('renders a stable branded physical-cover fallback with localized title and author', () => {
    const withoutCover = { ...book, coverImageUrl: undefined };
    const { rerender } = render(<BookShelfCard book={withoutCover} locale="ar" go={vi.fn()} />);
    const fallback = screen.getByRole('img', {
      name: `لا يوجد غلاف: ${book.titleAr}`,
    });
    const variant = Array.from(fallback.classList).find((name) =>
      name.startsWith('shelf-no-cover--'),
    );

    expect(fallback).toHaveTextContent('نَوَى');
    expect(fallback).toHaveTextContent('رحلة طويلة جدًا عبر عوالم');
    expect(fallback).toHaveTextContent('مايا ستون');

    rerender(<BookShelfCard book={withoutCover} locale="ar" go={vi.fn()} />);
    expect(screen.getByRole('img', { name: `لا يوجد غلاف: ${book.titleAr}` })).toHaveClass(
      variant!,
    );

    rerender(
      <BookShelfCard
        book={{ ...withoutCover, id: 'book-knowledge-02' }}
        locale="ar"
        go={vi.fn()}
      />,
    );
    expect(screen.getByRole('img', { name: `لا يوجد غلاف: ${book.titleAr}` })).not.toHaveClass(
      variant!,
    );
  });

  it('keeps English fallback metadata correctly directed inside Arabic RTL', () => {
    const englishFallback: PublicBook = {
      ...book,
      titleAr: undefined,
      authors: [{ author: { id: 'author-1', name: 'Maya Stone' } }],
    };

    render(<BookShelfCard book={englishFallback} locale="ar" go={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'A Journey Through Knowledge' })).toHaveAttribute(
      'dir',
      'auto',
    );
    expect(screen.getByText('Maya Stone')).toHaveAttribute('dir', 'auto');
  });

  it('falls back gracefully when a supplied cover image cannot load', () => {
    render(<BookShelfCard book={book} locale="en" go={vi.fn()} />);

    fireEvent.error(screen.getByAltText('A Journey Through Knowledge cover'));

    expect(
      screen.getByRole('img', { name: 'No cover: A Journey Through Knowledge' }),
    ).toBeInTheDocument();
    expect(screen.queryByAltText('A Journey Through Knowledge cover')).not.toBeInTheDocument();
  });

  it('shows Campus holding availability without changing the existing details action', () => {
    const campusBook: PublicBook = {
      ...book,
      campusAvailability: {
        hasPhysicalCopies: true,
        totalCopies: 1,
        availableCopies: 1,
        availabilityStatus: 'AVAILABLE',
      },
    };
    render(<BookShelfCard book={campusBook} locale="en" go={vi.fn()} campusScope />);

    expect(screen.getByText('Campus Library')).toHaveClass('shelf-campus-badge', 'is-available');
    expect(screen.getByText('Available', { selector: '.shelf-available' })).toBeInTheDocument();
  });
});
