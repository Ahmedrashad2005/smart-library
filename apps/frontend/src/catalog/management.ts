import type { Role } from '../auth/access';

export type ManagementArea =
  'books' | 'book-copies' | 'categories' | 'authors' | 'publishers' | 'locations' | 'shelves';

export const managementRole = (area: ManagementArea): Role[] =>
  area === 'books' || area === 'book-copies' ? ['LIBRARIAN', 'ADMIN'] : ['ADMIN'];

export function routeArea(path: string): ManagementArea | null {
  if (path.includes('/librarian/books')) return 'books';
  if (path.includes('/librarian/book-copies')) return 'book-copies';
  if (path.includes('/admin/categories')) return 'categories';
  if (path.includes('/admin/authors')) return 'authors';
  if (path.includes('/admin/publishers')) return 'publishers';
  if (path.includes('/admin/locations')) return 'locations';
  if (path.includes('/admin/shelves')) return 'shelves';
  return null;
}

export function canManageRoute(role: Role | undefined, path: string): boolean {
  const area = routeArea(path);
  return !!area && !!role && managementRole(area).includes(role);
}

export function validateBookForm(values: {
  title: string;
  slug: string;
  categoryId: string;
  authorIds: string[];
}): Record<string, string> {
  return {
    ...(values.title.trim() ? {} : { title: 'Title is required.' }),
    ...(values.slug.trim() ? {} : { slug: 'Slug is required.' }),
    ...(values.categoryId ? {} : { categoryId: 'Choose a category.' }),
    ...(values.authorIds.length ? {} : { authorIds: 'Choose at least one author.' }),
  };
}

export function validateCopyForm(values: {
  bookId: string;
  sectionId: string;
  shelfId: string;
}): Record<string, string> {
  return {
    ...(values.bookId ? {} : { bookId: 'Choose a book.' }),
    ...(values.sectionId ? {} : { sectionId: 'Choose a section.' }),
    ...(values.shelfId ? {} : { shelfId: 'Choose a shelf.' }),
  };
}

export function shelvesForSection<T extends { sectionId: string }>(
  shelves: T[],
  sectionId: string,
): T[] {
  return shelves.filter((shelf) => shelf.sectionId === sectionId);
}

export function pageSlice<T>(items: T[], page: number, pageSize = 10): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export function archivedState<T extends { id: string; isArchived: boolean }>(
  items: T[],
  id: string,
  isArchived: boolean,
): T[] {
  return items.map((item) => (item.id === id ? { ...item, isArchived } : item));
}

export function managementListQuery(
  path: string,
  query: string,
  page: number,
  archiveState: 'active' | 'archived' | 'all',
): string {
  return `${path}?limit=10&page=${page}&q=${encodeURIComponent(query)}&archiveState=${archiveState}`;
}
