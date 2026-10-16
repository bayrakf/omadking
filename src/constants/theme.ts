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

/**
 * The metabolic phases, in the palette's own temperature.
 *
 * These were the Tailwind swatches — amber-500, violet-500, cyan-500 — which is
 * the same six colours every dashboard on the internet uses, at full chroma.
 * Five of them side by side on one bar is what made the screen read as a
 * framework rather than as a product. Same hue order, muted to sit together.
 */
export const PhaseColors = {
  sugarDrop: '#F59E0B',
  fatBurn: '#FF6B4A',
  ketosis: '#A855F7',
  autophagy: '#38BDF8',
  deepFast: '#10B981',
};

const dark: ThemePalette = {
  // Deep Titanium Carbon Ground: true athletic contrast, zero muddy gray
  bg: '#08090C',
  surface: '#11141A',
  surfaceElevated: '#171B23',
  well: '#0C0E13',
  line: 'rgba(255, 255, 255, 0.08)',
  lineStrong: 'rgba(255, 255, 255, 0.16)',

  text: '#F8FAFC',
  textDim: '#94A3B8',
  textFaint: '#475569',

  // High-Voltage Athletic Volt: electric energy, maximum legibility
  accent: '#D4FF00',
  accentDim: '#B2D900',
  accentWash: 'rgba(212, 255, 0, 0.12)',
  onAccent: '#08090C',

  // Solar Kinetic Flame (Eating window, streaks)
  ember: '#FF5500',
  emberWash: 'rgba(255, 85, 0, 0.14)',

  hydro: '#38BDF8',
  hydroWash: 'rgba(56, 189, 248, 0.12)',
  body: '#818CF8',
  bodyWash: 'rgba(129, 140, 248, 0.12)',
  plan: '#D4FF00',
  planWash: 'rgba(212, 255, 0, 0.12)',
  gold: '#F59E0B',
  goldWash: 'rgba(245, 158, 11, 0.14)',

  positive: '#10B981',
  negative: '#EF4444',

  heroFill: '#10131A',
  onHero: '#FFFFFF',
  heroTrack: 'rgba(255, 255, 255, 0.10)',

  dialTrack: '#161922',
};

const light: ThemePalette = {
  // Pure Clean Chalk ground
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  well: '#F1F5F9',
  line: '#E2E8F0',
  lineStrong: '#CBD5E1',

  text: '#0F172A',
  textDim: '#475569',
  textFaint: '#94A3B8',

  accent: '#15803D',
  accentDim: '#166534',
  accentWash: 'rgba(21, 128, 61, 0.10)',
  onAccent: '#FFFFFF',

  ember: '#EA580C',
  emberWash: 'rgba(234, 88, 12, 0.10)',

  hydro: '#0284C7',
  hydroWash: 'rgba(2, 132, 199, 0.10)',
  body: '#7C3AED',
  bodyWash: 'rgba(124, 58, 237, 0.10)',
  plan: '#15803D',
  planWash: 'rgba(21, 128, 61, 0.10)',
  gold: '#D97706',
  goldWash: 'rgba(217, 119, 6, 0.10)',

  positive: '#15803D',
  negative: '#DC2626',

  heroFill: '#0F172A',
  onHero: '#FFFFFF',
  heroTrack: 'rgba(255, 255, 255, 0.20)',

  dialTrack: '#E2E8F0',
};

export const Colors = { light, dark };

// ---------------------------------------------------------------------------
// Type: Athletic Display (Archivo) + Humanist Body (Hanken) + Tabular Mono (JetBrains)
// ---------------------------------------------------------------------------

export const Font = {
  display: 'Archivo-Bold',
  displaySemi: 'Archivo-SemiBold',
  body: 'HankenGrotesk-Regular',
  bodyMedium: 'HankenGrotesk-Medium',
  bodySemi: 'HankenGrotesk-SemiBold',
  mono: 'JetBrainsMono-Medium',
} as const;

export const Type = {
  hero: { fontFamily: Font.display, fontSize: 46, lineHeight: 50, letterSpacing: -1.2 },
  display: { fontFamily: Font.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
  title: { fontFamily: Font.display, fontSize: 23, lineHeight: 27, letterSpacing: -0.5 },
  heading: { fontFamily: Font.displaySemi, fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
  subheading: { fontFamily: Font.bodySemi, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  body: { fontFamily: Font.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: Font.bodyMedium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: Font.body, fontSize: 13, lineHeight: 18 },
  /** Uppercase micro-labels with athletic tracking */
  eyebrow: { fontFamily: Font.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1.2 },
  /** Tabular figures, units, clock times */
  data: { fontFamily: Font.mono, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
} as const;

// ---------------------------------------------------------------------------
// Space, shape, motion — Precision Architectural Geometry (Not Bubbly Slop)
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  lifted: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
} as const;

export const Motion = {
  /** Entrance of a single element. */
  enter: 380,
  /** Delay between staggered siblings. Small enough to read as one gesture. */
  stagger: 45,
  /** Press feedback. */
  press: 100,
  pressScale: 0.97,
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
