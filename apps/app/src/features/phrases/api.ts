import { request } from '../../lib/http';

export async function savePhrase(text: string, sourceRef?: string): Promise<void> {
  await request('/v1/phrases', {
    method: 'POST',
    body: JSON.stringify({ text, source: 'exercise', sourceRef: sourceRef ?? null }),
  });
}
