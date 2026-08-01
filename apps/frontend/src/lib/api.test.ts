import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('frontend API client', () => {
  it('unwraps the backend response envelope for tables and forms', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { id: 'book-1' } }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest<{ id: string }>('/books')).resolves.toEqual({ id: 'book-1' });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Accept: 'application/json' });
  });

  it('sends a bearer token for protected archive, restore, and update actions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/books/id/archive', { method: 'POST' }, 'access-token');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer access-token',
    });
  });

  it('reports backend validation errors instead of treating them as success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: 'Choose a category.' }), { status: 400 }),
        ),
    );
    await expect(apiRequest('/books', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
  });
});
