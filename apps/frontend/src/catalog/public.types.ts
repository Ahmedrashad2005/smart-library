import type { Role } from '../auth/access';

export type PublicLocale = 'en' | 'ar';

export type PublicSession = {
  role: Role;
  fullName: string;
};

export type PublicCategory = {
  id: string;
  nameEn: string;
  nameAr: string;
  slug: string;
};

export type PublicAuthor = {
  id: string;
  name: string;
  nameAr?: string;
};

export type PublicBook = {
  id: string;
  slug: string;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  coverImageUrl?: string;
  borrowCount?: number;
  isFeatured?: boolean;
  createdAt?: string;
  totalCopies: number;
  availableCopies: number;
  category?: PublicCategory;
  authors: Array<{ author: PublicAuthor }>;
};

export type PublicCatalogResult = {
  items: PublicBook[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
