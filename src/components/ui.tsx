/**
 * Core UI primitives (`Screen`, `Columns`, `Card`, `Button`, `Chip`, `SegmentedControl`,
 * `PageHeader`, `NavRow`, `Stat`, `PairedBars`, `Bar`, `Empty`, `Notice`, `Txt`, `Tap`).
 *
 * Designed after shadcn/ui + react-native-reusables primitive discipline:
 * - Zero `gap`, `rowGap`, `columnGap` (react-native-web 0.21 crash guard).
 * - Strict dual-polarity `useTheme()` coloring (zero hardcoded light/dark leakage).
 * - Non-flicker `Enter` transitions (0.94 -> 1 opacity, never stalls dim).
 * - Compact single-line `SegmentedControl` with clean borders & `accessibilityState`.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import {
  Breakpoint,
  Font,
  MaxContentWidth,
  MaxWideWidth,
  Motion,
  Radius,
  Shadow,
  Space,
  TabBarClearance,
  Type,
  type ThemePalette,
} from '@/constants/theme';
import { useThemeMode } from './ThemeProvider';
import { Icon, type IconName } from './icons';
import { parseMarkdown, plainText, type Block, type Span } from '@/lib/markdown';

export { Font };

export function useTheme(): ThemePalette {
  return useThemeMode().colors;
}

export function useFontScale(): number {
  const { fontScale } = useWindowDimensions();
  return fontScale || 1;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(Boolean(v));
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

export function Enter({
  index = 0,
  delay,
  distance = 4,
  children,
  style,
}: {
  index?: number;
  delay?: number;
  distance?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const computedDelay = Math.min(delay ?? index * Motion.stagger, 100);

  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: Motion.enter,
      delay: computedDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim, computedDelay, reduced]);

  if (reduced) return <View style={style}>{children}</View>;

  return (
    <Animated.View
      style={[
        {
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }),
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= Breakpoint.wide;
}

export function Screen({
  children,
  scroll = true,
  edges,
  tabBar = true,
  wide = false,
  sticky,
  refresh,
  scrollRef,
  bare = false,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  tabBar?: boolean;
  wide?: boolean;
  sticky?: React.ReactNode;
  refresh?: { refreshing: boolean; onRefresh: () => void };
  scrollRef?: React.RefObject<ScrollView | null>;
  bare?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const isWide = useWide();
  const insets = useSafeAreaInsets();
  const useEdges = edges ?? ['top'];
  const padTop = useEdges.includes('top') ? Math.max(insets.top, Space.md) : 0;
  const padBottomBase = useEdges.includes('bottom') ? Math.max(insets.bottom, Space.base) : Space.xl;
  // On wide desktop viewports navigation sits in the top chrome bar so bottom never needs floating dock clearance.
  const padBottom = tabBar && !isWide ? padBottomBase + TabBarClearance : padBottomBase + Space.lg;
  const maxWidth = wide && isWide ? MaxWideWidth : MaxContentWidth;
  const sidePad = isWide ? Space.xl : Space.base;

  if (bare || !scroll) {
    return (
      <View
        style={[
          styles.flex,
          { backgroundColor: c.bg, paddingTop: padTop, paddingBottom: padBottomBase },
          style,
        ]}
      >
        <View style={[{ flex: 1, width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: sidePad }, contentStyle]}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: padTop }, style]}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          {
            width: '100%',
            maxWidth,
            alignSelf: 'center',
            paddingHorizontal: sidePad,
            paddingTop: Space.xs,
            paddingBottom: padBottom,
          },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          refresh ? (
            <RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} tintColor={c.accent} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {sticky ? (
        <View
          style={[
            styles.sticky,
            {
              backgroundColor: c.bg,
              borderTopColor: c.line,
              paddingBottom: Math.max(insets.bottom, Space.sm),
              paddingHorizontal: sidePad,
            },
          ]}
        >
          <View style={{ width: '100%', maxWidth, alignSelf: 'center' }}>{sticky}</View>
        </View>
      ) : null}
    </View>
  );
}

/** Two balanced columns above Breakpoint.wide (`840px`), single column below. */
export function Columns({ children }: { children: React.ReactNode }) {
  const isWide = useWide();
  const items = React.Children.toArray(children).filter(Boolean);
  if (!isWide || items.length < 2) {
    return <View>{children}</View>;
  }
  const left: React.ReactNode[] = [];
  const right: React.ReactNode[] = [];
  items.forEach((child, i) => {
    if (i % 2 === 0) left.push(child);
    else right.push(child);
  });
  return (
    <View style={styles.columns}>
      <View style={[styles.col, { marginRight: Space.base / 2 }]}>{left}</View>
      <View style={[styles.col, { marginLeft: Space.base / 2 }]}>{right}</View>
    </View>
  );
}

export type TxtVariant = keyof typeof Type;
export type TypeVariant = TxtVariant;

export function Txt({
  variant = 'body',
  color,
  align,
  style,
  children,
  ...rest
}: TextProps & {
  variant?: TxtVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}) {
  const c = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        Type[variant],
        { color: color ?? c.text },
        align ? { textAlign: align } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

export function Markdown({ text, color }: { text: string; color?: string }) {
  const c = useTheme();
  const blocks = useMemo(() => parseMarkdown(text), [text]);
  const fg = color ?? c.text;

  if (blocks.length === 0) {
    return <Txt variant="body" color={fg}>{text}</Txt>;
  }

  const inline = (spans: Span[]) =>
    spans.map((span, i) => {
      if (span.type === 'bold') return <RNText key={i} style={{ fontFamily: Font.bodySemi, fontWeight: '700' }}>{span.text}</RNText>;
      if (span.type === 'italic') return <RNText key={i} style={{ fontStyle: 'italic' }}>{span.text}</RNText>;
      if (span.type === 'code') {
        return (
          <RNText key={i} style={{ fontFamily: Font.mono, fontSize: 13, color: c.accent }}>
            {span.text}
          </RNText>
        );
      }
      return <RNText key={i}>{span.text}</RNText>;
    });

  return (
    <View accessible accessibilityLabel={plainText(blocks)}>
      {blocks.map((b: Block, i) => {
        const first = i === 0;
        if (b.type === 'heading') {
          return (
            <RNText
              key={i}
              style={[Type.subheading, { color: fg, marginTop: first ? 0 : Space.base, marginBottom: Space.xs }]}
            >
              {inline(b.spans)}
            </RNText>
          );
        }
        if (b.type === 'bullet' || b.type === 'ordered') {
          return (
            <View key={i} style={[styles.mdRow, { marginTop: first ? 0 : Space.sm }]}>
              {b.type === 'ordered' ? (
                <RNText style={[Type.body, { color: c.textDim, width: 22 }]}>{b.index}.</RNText>
              ) : (
                <View style={[styles.mdDot, { backgroundColor: c.textFaint }]} />
              )}
              <RNText style={[Type.body, { color: fg, flex: 1 }]}>{inline(b.spans)}</RNText>
            </View>
          );
        }
        return (
          <RNText key={i} style={[Type.body, { color: fg, marginTop: first ? 0 : Space.md }]}>
            {inline(b.spans)}
          </RNText>
        );
      })}
    </View>
  );
}

export function Eyebrow({
  children,
  color,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={1.25}
      numberOfLines={numberOfLines}
      style={[
        Type.eyebrow,
        {
          color: color ?? c.textFaint,
          textTransform: 'uppercase',
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

export const TONES: Record<Tone, (c: ThemePalette) => { edge: string; fill: string; ink: string }> = {
  accent: (c) => ({ edge: c.accentDim, fill: c.accentWash, ink: c.accent }),
  ember: (c) => ({ edge: c.ember, fill: c.emberWash, ink: c.ember }),
  hydro: (c) => ({ edge: c.hydro, fill: c.hydroWash, ink: c.hydro }),
  body: (c) => ({ edge: c.body, fill: c.bodyWash, ink: c.body }),
  plan: (c) => ({ edge: c.plan, fill: c.planWash, ink: c.plan }),
  gold: (c) => ({ edge: c.gold, fill: c.goldWash, ink: c.gold }),
};

export type CardTone = 'default' | 'accent' | 'ember' | 'hydro' | 'body' | 'plan' | 'gold';
export type Tone = Exclude<CardTone, 'default'>;
export type PaletteHue = Tone | 'textDim';

export function washOf(hex: string): string {
  if (!hex || typeof hex !== 'string') return 'rgba(148, 163, 184, 0.11)';
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
    let r = 0;
    let g = 0;
    let b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, 0.11)`;
  }
  return hex;
}

export function useTone(tone: Tone) {
  const c = useTheme();
  return TONES[tone](c);
}

export function shade(hex: string, pct: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const f = parseInt(hex.slice(1), 16);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  const R = f >> 16;
  const G = (f >> 8) & 0x00ff;
  const B = f & 0x0000ff;
  const nr = Math.round((t - R) * p) + R;
  const ng = Math.round((t - G) * p) + G;
  const nb = Math.round((t - B) * p) + B;
  return '#' + (0x1000000 + nr * 0x10000 + ng * 0x100 + nb).toString(16).slice(1);
}

export function Card({
  children,
  tone = 'default',
  style,
}: {
  children: React.ReactNode;
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { resolved } = useThemeMode();
  const pal =
    tone === 'default'
      ? { fill: c.surface, edge: c.line }
      : { fill: TONES[tone](c).fill, edge: washOf(TONES[tone](c).edge).replace('0.11)', '0.28)') };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: pal.fill,
          borderColor: pal.edge,
        },
        tone === 'default' && resolved === 'light' ? Shadow.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const OUTER_KEYS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'right',
  'bottom',
  'left',
]);

export function Tap({
  children,
  style,
  hitSlop,
  disabled,
  accessibilityRole,
  accessibilityState,
  ...rest
}: PressableProps & {
  style?: StyleProp<ViewStyle | TextStyle>;
  children: React.ReactNode;
}) {
  const flat = StyleSheet.flatten(style as StyleProp<ViewStyle>) || {};
  const outer: Record<string, any> = {};
  const inner: Record<string, any> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (OUTER_KEYS.has(k)) outer[k] = v;
    else inner[k] = v;
  }
  const fills = Object.keys(outer).length > 0;

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={accessibilityState}
      hitSlop={hitSlop ?? { top: 4, bottom: 4, left: 4, right: 4 }}
      {...(accessibilityState && 'checked' in accessibilityState
        ? { 'aria-checked': !!accessibilityState.checked }
        : null)}
      {...(accessibilityState && 'selected' in accessibilityState
        ? { 'aria-selected': !!accessibilityState.selected }
        : null)}
      {...(accessibilityState && accessibilityState.disabled
        ? { 'aria-disabled': true }
        : null)}
      {...rest}
      style={({ pressed }) => [
        outer as ViewStyle,
        Platform.OS === 'web' ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as any) : null,
        pressed && !disabled ? { opacity: 0.84, transform: [{ scale: Motion.pressScale }] } : null,
      ]}
    >
      <View style={[fills ? styles.tapFill : null, inner as ViewStyle]}>
        {children}
      </View>
    </Pressable>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'ember';
export type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  tone,
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: Tone;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const isDisabled = disabled || loading;

  let bg = c.accent;
  let border = c.accent;
  let fg = c.onAccent;

  if (variant === 'ember' || (variant === 'primary' && tone === 'ember')) {
    bg = c.ember;
    border = c.ember;
    fg = c.onEmber;
  } else if (variant === 'primary' && tone && tone !== 'accent') {
    const t = TONES[tone](c);
    bg = t.ink;
    border = t.ink;
    fg = tone === 'gold' || tone === 'hydro' || tone === 'plan' ? c.onAccent : '#FFFFFF';
  } else if (variant === 'secondary') {
    bg = c.surfaceElevated;
    border = c.lineStrong;
    fg = c.text;
  } else if (variant === 'outline') {
    bg = 'transparent';
    border = c.lineStrong;
    fg = c.text;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    border = 'transparent';
    fg = tone ? TONES[tone](c).ink : c.textDim;
  }

  const heightMap: Record<ButtonSize, { minHeight: number; px: number; fontSize: number }> = {
    sm: { minHeight: 36, px: 12, fontSize: 13 },
    md: { minHeight: 46, px: 18, fontSize: 15 },
    lg: { minHeight: 52, px: 22, fontSize: 16 },
  };
  const sz = heightMap[size];

  return (
    <Tap
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.btn,
        {
          minHeight: sz.minHeight,
          paddingHorizontal: sz.px,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'ghost' ? 0 : 1,
          opacity: isDisabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <View style={{ marginRight: 8 }}>
          <ActivityIndicator size="small" color={fg} />
        </View>
      ) : icon ? (
        <View style={{ marginRight: 8 }}>
          <Icon name={icon} size={sz.fontSize + 2} color={fg} />
        </View>
      ) : null}
      <RNText
        maxFontSizeMultiplier={1.25}
        style={{
          fontFamily: Font.bodySemi,
          fontSize: sz.fontSize,
          fontWeight: '700',
          letterSpacing: -0.1,
          color: fg,
          textAlign: 'center',
        }}
      >
        {label}
      </RNText>
    </Tap>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  tone = 'accent',
  icon,
  accessibilityLabel,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: CardTone;
  icon?: IconName;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const activeColors: Record<CardTone, { bg: string; fg: string; border: string }> = {
    default: { bg: c.accent, fg: c.onAccent, border: c.accent },
    accent: { bg: c.accent, fg: c.onAccent, border: c.accent },
    ember: { bg: c.ember, fg: c.onEmber, border: c.ember },
    hydro: { bg: c.hydro, fg: c.onAccent, border: c.hydro },
    body: { bg: c.body, fg: '#FFFFFF', border: c.body },
    plan: { bg: c.plan, fg: c.onAccent, border: c.plan },
    gold: { bg: c.gold, fg: c.onAccent, border: c.gold },
  };
  const pal = selected
    ? activeColors[tone]
    : { bg: c.surfaceElevated, fg: c.text, border: c.line };

  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: pal.bg,
          borderColor: pal.border,
        },
        style,
      ]}
    >
      {icon ? (
        <View style={{ marginRight: 6 }}>
          <Icon name={icon} size={14} color={pal.fg} />
        </View>
      ) : null}
      <RNText
        maxFontSizeMultiplier={1.25}
        style={{
          fontFamily: Font.bodySemi,
          fontSize: 13.5,
          fontWeight: selected ? '700' : '600',
          color: pal.fg,
        }}
      >
        {label}
      </RNText>
    </Tap>
  );
}

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
      <Eyebrow color={c.textFaint}>{label}</Eyebrow>
      <View style={styles.statValueRow}>
        <RNText
          style={[
            Type.title,
            { color: color ?? c.text, fontVariant: ['tabular-nums'], marginTop: 4 },
          ]}
        >
          {value}
        </RNText>
        {unit ? (
          <RNText style={[Type.small, { color: c.textDim, marginLeft: 4, marginBottom: 4 }]}>
            {unit}
          </RNText>
        ) : null}
      </View>
    </View>
  );
}

export function Bar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  const c = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.barTrack, { height, backgroundColor: c.well }]}>
      <View style={[styles.barFill, { width: `${clamped}%`, height, backgroundColor: color }]} />
    </View>
  );
}

export function PairedBars({
  days,
  height = 76,
  labels = true,
  tone = 'accent',
}: {
  days: { label: string; target: number | null; kcal: number | null }[];
  height?: number;
  labels?: boolean;
  tone?: Tone;
}) {
  const c = useTheme();
  const toneInk = TONES[tone](c).ink;
  const maxVal = Math.max(1, ...days.flatMap((d) => [d.target ?? 0, d.kcal ?? 0]));

  return (
    <View style={styles.pairedWrap}>
      {days.map((d, i) => {
        const targetH = d.target != null ? Math.max(4, Math.round((d.target / maxVal) * height)) : 4;
        const eatenH = d.kcal != null ? Math.max(4, Math.round((d.kcal / maxVal) * height)) : 0;
        const over = d.kcal != null && d.target != null && d.kcal > d.target * 1.15;
        return (
          <View key={i} style={styles.pairedCol}>
            <View style={[styles.pairedBarsRow, { height }]}>
              <View
                style={{
                  width: 8,
                  height: targetH,
                  borderRadius: 4,
                  backgroundColor: c.well,
                  borderWidth: 1,
                  borderColor: c.lineStrong,
                  marginRight: 3,
                }}
              />
              {d.kcal != null ? (
                <View
                  style={{
                    width: 8,
                    height: eatenH,
                    borderRadius: 4,
                    backgroundColor: over ? c.ember : toneInk,
                  }}
                />
              ) : (
                <View style={{ width: 8, height: 2, backgroundColor: c.lineStrong, borderRadius: 1 }} />
              )}
            </View>
            {labels ? (
              <Eyebrow color={c.textFaint} style={{ marginTop: 6, fontSize: 10 }}>
                {d.label}
              </Eyebrow>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  subtitle,
  tone = 'default',
  back,
  onBack,
  right,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  subtitle?: string;
  tone?: CardTone;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const c = useTheme();
  const toneInk = tone === 'default' ? c.textFaint : TONES[tone](c).ink;
  const subText = subtitle ?? sub;

  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        {back && onBack ? (
          <Tap
            onPress={onBack}
            accessibilityLabel="Back"
            style={[styles.backBtn, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <Icon name="chevronLeft" size={18} color={c.text} />
          </Tap>
        ) : null}
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Eyebrow color={toneInk} style={{ marginBottom: 4 }}>
              {eyebrow}
            </Eyebrow>
          ) : null}
          <Txt variant="title" color={c.text}>
            {title}
          </Txt>
          {subText ? (
            <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
              {subText}
            </Txt>
          ) : null}
        </View>
        {right ? <View style={{ marginLeft: Space.md }}>{right}</View> : null}
      </View>
    </View>
  );
}

export function SegmentedControl<T extends string>({
  values,
  selected,
  value,
  onSelect,
  onChange,
  tone = 'accent',
  style,
}: {
  values: { id: T; label: string; accessibilityLabel?: string; icon?: IconName }[];
  selected?: T;
  value?: T;
  onSelect?: (id: T) => void;
  onChange?: (id: T) => void;
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const isWide = useWide();
  const { resolved } = useThemeMode();
  const current = selected ?? value;
  const handleSelect = onSelect ?? onChange;
  const dotInk = tone === 'default' ? c.accent : TONES[tone](c).ink;
  const showIcons = isWide || values.length < 3;

  return (
    <View
      style={[
        styles.segTrack,
        { backgroundColor: c.well, borderColor: c.line },
        style,
      ]}
    >
      {values.map((item) => {
        const active = item.id === current;
        return (
          <Tap
            key={item.id}
            onPress={() => handleSelect?.(item.id)}
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            accessibilityState={{ selected: active }}
            style={[
              styles.segItem,
              { paddingHorizontal: isWide ? 8 : 4 },
              active
                ? {
                    backgroundColor: resolved === 'light' ? c.surface : c.surfaceElevated,
                    borderColor: c.lineStrong,
                    ...(resolved === 'light' ? Shadow.card : {}),
                  }
                : { borderColor: 'transparent' },
            ]}
          >
            {item.icon && showIcons ? (
              <View style={{ marginRight: 5 }}>
                <Icon name={item.icon} size={14} color={active ? dotInk : c.textFaint} />
              </View>
            ) : null}
            <RNText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              style={{
                fontFamily: Font.bodySemi,
                fontSize: isWide ? 13 : 12,
                fontWeight: active ? '700' : '600',
                color: active ? c.text : c.textDim,
                textAlign: 'center',
              }}
            >
              {item.label}
            </RNText>
          </Tap>
        );
      })}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.line, marginVertical: Space.md }, style]} />;
}

export function NavRow({
  icon,
  title,
  sub,
  subtitle,
  value,
  tone = 'default',
  onPress,
  trailing,
  style,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  subtitle?: string;
  value?: string;
  tone?: CardTone;
  onPress: () => void;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const { resolved } = useThemeMode();
  const pal =
    tone === 'default'
      ? { ink: c.textDim, fill: c.well }
      : { ink: TONES[tone](c).ink, fill: TONES[tone](c).fill };
  const subText = subtitle ?? sub;

  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={title}
      style={[
        styles.navRow,
        {
          backgroundColor: c.surface,
          borderColor: c.line,
        },
        resolved === 'light' ? Shadow.card : null,
        style,
      ]}
    >
      <View style={[styles.navIcon, { backgroundColor: pal.fill, borderColor: c.line }]}>
        <Icon name={icon} size={18} color={pal.ink} />
      </View>
      <View style={{ flex: 1, marginHorizontal: Space.md }}>
        <Txt variant="subheading" color={c.text} style={{ fontSize: 15 }}>
          {title}
        </Txt>
        {subText ? (
          <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
            {subText}
          </Txt>
        ) : null}
      </View>
      {trailing ?? (
        <View style={styles.navTrail}>
          {value ? (
            <Txt variant="data" color={c.textDim} style={{ marginRight: Space.xs }}>
              {value}
            </Txt>
          ) : null}
          <Icon name="chevronRight" size={16} color={c.textFaint} />
        </View>
      )}
    </Tap>
  );
}

export function Empty({
  icon,
  title,
  body,
  action,
  onAction,
  tone = 'default',
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: string | { label: string; onPress: () => void };
  onAction?: () => void;
  tone?: CardTone;
}) {
  const c = useTheme();
  const pal =
    tone === 'default'
      ? { ink: c.textDim, fill: c.well }
      : { ink: TONES[tone](c).ink, fill: TONES[tone](c).fill };

  const actLabel = typeof action === 'string' ? action : action?.label;
  const actPress = typeof action === 'string' ? onAction : action?.onPress ?? onAction;

  return (
    <Card style={styles.emptyCard}>
      <View style={[styles.emptyIcon, { backgroundColor: pal.fill, borderColor: c.lineStrong }]}>
        <Icon name={icon} size={24} color={pal.ink} />
      </View>
      <Txt variant="heading" color={c.text} align="center" style={{ marginTop: Space.base }}>
        {title}
      </Txt>
      <Txt variant="body" color={c.textDim} align="center" style={{ marginTop: Space.xs, maxWidth: 340 }}>
        {body}
      </Txt>
      {actLabel && actPress ? (
        <Button
          label={actLabel}
          onPress={actPress}
          variant="primary"
          style={{ marginTop: Space.lg }}
        />
      ) : null}
    </Card>
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'warn'; children: React.ReactNode }) {
  const c = useTheme();
  const pal =
    tone === 'ok'
      ? { border: c.positive, bg: washOf(c.positive), ink: c.positive, icon: 'check' as IconName }
      : tone === 'warn'
      ? { border: c.gold, bg: washOf(c.gold), ink: c.gold, icon: 'alert' as IconName }
      : { border: c.negative, bg: washOf(c.negative), ink: c.negative, icon: 'alert' as IconName };

  return (
    <View style={[styles.notice, { backgroundColor: pal.bg, borderColor: pal.border }]}>
      <View style={{ marginRight: Space.sm, marginTop: 2 }}>
        <Icon name={pal.icon} size={16} color={pal.ink} />
      </View>
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? (
          <Txt variant="small" color={c.text}>
            {children}
          </Txt>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tapFill: { flexGrow: 1, alignSelf: 'stretch' },
  sticky: { borderTopWidth: 1, paddingTop: Space.sm },
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  col: { flex: 1 },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barTrack: { borderRadius: Radius.full, overflow: 'hidden', width: '100%' },
  barFill: { borderRadius: Radius.full },
  pairedWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: Space.xs,
  },
  pairedCol: { alignItems: 'center', flex: 1 },
  pairedBarsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  header: { marginBottom: Space.base },
  headerTopRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  segTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 4,
    marginBottom: Space.base,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Space.md,
    marginBottom: Space.sm,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTrail: { flexDirection: 'row', alignItems: 'center' },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Space.xl,
    paddingHorizontal: Space.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Space.md,
    marginTop: Space.md,
  },
  mdRow: { flexDirection: 'row', alignItems: 'flex-start' },
  mdDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 9, marginRight: Space.sm },
});
