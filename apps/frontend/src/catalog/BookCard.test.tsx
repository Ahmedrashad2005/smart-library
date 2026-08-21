import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BookCard } from './BookCard';
import type { PublicBook } from './public.types';

const book: PublicBook = {
  id: 'campus-card-book',
  slug: 'campus-card-book',
  title: 'Campus Card Book',
  titleAr: 'كتاب بطاقة الكلية',
  totalCopies: 4,
  availableCopies: 3,
  authors: [{ author: { id: 'author', name: 'Nora Ali', nameAr: 'نورا علي' } }],
  campusAvailability: {
    hasPhysicalCopies: true,
    totalCopies: 1,
    availableCopies: 1,
    availabilityStatus: 'AVAILABLE',
  },
};

describe('BookCard Campus availability', () => {
  it('uses the deterministic Delta library book-cover fallback for missing and broken images', () => {
    const { rerender } = render(<BookCard book={book} locale="en" go={vi.fn()} />);

    expect(
      screen.getByRole('img', { name: 'No cover available: Campus Card Book' }),
    ).toHaveTextContent('DELTA');
    expect(
      screen.getByRole('img', { name: 'No cover available: Campus Card Book' }),
    ).toHaveTextContent('Campus Card Book');

    rerender(
      <BookCard
        book={{ ...book, coverImageUrl: 'https://images.test/broken-cover.jpg' }}
        locale="en"
        go={vi.fn()}
      />,
    );
    fireEvent.error(screen.getByAltText('Cover of Campus Card Book'));
    expect(
      screen.getByRole('img', { name: 'No cover available: Campus Card Book' }),
    ).toHaveTextContent('DELTA');
  });

  it('keeps English fallback metadata correctly directed in Arabic catalog cards', () => {
    const englishFallback: PublicBook = {
      ...book,
      titleAr: undefined,
      authors: [{ author: { id: 'author', name: 'Nora Ali' } }],
    };

    render(<BookCard book={englishFallback} locale="ar" go={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Campus Card Book' })).toHaveAttribute(
      'dir',
      'auto',
    );
    expect(
      screen.getByText('Nora Ali', { selector: '.catalog-book-card__authors' }),
    ).toHaveAttribute('dir', 'auto');
  });

  it('shows a subtle accurate Campus badge and uses Campus counts inside Campus scope', () => {
    render(<BookCard book={book} locale="en" go={vi.fn()} availabilityScope="campus" />);

    expect(screen.getByText('Available in the University Library')).toHaveClass(
      'campus-book-badge',
      'is-available',
    );
    expect(screen.getByLabelText('1 available · 1 copy')).toBeInTheDocument();
  });

  it('does not confuse global availability with an unavailable Campus holding', () => {
    const unavailableOnCampus: PublicBook = {
      ...book,
      campusAvailability: {
        hasPhysicalCopies: true,
        totalCopies: 1,
        availableCopies: 0,
        availabilityStatus: 'UNAVAILABLE',
      },
    };
    render(
      <BookCard book={unavailableOnCampus} locale="en" go={vi.fn()} availabilityScope="campus" />,
    );

    expect(screen.getByText('Currently unavailable in the University Library')).toHaveClass(
      'campus-book-badge',
      'is-unavailable',
    );
    expect(screen.getByLabelText('Currently unavailable · 1 copy')).toBeInTheDocument();
  });
});
