import { describe, expect, it } from 'vitest';

import {
  normalizeLanguageTag,
  resolveUiLocale,
  validateLanguageProfile,
} from '../src/language.js';

describe('language profile', () => {
  it('normalizes language tags', () => {
    expect(normalizeLanguageTag('EN-us')).toBe('en-US');
    expect(normalizeLanguageTag('it_it')).toBe('it-IT');
  });

  it('resolves unknown locales to the default', () => {
    expect(resolveUiLocale('fr-FR')).toBe('it');
    expect(resolveUiLocale('en-GB')).toBe('en');
    expect(resolveUiLocale(null)).toBe('it');
  });

  it('accepts a valid pair', () => {
    const result = validateLanguageProfile({ targetLang: 'en', nativeLang: 'it' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.targetLang).toBe('en');
  });

  it('rejects identical target and native languages', () => {
    const result = validateLanguageProfile({ targetLang: 'en', nativeLang: 'en' });
    expect(result.ok).toBe(false);
  });
});
