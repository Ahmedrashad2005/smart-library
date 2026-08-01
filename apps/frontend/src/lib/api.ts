export type ApiResult<T> = T;

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type ApiEnvelope<T> = { data?: T; message?: string };

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & { message?: string };
  if (!response.ok)
    throw new ApiError(body.message ?? 'The request could not be completed.', response.status);
  return body.data ?? (body as T);
}

export function requestMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'A network error occurred. Please try again.';
}
