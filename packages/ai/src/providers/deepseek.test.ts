import { describe, expect, it } from 'vitest';

import { DeepSeekProvider } from './deepseek.js';

interface CapturedRequest {
  readonly url: string;
  readonly body: Record<string, unknown>;
  readonly authorization: string | null;
}

function fakeFetch(response: Response, captured: CapturedRequest[]): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const rawBody = typeof init?.body === 'string' ? init.body : '{}';
    captured.push({
      url: String(input),
      body: JSON.parse(rawBody) as Record<string, unknown>,
      authorization: headers.get('authorization'),
    });
    return response;
  };
}

function okResponse(model = 'deepseek-chat'): Response {
  return new Response(
    JSON.stringify({
      id: 'req-1',
      model,
      choices: [{ message: { content: '{"corrections":[]}' } }],
      usage: { prompt_tokens: 120, completion_tokens: 30 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const baseRequest = {
  system: 'Return JSON only.',
  user: '<learner_text>I have went</learner_text>',
  model: 'deepseek-chat',
  tier: 'fast' as const,
  temperature: 0.1,
  attempt: 0,
};

describe('DeepSeek provider', () => {
  it('calls the OpenAI-compatible chat endpoint with JSON mode', async () => {
    const captured: CapturedRequest[] = [];
    const provider = new DeepSeekProvider({
      apiKey: 'test-key',
      fetchImpl: fakeFetch(okResponse(), captured),
    });

    const result = await provider.complete(baseRequest);

    expect(result.provider).toBe('deepseek');
    expect(result.text).toBe('{"corrections":[]}');
    expect(result.tokensIn).toBe(120);
    expect(result.tokensOut).toBe(30);
    expect(captured[0]?.url).toBe('https://api.deepseek.com/chat/completions');
    expect(captured[0]?.authorization).toBe('Bearer test-key');
    expect(captured[0]?.body).toMatchObject({
      model: 'deepseek-chat',
      stream: false,
      response_format: { type: 'json_object' },
    });
  });

  it('uses the reasoner model for the reason tier without JSON mode', async () => {
    const captured: CapturedRequest[] = [];
    const provider = new DeepSeekProvider({
      apiKey: 'test-key',
      fetchImpl: fakeFetch(okResponse('deepseek-reasoner'), captured),
    });

    await provider.complete({ ...baseRequest, tier: 'reason' });

    expect(captured[0]?.body).toMatchObject({ model: 'deepseek-reasoner', stream: false });
    expect(captured[0]?.body.response_format).toBeUndefined();
  });

  it('surfaces provider HTTP errors', async () => {
    const provider = new DeepSeekProvider({
      apiKey: 'test-key',
      fetchImpl: fakeFetch(
        new Response('{"error":{"message":"bad key"}}', { status: 401 }),
        [],
      ),
    });

    await expect(provider.complete(baseRequest)).rejects.toThrow('DeepSeek HTTP 401');
  });

  it('rejects malformed provider payloads', async () => {
    const provider = new DeepSeekProvider({
      apiKey: 'test-key',
      fetchImpl: fakeFetch(
        new Response('{"choices":[]}', { status: 200 }),
        [],
      ),
    });

    await expect(provider.complete(baseRequest)).rejects.toThrow('response shape invalid');
  });
});
