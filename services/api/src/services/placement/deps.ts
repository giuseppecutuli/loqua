import type { AiGateway } from '@loqua/ai';

import type { AccountRepository } from '../../repos/account.js';
import type { AssessmentStore } from '../../repos/assessment.js';

export interface PlacementRoutesDeps {
  readonly ai: AiGateway;
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly transcribe?: (
    audio: Uint8Array,
    languageCode?: string,
  ) => Promise<{ text: string; durationSec: number; languageCode: string | null }>;
  readonly now: () => Date;
}
