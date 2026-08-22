import { apiRequest } from '../lib/api';
import type { PublicBook } from '../catalog/public.types';
import type { PublicLocale } from '../catalog/public.types';

export type RecommendationMode = 'personalized' | 'cold_start' | 'fallback';

export type RecommendationResult = {
  mode: RecommendationMode;
  generatedAt: string;
  items: Array<{ book: PublicBook; reason: string }>;
};

export function getMyRecommendations(
  accessToken: string,
  limit = 4,
  locale: PublicLocale = 'ar',
): Promise<RecommendationResult> {
  return apiRequest<RecommendationResult>(
    `/recommendations/me?limit=${limit}&locale=${locale}`,
    {},
    accessToken,
  );
}
