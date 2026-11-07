import { it, type Catalogs, type TranslationKey } from './catalog.js';
import { en } from './en.js';

export const CATALOGS: Catalogs = { it, en };

export const PSEUDO_LOCALE = 'en-XA' as const;

export type Locale = keyof Catalogs | typeof PSEUDO_LOCALE;
export type TranslationParams = Record<string, string | number>;

const LOCALE_TAGS: Record<Locale, string> = {
  it: 'it-IT',
  en: 'en-US',
  'en-XA': 'en-US',
};

const PSEUDO_MAP: Record<string, string> = {
  a: 'á',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ğ',
  h: 'ħ',
  i: 'í',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ó',
  p: 'þ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'ú',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'Á',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  F: 'Ƒ',
  G: 'Ğ',
  H: 'Ħ',
  I: 'Í',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ó',
  P: 'Þ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Ú',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

/**
 * Pseudo-localization keeps balanced `{...}` placeholders intact while
 * accenting the surrounding text, so missing layout space and broken
 * interpolation show up in the pseudo locale build.
 */
export function pseudoLocalize(message: string): string {
  let output = '';
  let depth = 0;
  for (const character of message) {
    if (character === '{') depth += 1;
    if (depth > 0) {
      output += character;
      if (character === '}') depth -= 1;
      continue;
    }
    output += PSEUDO_MAP[character] ?? character;
  }
  return `⟦${output}⟧`;
}

function formatPlural(message: string, params: TranslationParams, locale: Locale): string {
  const pluralPattern = /\{(\w+),\s*plural,\s*((?:\w+\s*\{[^{}]*\}\s*)+)\}/g;
  return message.replace(pluralPattern, (match, rawName: string, variants: string) => {
    const value = params[rawName];
    if (typeof value !== 'number') return match;
    const selected = new Intl.PluralRules(LOCALE_TAGS[locale]).select(value);
    const variantPattern = /(\w+)\s*\{([^{}]*)\}/g;
    const choices = new Map<string, string>();
    for (const variant of variants.matchAll(variantPattern)) {
      if (variant[1] && variant[2] !== undefined) choices.set(variant[1], variant[2]);
    }
    const template = choices.get(selected) ?? choices.get('other') ?? '';
    return template.replaceAll('#', String(value));
  });
}

function formatSimple(message: string, params: TranslationParams): string {
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function formatMessage(
  message: string,
  params: TranslationParams = {},
  locale: Locale = 'it',
): string {
  return formatSimple(formatPlural(message, params, locale), params);
}

export interface Translator {
  (key: TranslationKey, params?: TranslationParams): string;
  readonly locale: Locale;
  t(key: TranslationKey, params?: TranslationParams): string;
  formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
}

export interface TranslatorCatalogs {
  readonly it?: Record<string, string>;
  readonly en: Record<string, string>;
}

export function createTranslator(
  locale: string,
  catalogs: TranslatorCatalogs = CATALOGS,
): Translator {
  const active: Locale = locale === 'en' ? 'en' : locale === PSEUDO_LOCALE ? PSEUDO_LOCALE : 'it';
  const base = active === 'it' ? 'it' : 'en';
  const primary = catalogs[base] ?? catalogs.en;
  const fallback = catalogs.en;

  const t = (key: TranslationKey, params: TranslationParams = {}): string => {
    const message = primary[key] ?? fallback[key] ?? key;
    const formatted = formatMessage(message, params, base);
    return active === PSEUDO_LOCALE ? pseudoLocalize(formatted) : formatted;
  };

  return Object.assign(t, {
    locale: active,
    t,
    formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
      return new Intl.DateTimeFormat(LOCALE_TAGS[active], options).format(value);
    },
    formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
      return new Intl.NumberFormat(LOCALE_TAGS[active], options).format(value);
    },
  });
}

export function catalogKeyParity(
  primary: Record<string, string>,
  fallback: Record<string, string>,
): string[] {
  const primaryKeys = Object.keys(primary);
  const fallbackKeys = Object.keys(fallback);
  return [
    ...primaryKeys.filter((key) => !(key in fallback)),
    ...fallbackKeys.filter((key) => !(key in primary)),
  ];
}
