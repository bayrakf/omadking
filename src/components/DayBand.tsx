/**
 * The day as one strip, read against the clock.
 *
 * `DayDial` says the same asymmetry as a ring and says it well — the fast is
 * the vast arc, the window is the small bright one. What a ring cannot do is
 * carry the six moments `dayAgenda` computes: labels on a rim either collide or
 * rotate past legibility, so the timeline has always had to be listed
 * underneath it as separate rows. The strip puts the moments on the instrument
 * itself, and gives the reader a clock axis to find "now" against.
 *
 * Midnight to midnight, left to right. Ember appears only where the eating
 * window is, which is the palette's standing rule, and a window that crosses
 * midnight arrives from `windowSegments` as two pieces — one at each end.
 */

import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Type, Space, Radius } from '@/constants/theme';
import { windowSegments, bandPosition, type AgendaItem } from '@/lib/agenda';
import { useTheme, useReducedMotion } from './ui';

const HEIGHT = 34;
/** Hours to print under the strip. Every third, so the labels never collide. */
const TICK_HOURS = [0, 6, 12, 18, 24];

/** Which moments earn a mark. The window edges are already the ember block. */
const MARKED: AgendaItem['kind'][] = ['cook', 'meal', 'snack', 'log_fast'];


export function DayBand({
  nowMin,
  windowStartMin,
  windowLengthMin,
  items,
  isEating,
  style,
}: {
  /** minutes past local midnight */
  nowMin: number;
  windowStartMin: number;
  windowLengthMin: number;
  items: AgendaItem[];
  isEating: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const reduced = useReducedMotion();

  const segments = windowSegments(windowStartMin, windowLengthMin);
  const nowFrac = Math.max(0, Math.min(1, nowMin / 1440));

  // The marker slides to its position on mount so the strip reads as a
  // measurement being taken rather than as a static picture. Under
  // reduce-motion it is simply where it belongs.
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      return;
    }
    const anim = Animated.timing(t, { toValue: 1, duration: 720, useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [reduced, t]);

  const marks = items
    .filter((i) => MARKED.includes(i.kind))
    .map((i) => ({
      kind: i.kind,
      at: i.at,
      past: i.past,
      done: i.done,
      left: bandPosition(windowStartMin, i.offset) * 100,
    }));

  return (
    <View style={style}>
      {/* The marker sits in this wrapper rather than inside the track, so
          "now" is a position read off the instrument and not another event
          printed on it. */}
      <View style={styles.bandWrap}>
        <View style={[styles.track, { backgroundColor: c.well, borderColor: c.line }]}>
          {segments.map((s, i) => (
            <View
              key={i}
              style={[
                styles.window,
                {
                  left: `${s.from * 100}%`,
                  width: `${(s.to - s.from) * 100}%`,
                  backgroundColor: isEating ? c.ember : c.accent,
                },
              ]}
            />
          ))}

          {/* Dimmer than the marker, deliberately. These are things that
              happen and there are several of them; where you are is one thing
              and it has to win. At equal weight the eye cannot find it. */}
          {marks.map((m, i) => (
            <View
              key={`${m.kind}-${i}`}
              style={[
                styles.mark,
                {
                  left: `${m.left}%`,
                  backgroundColor: m.done ? c.positive : m.past ? c.lineStrong : c.textDim,
                },
              ]}
            />
          ))}
        </View>

        <Animated.View
          style={[
            styles.nowWrap,
            { left: t.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${nowFrac * 100}%`] }) },
          ]}
          pointerEvents="none"
        >
          <View style={[styles.nowHead, { borderTopColor: c.text }]} />
          <View style={[styles.nowStem, { backgroundColor: c.text }]} />
        </Animated.View>
      </View>

      <View style={styles.axis}>
        {TICK_HOURS.map((h) => (
          <Text
            key={h}
            style={[Type.eyebrow, styles.tick, { color: c.textFaint, left: `${(h / 24) * 100}%` }]}
          >
            {String(h).padStart(2, '0')}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Holds the track and the marker that points at it. */
  bandWrap: { paddingTop: 7 },
  track: {
    height: HEIGHT,
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  window: { position: 'absolute', top: 0, bottom: 0 },
  /** A hairline through the full height, so a moment reads as an instant. */
  mark: { position: 'absolute', top: 0, bottom: 0, width: 1.5, marginLeft: -0.75 },
  nowWrap: { position: 'absolute', top: 0, bottom: 0, width: 10, marginLeft: -5, alignItems: 'center' },
  /** A downward caret. Border tricks beat shipping an SVG for six triangles. */
  nowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  nowStem: { width: 2, flex: 1, marginTop: -1 },
  axis: { height: 16, marginTop: Space.xs },
  // Absolute, so a tick sits at its hour rather than at a share of the row —
  // `justifyContent: space-between` would put 00 and 24 inside the edges.
  tick: { position: 'absolute', marginLeft: -8, width: 16, textAlign: 'center' },
});
