import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import Svg, { Path, LinearGradient, Stop, Circle as SvgCircle } from 'react-native-svg';
import { Colors } from '@/constants/theme';

type Props = {
  startHour: number;
  trainingHour: number;
};

export default function EnergyChart({ startHour = 14, trainingHour = 18 }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const width = 300;
  const height = 80;

  // Generate smooth SVG curve path for 24h glycogen curve
  // Peak after eating (startHour), dip before workout (trainingHour), post-meal recovery
  const pathD = `M 0 60 Q 60 40, 100 20 T 180 50 Q 220 10, 260 25 T 300 55`;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colorScheme === 'dark' ? 'rgba(124, 58, 237, 0.3)' : 'rgba(124, 58, 237, 0.1)' }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Energy & Glycogen Curve 📈</Text>
        <Text style={[styles.badge, { color: colors.accent }]}>Predicted Peak</Text>
      </View>

      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity="0.4" />
          <Stop offset="1" stopColor={colors.primary} stopOpacity="0.0" />
        </LinearGradient>

        <Path d={`${pathD} L 300 ${height} L 0 ${height} Z`} fill="url(#grad)" />
        <Path d={pathD} stroke={colors.primary} strokeWidth="3" fill="none" />

        {/* Workout Peak Dot */}
        <SvgCircle cx="220" cy="10" r="5" fill={colors.accent} />
      </Svg>

      <View style={styles.labelsRow}>
        <Text style={[styles.lbl, { color: colors.textSecondary }]}>06:00 Fasting</Text>
        <Text style={[styles.lbl, { color: colors.accent }]}>{startHour}:00 Meal</Text>
        <Text style={[styles.lbl, { color: colors.primary }]}>{trainingHour}:00 Workout Peak</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginVertical: 8,
    gap: 8,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  badge: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  lbl: { fontSize: 10, fontWeight: '600' },
});
