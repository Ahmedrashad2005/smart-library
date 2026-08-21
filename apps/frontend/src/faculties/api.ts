import { apiRequest } from '../lib/api';
import type { PublicBook, PublicCatalogResult } from '../catalog/public.types';

export type Faculty = {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  displayOrder: number;
  bookCount: number;
};

export function listFaculties(): Promise<Faculty[]> {
  return apiRequest<Faculty[]>('/faculties');
}

export function facultyDetail(slug: string): Promise<Faculty> {
  return apiRequest<Faculty>(`/faculties/${encodeURIComponent(slug)}`);
}

export function facultyBooks(slug: string, page = 1): Promise<PublicCatalogResult> {
  const params = new URLSearchParams({ facultySlug: slug, page: String(page), limit: '12' });
  return apiRequest<PublicCatalogResult>(`/books?${params.toString()}`);
}

export type { PublicBook };
