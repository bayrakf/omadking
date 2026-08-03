import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { Colors } from '@/constants/theme';

type Props = {
  startHour: number; // 0-23
  durationHours: number;
  trainingHour: number; // 0-23
};

export default function FastingRing({ startHour = 14, durationHours = 1, trainingHour = 18 }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [timeStr, setTimeStr] = useState('');
  const [statusText, setStatusText] = useState('Fasting');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const s = now.getSeconds();

      const totalSecCurrent = h * 3600 + m * 60 + s;
      const targetSec = startHour * 3600;

      let diff = targetSec - totalSecCurrent;
      if (diff < 0) diff += 86400; // next day

      const hoursLeft = Math.floor(diff / 3600);
      const minsLeft = Math.floor((diff % 3600) / 60);
      const secsLeft = diff % 60;

      setTimeStr(
        `${hoursLeft.toString().padStart(2, '0')}:${minsLeft.toString().padStart(2, '0')}:${secsLeft.toString().padStart(2, '0')}`
      );

      if (h >= startHour && h < startHour + durationHours) {
        setStatusText('Eating Window Active 🍽️');
      } else if (h >= trainingHour && h < trainingHour + 2) {
        setStatusText('Workout Recovery Phase ⚡');
      } else {
        setStatusText('Fasting Mode Active 🔒');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startHour, durationHours, trainingHour]);

  const size = 200;
  const strokeWidth = 14;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  // Angle calculations for eating window & workout
  const eatingStartAngle = (startHour / 24) * 360;
  const eatingEndAngle = ((startHour + durationHours) / 24) * 360;
  const workoutAngle = (trainingHour / 24) * 360;

  // Eating window dashoffset
  const eatingPct = durationHours / 24;
  const strokeDasharray = `${circumference * eatingPct} ${circumference * (1 - eatingPct)}`;
  const strokeDashoffset = -1 * (eatingStartAngle / 360) * circumference;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {/* Base Track */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colorScheme === 'dark' ? '#1E1E32' : '#E5E7EB'}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Eating Window Highlight Arc */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      </Svg>

      {/* Center Display */}
      <View style={styles.centerContent}>
        <Text style={[styles.statusLbl, { color: colors.primary }]}>{statusText}</Text>
        <Text style={[styles.countdownTxt, { color: colors.text }]}>{timeStr || '00:00:00'}</Text>
        <Text style={[styles.subTxt, { color: colors.textSecondary }]}>Until Eating Window</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  centerContent: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  statusLbl: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  countdownTxt: { fontSize: 26, fontWeight: '800', fontFamily: 'monospace' },
  subTxt: { fontSize: 11, marginTop: 2 },
});
