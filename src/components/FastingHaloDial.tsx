/**
 * Clean native SVG fasting ring — no dotted radar clutter, gradients, or floating inner pills.
 * Single deliberate visual focal element per `frontend-design` restraint rule.
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Txt, useTheme, type PaletteHue } from '@/components/ui';
import { useLang } from '@/components/lang';
import { Space } from '@/constants/theme';
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
  phaseHue?: PaletteHue;
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
  size = 212,
  stageSummary,
}: Props) {
  const c = useTheme();
  const { lang } = useLang();

  const strokeWidth = 8;
  const cx = size / 2;
  const cy = size / 2;
  const r = cx - strokeWidth - 4;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(2, Math.min(100, isEating ? progressPct : (hoursFasted / fastingHours) * 100));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const arcColor = isEating ? c.ember : c.accent;

  const timeCue = isEating
    ? lang === 'de'
      ? `Schließt um ${windowEnd}`
      : `Closes at ${windowEnd}`
    : lang === 'de'
    ? `Öffnet um ${windowStart}`
    : `Window opens ${windowStart}`;

  return (
    <View style={s.wrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={c.dialTrack}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={arcColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            fill="none"
          />
        </Svg>

        <View style={[s.centerOverlay, { width: size - strokeWidth * 2 - 20 }]}>
          <Txt variant="small" color={isEating ? c.ember : c.accent} style={{ fontWeight: '600', marginBottom: 2 }}>
            {phaseName}
          </Txt>

          <Txt variant="hero" color={c.onHero} style={s.countdownNumber}>
            {formatCountdown(remainingMs)}
          </Txt>

          <Txt variant="small" color={c.textDim} style={s.subCaption}>
            {timeCue}
          </Txt>
        </View>
      </View>

      {stageSummary ? (
        <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm, textAlign: 'center' }}>
          {stageSummary}
        </Txt>
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
  countdownNumber: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.0,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  subCaption: {
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
});
