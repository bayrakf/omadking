/**
 * OMADCoach Design Tokens — Mobile-First Human Utility (no-slop-ui + apple-design).
 *
 * Charcoal Studio (dark) & iOS System Grouped (light) palettes.
 * Eliminates neon acid-green / warm cream / ALL-CAPS monospace clichés in favor of
 * crisp system typography, 8–12px grouped surfaces, hairline separators, and calm
 * accessible contrast (>= 4.5:1 across body and secondary inks).
 *
 * `ember` remains strictly rationed: eating window open, meal due, surplus, streak.
 */

import { Platform, StyleSheet, type TextStyle } from 'react-native';
import '@/global.css';

export type ThemePalette = {
  bg: string;
  surface: string;
  surfaceElevated: string;
  well: string;
  line: string;
  lineStrong: string;

  text: string;
  textDim: string;
  textFaint: string;

  accent: string;
  accentDim: string;
  accentWash: string;
  onAccent: string;

  ember: string;
  emberWash: string;
  onEmber: string;

  hydro: string;
  hydroWash: string;
  body: string;
  bodyWash: string;
  plan: string;
  planWash: string;
  gold: string;
  goldWash: string;

  positive: string;
  negative: string;

  heroFill: string;
  onHero: string;
  heroTrack: string;

  dialTrack: string;
};

export const PhaseColors = {
  sugarDrop: '#FF9F0A',
  fatBurn: '#FF6B35',
  ketosis: '#5E5CE6',
  autophagy: '#0A84FF',
  deepFast: '#30D158',
} as const;

const dark: ThemePalette = {
  bg: '#0E0F12',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  well: '#242426',
  line: 'rgba(255, 255, 255, 0.10)',
  lineStrong: 'rgba(255, 255, 255, 0.22)',

  text: '#F5F5F7',
  textDim: '#AEAEB2',
  textFaint: '#8E8E93',

  accent: '#0A84FF',
  accentDim: '#0066CC',
  accentWash: 'rgba(10, 132, 255, 0.14)',
  onAccent: '#FFFFFF',

  ember: '#FF6B35',
  emberWash: 'rgba(255, 107, 53, 0.14)',
  onEmber: '#0E0F12',

  hydro: '#38BDF8',
  hydroWash: 'rgba(56, 189, 248, 0.14)',
  body: '#818CF8',
  bodyWash: 'rgba(129, 140, 248, 0.14)',
  plan: '#30D158',
  planWash: 'rgba(48, 209, 88, 0.14)',
  gold: '#FF9F0A',
  goldWash: 'rgba(255, 159, 10, 0.14)',

  positive: '#30D158',
  negative: '#FF453A',

  heroFill: '#1C1C1E',
  onHero: '#F5F5F7',
  heroTrack: 'rgba(255, 255, 255, 0.10)',

  dialTrack: 'rgba(255, 255, 255, 0.12)',
};

const light: ThemePalette = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#E9E9EE',
  well: '#E5E5EA',
  line: 'rgba(60, 60, 67, 0.12)',
  lineStrong: 'rgba(60, 60, 67, 0.24)',

  text: '#1C1C1E',
  textDim: '#52525B',
  textFaint: '#6C6C70',

  accent: '#0066CC',
  accentDim: '#004F9E',
  accentWash: 'rgba(0, 102, 204, 0.10)',
  onAccent: '#FFFFFF',

  ember: '#C2410C',
  emberWash: 'rgba(194, 65, 12, 0.10)',
  onEmber: '#FFFFFF',

  hydro: '#0284C7',
  hydroWash: 'rgba(2, 132, 199, 0.10)',
  body: '#5E5CE6',
  bodyWash: 'rgba(94, 92, 230, 0.10)',
  plan: '#15803D',
  planWash: 'rgba(21, 128, 61, 0.10)',
  gold: '#B45309',
  goldWash: 'rgba(180, 83, 9, 0.10)',

  positive: '#15803D',
  negative: '#D70015',

  heroFill: '#FFFFFF',
  onHero: '#1C1C1E',
  heroTrack: 'rgba(60, 60, 67, 0.09)',

  dialTrack: 'rgba(60, 60, 67, 0.10)',
};

export const Colors = { light, dark };

const UI_SANS = Platform.select({
  web: "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
  default: 'System',
});

export const Font = {
  display: UI_SANS,
  displaySemi: UI_SANS,
  body: UI_SANS,
  bodyMedium: UI_SANS,
  bodySemi: UI_SANS,
  sans: UI_SANS,
  mono: Platform.select({
    web: "ui-monospace, SFMono-Regular, Menlo, monospace",
    default: 'monospace',
  }),
} as const;

export const Type: Record<
  'hero' | 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyMedium' | 'small' | 'eyebrow' | 'data',
  TextStyle
> = {
  hero: { fontFamily: UI_SANS, fontSize: 42, lineHeight: 46, fontWeight: '700', letterSpacing: -1.0 },
  display: { fontFamily: UI_SANS, fontSize: 30, lineHeight: 35, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontFamily: UI_SANS, fontSize: 24, lineHeight: 29, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontFamily: UI_SANS, fontSize: 18, lineHeight: 23, fontWeight: '600', letterSpacing: -0.25 },
  subheading: { fontFamily: UI_SANS, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontFamily: UI_SANS, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyMedium: { fontFamily: UI_SANS, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  small: { fontFamily: UI_SANS, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  eyebrow: { fontFamily: UI_SANS, fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0 },
  data: {
    fontFamily: UI_SANS,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
};

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  section: 40,
  hero: 48,
} as const;

export const Radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  pill: 999,
  full: 999,
} as const;

export const Shadow = {
  card: Platform.select({
    web: { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)' } as any,
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
  }),
  lifted: Platform.select({
    web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' } as any,
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  }),
};

export const Motion = {
  enter: 120,
  fast: 100,
  base: 160,
  stagger: 0,
  press: 100,
  pressScale: 0.97,
} as const;

export const MaxContentWidth = 500;
export const MaxWideWidth = 680;
export const Breakpoint = { wide: 960 } as const;

/** Docked native tab bar sits in layout flow so scroll content only needs clean breathing room. */
export const TabBarClearance = 24;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
    mono: "ui-monospace, SFMono-Regular, monospace",
  },
});

export const Hairline = StyleSheet.hairlineWidth;
