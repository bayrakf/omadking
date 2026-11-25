/**
 * Coaxial SVG fasting telemetry dial.
 *
 * Dual-polarity safe: reads every ink/track/accent color from `useTheme()` so
 * Light Mode renders crisply against Alabaster Paper without white-on-white
 * vanishing text or dark glow bleed.
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Eyebrow, Txt, useTheme, washOf, type PaletteHue } from '@/components/ui';
import { useLang } from '@/components/lang';
import { Icon } from '@/components/icons';
import { Radius, Space } from '@/constants/theme';
import { formatCountdown } from '@/lib/nutrition';

type Props = {
  remainingMs: number;
  fastingHours: number;
  progressPct: number;
  isEating: boolean;
  windowStart: string;
  windowEnd: string;
  hoursFasted: number;
  phaseName: string;
  phaseHue: PaletteHue;
  size?: number;
  stageSummary?: string;
};

export function FastingHaloDial({
  remainingMs,
  fastingHours,
  progressPct,
  isEating,
  windowStart,
  windowEnd,
  hoursFasted,
  phaseName,
  phaseHue,
  size = 236,
  stageSummary,
}: Props) {
  const c = useTheme();
  const { lang, t } = useLang();

  const strokeWidth = 10;
  const cx = size / 2;
  const cy = size / 2;
  const r = cx - strokeWidth - 8;
  const innerR = r - 11;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(2, Math.min(100, isEating ? progressPct : (hoursFasted / fastingHours) * 100));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const arcColor = isEating ? c.ember : c.accent;
  const arcGradStart = isEating ? c.ember : phaseHue === 'plan' ? c.plan : c.accent;
  const pillColor = isEating ? c.ember : c[phaseHue] ?? c.accent;
  const pillBg = isEating ? c.emberWash : washOf(pillColor);

  const badgeLabel = isEating
    ? `${phaseName} · ${t('today.windowOpen')}`
    : `${phaseName} · ${hoursFasted.toFixed(1)}h`;

  const timeCue = isEating
    ? lang === 'de'
      ? `Schließt um ${windowEnd} Uhr`
      : `Window closes ${windowEnd}`
    : lang === 'de'
    ? `Öffnet um ${windowStart} Uhr`
    : `Window opens ${windowStart}`;

  return (
    <View style={s.wrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="haloGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={arcGradStart} />
              <Stop offset="100%" stopColor={arcColor} />
            </LinearGradient>
          </Defs>

          {/* Subtle recessed inner calibration ring */}
          <Circle
            cx={cx}
            cy={cy}
            r={innerR}
            stroke={c.line}
            strokeWidth={1}
            strokeDasharray="2 6"
            fill="none"
          />

          {/* Main dial track */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={c.dialTrack}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Active progress arc */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke="url(#haloGrad)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            fill="none"
          />
        </Svg>

        <View style={[s.centerOverlay, { width: size - strokeWidth * 2 - 28 }]}>
          <View style={[s.phasePill, { backgroundColor: pillBg, borderColor: washOf(pillColor) }]}>
            <Icon name={isEating ? 'plate' : 'flame'} size={11} color={pillColor} />
            <Txt
              variant="eyebrow"
              numberOfLines={1}
              color={pillColor}
              style={{ marginLeft: 5, fontSize: 9.5, fontWeight: '700' }}
            >
              {badgeLabel}
            </Txt>
          </View>

          <Txt
            variant="hero"
            color={c.onHero}
            style={s.countdownNumber}
          >
            {formatCountdown(remainingMs)}
          </Txt>

          <Txt variant="small" color={c.textDim} style={s.subCaption}>
            {timeCue}
          </Txt>
        </View>
      </View>

      {stageSummary ? (
        <Eyebrow color={c.textFaint} style={{ marginTop: Space.xs, textAlign: 'center', fontSize: 10 }}>
          {stageSummary}
        </Eyebrow>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.xs,
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginBottom: Space.sm,
  },
  countdownNumber: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  subCaption: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
