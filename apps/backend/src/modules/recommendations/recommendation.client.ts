import { Injectable } from '@nestjs/common';

export type RankHistoryBook = {
  title: string;
  authors: string[];
  category?: string;
  description?: string;
  faculties: string[];
};

export type RankCandidateBook = RankHistoryBook & {
  id: string;
  available: boolean;
};

export type RankRequest = {
  history: RankHistoryBook[];
  academicContext: Record<string, never>;
  candidateBooks: RankCandidateBook[];
  limit: number;
  locale: 'ar' | 'en';
  query?: string;
};

export type RankResponse = {
  recommendations: Array<{ bookId: string; reason: string }>;
};

@Injectable()
export class RecommendationClient {
  async rank(request: RankRequest): Promise<unknown> {
    const serviceUrl = process.env.RECOMMENDATION_SERVICE_URL ?? 'http://localhost:8000';
    const timeout = Math.min(
      15_000,
      Math.max(1_000, Number(process.env.RECOMMENDATION_TIMEOUT_MS ?? 8_000)),
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/recommendations/rank`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Recommendation service returned ${response.status}`);
      return response.json() as Promise<unknown>;
    } finally {
      clearTimeout(timer);
    }
  }
}
