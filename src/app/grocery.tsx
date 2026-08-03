import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';

type GroceryCategory = {
  name: string;
  emoji: string;
  items: { id: string; name: string; amount: string; checked: boolean }[];
};

export default function GroceryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [categories, setCategories] = useState<GroceryCategory[]>([
    {
      name: 'Proteins',
      emoji: '🥩',
      items: [
        { id: '1', name: 'Chicken Breast / Tofu', amount: '1.5 kg', checked: false },
        { id: '2', name: 'Salmon Fillets / Eggs', amount: '800 g / 12 pcs', checked: false },
        { id: '3', name: 'Greek Yogurt / Whey Protein', amount: '1 kg', checked: false },
      ],
    },
    {
      name: 'Complex Carbs & Grains',
      emoji: '🍠',
      items: [
        { id: '4', name: 'Sweet Potatoes', amount: '2 kg', checked: false },
        { id: '5', name: 'Jasmine / Basmati Rice', amount: '1 kg', checked: false },
        { id: '6', name: 'Rolled Oats & Quinoa', amount: '500 g', checked: false },
      ],
    },
    {
      name: 'Veggies & Healthy Fats',
      emoji: '🥦',
      items: [
        { id: '7', name: 'Broccoli, Spinach & Carrots', amount: '1.2 kg', checked: false },
        { id: '8', name: 'Extra Virgin Olive Oil', amount: '1 Bottle', checked: false },
        { id: '9', name: 'Avocados & Mixed Nuts', amount: '4 pcs / 300 g', checked: false },
      ],
    },
    {
      name: 'Fasting & Electrolytes',
      emoji: '🧂',
      items: [
        { id: '10', name: 'Celtic Sea Salt / Pink Salt', amount: '1 Pack', checked: false },
        { id: '11', name: 'Potassium Chloride / Electrolyte Powder', amount: '1 Tub', checked: false },
        { id: '12', name: 'Black Coffee Beans & Green Tea', amount: '500 g', checked: false },
      ],
    },
  ]);

  const toggleItem = (catIdx: number, itemIdx: number) => {
    setCategories((prev) => {
      const next = [...prev];
      next[catIdx].items[itemIdx].checked = !next[catIdx].items[itemIdx].checked;
      return next;
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Weekly Grocery List 🛒</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Consolidated shopping list generated from your AI meal plans for the upcoming week.
        </Text>

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
                  <Text style={[styles.itemAmount, { color: colors.textSecondary }]}>
                    {item.amount}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
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
  backBtn: { paddingRight: 12 },
  backTxt: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 40 },
  scrollContent: { padding: 20, gap: 16 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  card: { borderRadius: 16, padding: 18, gap: 12 },
  catTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  checkIcon: { fontSize: 18 },
  itemInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 15, fontWeight: '600' },
  itemAmount: { fontSize: 13, fontWeight: '500' },
  strikethrough: { textDecorationLine: 'line-through' },
});
