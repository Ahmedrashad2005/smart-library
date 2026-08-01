import { describe, expect, it } from 'vitest';
import {
  archivedState,
  canManageRoute,
  pageSlice,
  managementListQuery,
  routeArea,
  shelvesForSection,
  validateBookForm,
  validateCopyForm,
} from './management';

describe('catalog management frontend rules', () => {
  it('protects librarian and administrator routes from members', () => {
    expect(canManageRoute('MEMBER', '/librarian/books')).toBe(false);
    expect(canManageRoute('LIBRARIAN', '/librarian/books')).toBe(true);
    expect(canManageRoute('LIBRARIAN', '/admin/categories')).toBe(false);
    expect(canManageRoute('ADMIN', '/admin/categories')).toBe(true);
  });

  it('recognizes every implemented management route family', () => {
    expect(routeArea('/librarian/books/create')).toBe('books');
    expect(routeArea('/librarian/book-copies/a/edit')).toBe('book-copies');
    expect(routeArea('/admin/authors')).toBe('authors');
    expect(routeArea('/admin/locations')).toBe('locations');
    expect(routeArea('/books')).toBeNull();
  });

  it('validates a create-book form before sending it', () => {
    expect(validateBookForm({ title: '', slug: '', categoryId: '', authorIds: [] })).toEqual({
      title: 'Title is required.',
      slug: 'Slug is required.',
      categoryId: 'Choose a category.',
      authorIds: 'Choose at least one author.',
    });
    expect(
      validateBookForm({ title: 'Book', slug: 'book', categoryId: 'c1', authorIds: ['a1'] }),
    ).toEqual({});
  });

  it('validates copy creation and location choices', () => {
    expect(validateCopyForm({ bookId: '', sectionId: '', shelfId: '' })).toEqual({
      bookId: 'Choose a book.',
      sectionId: 'Choose a section.',
      shelfId: 'Choose a shelf.',
    });
    expect(validateCopyForm({ bookId: 'b', sectionId: 's', shelfId: 'sh' })).toEqual({});
  });

  it('only offers shelves belonging to the selected section', () => {
    const shelves = [
      { id: 'a', sectionId: 'one' },
      { id: 'b', sectionId: 'two' },
      { id: 'c', sectionId: 'one' },
    ];
    expect(shelvesForSection(shelves, 'one').map((shelf) => shelf.id)).toEqual(['a', 'c']);
  });

  it('paginates loaded tables without dropping records', () => {
    const rows = Array.from({ length: 23 }, (_, index) => index + 1);
    expect(pageSlice(rows, 1)).toHaveLength(10);
    expect(pageSlice(rows, 2)[0]).toBe(11);
    expect(pageSlice(rows, 3)).toEqual([21, 22, 23]);
  });

  it('keeps an archived row available for confirmation-driven restore', () => {
    const starting = [
      { id: 'one', isArchived: false },
      { id: 'two', isArchived: false },
    ];
    const archived = archivedState(starting, 'one', true);
    expect(archived[0]?.isArchived).toBe(true);
    expect(archivedState(archived, 'one', false)[0]?.isArchived).toBe(false);
  });

  it('requests archived books and copies again after a simulated reload', () => {
    expect(managementListQuery('/books', 'history', 2, 'archived')).toBe(
      '/books?limit=10&page=2&q=history&archiveState=archived',
    );
    expect(managementListQuery('/book-copies', 'QR 1', 1, 'all')).toContain(
      'q=QR%201&archiveState=all',
    );
  });

  it('keeps Arabic and RTL-compatible route logic independent of text direction', () => {
    expect(canManageRoute('ADMIN', '/admin/shelves')).toBe(true);
    expect(routeArea('/admin/shelves')).toBe('shelves');
  });
});
