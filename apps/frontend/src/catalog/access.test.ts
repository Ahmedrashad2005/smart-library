import { describe, expect, it } from 'vitest';
import { canManageCatalog, catalogRoute, validCatalogSearch } from './access';

describe('catalog frontend access and navigation', () => {
  it('builds safe book detail routes', () => {
    expect(catalogRoute()).toBe('/books');
    expect(catalogRoute('Arabic title')).toBe('/books/Arabic%20title');
  });
  it('only exposes management flows to librarians and administrators', () => {
    expect(canManageCatalog('MEMBER')).toBe(false);
    expect(canManageCatalog('LIBRARIAN')).toBe(true);
    expect(canManageCatalog('ADMIN')).toBe(true);
  });
  it('requires meaningful text when a catalog search is present', () => {
    expect(validCatalogSearch('')).toBe(true);
    expect(validCatalogSearch('a')).toBe(false);
    expect(validCatalogSearch('history')).toBe(true);
  });
});
