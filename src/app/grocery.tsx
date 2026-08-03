import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useColorScheme, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

type GroceryItem = { id: string; name: string; amount?: string; checked: boolean };
type GroceryCategory = { name: string; emoji: string; items: GroceryItem[] };

const EXTRACT_CATEGORIES = [
  { name: 'Proteins', emoji: '🥩', keywords: ['chicken', 'beef', 'steak', 'pork', 'salmon', 'tuna', 'fish', 'tofu', 'tempeh', 'eggs', 'egg', 'whey', 'protein', 'yogurt', 'turkey', 'lamb', 'shrimp', 'mince'] },
  { name: 'Vegetables', emoji: '🥦', keywords: ['broccoli', 'spinach', 'carrot', 'kale', 'lettuce', 'tomato', 'cucumber', 'pepper', 'onion', 'garlic', 'zucchini', 'asparagus', 'cauliflower', 'mushroom', 'cabbage', 'aubergine', 'eggplant', 'celery'] },
  { name: 'Fats', emoji: '🥑', keywords: ['olive oil', 'avocado', 'butter', 'ghee', 'almond', 'walnut', 'peanut', 'cashew', 'chia', 'flax', 'hemp', 'coconut oil', 'cheese', 'bacon', 'cream'] },
  { name: 'Carbs', emoji: '🍠', keywords: ['sweet potato', 'potato', 'rice', 'oat', 'quinoa', 'pasta', 'bread', 'tortilla', 'beans', 'lentil', 'chickpea', 'corn', 'apple', 'banana', 'berry', 'berries'] },
  { name: 'Supplements', emoji: '💊', keywords: ['electrolyte', 'magnesium', 'potassium', 'vitamin', 'creatine', 'omega', 'fish oil'] },
  { name: 'Seasonings', emoji: '🧂', keywords: ['salt', 'pepper', 'cinnamon', 'paprika', 'cumin', 'oregano', 'basil', 'soy sauce', 'vinegar', 'mustard', 'hot sauce', 'coffee', 'tea'] },
];

export default function GroceryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [hasMealPlan, setHasMealPlan] = useState(false);
  const [categories, setCategories] = useState<GroceryCategory[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const plan = await AsyncStorage.getItem('last_meal_plan');
      if (!plan) {
        setHasMealPlan(false);
        setLoaded(true);
        return;
      }
      setHasMealPlan(true);

      const savedChecks = await AsyncStorage.getItem('grocery_checked');
      const checksMap = savedChecks ? JSON.parse(savedChecks) : {};

      const textLower = plan.toLowerCase();
      const extracted: GroceryCategory[] = [];

      EXTRACT_CATEGORIES.forEach(cat => {
        const foundItems: GroceryItem[] = [];
        cat.keywords.forEach(keyword => {
          if (textLower.includes(keyword)) {
            const name = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            foundItems.push({
              id: keyword,
              name,
              checked: !!checksMap[keyword],
            });
          }
        });

        if (foundItems.length > 0) {
          extracted.push({
            name: cat.name,
            emoji: cat.emoji,
            items: foundItems,
          });
        }
      });

      setCategories(extracted);
      setLoaded(true);
    } catch (e) {
      setLoaded(true);
    }
  };

  const saveChecks = async (cats: GroceryCategory[]) => {
    const checksMap: Record<string, boolean> = {};
    cats.forEach(cat => {
      cat.items.forEach(item => {
        if (item.checked) {
          checksMap[item.id] = true;
        }
      });
    });
    await AsyncStorage.setItem('grocery_checked', JSON.stringify(checksMap));
  };

  const toggleItem = (catIdx: number, itemIdx: number) => {
    setCategories(prev => {
      const next = [...prev];
      next[catIdx].items[itemIdx].checked = !next[catIdx].items[itemIdx].checked;
      saveChecks(next);
      return next;
    });
  };

  const clearChecks = () => {
    setCategories(prev => {
      const next = prev.map(cat => ({
        ...cat,
        items: cat.items.map(item => ({ ...item, checked: false }))
      }));
      saveChecks(next);
      return next;
    });
  };

  const shareList = async () => {
    let text = 'My Grocery List 🛒\n\n';
    categories.forEach(cat => {
      text += `${cat.emoji} ${cat.name}:\n`;
      cat.items.forEach(item => {
        text += `- ${item.name} ${item.checked ? '✅' : '⬜'}\n`;
      });
      text += '\n';
    });

    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
      } catch (e) {
        alert('Failed to copy to clipboard.');
      }
    } else {
      Share.share({ message: text });
    }
  };

  if (!mounted) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Grocery List</Text>
        {hasMealPlan && categories.length > 0 && (
          <Pressable onPress={shareList} style={styles.actionBtn}>
            <Text style={[styles.actionTxt, { color: colors.primary }]}>Share</Text>
          </Pressable>
        )}
      </View>

      {!loaded ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      ) : !hasMealPlan || categories.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>No list yet 🛒</Text>
          <Text style={[styles.placeholderSubtitle, { color: colors.textSecondary }]}>
            Generate your first meal plan to auto-extract your weekly groceries.
          </Text>
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/planner')}
          >
            <Text style={styles.ctaTxt}>Go to Meal Planner</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Ingredients extracted from your latest meal plan.
            </Text>
            <Pressable onPress={clearChecks}>
              <Text style={[styles.clearTxt, { color: colors.danger }]}>Clear all</Text>
            </Pressable>
          </View>

          {categories.map((cat, catIdx) => (
            <View key={cat.name} style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.catTitle, { color: colors.text }]}>
                {cat.emoji} {cat.name}
              </Text>

              {cat.items.map((item, itemIdx) => (
                <Pressable
                  key={item.id}
                  onPress={() => toggleItem(catIdx, itemIdx)}
                  style={styles.itemRow}
                >
                  <Text style={styles.checkIcon}>{item.checked ? '✅' : '⬜'}</Text>
                  <View style={styles.itemInfo}>
                    <Text
                      style={[
                        styles.itemName,
                        { color: item.checked ? colors.textSecondary : colors.text },
                        item.checked && styles.strikethrough,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {item.amount && (
                      <Text style={[styles.itemAmount, { color: colors.textSecondary }]}>
                        {item.amount}
                      </Text>
                    )}
                  </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingRight: 12, minWidth: 60 },
  backTxt: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  actionBtn: { minWidth: 60, alignItems: 'flex-end' },
  actionTxt: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  placeholderTitle: { fontSize: 22, fontWeight: '700' },
  placeholderSubtitle: { fontSize: 15, textAlign: 'center', marginBottom: 12, lineHeight: 22 },
  ctaBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  ctaTxt: { color: 'white', fontSize: 16, fontWeight: '700' },
  scrollContent: { padding: 20, gap: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 },
  subtitle: { fontSize: 14, flex: 1, paddingRight: 16, lineHeight: 20 },
  clearTxt: { fontSize: 14, fontWeight: '600', paddingVertical: 4 },
  card: { borderRadius: 16, padding: 18, gap: 12 },
  catTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  checkIcon: { fontSize: 18 },
  itemInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemAmount: { fontSize: 13, fontWeight: '500' },
  strikethrough: { textDecorationLine: 'line-through' },
});
