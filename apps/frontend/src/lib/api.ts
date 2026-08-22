export type ApiResult<T> = T;

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export function apiUrl(path: string): string {
  return `${baseUrl}${path}`;
}

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
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
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

export function apiUpload<T>(path: string, file: File, accessToken: string): Promise<T> {
  const body = new FormData();
  body.append('file', file);
  return apiRequest<T>(path, { method: 'POST', body }, accessToken);
}

export async function apiBlob(path: string, accessToken: string): Promise<Blob> {
  const response = await fetch(apiUrl(path), {
    headers: { Accept: 'application/pdf', Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(body.message ?? 'The PDF preview could not be loaded.', response.status);
  }
  return response.blob();
}

export function requestMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'A network error occurred. Please try again.';
}
