import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
import { splitSteps } from '@/lib/grocery';

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
  prepTimeMin = 30,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const toggleStep = (key: string) => setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }));

  const cookSteps = splitSteps(instructions);
  const reheatSteps = splitSteps(reheatInstructions ?? '');

  const renderSteps = (steps: string[], prefix: string, numbered: boolean) =>
    steps.map((step, idx) => {
      const key = `${prefix}_${idx}`;
      const isDone = checkedSteps[key];
      return (
        <Pressable
          key={key}
          onPress={() => toggleStep(key)}
          style={styles.stepRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!isDone }}
        >
          <Text style={styles.checkbox}>{isDone ? '✅' : '⬜'}</Text>
          <Text
            style={[
              styles.stepText,
              { color: isDone ? colors.textSecondary : colors.text },
              isDone && styles.strikethrough,
            ]}
          >
            {numbered ? `${idx + 1}. ` : ''}
            {step}
          </Text>
        </Pressable>
      );
    });

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
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
          <Text style={[styles.badgeTxt, { color: colors.primary }]}>⚡ {proteinG}g protein</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <Text style={[styles.badgeTxt, { color: colors.accent }]}>👨‍🍳 {prepTimeMin ?? 30} min prep</Text>
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.reasoning, { color: colors.textSecondary }]}>{reasoning}</Text>

      <View style={styles.macroRow}>
        {(
          [
            [String(totalKcal), 'kcal'],
            [`${proteinG}g`, 'Protein'],
            [`${carbsG}g`, 'Carbs'],
            [`${fatG}g`, 'Fat'],
          ] as const
        ).map(([val, lbl]) => (
          <View key={lbl} style={[styles.macroBox, { backgroundColor: colors.backgroundElement }]}>
            <Text style={[styles.macroVal, { color: colors.primary }]}>{val}</Text>
            <Text style={[styles.macroLbl, { color: colors.textSecondary }]}>{lbl}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionHeading, { color: colors.text }]}>🛒 Ingredients</Text>
      {ingredients.map((item, idx) => (
        <Text key={`${item}-${idx}`} style={[styles.bullet, { color: colors.text }]}>
          • {item}
        </Text>
      ))}

      {cookSteps.length > 0 && (
        <>
          <Text style={[styles.sectionHeading, { color: colors.primary }]}>👨‍🍳 Method</Text>
          {renderSteps(cookSteps, 'cook', true)}
        </>
      )}

      {reheatSteps.length > 0 && (
        <>
          <Text style={[styles.sectionHeading, { color: colors.accent }]}>🔥 Reheating tomorrow</Text>
          {renderSteps(reheatSteps, 'reheat', false)}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Spacing is margin-based: `gap` / `rowGap` break this RN-Web version.
  card: { borderRadius: 20, padding: 20, borderWidth: 1.5, marginVertical: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, marginRight: -8 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 8, marginBottom: 4 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  reasoning: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  macroRow: { flexDirection: 'row', marginTop: 16, marginBottom: 8, marginRight: -6 },
  macroBox: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginRight: 6 },
  macroVal: { fontSize: 16, fontWeight: '800' },
  macroLbl: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionHeading: { fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  bullet: { fontSize: 14, lineHeight: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  checkbox: { fontSize: 18, marginTop: 1, marginRight: 10 },
  stepText: { fontSize: 14, flex: 1, lineHeight: 21 },
  strikethrough: { textDecorationLine: 'line-through' },
});
