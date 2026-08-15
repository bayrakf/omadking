/**
 * Design tokens.
 *
 * Direction — "instrument panel for a 22-hour fast".
 *
 * The product's single fact is that the day is one enormous fast and one small
 * window. So the interface encodes physiological state in temperature rather
 * than decorating with it: the resting identity is cold (graphite, ice), and
 * `ember` is reserved for eating and its excess — the window being open, a meal
 * being due, the meal itself, and a day or a week that ran past its line.
 * Because ember is rationed, it means something when it shows up.
 *
 * Nothing else may be warm, and "nothing else" has teeth: a crown on the
 * paywall and a "best value" badge were both ember once, which spent the one
 * colour that means *eat now* on a sales badge. Decoration is exactly the use
 * this rule exists to refuse. If something warm is wanted and it is not about
 * eating, the answer is no.
 *
 * Three type roles, deliberately distinct:
 *   display (Archivo)        — numerals and titles; this app is mostly numbers
 *   body    (Hanken Grotesk) — prose, labels, buttons
 *   mono    (JetBrains Mono) — eyebrows, units, clock times. Tabular figures
 *                              stop the countdown jittering as digits change.
 */

import '@/global.css';
import { Platform } from 'react-native';

export type ThemePalette = {
  /** page background */
  bg: string;
  /** card / panel */
  surface: string;
  /** elevated card surface with extra pop */
  surfaceElevated: string;
  /** input wells, progress tracks, inactive chips */
  well: string;
  /** hairline borders */
  line: string;
  /** stronger border, for focus and selection */
  lineStrong: string;

  text: string;
  textDim: string;
  textFaint: string;

  /** vibrant teal/cyan accent */
  accent: string;
  accentDim: string;
  accentWash: string;
  onAccent: string;

  /** radiant flame / sunset: eating window, meal due, streak fire */
  ember: string;
  emberWash: string;

  /** Domain hues */
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

  /** Hero countdown block */
  heroFill: string;
  onHero: string;
  heroTrack: string;

  /** the dial's untravelled track */
  dialTrack: string;
};

export const PhaseColors = {
  sugarDrop: '#F59E0B',
  fatBurn: '#FF6B4A',
  ketosis: '#8B5CF6',
  autophagy: '#06B6D4',
  deepFast: '#10B981',
};

const dark: ThemePalette = {
  bg: '#080C14',
  surface: '#111827',
  surfaceElevated: '#172238',
  well: '#1A2438',
  line: '#24324B',
  lineStrong: '#3B4D6E',

  text: '#F8FAFC',
  textDim: '#94A3B8',
  textFaint: '#64748B',

  accent: '#38BDF8',
  accentDim: '#0284C7',
  accentWash: 'rgba(56, 189, 248, 0.18)',
  onAccent: '#031726',

  ember: '#FF6B4A',
  emberWash: 'rgba(255, 107, 74, 0.20)',

  hydro: '#38BDF8',
  hydroWash: 'rgba(56, 189, 248, 0.18)',
  body: '#A855F7',
  bodyWash: 'rgba(168, 85, 247, 0.18)',
  plan: '#34D399',
  planWash: 'rgba(52, 211, 153, 0.18)',
  gold: '#FBBF24',
  goldWash: 'rgba(251, 191, 36, 0.18)',

  positive: '#34D399',
  negative: '#F87171',

  heroFill: '#0C2A38',
  onHero: '#FFFFFF',
  heroTrack: 'rgba(255, 255, 255, 0.14)',

  dialTrack: '#1A2436',
};

const light: ThemePalette = {
  bg: '#F3F6FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  well: '#EBF1F7',
  line: '#E1E8F0',
  lineStrong: '#CBD5E1',

  text: '#0F172A',
  textDim: '#506179',
  textFaint: '#8797AB',

  accent: '#0284C7',
  accentDim: '#0369A1',
  accentWash: 'rgba(2, 132, 199, 0.14)',
  onAccent: '#FFFFFF',

  ember: '#EA580C',
  emberWash: 'rgba(234, 88, 12, 0.14)',

  hydro: '#0284C7',
  hydroWash: 'rgba(2, 132, 199, 0.14)',
  body: '#7C3AED',
  bodyWash: 'rgba(124, 58, 237, 0.14)',
  plan: '#059669',
  planWash: 'rgba(5, 150, 105, 0.14)',
  gold: '#D97706',
  goldWash: 'rgba(217, 119, 6, 0.14)',

  positive: '#059669',
  negative: '#DC2626',

  heroFill: '#075985',
  onHero: '#FFFFFF',
  heroTrack: 'rgba(255, 255, 255, 0.22)',

  dialTrack: '#E2E8F0',
};

export const Colors = { light, dark };

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

/** Family names must match the keys passed to useFonts() in the root layout. */
export const Font = {
  display: 'Archivo-Bold',
  displaySemi: 'Archivo-SemiBold',
  body: 'HankenGrotesk-Regular',
  bodyMedium: 'HankenGrotesk-Medium',
  bodySemi: 'HankenGrotesk-SemiBold',
  mono: 'JetBrainsMono-Medium',
} as const;

/**
 * Negative tracking on large display sizes only — it tightens headlines without
 * hurting small-text legibility.
 */
export const Type = {
  hero: { fontFamily: Font.display, fontSize: 56, lineHeight: 56, letterSpacing: -2 },
  display: { fontFamily: Font.display, fontSize: 40, lineHeight: 42, letterSpacing: -1.4 },
  title: { fontFamily: Font.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
  heading: { fontFamily: Font.displaySemi, fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
  subheading: { fontFamily: Font.bodySemi, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  body: { fontFamily: Font.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: Font.bodyMedium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: Font.body, fontSize: 13, lineHeight: 19 },
  /** Uppercase micro-labels. The instrument-panel voice. */
  eyebrow: { fontFamily: Font.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1.4 },
  /** Clock times, units, tabular data. */
  data: { fontFamily: Font.mono, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
} as const;

// ---------------------------------------------------------------------------
// Space, shape, motion
// ---------------------------------------------------------------------------

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
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const Motion = {
  /** Entrance of a single element. */
  enter: 420,
  /** Delay between staggered siblings. Small enough to read as one gesture. */
  stagger: 55,
  /** Press feedback. */
  press: 120,
  pressScale: 0.975,
} as const;

export const MaxContentWidth = 560;

/**
 * The column budget once there are two of them, and where two start.
 *
 * Below the breakpoint the app is a phone app and one column is correct. Above
 * it, a 560pt strip stranded in a 1600pt window is not restraint, it is a phone
 * app someone opened on a laptop — which is exactly how it read.
 *
 * Both numbers are derived rather than chosen, because the chosen ones were
 * wrong in a way that is easy to miss: at a 900pt breakpoint with a 1080pt
 * budget, crossing into two columns gave each card 422pt where the single
 * column had given it 520. The window got wider and every card got narrower.
 *
 * So the rule is stated instead: a column is never narrower than the one
 * column it replaces, which makes the budget two full content widths plus the
 * gutter between them, and the breakpoint the width at which that fits.
 */
export const MaxWideWidth = MaxContentWidth * 2 + Space.base;
export const Breakpoint = { wide: MaxWideWidth } as const;

/** Tab bar height + breathing room, so scroll views clear the floating bar. */
export const TabBarClearance = 108;

/** Web needs the font stack too, for any text rendered before RN styles apply. */
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});
