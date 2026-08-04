import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Card, Txt, Eyebrow, Tap, Divider, useTheme } from './ui';
import { Icon } from './icons';
import { splitSteps } from '@/lib/grocery';
import type { MealPlan } from '@/lib/ai';

/**
 * Steps are checkable because this is read standing at a hob with one hand
 * free — the state is intentionally not persisted, since it only means anything
 * for the length of one cook.
 */
export default function RecipeCard({ plan }: { plan: MealPlan }) {
  const c = useTheme();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setDone((p) => ({ ...p, [k]: !p[k] }));

  const cook = splitSteps(plan.recipe.instructions);
  const reheat = splitSteps(plan.recipe.reheat_instructions ?? '');

  const steps = (list: string[], prefix: string, numbered: boolean) =>
    list.map((step, i) => {
      const key = `${prefix}${i}`;
      const isDone = done[key];
      return (
        <Tap
          key={key}
          onPress={() => toggle(key)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!isDone }}
          accessibilityLabel={step}
        >
          <View style={s.step}>
            <View style={[s.box, { borderColor: isDone ? c.accent : c.lineStrong, backgroundColor: isDone ? c.accent : 'transparent' }]}>
              {isDone && <Icon name="check" size={12} color={c.onAccent} strokeWidth={2.4} />}
            </View>
            <Txt variant="body" color={isDone ? c.textFaint : c.text} style={[s.stepText, isDone && s.struck]}>
              {numbered ? `${i + 1}. ` : ''}{step}
            </Txt>
          </View>
        </Tap>
      );
    });

  return (
    <Card style={{ marginTop: Space.md }}>
      <Eyebrow>{plan.recipe.prep_time_min ?? 30} min prep · cook once, eat tomorrow</Eyebrow>
      <Txt variant="heading" style={{ marginTop: Space.sm }}>{plan.recipe.title}</Txt>

      {/* Stated plainly rather than hidden: a generic plate with no explanation
          reads as a bad app, not as a service that was briefly unavailable. */}
      {plan.recipe_source === 'offline' && plan.recipe_note && (
        <View style={[s.fallback, { borderColor: c.line, backgroundColor: c.well }]}>
          <Icon name="alert" size={15} color={c.textDim} />
          <Txt variant="small" color={c.textDim} style={s.fallbackText}>
            {plan.recipe_note}
          </Txt>
        </View>
      )}

      <View style={[s.macros, { backgroundColor: c.well }]}>
        {([
          [String(plan.total_kcal), 'kcal'],
          [`${plan.protein_g}`, 'protein'],
          [`${plan.carbs_g}`, 'carbs'],
          [`${plan.fat_g}`, 'fat'],
        ] as const).map(([v, label]) => (
          <View key={label} style={s.macro}>
            <Txt variant="subheading" style={{ fontSize: 17 }}>{v}</Txt>
            <Eyebrow style={{ marginTop: 3 }}>{label}</Eyebrow>
          </View>
        ))}
      </View>

      <Eyebrow style={s.section}>Ingredients</Eyebrow>
      {plan.recipe.ingredients.map((item, i) => (
        <View key={`${item}-${i}`} style={s.ingredient}>
          <View style={[s.dot, { backgroundColor: c.lineStrong }]} />
          <Txt variant="body" style={{ flex: 1 }}>{item}</Txt>
        </View>
      ))}

      {cook.length > 0 && (
        <>
          <Divider style={{ marginTop: Space.lg }} />
          <Eyebrow style={s.section}>Method</Eyebrow>
          {steps(cook, 'c', true)}
        </>
      )}

      {reheat.length > 0 && (
        <>
          <Divider style={{ marginTop: Space.lg }} />
          <Eyebrow style={s.section} color={c.ember}>Reheating tomorrow</Eyebrow>
          {steps(reheat, 'r', false)}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  fallback: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: Radius.sm, borderWidth: 1,
    padding: Space.md, marginTop: Space.md,
  },
  fallbackText: { flex: 1, marginLeft: Space.sm },
  macros: {
    flexDirection: 'row', borderRadius: Radius.md,
    paddingVertical: Space.base, marginTop: Space.base,
  },
  macro: { flex: 1, alignItems: 'center' },
  section: { marginTop: Space.lg, marginBottom: Space.md },
  ingredient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  dot: { width: 4, height: 4, borderRadius: 2, marginRight: Space.md },
  step: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7 },
  box: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: Space.md, marginTop: 1,
  },
  stepText: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
});
