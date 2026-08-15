/**
 * Shared primitives. Every screen composes these rather than restyling from
 * scratch, which is what keeps nine screens looking like one product.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  useWindowDimensions,
  PixelRatio,
  Dimensions,
  View,
  Text,
  Pressable,
  Animated,
  ScrollView,
  StyleSheet,
  useColorScheme,
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { clampFontScale, scaleType } from '@/lib/typography';
import {
  Colors, Type, Space, Radius, Motion, Font, MaxContentWidth, MaxWideWidth, Breakpoint,
  TabBarClearance, type ThemePalette,
} from '@/constants/theme';
import { parseMarkdown, plainText, type Block, type Span } from '@/lib/markdown';
import { Icon, type IconName } from './icons';

export function useTheme(): ThemePalette {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

/** Honours the OS "reduce motion" setting; entrances become instant. */
/** The system font setting, clamped by src/lib/typography. */
export function useFontScale(): number {
  const [scale, setScale] = React.useState(() => clampFontScale(PixelRatio.getFontScale()));

  React.useEffect(() => {
    // The setting can change while the app is open.
    const sub = Dimensions.addEventListener('change', () =>
      setScale(clampFontScale(PixelRatio.getFontScale()))
    );
    return () => sub.remove();
  }, []);

  return scale;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => alive && setReduced(!!v));
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/**
 * Staggered fade + rise. One orchestrated entrance per screen reads as a single
 * gesture; the same effect scattered across unrelated elements reads as noise.
 */
export function Enter({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      return;
    }
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: Motion.enter,
      delay: index * Motion.stagger,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [index, reduced, t]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Whether this viewport has room for two columns.
 *
 * A hook rather than a media query because the layout has to work on native
 * too — a tablet in landscape is the same situation as a laptop, and RN has no
 * CSS to ask.
 */
export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= Breakpoint.wide;
}

/** Page shell: safe area, centred column, clearance for the floating tab bar. */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  tabBar = true,
  wide = false,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  tabBar?: boolean;
  /**
   * Opt in to the wider budget on a large screen.
   *
   * Only for screens that actually have parallel content. A form or a
   * conversation reads worse wide — a line of prose past about 75 characters
   * is harder to track back to the next line, and no amount of screen makes
   * that untrue.
   */
  wide?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const isWide = useWide();
  const pad = { paddingBottom: tabBar ? TabBarClearance : Space.xxl };
  const width = { maxWidth: wide && isWide ? MaxWideWidth : MaxContentWidth };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.column, width, pad, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.column, width, pad, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/**
 * Two columns on a wide screen, one on a phone.
 *
 * Children go into a left and a right column rather than wrapping. Wrapping at
 * 50% width lines cards up in rows, so a short card beside a tall one leaves a
 * hole the height of the difference — and this app's cards differ a lot, a
 * two-line notice next to a chart.
 *
 * Which column a card lands in is decided by height, not by turn. Dealing them
 * alternately packs each column but not against each other: on Progress the
 * odd positions happened to hold the two short cards and the even ones the
 * three tall ones, so the right column ended half way up the screen and the
 * bottom right of the page was empty. Each card now goes under whichever
 * column is currently shorter, which is what makes a masonry look deliberate.
 *
 * Heights are only known after a layout pass, so the first paint deals
 * alternately and the arrangement settles once. Moving a card between columns
 * cannot change its height — both columns are the same width — so it settles
 * exactly once rather than oscillating.
 *
 * Order runs down the left and then down the right, which is how someone reads
 * two columns anyway. Anything whose sequence carries meaning should not be in
 * here — put it above the split.
 *
 * Margins, not `gap`: the README's standing constraint.
 */
export function Columns({ children }: { children: React.ReactNode }) {
  const wide = useWide();
  const [heights, setHeights] = useState<Record<number, number>>({});
  const items = React.Children.toArray(children).filter(Boolean);

  const measure = (i: number) => (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setHeights((prev) => (prev[i] === h ? prev : { ...prev, [i]: h }));
  };

  if (!wide || items.length < 2) return <>{children}</>;

  const measured = items.every((_, i) => heights[i] !== undefined);
  const left: React.ReactNode[] = [];
  const right: React.ReactNode[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  items.forEach((child, i) => {
    const cell = (
      <View key={i} onLayout={measure(i)}>
        {child}
      </View>
    );
    const goLeft = measured ? leftHeight <= rightHeight : i % 2 === 0;
    if (goLeft) {
      left.push(cell);
      leftHeight += heights[i] ?? 0;
    } else {
      right.push(cell);
      rightHeight += heights[i] ?? 0;
    }
  });

  return (
    <View style={styles.columns}>
      <View style={[styles.columnHalf, styles.columnLeft]}>{left}</View>
      <View style={styles.columnHalf}>{right}</View>
    </View>
  );
}

type TxtVariant = keyof typeof Type;

export function Txt({
  variant = 'body',
  color,
  style,
  children,
  numberOfLines,
  ...rest
}: {
  variant?: TxtVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
} & React.ComponentProps<typeof Text>) {
  const c = useTheme();
  const scale = useFontScale();
  const base = Type[variant] as TextStyle;
  const scaled = scaleType(base, scale);

  return (
    <Text
      numberOfLines={numberOfLines}
      // The cap is ours; letting the OS scale on top of it would double up.
      maxFontSizeMultiplier={1}
      style={[base, scaled, { color: color ?? c.text }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

/**
 * Renders what the coach writes.
 *
 * The model replies in Markdown; printing it verbatim put literal `**` and
 * `* ` on screen. Blocks are spaced with margins because `gap` breaks this
 * RN-Web version, and the whole reply carries one accessibility label so a
 * screen reader hears prose rather than a list of fragments.
 */
export function Markdown({ text, color }: { text: string; color?: string }) {
  const c = useTheme();
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);
  const fg = color ?? c.text;

  // Nothing recognised at all — show the source rather than an empty bubble.
  if (blocks.length === 0) {
    return <Txt variant="body" color={fg}>{text}</Txt>;
  }

  const inline = (spans: Span[]) =>
    spans.map((s, i) => {
      if (s.type === 'bold') return <Text key={i} style={{ fontFamily: Font.bodySemi }}>{s.text}</Text>;
      if (s.type === 'italic') return <Text key={i} style={{ fontStyle: 'italic' }}>{s.text}</Text>;
      if (s.type === 'code') {
        return (
          <Text key={i} style={{ fontFamily: Font.mono, fontSize: 13, color: c.accent }}>
            {s.text}
          </Text>
        );
      }
      return <Text key={i}>{s.text}</Text>;
    });

  return (
    <View accessible accessibilityLabel={plainText(blocks)}>
      {blocks.map((b: Block, i) => {
        const first = i === 0;
        if (b.type === 'heading') {
          return (
            <Text
              key={i}
              style={[Type.subheading, { color: fg, marginTop: first ? 0 : Space.base, marginBottom: Space.xs }]}
            >
              {inline(b.spans)}
            </Text>
          );
        }
        if (b.type === 'bullet' || b.type === 'ordered') {
          return (
            <View key={i} style={[styles.mdRow, { marginTop: first ? 0 : Space.sm }]}>
              {b.type === 'ordered' ? (
                <Text style={[Type.body, { color: c.textDim, width: 22 }]}>{b.index}.</Text>
              ) : (
                <View style={[styles.mdDot, { backgroundColor: c.textFaint }]} />
              )}
              <Text style={[Type.body, { color: fg, flex: 1 }]}>{inline(b.spans)}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={[Type.body, { color: fg, marginTop: first ? 0 : Space.md }]}>
            {inline(b.spans)}
          </Text>
        );
      })}
    </View>
  );
}

/** Uppercase mono micro-label. Carries data, never decoration. */
export function Eyebrow({ children, color, style, numberOfLines }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const c = useTheme();
  const scale = useFontScale();
  return (
    <Text
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={1}
      style={[
        Type.eyebrow,
        scaleType(Type.eyebrow, scale),
        { color: color ?? c.textFaint, textTransform: 'uppercase' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Flat panel with a hairline border. Shadows go muddy on a near-black page. */
/**
 * A panel, optionally belonging to one of the app's domains.
 *
 * The tone is a location, not a decoration: a card washed in blue is about
 * water, violet is about your body, green is about the plan. A screen of
 * identical white boxes made everything the same weight and told the reader
 * nothing; a wash and a matching edge cost one prop and say where they are.
 *
 * `default` stays plain on purpose. If every card were tinted the tint would
 * mean as little as no tint at all — the same reasoning that keeps ember rare.
 */
export type CardTone = 'default' | 'accent' | 'ember' | 'hydro' | 'body' | 'plan';

/** The domains a tone can name. `default` is "this belongs to no domain". */
export type Tone = Exclude<CardTone, 'default'>;

/**
 * `edge` draws the border, `fill` washes the surface, `ink` is what text and
 * icons on that wash are set in.
 *
 * `ink` is separate from `edge` because the accent's border is deliberately
 * dimmed — a full-strength teal outline on every accent card was louder than
 * the card's contents — while its text has to stay readable. For the domain
 * hues the two happen to be the same value, and saying so once here is
 * cheaper than every call site deciding.
 */
const TONES: Record<Tone, (c: ThemePalette) => { edge: string; fill: string; ink: string }> = {
  accent: (c) => ({ edge: c.accentDim, fill: c.accentWash, ink: c.accent }),
  ember: (c) => ({ edge: c.ember, fill: c.emberWash, ink: c.ember }),
  hydro: (c) => ({ edge: c.hydro, fill: c.hydroWash, ink: c.hydro }),
  body: (c) => ({ edge: c.body, fill: c.bodyWash, ink: c.body }),
  plan: (c) => ({ edge: c.plan, fill: c.planWash, ink: c.plan }),
};

/** The palette entry for a domain, for anything that is not a `Card`. */
export function useTone(tone: Tone) {
  return TONES[tone](useTheme());
}

export function Card({
  children,
  style,
  tone = 'default',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: CardTone;
}) {
  const c = useTheme();
  const t = tone === 'default' ? null : TONES[tone](c);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t ? t.fill : c.surface,
          borderColor: t ? t.edge : c.line,
          borderWidth: t ? 1.5 : 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Sizing lives on the pressable; everything else lives on the view that scales.
 *
 * `Tap` renders a `Pressable` wrapping an `Animated.View`, and the caller's
 * style went entirely on the inner view — so `flex: 1` sized the *contents* of
 * a pressable that was still `flex-grow: 0` and hugging its text. A row of
 * three tabs written as three equal thirds rendered as three pills bunched at
 * the left, and a one-item row collapsed to 9pt wide with the label spilling
 * out of it. Twelve call sites across the app were quietly wrong this way.
 *
 * These keys are the ones a parent flex container reads off its child, so they
 * have to be on the element the parent actually sees. They are removed from the
 * inner view rather than duplicated: a `width: '48%'` applied twice would be
 * 48% of 48%.
 */
const OUTER_KEYS = [
  'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'width', 'minWidth', 'maxWidth', 'alignSelf',
] as const;

/** Press feedback: a small spring scale. Applied once, everywhere tappable. */
export function Tap({
  onPress,
  children,
  style,
  disabled,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: any;
  accessibilityState?: any;
}) {
  const reduced = useReducedMotion();
  const s = useRef(new Animated.Value(1)).current;

  const to = (v: number) => {
    if (reduced) return;
    Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  };

  const inner: ViewStyle = { ...(StyleSheet.flatten(style) as ViewStyle) };
  const outer: ViewStyle = {};
  for (const k of OUTER_KEYS) {
    if (inner[k] === undefined) continue;
    (outer as any)[k] = inner[k];
    delete inner[k];
  }
  // Once the pressable carries the size, the inner view has to fill it —
  // otherwise the padding and background it draws stay hugging the label
  // inside a box that is now wider than they are.
  const fills = Object.keys(outer).length > 0;

  return (
    <Pressable
      style={outer}
      onPress={onPress}
      onPressIn={() => to(Motion.pressScale)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      // This version of RN-Web does not translate accessibilityState into
      // aria-checked, so a screen reader could not tell a ticked box from an
      // empty one. Native ignores the extra prop.
      {...(accessibilityState && 'checked' in accessibilityState
        ? { 'aria-checked': !!accessibilityState.checked }
        : null)}
      {...(accessibilityState && accessibilityState.disabled
        ? { 'aria-disabled': true }
        : null)}
    >
      <Animated.View style={[{ transform: [{ scale: s }] }, fills && styles.tapFill, inner]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  tone = 'accent',
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * The domain the action belongs to.
   *
   * A teal button is the app's action colour and stays the default, but on a
   * screen that is otherwise green the one thing you are meant to press was
   * the only element arguing with it. The button follows the screen so that
   * the accent still means "act" rather than "teal".
   */
  tone?: Tone;
}) {
  const c = useTheme();
  const off = disabled || loading;
  const t = TONES[tone](c);

  const bg = variant === 'primary' ? (off ? c.well : t.ink) : variant === 'secondary' ? c.well : 'transparent';
  const fg = variant === 'primary' ? (off ? c.textFaint : c.onAccent) : off ? c.textFaint : c.text;

  return (
    <Tap onPress={onPress} disabled={off} accessibilityLabel={label} style={style}>
      <View
        style={[
          styles.button,
          {
            backgroundColor: bg,
            borderWidth: variant === 'ghost' ? 1 : 0,
            borderColor: c.line,
          },
        ]}
      >
        {icon && <Icon name={icon} size={18} color={fg} />}
        <Text style={[Type.subheading, { color: fg, marginLeft: icon ? Space.sm : 0 }]}>
          {loading ? 'Working…' : label}
        </Text>
      </View>
    </Tap>
  );
}

/** Selectable pill. Used for every option row in the app. */
export function Chip({
  label,
  selected,
  onPress,
  style,
  tone = 'accent',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** The domain the choice belongs to, so a screen's chips match its header. */
  tone?: Tone;
}) {
  const c = useTheme();
  const t = TONES[tone](c);
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={style}
    >
      {/* Filled rather than outlined when chosen. A wash behind a hued label
          is the same weight as the unchosen pill beside it, and the Plan
          screen is twenty of these — the answer to "what did I pick" should
          not be a border. `onAccent` inverts with the scheme, which is what
          keeps the label readable on a hue that is dark on white and bright
          on black. */}
      <View
        style={[
          styles.chip,
          {
            backgroundColor: selected ? t.ink : c.well,
            borderColor: selected ? t.ink : 'transparent',
          },
        ]}
      >
        <Text style={[Type.bodyMedium, { color: selected ? c.onAccent : c.textDim, fontSize: 14 }]}>
          {label}
        </Text>
      </View>
    </Tap>
  );
}

/** Label above, value below. The app's standard readout. */
export function Stat({
  label,
  value,
  unit,
  color,
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  return (
    <View style={style}>
      <Eyebrow>{label}</Eyebrow>
      <View style={styles.statRow}>
        <Text style={[Type.heading, { color: color ?? c.text, fontSize: 22 }]}>{value}</Text>
        {unit && <Text style={[Type.data, { color: c.textFaint, marginLeft: 3 }]}>{unit}</Text>}
      </View>
    </View>
  );
}

export function Bar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  const c = useTheme();
  const reduced = useReducedMotion();
  const w = useRef(new Animated.Value(reduced ? pct : 0)).current;

  useEffect(() => {
    if (reduced) {
      w.setValue(pct);
      return;
    }
    Animated.timing(w, { toValue: pct, duration: 620, useNativeDriver: false }).start();
  }, [pct, reduced, w]);

  return (
    <View style={[styles.track, { backgroundColor: c.well, height, borderRadius: height / 2 }]}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
          width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }),
        }}
      />
    </View>
  );
}

/**
 * What each day aimed at, next to what it came to.
 *
 * The week already exists on Progress as a row of glyphs, which says whether a
 * day was answered and roughly how, but not by how much. Two bars per day say
 * it in the one way that needs no reading: the pair matches, or one is taller.
 *
 * Days without an answer are drawn as an empty slot rather than skipped, so the
 * gaps in a week stay visible — a chart of only the answered days would flatter
 * anyone who stops answering when it goes badly.
 */
export function PairedBars({
  days,
  height = 96,
  labels = true,
}: {
  days: { label: string; target: number | null; kcal: number | null }[];
  height?: number;
  /** Off when the row beneath already names the days — see Progress. */
  labels?: boolean;
}) {
  const c = useTheme();
  // One scale across the week, from the tallest thing in it — per-day scaling
  // would make every day look the same height and the comparison would be lost.
  const peak = Math.max(
    1,
    ...days.flatMap((d) => [d.target ?? 0, d.kcal ?? 0])
  );

  return (
    <View>
      <View style={[styles.pairRow, { height }]}>
        {days.map((d, i) => {
          const over = d.kcal !== null && d.target !== null && d.kcal > d.target;
          return (
            <View key={i} style={styles.pairCol}>
              <View style={[styles.pairBars, { height }]}>
                {/* The plan is grey and inert; what you did carries the
                    colour. Both drawn in the accent family read as one
                    two-toned bar, and on a day that landed exactly on target
                    the pair became two identical teal sticks with nothing to
                    say which was which. */}
                <View
                  style={[
                    styles.pairBar,
                    {
                      // `textFaint`, not `lineStrong`: the same floor the day
                      // band needed. lineStrong against a dark card is about
                      // 1.6:1 — drawn, and gone.
                      backgroundColor: d.target === null ? c.well : c.textFaint,
                      height: Math.max(2, ((d.target ?? 0) / peak) * height),
                    },
                  ]}
                />
                <View
                  style={[
                    styles.pairBar,
                    styles.pairBarLast,
                    {
                      backgroundColor: d.kcal === null ? c.well : over ? c.ember : c.accent,
                      height: Math.max(2, ((d.kcal ?? 0) / peak) * height),
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={[styles.pairRow, !labels && styles.hidden]}>
        {days.map((d, i) => (
          <View key={i} style={styles.pairCol}>
            <Text
              style={[Type.eyebrow, { color: c.textFaint, textAlign: 'center', marginTop: Space.sm }]}
              numberOfLines={1}
            >
              {d.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Screen title block. Eyebrow carries real data, not a decorative kicker. */
/**
 * The eyebrow is where a screen says which part of the app you are in, so it
 * is the cheapest place to put the domain's colour: one prop, and the header
 * of every screen stops being the same grey caption on the same white page.
 *
 * As a badge rather than loose text because at 10pt a hue is barely a hue —
 * coloured type that small reads as grey type someone got slightly wrong. The
 * wash behind it gives the colour enough area to be a colour.
 */
export function PageHeader({
  eyebrow,
  title,
  sub,
  tone,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  tone?: Tone;
}) {
  const c = useTheme();
  const t = tone ? TONES[tone](c) : null;
  return (
    <View style={styles.pageHeader}>
      {eyebrow &&
        (t ? (
          <View style={styles.headerBadgeRow}>
            <View style={[styles.headerBadge, { backgroundColor: t.fill, borderColor: t.edge }]}>
              <Eyebrow color={t.ink} numberOfLines={1}>{eyebrow}</Eyebrow>
            </View>
          </View>
        ) : (
          <Eyebrow style={{ marginBottom: Space.sm }}>{eyebrow}</Eyebrow>
        ))}
      <Txt variant="title">{title}</Txt>
      {sub && (
        <Txt variant="body" color={c.textDim} style={{ marginTop: Space.sm }}>
          {sub}
        </Txt>
      )}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.line }, style]} />;
}

/** Row that navigates somewhere. */
export function NavRow({
  icon,
  title,
  sub,
  onPress,
  tone,
}: {
  icon: IconName;
  title: string;
  sub: string;
  onPress: () => void;
  /**
   * The domain this row leads to, if it leads to one.
   *
   * Six rows with six identical grey tiles is a list you have to read from the
   * top every time. Left without a tone the tile stays neutral, which is the
   * honest answer for the rows that are not about your body, your water or the
   * plan — Sync and Export lead somewhere real but nowhere coloured, and
   * giving them a hue anyway would be the point at which the hues stop meaning
   * a place and start meaning "this row exists".
   */
  tone?: Tone;
}) {
  const c = useTheme();
  const t = tone ? TONES[tone](c) : null;
  return (
    <Tap onPress={onPress} accessibilityLabel={title}>
      <View style={[styles.navRow, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={[styles.navIcon, { backgroundColor: t ? t.fill : c.well }]}>
          {/* Not `textDim` when there is no tone: beside three coloured tiles
              a dim glyph reads as a disabled row rather than a neutral one. */}
          <Icon name={icon} size={20} color={t ? t.ink : c.text} />
        </View>
        <View style={styles.flex}>
          <Txt variant="subheading">{title}</Txt>
          <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
            {sub}
          </Txt>
        </View>
        <Icon name="chevronRight" size={18} color={c.textFaint} />
      </View>
    </Tap>
  );
}

/** Empty states are an invitation to act, not an apology. */
export function Empty({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  const c = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { borderColor: c.line }]}>
        <Icon name={icon} size={26} color={c.textFaint} />
      </View>
      <Txt variant="heading" style={{ marginTop: Space.lg, textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt variant="body" color={c.textDim} style={{ marginTop: Space.sm, textAlign: 'center', maxWidth: 300 }}>
        {body}
      </Txt>
      {action && onAction && <Button label={action} onPress={onAction} style={{ marginTop: Space.xl }} />}
    </View>
  );
}

/** Inline status line. Errors state what happened and what to do next. */
export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'warn'; children: React.ReactNode }) {
  const c = useTheme();
  const color = tone === 'error' ? c.negative : tone === 'ok' ? c.positive : c.ember;
  const wash = tone === 'ok' ? 'transparent' : tone === 'warn' ? c.emberWash : 'rgba(255,107,107,0.10)';
  return (
    <View style={[styles.notice, { backgroundColor: wash, borderColor: color }]}>
      <Icon name={tone === 'ok' ? 'check' : 'alert'} size={16} color={color} />
      <Text style={[Type.small, { color, marginLeft: Space.sm, flex: 1 }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /** See OUTER_KEYS: the inner view fills the pressable it no longer sizes. */
  tapFill: { flexGrow: 1, alignSelf: 'stretch' },
  column: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  card: { borderRadius: Radius.lg, padding: Space.lg },
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  columnHalf: { flex: 1, minWidth: 0 },
  columnLeft: { marginRight: Space.base },
  button: {
    minHeight: 54,
    paddingVertical: Space.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: Space.xl,
  },
  chip: {
    paddingHorizontal: Space.base,
    minHeight: 40,
    paddingVertical: Space.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: Space.xs },
  track: { width: '100%', overflow: 'hidden' },
  pairRow: { flexDirection: 'row', alignItems: 'flex-end' },
  pairCol: { flex: 1 },
  // The pair sits on the baseline and the two bars touch, so each day reads as
  // one object with a step in it rather than as two separate columns.
  pairBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  pairBar: { width: 7, borderTopLeftRadius: 3, borderTopRightRadius: 3, marginRight: 2 },
  pairBarLast: { marginRight: 0 },
  hidden: { display: 'none' },
  pageHeader: { paddingTop: Space.base, paddingBottom: Space.xl },
  // A row, so the badge is only as wide as its label. Left to itself inside
  // the header it would stretch the full column and read as a banner.
  headerBadgeRow: { flexDirection: 'row', marginBottom: Space.md },
  headerBadge: {
    paddingHorizontal: Space.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Space.base,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Space.sm,
  },
  navIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  empty: { alignItems: 'center', paddingVertical: Space.hero, paddingHorizontal: Space.lg },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mdRow: { flexDirection: 'row', alignItems: 'flex-start' },
  mdDot: { width: 4, height: 4, borderRadius: 2, marginTop: 9, marginRight: 10 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Space.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginTop: Space.md,
  },
});
