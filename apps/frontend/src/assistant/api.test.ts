import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.fn();
vi.mock('../lib/api', () => ({ apiRequest }));

describe('assistant API boundary', () => {
  beforeEach(() => apiRequest.mockReset());

  it('sends no member identity and bounds context to the latest ten turns', async () => {
    apiRequest.mockResolvedValue({ type: 'TEXT', message: 'ok' });
    const { sendAssistantMessage } = await import('./api');
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: 'user' as const,
      content: `turn-${index}`,
    }));
    await sendAssistantMessage('hello', 'en', history, 'member-token');
    expect(apiRequest).toHaveBeenCalledWith(
      '/assistant/message',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'hello', locale: 'en', history: history.slice(-10) }),
      }),
      'member-token',
    );
    expect(apiRequest.mock.calls[0]![1].body).not.toMatch(/memberId|email/);
  });

  it('sends only bounded structured Book follow-up context', async () => {
    apiRequest.mockResolvedValue({ type: 'TEXT', message: 'ok' });
    const { sendAssistantMessage } = await import('./api');
    const context = {
      referencedBookIds: ['book-1', 'book-2'],
      selectedBookId: 'book-2',
      lastIntent: 'BOOK_AVAILABILITY' as const,
    };
    await sendAssistantMessage('موجود فين؟', 'ar', [], undefined, context);
    expect(JSON.parse(apiRequest.mock.calls[0]![1].body)).toEqual({
      message: 'موجود فين؟',
      locale: 'ar',
      history: [],
      context,
    });
  });
});
