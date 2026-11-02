export const colors = {
  background: '#F7F5F0',
  surface: '#FFFFFF',
  surfaceMuted: '#EFEAE0',
  text: '#1F2933',
  textMuted: '#52606D',
  primary: '#1F6F5C',
  primaryPressed: '#175846',
  primaryContrast: '#FFFFFF',
  accent: '#D97706',
  success: '#2F855A',
  warning: '#B45309',
  danger: '#B91C1C',
  border: '#D9D2C5',
  overlay: 'rgba(31, 41, 51, 0.45)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
} as const;

export const layout = {
  minTouchTarget: 44,
  maxContentWidth: 680,
  tabBarHeight: 56,
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type TypographyToken = keyof typeof typography;
