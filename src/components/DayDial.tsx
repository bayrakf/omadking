/**
 * The signature element.
 *
 * A whole day as one ring, midnight at the top, clockwise. The fast is the vast
 * untravelled arc; the eating window is a small bright one; the workout is a
 * marker on the rim. That asymmetry *is* the product — a horizontal progress bar
 * flattens it into something that looks like every other tracker.
 *
 * The window arc is `accent` (cold) while fasting and `ember` (warm) once the
 * window opens, so state is readable across a room without reading a word.
 */

import { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { Type, Space, Font } from '@/constants/theme';
import { useTheme, useReducedMotion } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DAY = 1440;
const mod = (n: number) => ((n % DAY) + DAY) % DAY;

type Props = {
  size?: number;
  /** minutes past local midnight */
  nowMin: number;
  windowStartMin: number;
  windowLengthMin: number;
  trainingStartMin?: number | null;
  trainingDurationMin?: number;
  isEating: boolean;
  headline: string;
  caption: string;
};

/** Point on the rim for a minute-of-day, midnight at top, clockwise. */
function rimPoint(minute: number, cx: number, cy: number, r: number) {
  const a = (minute / DAY) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export default function DayDial({
  size = 250,
  nowMin,
  windowStartMin,
  windowLengthMin,
  trainingStartMin,
  trainingDurationMin = 0,
  isEating,
  headline,
  caption,
}: Props) {
  const c = useTheme();
  const reduced = useReducedMotion();

  const stroke = 13;
  // Inset leaves room for the hour labels outside the ring; at a smaller inset
  // they fell outside the SVG viewport and were clipped.
  const r = (size - stroke) / 2 - 27;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  const windowColor = isEating ? c.ember : c.accent;
  const arc = (mins: number) => (Math.min(mins, DAY) / DAY) * C;
  const at = (mins: number) => -(mod(mins) / DAY) * C;

  // How far through the current phase we are, drawn as a dim arc so the ring
  // carries progress as well as shape — otherwise it reads as a static diagram.
  const fastStart = mod(windowStartMin + windowLengthMin);
  const elapsed = isEating ? mod(nowMin - windowStartMin) : mod(nowMin - fastStart);
  const elapsedFrom = isEating ? windowStartMin : fastStart;

  const draw = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return draw.setValue(1);
    const a = Animated.timing(draw, { toValue: 1, duration: 900, delay: 140, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [draw, reduced]);

  const windowDash = draw.interpolate({
    inputRange: [0, 1],
    outputRange: [`0, ${C}`, `${arc(windowLengthMin)}, ${C}`],
  });

  const now = rimPoint(nowMin, cx, cy, r);

  const training = useMemo(() => {
    if (trainingStartMin == null || trainingDurationMin <= 0) return null;
    const rr = r + stroke / 2 + 7;
    const a = rimPoint(trainingStartMin, cx, cy, rr);
    const b = rimPoint(trainingStartMin + trainingDurationMin, cx, cy, rr);
    const large = trainingDurationMin / DAY > 0.5 ? 1 : 0;
    return { d: `M ${a.x} ${a.y} A ${rr} ${rr} 0 ${large} 1 ${b.x} ${b.y}`, a };
  }, [trainingStartMin, trainingDurationMin, cx, cy, r, stroke]);

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          {/* The whole day. */}
          <Circle cx={cx} cy={cy} r={r} stroke={c.dialTrack} strokeWidth={stroke} fill="none" />

          {/* Elapsed portion of the current phase. */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={isEating ? c.ember : c.accentDim}
            strokeWidth={stroke}
            fill="none"
            opacity={0.32}
            strokeDasharray={`${arc(elapsed)}, ${C}`}
            strokeDashoffset={at(elapsedFrom)}
          />

          {/* The eating window. */}
          <AnimatedCircle
            cx={cx}
            cy={cy}
            r={r}
            stroke={windowColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={windowDash as unknown as string}
            strokeDashoffset={at(windowStartMin)}
          />

          {/* The session, on its own outer track so it never competes. */}
          {training && (
            <Path d={training.d} stroke={c.textDim} strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.85} />
          )}
        </G>

        {/* Quarter-day orientation. */}
        {[0, 6, 12, 18].map((h) => {
          const o = rimPoint(h * 60, cx, cy, r - stroke / 2 - 5);
          const i = rimPoint(h * 60, cx, cy, r - stroke / 2 - 11);
          const l = rimPoint(h * 60, cx, cy, r + stroke / 2 + 15);
          return (
            <G key={h}>
              <Line x1={o.x} y1={o.y} x2={i.x} y2={i.y} stroke={c.textFaint} strokeWidth={1} opacity={0.7} />
              <SvgText x={l.x} y={l.y + 3.5} fill={c.textDim} fontSize={10} textAnchor="middle">
                {String(h).padStart(2, '0')}
              </SvgText>
            </G>
          );
        })}

        {/* Now. Ringed so it stays visible on any arc beneath it. */}
        <Circle cx={now.x} cy={now.y} r={7} fill={c.bg} />
        <Circle cx={now.x} cy={now.y} r={4} fill={c.text} />
      </Svg>

      <View style={styles.centre} pointerEvents="none">
        {/* Mono: monospaced figures stop the digits shifting the layout each tick. */}
        <Text style={[styles.headline, { color: windowColor }]} numberOfLines={1} adjustsFontSizeToFit>
          {headline}
        </Text>
        <Text style={[Type.small, { color: c.textDim, marginTop: 5, textAlign: 'center' }]} numberOfLines={2}>
          {caption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Keeps the readout clear of the ring on every side.
    paddingHorizontal: 56,
  },
  headline: {
    fontFamily: Font.mono,
    fontSize: 30,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});
