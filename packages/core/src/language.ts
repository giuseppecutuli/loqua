export const SUPPORTED_UI_LOCALES = ['it', 'en'] as const;

export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

export const DEFAULT_UI_LOCALE: UiLocale = 'it';
export const DEFAULT_TARGET_LANG = 'en';
export const DEFAULT_NATIVE_LANG = 'it';

export const EXPLANATION_MODES = ['target_simple', 'native'] as const;
export type ExplanationMode = (typeof EXPLANATION_MODES)[number];

export const DEFAULT_EXPLANATION_MODE: ExplanationMode = 'target_simple';
export const DEFAULT_PROFICIENCY_FRAMEWORK = 'CEFR';

export interface LanguageProfile {
  readonly targetLang: string;
  readonly nativeLang: string;
  readonly uiLocale: UiLocale;
  readonly explanationMode: ExplanationMode;
  readonly proficiencyFramework: string;
}

export const DEFAULT_LANGUAGE_PROFILE: LanguageProfile = {
  targetLang: DEFAULT_TARGET_LANG,
  nativeLang: DEFAULT_NATIVE_LANG,
  uiLocale: DEFAULT_UI_LOCALE,
  explanationMode: DEFAULT_EXPLANATION_MODE,
  proficiencyFramework: DEFAULT_PROFICIENCY_FRAMEWORK,
};

const LANGUAGE_TAG = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/;

export function isLanguageTag(value: unknown): value is string {
  return typeof value === 'string' && LANGUAGE_TAG.test(value);
}

export function normalizeLanguageTag(tag: string): string {
  const [language = '', ...rest] = tag.trim().replaceAll('_', '-').split('-');
  const normalizedRest = rest.map((part) => {
    if (part.length === 2) return part.toUpperCase();
    if (part.length === 3 && /^[A-Za-z]+$/.test(part)) {
      return `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`;
    }
    return part;
  });
  return [language.toLowerCase(), ...normalizedRest].join('-');
}

export function isSupportedUiLocale(value: unknown): value is UiLocale {
  return typeof value === 'string' && (SUPPORTED_UI_LOCALES as readonly string[]).includes(value);
}

export function resolveUiLocale(requested: string | null | undefined): UiLocale {
  if (!requested) return DEFAULT_UI_LOCALE;
  const primary = normalizeLanguageTag(requested).split('-')[0];
  return isSupportedUiLocale(primary) ? primary : DEFAULT_UI_LOCALE;
}

export function isExplanationMode(value: unknown): value is ExplanationMode {
  return typeof value === 'string' && (EXPLANATION_MODES as readonly string[]).includes(value);
}

export function validateLanguageProfile(
  input: Partial<LanguageProfile>,
): { readonly ok: true; readonly value: LanguageProfile } | { readonly ok: false; readonly errors: string[] } {
  const errors: string[] = [];
  const targetLang = input.targetLang ?? DEFAULT_LANGUAGE_PROFILE.targetLang;
  const nativeLang = input.nativeLang ?? DEFAULT_LANGUAGE_PROFILE.nativeLang;

  if (!isLanguageTag(targetLang)) errors.push('target_lang_invalid');
  if (!isLanguageTag(nativeLang)) errors.push('native_lang_invalid');
  if (targetLang === nativeLang) errors.push('target_native_same');
  if (!isSupportedUiLocale(input.uiLocale ?? DEFAULT_LANGUAGE_PROFILE.uiLocale)) {
    errors.push('ui_locale_unsupported');
  }
  if (!isExplanationMode(input.explanationMode ?? DEFAULT_LANGUAGE_PROFILE.explanationMode)) {
    errors.push('explanation_mode_invalid');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      targetLang: normalizeLanguageTag(targetLang),
      nativeLang: normalizeLanguageTag(nativeLang),
      uiLocale: resolveUiLocale(input.uiLocale ?? DEFAULT_LANGUAGE_PROFILE.uiLocale),
      explanationMode: input.explanationMode ?? DEFAULT_LANGUAGE_PROFILE.explanationMode,
      proficiencyFramework:
        input.proficiencyFramework ?? DEFAULT_LANGUAGE_PROFILE.proficiencyFramework,
    },
  };
}
