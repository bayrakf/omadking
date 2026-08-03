import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

type Props = {
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  weightKg?: number;
};

export default function MicronutrientsCard({
  proteinG = 160,
  carbsG = 300,
  fatG = 75,
  weightKg = 75,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Evidence-based sports nutrition calculations for OMAD athletes
  const fiberTargetG = 35; // Recommended daily fiber for OMAD gut motility & slow glucose release
  const sodiumTargetMg = 4000; // Electrolyte replenishment during fasting & sweat loss
  const potassiumTargetMg = 3500; // Glycogen synthesis & cellular hydration
  const magnesiumTargetMg = 420; // ATP energy production & muscle spasm prevention
  const waterTargetL = Math.round((weightKg * 0.045) * 10) / 10; // 45ml per kg for active fasters

  const ItemRow = ({
    emoji,
    label,
    value,
    target,
    unit,
    desc,
  }: {
    emoji: string;
    label: string;
    value: number;
    target: number;
    unit: string;
    desc: string;
  }) => {
    const pct = Math.min(100, Math.round((value / target) * 100));
    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemLabel}>
            {emoji} {label}
          </Text>
          <Text style={[styles.itemVal, { color: colors.primary }]}>
            {value} / {target} {unit}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
          <View style={[styles.fill, { backgroundColor: colors.primary, width: `${pct}%` }]} />
        </View>

        <Text style={[styles.desc, { color: colors.textSecondary }]}>{desc}</Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colorScheme === 'dark' ? 'rgba(124, 58, 237, 0.3)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>🔬 Daily Science & Micro Targets</Text>
        <View style={[styles.badge, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
          <Text style={[styles.badgeTxt, { color: colors.primary }]}>OMAD Sports Protocol</Text>
        </View>
      </View>

      <Text style={[styles.introText, { color: colors.textSecondary }]}>
        Essential electrolytes & fiber targets required to sustain high-intensity evening workouts on a single meal.
      </Text>

      {/* Fiber */}
      <ItemRow
        emoji="🌾"
        label="Dietary Fiber"
        value={28}
        target={fiberTargetG}
        unit="g"
        desc="Prevents glucose spikes in 1h window & maintains gut motility."
      />

      {/* Sodium */}
      <ItemRow
        emoji="🧂"
        label="Sodium (Electrolytes)"
        value={3800}
        target={sodiumTargetMg}
        unit="mg"
        desc="Prevents fasting fatigue, headaches & sweat electrolyte loss."
      />

      {/* Potassium */}
      <ItemRow
        emoji="🍌"
        label="Potassium"
        value={3100}
        target={potassiumTargetMg}
        unit="mg"
        desc="Drives glucose into muscle cells to rebuild glycogen post-workout."
      />

      {/* Magnesium */}
      <ItemRow
        emoji="🥑"
        label="Magnesium"
        value={390}
        target={magnesiumTargetMg}
        unit="mg"
        desc="Essential for ATP muscle energy synthesis & cramp prevention."
      />

      {/* Hydration */}
      <ItemRow
        emoji="💧"
        label="Fasting Hydration Target"
        value={3.2}
        target={waterTargetL}
        unit="L"
        desc="Maintains blood volume & kidney filtration during 23h fasts."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18, marginVertical: 12, borderWidth: 1, gap: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  introText: { fontSize: 13, lineHeight: 18 },
  itemContainer: { gap: 4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemLabel: { fontSize: 14, fontWeight: '700' },
  itemVal: { fontSize: 13, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, width: '100%', overflow: 'hidden', marginVertical: 4 },
  fill: { height: '100%', borderRadius: 4 },
  desc: { fontSize: 11, lineHeight: 15 },
});
