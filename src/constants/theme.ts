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

  positive: string;
  negative: string;

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

  positive: '#5FD39B',
  negative: '#FF6B6B',

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
  accentWash: 'rgba(14, 122, 146, 0.10)',
  onAccent: '#FFFFFF',

  ember: '#C2500F',
  emberWash: 'rgba(194, 80, 15, 0.10)',

  positive: '#12805A',
  negative: '#C0392B',

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
