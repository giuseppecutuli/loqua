import { describe, expect, it } from 'vitest';

import { it as italian } from './catalog.js';
import { en } from './en.js';
import {
  CATALOGS,
  PSEUDO_LOCALE,
  catalogKeyParity,
  createTranslator,
  formatMessage,
  pseudoLocalize,
} from './translate.js';

describe('i18n catalogs', () => {
  it('has key parity between Italian and English', () => {
    expect(catalogKeyParity(italian, en)).toEqual([]);
  });

  it('defaults to Italian and supports English', () => {
    expect(createTranslator('it').t('nav.today')).toBe('Oggi');
    expect(createTranslator('en').t('nav.today')).toBe('Today');
    expect(createTranslator('fr').locale).toBe('it');
  });

  it('falls back to English for a missing Italian key', () => {
    const partial: Record<string, string> = { ...italian };
    delete partial['nav.today'];
    const translator = createTranslator('it', { it: partial, en });
    expect(translator.t('nav.today')).toBe('Today');
  });

  it('formats ICU plurals with Intl.PluralRules', () => {
    expect(formatMessage(CATALOGS.it['common.minutes'], { count: 1 }, 'it')).toBe('1 minuto');
    expect(formatMessage(CATALOGS.it['common.minutes'], { count: 5 }, 'it')).toBe('5 minuti');
    expect(formatMessage(CATALOGS.en['common.minutes'], { count: 1 }, 'en')).toBe('1 minute');
  });

  it('interpolates simple parameters', () => {
    const translator = createTranslator('it');
    expect(translator.t('onboarding.progress', { current: 2, total: 4 })).toBe('Passo 2 di 4');
  });

  it('keeps placeholders intact in the pseudo locale', () => {
    expect(pseudoLocalize('Hello {name}')).toBe('⟦Ħéļļó {name}⟧');
    const translator = createTranslator(PSEUDO_LOCALE);
    expect(translator.locale).toBe(PSEUDO_LOCALE);
    expect(translator.t('onboarding.progress', { current: 2, total: 4 })).toBe('⟦Šţéþ 2 óƒ 4⟧');
  });

  it('pseudo-localizes a message with an ICU plural', () => {
    const message = CATALOGS.en['common.minutes'];
    const formatted = formatMessage(message, { count: 1 }, 'en');
    const pseudo = pseudoLocalize(formatted);
    expect(pseudo).toContain('1');
    expect(pseudo.startsWith('⟦')).toBe(true);
    expect(pseudo.endsWith('⟧')).toBe(true);
  });

  it('formats dates and numbers by locale', () => {
    const italianTranslator = createTranslator('it');
    const english = createTranslator('en');
    expect(italianTranslator.formatNumber(1234.5)).not.toBe(english.formatNumber(1234.5));
    expect(
      italianTranslator.formatDate(new Date('2026-11-01T00:00:00.000Z'), { dateStyle: 'long' }),
    ).toContain('2026');
  });
});
