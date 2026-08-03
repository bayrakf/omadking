import React from 'react';
import { View, Text, StyleSheet, Image, useColorScheme } from 'react-native';
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
          borderColor: colorScheme === 'dark' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.2)',
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Image
          source={require('../../assets/images/streak_badge.jpg')}
          style={styles.lionImg}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.streakNum, { color: colors.accent }]}>🔥 {streakDays} Day OMAD Streak</Text>
          <Text style={[styles.statusTxt, { color: colors.textSecondary }]}>Level 3 Fasting Lion • 100% On Track</Text>
        </View>
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
  card: { borderRadius: 20, padding: 16, borderWidth: 1.5, gap: 12, marginVertical: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  lionImg: { width: 56, height: 56, borderRadius: 14 },
  streakNum: { fontSize: 18, fontWeight: '800' },
  statusTxt: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  badgesGrid: { flexDirection: 'row', gap: 8 },
  badgeBox: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  badgeEmoji: { fontSize: 20 },
  badgeTitle: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
