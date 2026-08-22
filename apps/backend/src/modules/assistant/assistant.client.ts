import { Injectable } from '@nestjs/common';

export const assistantIntents = [
  'RECOMMEND_BOOKS',
  'SEARCH_BOOKS',
  'BOOK_DETAILS',
  'BOOK_AVAILABILITY',
  'BOOK_LOCATION',
  'MY_LOANS',
  'MY_RESERVATIONS',
  'UNIVERSITY_INFO',
  'ACADEMIC_HELP',
  'GENERAL_LIBRARY_HELP',
  'OUT_OF_SCOPE',
] as const;
export type AssistantIntent = (typeof assistantIntents)[number];

export type AssistantInterpretRequest = {
  message: string;
  locale: 'ar' | 'en';
  history: Array<{ role: 'user' | 'assistant'; content: string; bookIds: string[] }>;
  context: {
    referencedBookIds: string[];
    selectedBookId?: string;
    lastIntent?: AssistantIntent;
  };
  allowedBookIds: string[];
};

export type AssistantInterpretation = {
  intent: AssistantIntent;
  query?: string | null;
  referencedBookId?: string | null;
  answer?: string | null;
  confidence?: 'low' | 'medium' | 'high';
};

export type AssistantBookExplanationRequest = {
  message: string;
  locale: 'ar' | 'en';
  history: AssistantInterpretRequest['history'];
  book: {
    id: string;
    title: string;
    titleAr?: string | null;
    authors: string[];
    category?: string | null;
    description?: string | null;
    language?: string | null;
    publicationYear?: number | null;
    recommendationReason?: string | null;
    previewAvailable: boolean;
    previewOriginalName?: string | null;
  };
};

export type AssistantAcademicHelpRequest = {
  message: string;
  locale: 'ar' | 'en';
  history: AssistantInterpretRequest['history'];
};

export type AssistantCatalogCandidate = {
  id: string;
  title: string;
  titleAr?: string | null;
  subtitle?: string | null;
  subtitleAr?: string | null;
  authors: string[];
  categories: string[];
  publisher?: string | null;
  classification?: string | null;
  description?: string | null;
  faculties: string[];
};

export type AssistantCatalogSelectionRequest = {
  query: string;
  locale: 'ar' | 'en';
  books: AssistantCatalogCandidate[];
  limit: number;
};

@Injectable()
export class AssistantClient {
  async interpret(request: AssistantInterpretRequest): Promise<unknown> {
    return this.post('/assistant/interpret', request);
  }

  async explainBook(request: AssistantBookExplanationRequest): Promise<unknown> {
    return this.post('/assistant/explain-book', request);
  }

  async explainAcademic(request: AssistantAcademicHelpRequest): Promise<unknown> {
    return this.post('/assistant/explain-academic', request);
  }

  async selectCatalog(request: AssistantCatalogSelectionRequest): Promise<unknown> {
    return this.post('/assistant/select-catalog', request);
  }

  private async post(path: string, request: object): Promise<unknown> {
    const serviceUrl = process.env.RECOMMENDATION_SERVICE_URL ?? 'http://localhost:8000';
    const timeout = Math.min(
      15_000,
      Math.max(1_000, Number(process.env.RECOMMENDATION_TIMEOUT_MS ?? 8_000)),
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${serviceUrl.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
        const detail =
          typeof body?.detail === 'string' ? body.detail.slice(0, 80) : 'UNKNOWN_ERROR';
        const error = new Error(`Assistant service returned ${response.status} (${detail})`);
        error.name = 'AssistantServiceError';
        throw error;
      }
      return response.json() as Promise<unknown>;
    } finally {
      clearTimeout(timer);
    }
  }
}
