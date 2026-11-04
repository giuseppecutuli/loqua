import { describe, expect, it } from 'vitest';

import { estimateCostUsd } from './cost.js';
import {
  conversationTurnInputSchema,
  conversationTurnOutputSchema,
} from './prompts/conversation.turn.js';

interface EvalCase {
  readonly level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
  readonly reply: string;
  readonly maxChars: number;
}

const CASES: readonly EvalCase[] = [
  { level: 'A1', reply: 'Hello! What would you like to drink?', maxChars: 90 },
  { level: 'A1', reply: 'Sure. One coffee. Anything else?', maxChars: 90 },
  { level: 'A1', reply: 'The bus stops here. It is late today.', maxChars: 90 },
  { level: 'A1', reply: 'I have a headache. Please sit down.', maxChars: 90 },
  { level: 'A2', reply: 'That sounds good. Do you want to meet at six?', maxChars: 120 },
  { level: 'A2', reply: 'I went to the market yesterday and bought some fruit.', maxChars: 120 },
  { level: 'A2', reply: 'Could you repeat the address, please?', maxChars: 120 },
  { level: 'A2', reply: 'The train leaves from platform four in ten minutes.', maxChars: 120 },
  { level: 'B1', reply: 'I have been working on this project since Monday, so I am a little tired.', maxChars: 180 },
  { level: 'B1', reply: 'If we leave now, we should arrive before the traffic gets worse.', maxChars: 180 },
  { level: 'B1', reply: 'That is a fair point, although I would check the figures first.', maxChars: 180 },
  { level: 'B1', reply: 'Could you explain what you mean by the second option?', maxChars: 180 },
  { level: 'B2', reply: 'The report suggests that demand has grown, but the support team is under pressure.', maxChars: 240 },
  { level: 'B2', reply: 'I would rather postpone the decision until we have more evidence.', maxChars: 240 },
  { level: 'B2', reply: 'Although the plan looks expensive, it may reduce costs over time.', maxChars: 240 },
  { level: 'B2', reply: 'What trade-offs did the team consider before choosing that approach?', maxChars: 240 },
  { level: 'C1', reply: 'The proposal is compelling, though the assumptions behind the forecast deserve scrutiny.', maxChars: 320 },
  { level: 'C1', reply: 'Had the team tested the prototype earlier, the flaw might have surfaced sooner.', maxChars: 320 },
  { level: 'C1', reply: 'I take your point, but the evidence does not quite support that conclusion.', maxChars: 320 },
  { level: 'C1', reply: 'Could you elaborate on how the policy would affect smaller providers?', maxChars: 320 },
];

function scenario(level: EvalCase['level']) {
  return {
    id: `eval-${level.toLowerCase()}`,
    title: 'Evaluation scenario',
    setting: 'A short conversation used for evaluation.',
    goal: 'Keep the conversation at the requested level.',
    learnerRole: 'Learner',
    tutorRole: 'Tutor',
    targetPhrases: ['Could you repeat that?'],
    openingLine: 'Hello! How can I help?',
  };
}

describe('conversation level eval set', () => {
  it('covers 20 recorded replies across A1-C1 with bounded length', () => {
    expect(CASES).toHaveLength(20);
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      expect(CASES.filter((entry) => entry.level === level).length).toBeGreaterThanOrEqual(4);
    }
    for (const entry of CASES) {
      const input = conversationTurnInputSchema.parse({
        targetLang: 'en',
        nativeLang: 'it',
        explanationMode: 'target_simple',
        proficiencyFramework: 'CEFR',
        level: entry.level,
        scenario: scenario(entry.level),
        recentTurns: [
          { role: 'learner', content: 'Hello.' },
          { role: 'tutor', content: 'Hi! How can I help?' },
        ],
        olderSummary: 'The learner introduced themselves.',
        learnerMessage: 'I would like to practise today.',
      });
      const output = conversationTurnOutputSchema.parse({ reply: entry.reply });
      const words = output.reply.split(/\s+/).filter(Boolean).length;
      expect(output.reply.length).toBeLessThanOrEqual(entry.maxChars);
      expect(words).toBeLessThanOrEqual(entry.level === 'A1' ? 12 : entry.level === 'A2' ? 18 : 40);
      expect(input.olderSummary).toContain('introduced');
    }
  });

  it('keeps a 10-turn conversation under the cost target', () => {
    const tokensIn = 10 * 1_200;
    const tokensOut = 10 * 240;
    const costUsd = estimateCostUsd('deepseek-chat', tokensIn, tokensOut);
    expect(costUsd).toBeLessThanOrEqual(0.1);
    expect(costUsd).toBeGreaterThan(0);
  });
});
