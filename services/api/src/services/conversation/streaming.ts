import { createHmac, timingSafeEqual } from 'node:crypto';

export interface StreamingTurnEvent {
  readonly end_of_turn: boolean;
  readonly transcript: string;
}

export interface StreamingTranscriberLike {
  connect(): Promise<unknown>;
  sendAudio(audio: Uint8Array): void;
  on(event: 'turn', listener: (event: StreamingTurnEvent) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  close(waitForSessionTermination?: boolean): Promise<void>;
}

export interface StreamTicketClaims {
  readonly userId: string;
  readonly conversationId: string;
  readonly expiresAt: number;
}

export interface StreamTicket {
  readonly ticket: string;
  readonly expiresAt: string;
}

export interface VerifyStreamTicketInput {
  readonly ticket: string;
  readonly conversationId: string;
  readonly now: Date;
}

const TICKET_TTL_SECONDS = 60;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createStreamTicket(
  input: { readonly userId: string; readonly conversationId: string; readonly now: Date },
  secret: string,
): StreamTicket {
  const expiresAt = Math.floor(input.now.getTime() / 1000) + TICKET_TTL_SECONDS;
  const payload = Buffer.from(
    `${input.userId}.${input.conversationId}.${expiresAt}`,
    'utf8',
  ).toString('base64url');
  const signature = sign(payload, secret);
  return {
    ticket: `${payload}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function verifyStreamTicket(
  input: VerifyStreamTicketInput,
  secret: string,
): StreamTicketClaims | null {
  const parts = input.ticket.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload, secret);
  const provided = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  const claims = decoded.split('.');
  if (claims.length !== 3) return null;
  const [userId, conversationId, rawExpiry] = claims;
  if (!userId || !conversationId || !rawExpiry) return null;

  const expiry = Number(rawExpiry);
  if (!Number.isInteger(expiry) || expiry < Math.floor(input.now.getTime() / 1000)) {
    return null;
  }
  if (conversationId !== input.conversationId) return null;

  return { userId, conversationId, expiresAt: expiry * 1000 };
}
