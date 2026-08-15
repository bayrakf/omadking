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
  sugarDrop: '#C9922F',
  fatBurn: '#C4552A',
  ketosis: '#7A5480',
  autophagy: '#37789A',
  deepFast: '#5B7A4B',
};
const dark: ThemePalette = {
  // Warm charcoal, not blue-black. The cold greys read as a framework default
  // because they are one; a ground with a little brown in it reads as chosen.
  bg: '#14110E',
  surface: '#1D1915',
  surfaceElevated: '#252019',
  well: '#292219',
  line: '#332B22',
  lineStrong: '#4A4034',

  text: '#F6F0E7',
  textDim: '#A99C8C',
  textFaint: '#7A6E60',

  accent: '#6FB3D2',
  accentDim: '#3F7B94',
  accentWash: 'rgba(111, 179, 210, 0.16)',
  onAccent: '#0B1A21',

  ember: '#E8834F',
  emberWash: 'rgba(232, 131, 79, 0.18)',

  hydro: '#7CBEDD',
  hydroWash: 'rgba(124, 190, 221, 0.16)',
  body: '#C4A0CB',
  bodyWash: 'rgba(196, 160, 203, 0.16)',
  plan: '#9DC482',
  planWash: 'rgba(157, 196, 130, 0.16)',
  gold: '#E0B25C',
  goldWash: 'rgba(224, 178, 92, 0.16)',

  positive: '#9DC482',
  negative: '#E08267',

  heroFill: '#20303A',
  onHero: '#F6F0E7',
  heroTrack: 'rgba(246, 240, 231, 0.14)',

  dialTrack: '#241E17',
};

const light: ThemePalette = {
  // Sand rather than slate. This is the single change that takes the most
  // "software" out of the screen: a warm ground makes every card on it read as
  // paper instead of as a panel.
  bg: '#F5F0E8',
  surface: '#FFFCF7',
  surfaceElevated: '#FFFFFF',
  well: '#EEE6DA',
  line: '#E3D8C9',
  lineStrong: '#C9BAA6',

  text: '#1E1913',
  textDim: '#6B6055',
  textFaint: '#9A8D7E',

  accent: '#2F6D8C',
  accentDim: '#4F8AA6',
  accentWash: 'rgba(47, 109, 140, 0.11)',
  onAccent: '#FFFFFF',

  ember: '#C4552A',
  emberWash: 'rgba(196, 85, 42, 0.12)',

  hydro: '#37789A',
  hydroWash: 'rgba(55, 120, 154, 0.11)',
  body: '#7A5480',
  bodyWash: 'rgba(122, 84, 128, 0.11)',
  plan: '#5B7A4B',
  planWash: 'rgba(91, 122, 75, 0.12)',
  gold: '#A8762B',
  goldWash: 'rgba(168, 118, 43, 0.12)',

  positive: '#4E7A54',
  negative: '#A8462F',

  heroFill: '#25505F',
  onHero: '#FFFCF7',
  heroTrack: 'rgba(255, 252, 247, 0.20)',

  dialTrack: '#E6DCCC',
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

/**
 * Corners, generous on purpose.
 *
 * A 14pt radius on a 340pt card is a rectangle that has been told to be
 * slightly polite about it — the eye still reads a box. The size where a corner
 * stops being a detail and starts being the shape of the thing is around 24,
 * which is where every app that gets called "soft" sits.
 */
export const Radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

/**
 * Depth instead of outlines.
 *
 * Every panel was drawn with a hairline, which is the cheapest way to say
 * "this is a container" and also the most mechanical: a 1px rule is a drawing
 * instruction, and forty of them on a screen is a wireframe. A soft shadow
 * says the same thing the way paper does.
 *
 * Kept low and wide rather than tight and dark — a tight shadow reads as a
 * button pressed into the page, a wide one reads as a card resting on it. On
 * the dark scheme shadows are nearly invisible, which is why the surfaces
 * there are separated by lightness instead, and `surfaceElevated` exists.
 */
export const Shadow = {
  card: {
    shadowColor: '#2B1F12',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  lifted: {
    shadowColor: '#2B1F12',
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
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
