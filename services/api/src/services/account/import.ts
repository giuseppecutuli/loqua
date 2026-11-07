import {
  consentRecordSchema,
  generateUuidV7,
  learnerProfileSchema,
  type ExportEnvelope,
  type LearnerProfile,
} from '@loqua/core';
import type { AccountStore } from '@loqua/db-postgres';

export interface ImportAccountInput {
  readonly account: AccountStore;
  readonly userId: string;
  readonly envelope: ExportEnvelope;
  readonly now: Date;
}

export type ImportAccountResult =
  | {
      readonly ok: true;
      readonly imported: {
        readonly profile: number;
        readonly consents: number;
        readonly settings: number;
      };
    }
  | { readonly ok: false; readonly message: string };

export async function importAccount(input: ImportAccountInput): Promise<ImportAccountResult> {
  const snapshot = await input.account.getSnapshot(input.userId);
  const existingProfile = snapshot.profile;
  const existingConsents = new Map(
    snapshot.consents.map((consent) => [`${consent.kind}@${consent.version}`, consent]),
  );

  let profile: LearnerProfile | null = null;
  if (input.envelope.profile) {
    const validated = learnerProfileSchema.safeParse({
      ...input.envelope.profile,
      id: existingProfile?.id ?? generateUuidV7(),
      userId: input.userId,
      createdAt: existingProfile?.createdAt ?? input.envelope.profile.createdAt,
    });
    if (!validated.success) return { ok: false, message: 'Profile in export is invalid' };
    profile = validated.data;
    await input.account.upsertProfile(profile);
  }

  const consents = input.envelope.consents.flatMap((consent) => {
    const current = existingConsents.get(`${consent.kind}@${consent.version}`);
    const validated = consentRecordSchema.safeParse({
      ...consent,
      id: current?.id ?? generateUuidV7(),
      userId: input.userId,
      createdAt: current?.createdAt ?? consent.createdAt,
    });
    return validated.success ? [validated.data] : [];
  });
  if (consents.length !== input.envelope.consents.length) {
    return { ok: false, message: 'Consents in export are invalid' };
  }
  await input.account.upsertConsents(consents);

  if (input.envelope.settings) {
    await input.account.upsertSettings({
      userId: input.userId,
      notificationPrefs: input.envelope.settings.notificationPrefs,
      now: input.now,
    });
  }

  return {
    ok: true,
    imported: {
      profile: profile ? 1 : 0,
      consents: consents.length,
      settings: input.envelope.settings ? 1 : 0,
    },
  };
}
