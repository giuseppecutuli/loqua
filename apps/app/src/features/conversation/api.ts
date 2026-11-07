import {
  conversationReplySchema,
  conversationReportSchema,
  conversationScenarioViewSchema,
  conversationViewSchema,
  type ConversationReply,
  type ConversationReport,
  type ConversationScenarioView,
  type ConversationView,
} from '@loqua/core';

import { field, parseBody, parseCollection, parseEnvelope, request } from '../../lib/http';

export interface StreamTicket {
  readonly ticket: string;
  readonly expiresAt: string;
}

export function parseConversationReply(value: unknown): ConversationReply {
  return parseBody(value, conversationReplySchema, 'invalid_conversation');
}

export async function fetchConversationScenarios(): Promise<readonly ConversationScenarioView[]> {
  const body: unknown = await (await request('/v1/conversations/scenarios')).json();
  return parseCollection(body, 'scenarios', conversationScenarioViewSchema, 'invalid_scenarios');
}

export async function startConversation(scenarioId: string): Promise<ConversationView> {
  const body: unknown = await (
    await request('/v1/conversations', {
      method: 'POST',
      body: JSON.stringify({ scenarioId }),
    })
  ).json();
  return parseEnvelope(body, 'session', conversationViewSchema, 'invalid_conversation');
}

export async function fetchStreamTicket(conversationId: string): Promise<StreamTicket> {
  const body: unknown = await (
    await request(`/v1/conversations/${encodeURIComponent(conversationId)}/stream-ticket`, {
      method: 'POST',
    })
  ).json();
  const ticket = field(body, 'ticket');
  const expiresAt = field(body, 'expiresAt');
  if (typeof ticket !== 'string' || ticket.length === 0 || typeof expiresAt !== 'string') {
    throw new Error('invalid_stream_ticket');
  }
  return { ticket, expiresAt };
}

export function streamingUrl(base: string, ticket: string): string {
  const wsBase = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  const separator = wsBase.includes('?') ? '&' : '?';
  return `${wsBase}${separator}ticket=${encodeURIComponent(ticket)}`;
}

export async function fetchConversation(id: string): Promise<ConversationView> {
  const body: unknown = await (await request(`/v1/conversations/${encodeURIComponent(id)}`)).json();
  return parseEnvelope(body, 'session', conversationViewSchema, 'invalid_conversation');
}

export async function sendConversationTurn(id: string, text: string): Promise<ConversationReply> {
  const body: unknown = await (
    await request(`/v1/conversations/${encodeURIComponent(id)}/turns`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  ).json();
  return parseConversationReply(body);
}

export async function sendConversationVoice(
  conversationId: string,
  audioBase64: string,
  durationSec: number,
): Promise<ConversationReply> {
  const body: unknown = await (
    await request(`/v1/conversations/${encodeURIComponent(conversationId)}/turns/voice`, {
      method: 'POST',
      body: JSON.stringify({ audioBase64, durationSec }),
    })
  ).json();
  return parseConversationReply(body);
}

export async function fetchConversationReport(conversationId: string): Promise<ConversationReport> {
  const body: unknown = await (
    await request(`/v1/conversations/${encodeURIComponent(conversationId)}/report`, {
      method: 'POST',
    })
  ).json();
  return parseEnvelope(body, 'report', conversationReportSchema, 'invalid_report');
}

export async function completeConversation(id: string): Promise<ConversationView> {
  const body: unknown = await (
    await request(`/v1/conversations/${encodeURIComponent(id)}/complete`, { method: 'POST' })
  ).json();
  return parseEnvelope(body, 'session', conversationViewSchema, 'invalid_conversation');
}
