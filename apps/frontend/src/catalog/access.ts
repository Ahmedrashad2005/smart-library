export type FrontendRole = 'MEMBER' | 'LIBRARIAN' | 'ADMIN' | null;

export function catalogRoute(slug?: string): string {
  return slug ? `/books/${encodeURIComponent(slug)}` : '/books';
}

export function canManageCatalog(role: FrontendRole): boolean {
  return role === 'LIBRARIAN' || role === 'ADMIN';
}

export function validCatalogSearch(value: string): boolean {
  return value.trim().length === 0 || value.trim().length >= 2;
}
