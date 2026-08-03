import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

export default function PhotoMealLogger() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [analyzing, setAnalyzing] = useState(false);
  const [loggedMeal, setLoggedMeal] = useState<{ name: string; kcal: number; protein: number } | null>(null);

  const simulatePhotoScan = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setLoggedMeal({
        name: 'Ribeye Steak, Sweet Potato & Asparagus',
        kcal: 1850,
        protein: 145,
      });
    }, 1500);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.accent }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>📸 AI Meal Photo Logger</Text>
        <View style={[styles.badge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Text style={[styles.badgeTxt, { color: colors.accent }]}>Vision AI</Text>
        </View>
      </View>

      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        Snap or upload a photo of your OMAD dinner for instant AI macro breakdown.
      </Text>

      {loggedMeal ? (
        <View style={[styles.resultBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.mealName, { color: colors.text }]}>✅ {loggedMeal.name}</Text>
          <View style={styles.macroRow}>
            <Text style={[styles.macroTxt, { color: colors.primary }]}>🔥 {loggedMeal.kcal} kcal</Text>
            <Text style={[styles.macroTxt, { color: colors.accent }]}>🥩 {loggedMeal.protein}g Protein</Text>
          </View>
          <Pressable onPress={() => setLoggedMeal(null)} style={styles.resetBtn}>
            <Text style={[styles.resetTxt, { color: colors.textSecondary }]}>Log Another Meal</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.scanBtn, { backgroundColor: colors.accent }]}
          onPress={simulatePhotoScan}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.scanBtnTxt}>Scan Meal Photo 📷</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18, borderWidth: 1, gap: 10, marginVertical: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 18 },
  scanBtn: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  scanBtnTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  resultBox: { borderRadius: 14, padding: 12, gap: 6, marginTop: 4 },
  mealName: { fontSize: 15, fontWeight: '700' },
  macroRow: { flexDirection: 'row', gap: 16 },
  macroTxt: { fontSize: 14, fontWeight: '800' },
  resetBtn: { marginTop: 4 },
  resetTxt: { fontSize: 12, textDecorationLine: 'underline' },
});
