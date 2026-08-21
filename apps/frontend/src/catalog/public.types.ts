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

const publicCategoryLabels: Record<string, { en: string; ar: string }> = {
  'campus-uncategorized': {
    en: 'University Library books',
    ar: 'كتب المكتبة الجامعية',
  },
  'campus-cyber-security-communication': {
    en: 'Cyber security',
    ar: 'الأمن السيبراني',
  },
  'campus-bio-informatics': {
    en: 'Bioinformatics',
    ar: 'المعلوماتية الحيوية',
  },
  'campus-ai-programming-ml-processing': {
    en: 'AI & programming',
    ar: 'الذكاء الاصطناعي والبرمجة',
  },
};

export function publicCategoryName(category: PublicCategory, locale: PublicLocale): string {
  const publicLabel = publicCategoryLabels[category.slug];
  if (publicLabel) return publicLabel[locale];
  return locale === 'ar' ? category.nameAr : category.nameEn;
}

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
  campusAvailability?: {
    hasPhysicalCopies: boolean;
    totalCopies: number;
    availableCopies: number;
    availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_HELD';
  };
};

export type PublicCatalogResult = {
  items: PublicBook[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  sourceCollections?: string[];
};
