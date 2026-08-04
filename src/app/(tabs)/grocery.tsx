import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, Share, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, MaxContentWidth } from '@/constants/theme';
import { loadPlanHistory, KEYS } from '@/lib/store';
import { buildGroceryList, type GroceryCategory } from '@/lib/grocery';
import type { MealPlan } from '@/lib/ai';

export default function GroceryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<GroceryCategory[]>([]);
  const [copied, setCopied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [plans, checksRaw] = await Promise.all([
          loadPlanHistory<MealPlan>(),
          AsyncStorage.getItem(KEYS.groceryChecked),
        ]);
        if (!active) return;
        let checks: Record<string, boolean> = {};
        try {
          checks = checksRaw ? JSON.parse(checksRaw) : {};
        } catch {
          checks = {};
        }
        // Last 3 plans — a week of meal prep without dragging in months of history.
        setCategories(buildGroceryList(plans.slice(0, 3), checks));
        setMounted(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const persist = async (cats: GroceryCategory[]) => {
    const map: Record<string, boolean> = {};
    cats.forEach((c) => c.items.forEach((i) => i.checked && (map[i.id] = true)));
    await AsyncStorage.setItem(KEYS.groceryChecked, JSON.stringify(map));
  };

  const toggleItem = (catIdx: number, itemId: string) => {
    setCategories((prev) => {
      // Copy rather than mutate in place — the old version mutated state
      // objects directly, so React could skip the re-render.
      const next = prev.map((cat, ci) =>
        ci !== catIdx
          ? cat
          : { ...cat, items: cat.items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)) }
      );
      persist(next);
      return next;
    });
  };

  const clearChecks = () => {
    setCategories((prev) => {
      const next = prev.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, checked: false })) }));
      persist(next);
      return next;
    });
  };

  const shareList = async () => {
    const text =
      '🛒 Grocery list\n\n' +
      categories
        .map(
          (c) =>
            `${c.emoji} ${c.name}\n` + c.items.map((i) => `${i.checked ? '✅' : '⬜'} ${i.name}`).join('\n')
        )
        .join('\n\n');

    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard blocked — nothing useful to do */
      }
    } else {
      await Share.share({ message: text });
    }
  };

  if (!mounted) return null;

  const total = categories.reduce((n, c) => n + c.items.length, 0);
  const done = categories.reduce((n, c) => n + c.items.filter((i) => i.checked).length, 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerBlock}>
        <Text style={[styles.title, { color: colors.text }]}>Grocery list</Text>
        {total > 0 && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {done} of {total} picked up — from your last 3 meal plans
          </Text>
        )}
      </View>

      {total === 0 ? (
        <View style={styles.center}>
          <Text style={styles.placeholderEmoji}>🛒</Text>
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>Nothing to buy yet</Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.textSecondary }]}>
            Generate a meal plan and its ingredients land here, sorted by aisle.
          </Text>
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/planner')}
            accessibilityRole="button"
          >
            <Text style={styles.ctaTxt}>Go to meal planner</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.actionRow}>
            <Pressable onPress={shareList} accessibilityRole="button">
              <Text style={[styles.actionTxt, { color: colors.primary }]}>
                {copied ? '✅ Copied' : Platform.OS === 'web' ? 'Copy list' : 'Share list'}
              </Text>
            </Pressable>
            <Pressable onPress={clearChecks} accessibilityRole="button">
              <Text style={[styles.actionTxt, { color: colors.danger }]}>Clear ticks</Text>
            </Pressable>
          </View>

          {categories.map((cat, catIdx) => (
            <View key={cat.name} style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.catTitle, { color: colors.text }]}>
                {cat.emoji} {cat.name}
              </Text>
              {cat.items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => toggleItem(catIdx, item.id)}
                  style={styles.itemRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.checked }}
                >
                  <Text style={styles.checkIcon}>{item.checked ? '✅' : '⬜'}</Text>
                  <Text
                    style={[
                      styles.itemName,
                      { color: item.checked ? colors.textSecondary : colors.text },
                      item.checked && styles.strikethrough,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBlock: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, paddingBottom: 120 },
  placeholderEmoji: { fontSize: 44, marginBottom: 12 },
  placeholderTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  placeholderSubtitle: { fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  ctaBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  ctaTxt: { color: 'white', fontSize: 15, fontWeight: '700' },
  scrollContent: { padding: 20, paddingBottom: 130, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  actionTxt: { fontSize: 14, fontWeight: '700' },
  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  catTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkIcon: { fontSize: 18, marginRight: 12 },
  itemName: { fontSize: 15, fontWeight: '500', flex: 1, lineHeight: 21 },
  strikethrough: { textDecorationLine: 'line-through' },
});
