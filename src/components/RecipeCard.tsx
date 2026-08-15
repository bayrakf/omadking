import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Card, Txt, Eyebrow, Tap, Divider, useTheme, useTone } from './ui';
import { useT } from './lang';
import { Icon } from './icons';
import { splitSteps, scaleIngredients, splitAmount } from '@/lib/grocery';
import type { MealPlan } from '@/lib/ai';

/**
 * Steps are checkable because this is read standing at a hob with one hand
 * free — the state is intentionally not persisted, since it only means anything
 * for the length of one cook.
 */
export default function RecipeCard({
  plan,
  portions = 1,
  onPortions,
}: {
  plan: MealPlan;
  portions?: number;
  onPortions?: (n: number) => void;
}) {
  const c = useTheme();
  const t = useT();
  const plan_ = useTone('plan');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setDone((p) => ({ ...p, [k]: !p[k] }));

  const cook = splitSteps(plan.recipe.instructions);
  const reheat = splitSteps(plan.recipe.reheat_instructions ?? '');

  /**
   * The box shows the step's number until it is ticked, then the check.
   *
   * It used to be a bare box beside a paragraph that opened "1. ", so the
   * order lived in the prose and the box was a second, wordless column. One
   * element can carry both: standing at a hob you are looking for "where was
   * I", and a numbered token that fills in as you go answers that from across
   * the kitchen. Unnumbered lists (reheating, where the steps are
   * alternatives rather than a sequence) keep the plain box.
   */
  const steps = (list: string[], prefix: string, numbered: boolean, tint: string) =>
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
            <View
              style={[
                s.box,
                numbered && s.boxNumbered,
                { borderColor: isDone ? tint : c.lineStrong, backgroundColor: isDone ? tint : 'transparent' },
              ]}
            >
              {isDone ? (
                <Icon name="check" size={12} color={c.onAccent} strokeWidth={2.4} />
              ) : numbered ? (
                <Txt variant="data" color={tint}>{i + 1}</Txt>
              ) : null}
            </View>
            <Txt variant="body" color={isDone ? c.textFaint : c.text} style={[s.stepText, isDone && s.struck]}>
              {step}
            </Txt>
          </View>
        </Tap>
      );
    });

  return (
    <Card style={{ marginTop: Space.md }}>
      <Eyebrow>{t('recipe.prep', { min: plan.recipe.prep_time_min ?? 30 })}</Eyebrow>
      <Txt variant="heading" style={s.recipeTitle}>{plan.recipe.title}</Txt>

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

      <View style={[s.macros, { backgroundColor: plan_.fill, borderColor: plan_.edge }]}>
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

      <View style={s.ingredientHead}>
        <Eyebrow color={plan_.ink}>{t('recipe.ingredients')}</Eyebrow>
        {onPortions && (
          <View style={s.portions}>
            {[1, 2, 3].map((n) => (
              <Tap
                key={n}
                onPress={() => onPortions(n)}
                accessibilityRole="radio"
                accessibilityState={{ checked: portions === n }}
                accessibilityLabel={`${n} portions`}
              >
                <View
                  style={[
                    s.portion,
                    {
                      borderColor: portions === n ? plan_.ink : c.line,
                      backgroundColor: portions === n ? plan_.ink : 'transparent',
                    },
                  ]}
                >
                  <Txt variant="data" color={portions === n ? c.onAccent : c.textDim}>
                    {n}×
                  </Txt>
                </View>
              </Tap>
            ))}
          </View>
        )}
      </View>
      {/* Amount left, food right, both starting on the same vertical line.
          A dot bullet ahead of a run-on sentence put every quantity at a
          different indent, which is the one thing this list is scanned for. */}
      {scaleIngredients(plan.recipe.ingredients, portions).map((item, i) => {
        const { amount, name } = splitAmount(item);
        return (
          <View key={`${item}-${i}`} style={s.ingredient}>
            {amount ? (
              <Txt variant="data" color={plan_.ink} style={s.amount}>{amount}</Txt>
            ) : (
              <View style={s.amount} />
            )}
            <Txt variant="body" style={s.ingredientName}>{name}</Txt>
          </View>
        );
      })}

      {cook.length > 0 && (
        <>
          <Divider style={{ marginTop: Space.lg }} />
          <Eyebrow style={s.section} color={plan_.ink}>{t('recipe.method')}</Eyebrow>
          {steps(cook, 'c', true, plan_.ink)}
        </>
      )}

      {reheat.length > 0 && (
        <>
          <Divider style={{ marginTop: Space.lg }} />
          <Eyebrow style={s.section} color={c.ember}>{t('recipe.reheat')}</Eyebrow>
          {steps(reheat, 'r', false, c.ember)}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  recipeTitle: { marginTop: Space.sm, lineHeight: 27 },
  fallback: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: Radius.sm, borderWidth: 1,
    padding: Space.md, marginTop: Space.md,
  },
  fallbackText: { flex: 1, marginLeft: Space.sm },
  macros: {
    flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1,
    paddingVertical: Space.base, marginTop: Space.base,
  },
  macro: { flex: 1, alignItems: 'center' },
  section: { marginTop: Space.lg, marginBottom: Space.md },
  ingredientHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Space.lg, marginBottom: Space.md,
  },
  portions: { flexDirection: 'row', marginRight: -Space.xs },
  portion: {
    minWidth: 34, minHeight: 28, borderRadius: Radius.pill, borderWidth: 1, paddingVertical: 3,
    alignItems: 'center', justifyContent: 'center', marginRight: Space.xs,
    paddingHorizontal: Space.sm,
  },
  ingredient: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  // Fixed, so the food names line up whatever the numbers do. Wide enough for
  // "1.82kg"; anything longer wraps inside its own column rather than pushing
  // the names out of alignment.
  amount: { width: 72, marginRight: Space.md, marginTop: 2 },
  ingredientName: { flex: 1 },
  step: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7 },
  box: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: Space.md, marginTop: 1,
  },
  /** A numeral needs a round token, not a checkbox that happens to hold one. */
  boxNumbered: { width: 24, height: 24, borderRadius: 12 },
  stepText: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
});
