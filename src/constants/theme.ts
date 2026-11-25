/**
 * OMADCoach design tokens — Precision Metabolic Telemetry.
 *
 * Dual-polarity system (DESIGN.md):
 *   - Obsidian Carbon (dark): #090B0E canvas, crisp hairlines, #C9F233 volt accent
 *   - Alabaster Paper (light): #F5F4EF warm paper, crisp white surfaces, #157A3D emerald
 *
 * `ember` is strictly rationed across the product: eating window open, meal due,
 * excess intake, and streak fire (`CLAUDE.md` Voice rule).
 * Both polarities guarantee >= 4.5:1 text contrast and prohibit dark card islands
 * stranded inside light mode.
 */

import { Platform, type TextStyle } from 'react-native';
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
  sugarDrop: '#F59E0B',
  fatBurn: '#FF642E',
  ketosis: '#A855F7',
  autophagy: '#38BDF8',
  deepFast: '#22C55E',
} as const;

const dark: ThemePalette = {
  bg: '#090B0E',
  surface: '#11141A',
  surfaceElevated: '#171B23',
  well: '#0C0F14',
  line: 'rgba(241, 245, 249, 0.08)',
  lineStrong: 'rgba(241, 245, 249, 0.17)',

  text: '#F3F5F8',
  textDim: '#9CA5B4',
  textFaint: '#737E90',

  accent: '#C9F233',
  accentDim: '#A8CE23',
  accentWash: 'rgba(201, 242, 51, 0.12)',
  onAccent: '#090B0E',

  ember: '#FF642E',
  emberWash: 'rgba(255, 100, 46, 0.13)',
  onEmber: '#090B0E',

  hydro: '#38BDF8',
  hydroWash: 'rgba(56, 189, 248, 0.12)',
  body: '#A78BFA',
  bodyWash: 'rgba(167, 139, 250, 0.12)',
  plan: '#22C55E',
  planWash: 'rgba(34, 197, 94, 0.12)',
  gold: '#F59E0B',
  goldWash: 'rgba(245, 158, 11, 0.12)',

  positive: '#22C55E',
  negative: '#EF4444',

  heroFill: '#131720',
  onHero: '#F3F5F8',
  heroTrack: 'rgba(241, 245, 249, 0.10)',

  dialTrack: 'rgba(241, 245, 249, 0.10)',
};

const light: ThemePalette = {
  bg: '#F5F4EF',
  surface: '#FFFFFF',
  surfaceElevated: '#ECEAE2',
  well: '#E6E3DA',
  line: 'rgba(17, 19, 23, 0.08)',
  lineStrong: 'rgba(17, 19, 23, 0.17)',

  text: '#111317',
  textDim: '#4A5260',
  textFaint: '#616B7A',

  accent: '#157A3D',
  accentDim: '#116332',
  accentWash: 'rgba(21, 122, 61, 0.10)',
  onAccent: '#FFFFFF',

  ember: '#C2410C',
  emberWash: 'rgba(194, 65, 12, 0.10)',
  onEmber: '#FFFFFF',

  hydro: '#0369A1',
  hydroWash: 'rgba(3, 105, 161, 0.10)',
  body: '#6D28D9',
  bodyWash: 'rgba(109, 40, 217, 0.09)',
  plan: '#15803D',
  planWash: 'rgba(21, 128, 61, 0.10)',
  gold: '#B45309',
  goldWash: 'rgba(180, 83, 9, 0.10)',

  positive: '#15803D',
  negative: '#DC2626',

  heroFill: '#FFFFFF',
  onHero: '#111317',
  heroTrack: 'rgba(17, 19, 23, 0.09)',

  dialTrack: 'rgba(17, 19, 23, 0.09)',
};

export const Colors = { light, dark };

export const Font = {
  display: 'Archivo-Bold',
  displaySemi: 'Archivo-SemiBold',
  body: 'HankenGrotesk-Regular',
  bodyMedium: 'HankenGrotesk-Medium',
  bodySemi: 'HankenGrotesk-SemiBold',
  sans: 'HankenGrotesk-Regular',
  mono: 'JetBrainsMono-Medium',
} as const;

export const Type: Record<
  'hero' | 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'bodyMedium' | 'small' | 'eyebrow' | 'data',
  TextStyle
> = {
  hero: { fontFamily: Font.display, fontSize: 44, lineHeight: 48, letterSpacing: -1.4 },
  display: { fontFamily: Font.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.9 },
  title: { fontFamily: Font.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.6 },
  heading: { fontFamily: Font.displaySemi, fontSize: 18, lineHeight: 23, letterSpacing: -0.3 },
  subheading: { fontFamily: Font.bodySemi, fontSize: 15, lineHeight: 21, letterSpacing: -0.15 },
  body: { fontFamily: Font.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: Font.bodyMedium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: Font.body, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: Font.mono, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.1 },
  data: {
    fontFamily: Font.mono,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
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
  hero: 56,
} as const;

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
  full: 999,
} as const;

export const Shadow = {
  card: Platform.select({
    web: { boxShadow: '0 1px 3px rgba(9, 11, 14, 0.05), 0 6px 20px rgba(9, 11, 14, 0.03)' } as any,
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  }),
  lifted: Platform.select({
    web: { boxShadow: '0 8px 28px rgba(9, 11, 14, 0.14)' } as any,
    default: {
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  }),
};

export const Motion = {
  enter: 160,
  fast: 140,
  base: 220,
  stagger: 35,
  press: 100,
  pressScale: 0.98,
} as const;

export const MaxContentWidth = 560;
export const MaxWideWidth = 1000;
export const Breakpoint = { wide: 840 } as const;

/** Tab bar height + breathing room on mobile viewports so bottom cards are never clipped. */
export const TabBarClearance = 124;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "'Hanken Grotesk', system-ui, -apple-system, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'Hanken Grotesk', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
});
