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
  /** input wells, progress tracks, inactive chips */
  well: string;
  /** hairline borders — dark UI reads better with lines than shadows */
  line: string;
  /** stronger border, for focus and selection */
  lineStrong: string;

  text: string;
  textDim: string;
  textFaint: string;

  /** resting identity: fasted, precise, cold */
  accent: string;
  accentDim: string;
  /** 12% wash of accent, for selected chips and badges */
  accentWash: string;
  /** text colour that sits on a filled accent surface */
  onAccent: string;

  /** rationed: eating window open, meal due, the meal itself */
  ember: string;
  emberWash: string;

  /**
   * Domain hues.
   *
   * One accent for everything made the app read as a single grey instrument
   * with a teal light on it — every card the same weight, every icon the same
   * colour, nothing telling you which part of the product you were in.
   *
   * These are not decoration. Each area of the app owns one, so the colour is
   * a location: blue is water, violet is your body and what was measured from
   * it, green is food and the plan. Someone who has used the app for a week
   * knows where they are before reading a word — which is the same job the
   * ember does for eating, extended to the rest.
   *
   * Each carries a wash: a low-alpha tint used as a card surface, so a screen
   * is a set of distinguishable places rather than a stack of white boxes.
   */
  hydro: string;
  hydroWash: string;
  body: string;
  bodyWash: string;
  plan: string;
  planWash: string;

  positive: string;
  negative: string;

  /**
   * The one filled surface in the app: the countdown on Today.
   *
   * Everything else is a light card on a light ground, which is why the app
   * read as plain — the single thing looked at most was the same white box as
   * the shopping list. A filled block gives the screen an anchor and the
   * product a face.
   *
   * Scheme-aware on purpose rather than one colour dimmed: light mode needs a
   * saturated block to have any drama at all, while dark mode already has
   * drama and a bright teal slab would glare. Dark gets depth instead, and the
   * numerals carry the colour.
   */
  heroFill: string;
  onHero: string;
  /** Track and window drawn *on* the hero, where the page palette has no contrast. */
  heroTrack: string;

  /** the dial's untravelled track */
  dialTrack: string;
};

const dark: ThemePalette = {
  bg: '#0A0C10',
  surface: '#12161E',
  well: '#1A202B',
  line: '#222A36',
  lineStrong: '#33404F',

  text: '#ECEFF3',
  textDim: '#8D97A6',
  textFaint: '#5A6472',

  accent: '#6FD3E8',
  accentDim: '#3E8FA3',
  accentWash: 'rgba(111, 211, 232, 0.12)',
  onAccent: '#04141A',

  ember: '#FF8A4C',
  emberWash: 'rgba(255, 138, 76, 0.14)',

  hydro: '#5AA9FF',
  hydroWash: 'rgba(90, 169, 255, 0.13)',
  body: '#A78BFA',
  bodyWash: 'rgba(167, 139, 250, 0.13)',
  plan: '#8FDB6E',
  planWash: 'rgba(143, 219, 110, 0.13)',

  positive: '#5FD39B',
  negative: '#FF6B6B',

  heroFill: '#0B3A47',
  onHero: '#ECEFF3',
  heroTrack: 'rgba(236, 239, 243, 0.10)',

  dialTrack: '#1C232E',
};

const light: ThemePalette = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  well: '#EDF0F4',
  line: '#E0E5EC',
  lineStrong: '#C4CCD7',

  text: '#0C1017',
  textDim: '#5C6675',
  textFaint: '#8B95A3',

  // Darkened so contrast holds on white; same hue family as dark mode.
  accent: '#0E7A92',
  accentDim: '#4A93A5',
  accentWash: 'rgba(14, 122, 146, 0.13)',
  onAccent: '#FFFFFF',

  ember: '#C2500F',
  emberWash: 'rgba(194, 80, 15, 0.13)',

  // Darkened against white the same way the accent is: same hues as dark mode,
  // enough contrast to carry text and an icon on a tinted card.
  hydro: '#1F6FD0',
  hydroWash: 'rgba(31, 111, 208, 0.13)',
  body: '#6D4FD0',
  bodyWash: 'rgba(109, 79, 208, 0.13)',
  plan: '#3E8E3F',
  planWash: 'rgba(62, 142, 63, 0.13)',

  positive: '#12805A',
  negative: '#C0392B',

  heroFill: '#0B5F72',
  onHero: '#FFFFFF',
  heroTrack: 'rgba(255, 255, 255, 0.18)',

  dialTrack: '#E3E8EE',
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
