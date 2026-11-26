/**
 * Mobile-first core UI primitives (`Screen`, `Columns`, `Card`, `Button`, `Chip`,
 * `SegmentedControl`, `PageHeader`, `NavRow`, `Stat`, `PairedBars`, `Bar`,
 * `Empty`, `Notice`, `Txt`, `Tap`).
 *
 * Implements `mobile-native`, `no-slop-ui`, and `animate-expo` rules:
 * - Zero `gap`, `rowGap`, `columnGap` (react-native-web 0.21 crash guard).
 * - Zero page-load fade stagger bloat (`Enter` renders immediately without dim delay).
 * - Zero forced uppercase mono eyebrow noise or decorative icon boxes.
 * - >= 44pt touch targets with `pressRetentionOffset` and crisp press feedback.
 */

import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
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
  Hairline,
  MaxContentWidth,
  MaxWideWidth,
  Radius,
  Shadow,
  Space,
  TabBarClearance,
  Type,
  type ThemePalette,
} from '@/constants/theme';
import { useThemeMode } from './ThemeProvider';
import { Icon, type IconName } from './icons';

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

/** Immediate container wrapper (no entrance stagger slop on every mount). */
export function Enter({
  children,
  style,
}: {
  index?: number;
  delay?: number;
  distance?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
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
  const padBottomBase = useEdges.includes('bottom') ? Math.max(insets.bottom, Space.base) : Space.base;
  // Tab bar is docked in normal flex flow below Screen — only comfortable scroll breathing room needed.
  const padBottom = tabBar ? padBottomBase + TabBarClearance : padBottomBase + Space.lg;
  const maxWidth = wide && isWide ? MaxWideWidth : MaxContentWidth;
  const sidePad = Space.base;

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

/** Single-column mobile-first flow; optional two columns only on tablet/desktop wide screens. */
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
      <View style={[styles.col, { marginRight: Space.sm }]}>{left}</View>
      <View style={[styles.col, { marginLeft: Space.sm }]}>{right}</View>
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

/** Clean section label in natural sentence case — no forced ALL-CAPS monospace spam. */
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
      maxFontSizeMultiplier={1.3}
      numberOfLines={numberOfLines}
      style={[
        Type.eyebrow,
        { color: color ?? c.textFaint },
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
  if (!hex || typeof hex !== 'string') return 'rgba(148, 163, 184, 0.10)';
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
    return `rgba(${r}, ${g}, ${b}, 0.10)`;
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
      : { fill: TONES[tone](c).fill, edge: washOf(TONES[tone](c).edge).replace('0.10)', '0.26)') };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: pal.fill,
          borderColor: pal.edge,
          borderWidth: tone === 'default' && resolved === 'light' ? Hairline : 1,
        },
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
      hitSlop={hitSlop ?? { top: 6, bottom: 6, left: 6, right: 6 }}
      pressRetentionOffset={{ top: 16, bottom: 16, left: 16, right: 16 }}
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
        pressed && !disabled ? { opacity: 0.78, transform: [{ scale: 0.97 }] } : null,
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
    border = c.line;
    fg = c.text;
  } else if (variant === 'outline') {
    bg = 'transparent';
    border = c.lineStrong;
    fg = c.text;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    border = 'transparent';
    fg = tone ? TONES[tone](c).ink : c.accent;
  }

  const heightMap: Record<ButtonSize, { minHeight: number; px: number; fontSize: number }> = {
    sm: { minHeight: 40, px: 14, fontSize: 14 },
    md: { minHeight: 48, px: 18, fontSize: 15 },
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
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: isDisabled ? 0.42 : 1,
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
          fontWeight: '600',
          color: fg,
          textAlign: 'center',
        }}
      >
        {label}
      </RNText>
    </Tap>
  );
}

/** Tactile 8px-radius chip selector — avoids rounded pill clutter everywhere. */
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
          fontWeight: selected ? '600' : '500',
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
            { color: color ?? c.text, fontVariant: ['tabular-nums'], marginTop: 2 },
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

export function Bar({ pct, color, height = 5 }: { pct: number; color: string; height?: number }) {
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
  height = 72,
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
                  borderRadius: 3,
                  backgroundColor: c.well,
                  marginRight: 3,
                }}
              />
              {d.kcal != null ? (
                <View
                  style={{
                    width: 8,
                    height: eatenH,
                    borderRadius: 3,
                    backgroundColor: over ? c.ember : toneInk,
                  }}
                />
              ) : (
                <View style={{ width: 8, height: 2, backgroundColor: c.lineStrong, borderRadius: 1 }} />
              )}
            </View>
            {labels ? (
              <Eyebrow color={c.textFaint} style={{ marginTop: 6, fontSize: 11 }}>
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
  const subText = subtitle ?? sub;
  const metaColor = tone === 'default' ? c.textDim : TONES[tone](c).ink;

  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        {back && onBack ? (
          <Tap
            onPress={onBack}
            accessibilityLabel="Back"
            style={[styles.backBtn, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <Icon name="chevronLeft" size={20} color={c.text} />
          </Tap>
        ) : null}
        <View style={{ flex: 1 }}>
          <Txt variant="display" color={c.text}>
            {title}
          </Txt>
          {subText ? (
            <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
              {subText}
            </Txt>
          ) : eyebrow ? (
            <Txt variant="small" color={metaColor} style={{ marginTop: 2 }}>
              {eyebrow}
            </Txt>
          ) : null}
        </View>
        {right ? <View style={{ marginLeft: Space.sm }}>{right}</View> : null}
      </View>
    </View>
  );
}

/** Native iOS segmented control: crisp single-line segments, zero overflowing ellipsis. */
export function SegmentedControl<T extends string>({
  values,
  selected,
  value,
  onSelect,
  onChange,
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
  const { resolved } = useThemeMode();
  const current = selected ?? value;
  const handleSelect = onSelect ?? onChange;

  return (
    <View style={[styles.segTrack, { backgroundColor: c.well }, style]}>
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
              active
                ? {
                    backgroundColor: resolved === 'light' ? c.surface : c.surfaceElevated,
                    ...(resolved === 'light' ? Shadow.card : {}),
                  }
                : null,
            ]}
          >
            <RNText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={{
                fontFamily: Font.bodySemi,
                fontSize: 13,
                fontWeight: active ? '600' : '500',
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
  return <View style={[{ height: Hairline, backgroundColor: c.line, marginVertical: Space.md }, style]} />;
}

/** iOS grouped Settings row: crisp vector icon directly inline, no decorative badge boxes. */
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
  const iconColor = tone === 'default' ? c.textDim : TONES[tone](c).ink;
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
        style,
      ]}
    >
      <Icon name={icon} size={20} color={iconColor} />
      <View style={{ flex: 1, marginHorizontal: Space.md }}>
        <Txt variant="bodyMedium" color={c.text}>
          {title}
        </Txt>
        {subText ? (
          <Txt variant="small" color={c.textDim} style={{ marginTop: 1 }}>
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
  const ink = tone === 'default' ? c.textDim : TONES[tone](c).ink;

  const actLabel = typeof action === 'string' ? action : action?.label;
  const actPress = typeof action === 'string' ? onAction : action?.onPress ?? onAction;

  return (
    <Card style={styles.emptyCard}>
      <Icon name={icon} size={32} color={ink} />
      <Txt variant="heading" color={c.text} align="center" style={{ marginTop: Space.base }}>
        {title}
      </Txt>
      <Txt variant="body" color={c.textDim} align="center" style={{ marginTop: Space.xs, maxWidth: 320 }}>
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
  sticky: { borderTopWidth: Hairline, paddingTop: Space.sm },
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  col: { flex: 1 },
  card: {
    borderRadius: Radius.lg,
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
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 38,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barTrack: { borderRadius: Radius.xs, overflow: 'hidden', width: '100%' },
  barFill: { borderRadius: Radius.xs },
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
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: Hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  segTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: Space.base,
  },
  segItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    minHeight: 34,
    paddingHorizontal: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: Hairline,
    paddingHorizontal: Space.base,
    paddingVertical: 13,
    minHeight: 52,
    marginBottom: Space.sm,
  },
  navTrail: { flexDirection: 'row', alignItems: 'center' },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Space.xl,
    paddingHorizontal: Space.lg,
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
