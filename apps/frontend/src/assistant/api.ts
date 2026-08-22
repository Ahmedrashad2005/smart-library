import type { PublicBook, PublicLocale } from '../catalog/public.types';
import { apiRequest } from '../lib/api';

export type AssistantTurn = {
  role: 'user' | 'assistant';
  content: string;
  bookIds?: string[];
};

export type AssistantIntent =
  | 'RECOMMEND_BOOKS'
  | 'SEARCH_BOOKS'
  | 'BOOK_DETAILS'
  | 'BOOK_AVAILABILITY'
  | 'BOOK_LOCATION'
  | 'MY_LOANS'
  | 'MY_RESERVATIONS'
  | 'UNIVERSITY_INFO'
  | 'ACADEMIC_HELP'
  | 'GENERAL_LIBRARY_HELP'
  | 'OUT_OF_SCOPE';

export type AssistantContext = {
  referencedBookIds: string[];
  selectedBookId?: string;
  lastIntent?: AssistantIntent;
};

export type AssistantLoan = {
  id: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt?: string | null;
  effectiveStatus: 'ACTIVE' | 'OVERDUE' | 'RETURNED';
  renewedCount: number;
  bookCopy: { copyCode: string; book: PublicBook };
};

export type AssistantReservation = {
  id: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'COLLECTED';
  reservedAt: string;
  expiresAt: string;
  book: PublicBook;
  bookCopy: {
    copyCode: string;
    homeLibraryRoom?: {
      roomNumber: string;
      nameEn?: string;
      nameAr?: string;
      floor: { floorNumber: string; library: { nameEn: string; nameAr: string } };
    } | null;
  };
};

export type AssistantSuggestion = {
  action: 'SEARCH_BOOKS' | 'ASK_FOLLOW_UP' | 'VIEW_BOOK' | 'BOOK_AVAILABILITY' | 'SIMILAR_BOOKS';
  label: string;
  query?: string;
  path?: string;
};

export type AssistantResponse = {
  type:
    | 'TEXT'
    | 'ACADEMIC_EXPLANATION'
    | 'BOOK_EXPLANATION'
    | 'BOOK_SEARCH_RESULTS'
    | 'BOOK_RECOMMENDATIONS'
    | 'BOOK_DETAILS'
    | 'BOOK_AVAILABILITY'
    | 'BOOK_LOCATION'
    | 'LOANS'
    | 'RESERVATIONS'
    | 'LOGIN_REQUIRED'
    | 'ERROR';
  message: string;
  books?: Array<PublicBook & { reason?: string; semanticReason?: string }>;
  loans?: AssistantLoan[];
  reservations?: AssistantReservation[];
  title?: string;
  summary?: string;
  keyPoints?: string[];
  example?: string;
  useCase?: string;
  overview?: string;
  topics?: string[];
  level?: 'BEGINNER' | 'BEGINNER_INTERMEDIATE' | 'INTERMEDIATE' | 'ADVANCED' | 'UNKNOWN';
  whyUseful?: string;
  caveat?: string;
  suggestions?: Array<string | AssistantSuggestion>;
  loginPath?: string;
  context?: AssistantContext;
};

export function sendAssistantMessage(
  message: string,
  locale: PublicLocale,
  history: AssistantTurn[],
  accessToken?: string,
  context?: AssistantContext,
): Promise<AssistantResponse> {
  return apiRequest<AssistantResponse>(
    '/assistant/message',
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        locale,
        history: history.slice(-10),
        ...(context ? { context } : {}),
      }),
    },
    accessToken,
  );
}
