import type { AiGatewayError } from '@loqua/ai';

export function aiErrorStatus(code: AiGatewayError['code']): 400 | 402 | 502 {
  switch (code) {
    case 'unknown_prompt':
    case 'invalid_input':
      return 400;
    case 'budget_blocked':
      return 402;
    case 'provider_error':
    case 'schema_error':
      return 502;
  }
}
