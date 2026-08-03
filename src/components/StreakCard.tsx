import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

type Props = {
  streakDays?: number;
};

export default function StreakCard({ streakDays = 7 }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colorScheme === 'dark' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.15)',
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.streakBadge}>
          <Text style={styles.flame}>🔥</Text>
          <Text style={[styles.streakNum, { color: colors.accent }]}>{streakDays} Day Streak</Text>
        </View>
        <Text style={[styles.statusTxt, { color: colors.textSecondary }]}>Active OMAD Fasting</Text>
      </View>

      {/* Badges Grid */}
      <View style={styles.badgesGrid}>
        <View style={[styles.badgeBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.badgeEmoji}>⚡</Text>
          <Text style={[styles.badgeTitle, { color: colors.text }]}>7-Day Warrior</Text>
        </View>
        <View style={[styles.badgeBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.badgeEmoji}>🏆</Text>
          <Text style={[styles.badgeTitle, { color: colors.text }]}>Macro Master</Text>
        </View>
        <View style={[styles.badgeBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={styles.badgeEmoji}>🏋️</Text>
          <Text style={[styles.badgeTitle, { color: colors.text }]}>Workout Fueled</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18, borderWidth: 1.5, gap: 12, marginVertical: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flame: { fontSize: 24 },
  streakNum: { fontSize: 18, fontWeight: '800' },
  statusTxt: { fontSize: 12, fontWeight: '600' },
  badgesGrid: { flexDirection: 'row', gap: 8 },
  badgeBox: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  badgeEmoji: { fontSize: 20 },
  badgeTitle: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
