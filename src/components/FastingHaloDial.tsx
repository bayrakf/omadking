import { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Space, Radius, Font } from '@/constants/theme';
import { Txt, Eyebrow, useTheme, useReducedMotion } from './ui';
import { Icon } from './icons';
import { useLang } from './lang';
import { formatCountdown } from '@/lib/nutrition';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface FastingHaloDialProps {
  size?: number;
  remainingMs: number;
  fastingHours: number;
  progressPct: number;
  isEating: boolean;
  windowStart: string;
  windowEnd: string;
  hoursFasted: number;
  phaseName: string;
  phaseHue: 'gold' | 'ember' | 'accent' | 'plan' | 'body';
  onPressTimer: () => void;
  onPressAdjust: () => void;
}

export function FastingHaloDial({
  size = 230,
  remainingMs,
  progressPct,
  isEating,
  windowStart,
  windowEnd,
  hoursFasted,
  phaseName,
  phaseHue,
  onPressTimer,
  onPressAdjust,
}: FastingHaloDialProps) {
  const c = useTheme();
  const { lang, t } = useLang();
  const reduced = useReducedMotion();

  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2 - 10;
  const circumference = 2 * Math.PI * radius;

  const anim = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      anim.setValue(1);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [anim, reduced]);

  // Normalized progress (0 to 1)
  const normProgress = Math.max(0.02, Math.min(1, progressPct / 100));
  const strokeDashoffset = circumference * (1 - normProgress);

  const phaseColor = isEating ? c.ember : c[phaseHue] || c.accent;

  return (
    <View style={[s.wrapper, { width: size, height: size }]}>
      {/* Ambient Radial Mesh Glow */}
      <View
        style={[
          s.ambientGlow,
          {
            width: size * 0.9,
            height: size * 0.9,
            borderRadius: (size * 0.9) / 2,
            backgroundColor: isEating ? 'rgba(255, 107, 74, 0.12)' : `${phaseColor}15`,
          },
        ]}
      />

      {/* SVG Circular Halo Track */}
      <Svg width={size} height={size} style={s.svgLayer}>
        <Defs>
          <LinearGradient id="haloGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={isEating ? c.ember : phaseColor} />
            <Stop offset="100%" stopColor={isEating ? '#FF8C66' : c.accent} />
          </LinearGradient>
        </Defs>

        {/* Untravelled Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={c.well}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Travelled Progress Arc */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#haloGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center Readout Card */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPressTimer}
        style={s.centerContent}
        accessibilityRole="button"
        accessibilityLabel={`Fasten Timer: ${formatCountdown(remainingMs)}`}
      >
        {/* Phase Pill Badge */}
        <View style={[s.phasePill, { backgroundColor: isEating ? c.emberWash : `${phaseColor}22` }]}>
          <Icon name={isEating ? 'plate' : 'flame'} size={11} color={phaseColor} />
          <Eyebrow color={phaseColor} style={{ marginLeft: 4, fontSize: 9.5, fontWeight: '800' }}>
            {isEating ? t('today.windowEating') : `${phaseName.toUpperCase()} · FASTING`}
          </Eyebrow>
        </View>

        {/* Hero Countdown Figures */}
        <Txt variant="hero" color={c.text} style={s.countdownNumber}>
          {formatCountdown(remainingMs)}
        </Txt>

        {/* Subtitle Information */}
        <Txt variant="small" color={c.textDim} style={s.subCaption}>
          {lang === 'de'
            ? isEating
              ? `schließt um ${windowEnd}`
              : `${hoursFasted.toFixed(1)}h · öffnet ${windowStart}`
            : isEating
            ? `closes at ${windowEnd}`
            : `${hoursFasted.toFixed(1)}h · opens ${windowStart}`}
        </Txt>

        {/* Adjust Hint Icon */}
        <TouchableOpacity
          onPress={onPressAdjust}
          activeOpacity={0.7}
          style={[s.adjustPill, { backgroundColor: c.well, borderColor: c.line }]}
          accessibilityLabel="Zeitfenster bearbeiten"
        >
          <Icon name="clock" size={10} color={c.textDim} />
          <Txt variant="eyebrow" color={c.textDim} style={{ marginLeft: 3, fontSize: 9, fontWeight: '700' }}>
            {windowStart}–{windowEnd}
          </Txt>
          <View style={{ marginLeft: 3 }}>
            <Icon name="edit" size={9} color={c.textDim} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Space.sm,
  },
  ambientGlow: {
    position: 'absolute',
  },
  svgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.sm,
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginBottom: 4,
  },
  countdownNumber: {
    fontSize: 34,
    lineHeight: 38,
    fontFamily: Font.display,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subCaption: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  adjustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginTop: 6,
  },
});
