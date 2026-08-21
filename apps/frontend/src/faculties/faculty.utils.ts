import type { PublicLocale } from '../catalog/public.types';
import type { Faculty } from './api';

const MEDICINE_FACULTY_NAME_AR = 'كلية الطب البشري';

export type FacultyBranding = {
  logoSrc: string;
  logoAlt: string;
};

export function facultyName(faculty: Faculty, locale: PublicLocale): string {
  return locale === 'en' && faculty.nameEn ? faculty.nameEn : faculty.nameAr;
}

export function facultyBranding(faculty: Faculty, locale: PublicLocale): FacultyBranding | null {
  if (faculty.nameAr !== MEDICINE_FACULTY_NAME_AR) return null;

  return {
    logoSrc: '/branding/faculties/medicine.png',
    logoAlt:
      locale === 'ar'
        ? 'شعار كلية الطب البشري - جامعة الدلتا'
        : 'Faculty of Medicine - Delta University logo',
  };
}
