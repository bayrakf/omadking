import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

type Props = {
  title: string;
  reasoning: string;
  totalKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  instructions: string;
  reheatInstructions?: string | null;
  prepTimeMin?: number | null;
};

export default function RecipeCard({
  title,
  reasoning,
  totalKcal,
  proteinG,
  carbsG,
  fatG,
  ingredients,
  instructions,
  reheatInstructions,
  prepTimeMin = 25,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (key: string) => {
    setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const cookSteps = instructions
    .split(/(?:\d+\.\s*|\.\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const reheatSteps = (reheatInstructions || '')
    .split(/(?:\d+\.\s*|\.\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colorScheme === 'dark' ? 'rgba(124, 58, 237, 0.4)' : 'rgba(124, 58, 237, 0.15)',
        },
      ]}
    >
      {/* Badge Header */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
          <Text style={[styles.badgeTxt, { color: colors.primary }]}>⚡ High Protein</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Text style={[styles.badgeTxt, { color: colors.accent }]}>👨‍🍳 Chef Recipe ({prepTimeMin}m)</Text>
        </View>
      </View>

      {/* Recipe Title */}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.reasoning, { color: colors.textSecondary }]}>{reasoning}</Text>

      {/* Macros Row */}
      <View style={styles.macroRow}>
        <View style={[styles.macroBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.macroVal, { color: colors.primary }]}>{totalKcal}</Text>
          <Text style={[styles.macroLbl, { color: colors.textSecondary }]}>kcal</Text>
        </View>
        <View style={[styles.macroBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.macroVal, { color: colors.primary }]}>{proteinG}g</Text>
          <Text style={[styles.macroLbl, { color: colors.textSecondary }]}>Protein</Text>
        </View>
        <View style={[styles.macroBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.macroVal, { color: colors.primary }]}>{carbsG}g</Text>
          <Text style={[styles.macroLbl, { color: colors.textSecondary }]}>Carbs</Text>
        </View>
        <View style={[styles.macroBox, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.macroVal, { color: colors.primary }]}>{fatG}g</Text>
          <Text style={[styles.macroLbl, { color: colors.textSecondary }]}>Fat</Text>
        </View>
      </View>

      {/* Ingredients List */}
      <Text style={[styles.sectionHeading, { color: colors.text }]}>🛒 Precise Ingredients</Text>
      {ingredients.map((item, idx) => (
        <Text key={idx} style={[styles.bullet, { color: colors.text }]}>• {item}</Text>
      ))}

      {/* Cooking Instructions */}
      <Text style={[styles.sectionHeading, { color: colors.primary, marginTop: 14 }]}>
        👨‍🍳 Cooking Instructions
      </Text>
      {cookSteps.map((step, idx) => {
        const key = `cook_${idx}`;
        const isDone = checkedSteps[key];
        return (
          <Pressable key={key} onPress={() => toggleStep(key)} style={styles.stepRow}>
            <Text style={styles.checkbox}>{isDone ? '✅' : '⬜'}</Text>
            <Text
              style={[
                styles.stepText,
                { color: isDone ? colors.textSecondary : colors.text },
                isDone && styles.strikethrough,
              ]}
            >
              Step {idx + 1}: {step}
            </Text>
          </Pressable>
        );
      })}

      {/* Meal Prep & Reheating */}
      {reheatSteps.length > 0 && (
        <>
          <Text style={[styles.sectionHeading, { color: colors.accent, marginTop: 14 }]}>
            🔥 Meal Prep & Reheating (Skillet / Air Fryer / Microwave)
          </Text>
          {reheatSteps.map((step, idx) => {
            const key = `reheat_${idx}`;
            const isDone = checkedSteps[key];
            return (
              <Pressable key={key} onPress={() => toggleStep(key)} style={styles.stepRow}>
                <Text style={styles.checkbox}>{isDone ? '✅' : '⬜'}</Text>
                <Text
                  style={[
                    styles.stepText,
                    { color: isDone ? colors.textSecondary : colors.text },
                    isDone && styles.strikethrough,
                  ]}
                >
                  {step}
                </Text>
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 20, borderWidth: 1.5, rowGap: 10, columnGap: 10, marginVertical: 8 },
  badgeRow: { flexDirection: 'row', rowGap: 8, columnGap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  reasoning: { fontSize: 14, lineHeight: 20 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', rowGap: 6, columnGap: 6, marginVertical: 6 },
  macroBox: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  macroVal: { fontSize: 16, fontWeight: '800' },
  macroLbl: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionHeading: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  bullet: { fontSize: 14, lineHeight: 22 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', rowGap: 10, columnGap: 10, paddingVertical: 5 },
  checkbox: { fontSize: 18, marginTop: 2 },
  stepText: { fontSize: 14, flex: 1, lineHeight: 20 },
  strikethrough: { textDecorationLine: 'line-through' },
});
