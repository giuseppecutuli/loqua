import type {
  AssessmentItem,
  SessionBlockKind,
  SessionItemView,
  SessionView,
} from '@loqua/core';

import { toPublicItem } from '../../items.js';
import type { SessionItemRecord, SessionRecord } from '../../repos/session.js';

function narrowBlock(value: SessionItemRecord['block']): SessionBlockKind | null {
  switch (value) {
    case 'review':
    case 'input':
    case 'production':
      return value;
    default:
      return null;
  }
}

export function currentView(
  session: SessionRecord,
  items: readonly SessionItemRecord[],
  itemsById: ReadonlyMap<string, AssessmentItem>,
): SessionView {
  const answered = items.filter((item) => item.status === 'answered').length;
  const pending = items.find((item) => item.status === 'pending');
  const item = pending ? itemsById.get(pending.itemId) : undefined;
  const block = pending ? narrowBlock(pending.block) : null;
  const current: SessionItemView | null =
    pending && item && block
      ? {
          id: pending.id,
          itemId: pending.itemId,
          block,
          rationale: pending.rationaleCode,
          status: pending.status,
          item: toPublicItem(item),
        }
      : null;
  return {
    id: session.id,
    status: session.status,
    total: items.length,
    answered,
    current,
  };
}
