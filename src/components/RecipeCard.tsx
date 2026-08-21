import { Radius, Space } from '@/constants/theme';
import type { MealPlan } from '@/lib/ai';
import { scaleIngredients, splitAmount, splitSteps } from '@/lib/grocery';
import { isFavoriteRecipe, toggleFavoriteRecipe } from '@/lib/store';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Icon } from './icons';
import { useLang } from './lang';
import { Card, Eyebrow, Tap, Txt, useTheme, useTone, washOf } from './ui';

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
  const { lang, t } = useLang();
  const plan_ = useTone('plan');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [favorite, setFavorite] = useState(false);
  const toggle = (k: string) => setDone((p) => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    isFavoriteRecipe(plan.recipe.title).then(setFavorite);
  }, [plan.recipe.title]);

  const onToggleFav = async () => {
    const next = await toggleFavoriteRecipe(plan);
    setFavorite(next);
  };

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
      <View style={s.imageWrapper}>
        <Image
          source={require('../../assets/images/omad_plate_hero.jpg')}
          style={s.foodImage}
          resizeMode="cover"
        />
        {plan.complexity === 'chef' && (
          <View style={[s.chefImageBadge, { backgroundColor: 'rgba(20, 17, 14, 0.82)', borderColor: c.gold }]}>
            <Icon name="crown" size={11} color={c.gold} />
            <Txt variant="eyebrow" color={c.gold} style={{ fontSize: 9, fontWeight: '800', marginLeft: 4 }}>
              GOURMET PLATING ARCHITEKTUR
            </Txt>
          </View>
        )}
        <TouchableOpacity
          onPress={onToggleFav}
          activeOpacity={0.75}
          style={[
            s.favBtn,
            {
              // Gold, not red: a favourite is something kept, and red here
              // read as "remove". Gold is the palette's "worth keeping".
              backgroundColor: favorite ? c.gold : 'rgba(20, 17, 14, 0.72)',
              borderColor: favorite ? c.gold : 'rgba(255, 252, 247, 0.28)',
            },
          ]}
          accessibilityLabel={favorite ? 'Favorit' : 'Als Favorit speichern'}
        >
          <Icon name="check" size={13} color={favorite ? '#231303' : '#FFFFFF'} strokeWidth={2.4} />
          <Txt variant="eyebrow" color={favorite ? '#231303' : '#FFFFFF'} style={{ fontSize: 10, fontWeight: '800', marginLeft: 4 }}>
            {favorite ? 'FAVORIT' : '+FAVORIT'}
          </Txt>
        </TouchableOpacity>
      </View>
      <View style={s.cardTopRow}>
        <Eyebrow style={{ marginTop: Space.xs }}>{t('recipe.prep', { min: plan.recipe.prep_time_min ?? 30 })}</Eyebrow>
        {plan.complexity && plan.complexity !== 'balanced' && (
          <View style={[
            s.complexityBadge,
            plan.complexity === 'chef'
              ? { backgroundColor: washOf(c.gold), borderColor: c.gold }
              : { backgroundColor: c.well, borderColor: c.line },
          ]}>
            <Txt
              variant="eyebrow"
              style={{ fontSize: 10, fontWeight: '800' }}
              color={plan.complexity === 'chef' ? c.gold : c.textDim}
            >
              {plan.complexity === 'quick' ? '⚡ BLITZ · ≤15 MIN' : '👨‍🍳 CHEF-LEVEL'}
            </Txt>
          </View>
        )}
      </View>
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

      {/* Same macro language as the planner's daily-target card: neutral
          wells, one coloured dot each. Four full-colour boxes here fought the
          card photo and the ingredient badges for attention; the dot keeps
          the mapping legible without shouting. */}
      <View style={s.macros}>
        {[
          { v: String(plan.total_kcal), label: 'KCAL', color: c.ember },
          { v: `${plan.protein_g}g`, label: 'PROTEIN', color: c.plan },
          { v: `${plan.carbs_g}g`, label: 'CARBS', color: c.hydro },
          { v: `${plan.fat_g}g`, label: lang === 'de' ? 'FETT' : 'FAT', color: c.gold },
        ].map((m) => (
          <View key={m.label} style={[s.macro, { backgroundColor: c.well, borderColor: c.line }]}>
            <View style={[s.macroDot, { backgroundColor: m.color }]} />
            <Txt variant="subheading" style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{m.v}</Txt>
            <Eyebrow style={{ marginTop: 2 }} color={c.textDim}>{m.label}</Eyebrow>
          </View>
        ))}
      </View>
      <View style={[s.subCard, { backgroundColor: c.well, borderColor: c.line }]}>
        <View style={s.ingredientHead}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Icon name="basket" size={16} color={plan_.ink} />
            <Eyebrow color={plan_.ink} style={{ marginLeft: 6 }}>{t('recipe.ingredients')}</Eyebrow>
          </View>
          {onPortions && (
            <View style={s.portions}>
              {[1, 2, 3, 4].map((n) => (
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
                        backgroundColor: portions === n ? plan_.ink : c.surface,
                      },
                    ]}
                  >
                    <Txt variant="data" color={portions === n ? c.onAccent : c.textDim} style={{ fontWeight: '700' }}>
                      {n}×
                    </Txt>
                  </View>
                </Tap>
              ))}
            </View>
          )}
        </View>
        {portions > 1 && (
          <View style={[s.batchNotice, { backgroundColor: plan_.fill, borderColor: plan_.edge }]}>
            <Icon name="basket" size={13} color={plan_.ink} />
            <Txt variant="small" color={plan_.ink} style={{ marginLeft: 6, fontWeight: '600' }}>
              Meal-Prep Modus: Zutaten für {portions} Tage automatisch skaliert.
            </Txt>
          </View>
        )}
        {scaleIngredients(plan.recipe.ingredients, portions).map((item, i) => {
          const { amount, name } = splitAmount(item);
          return (
            <View key={`${item}-${i}`} style={s.ingredient}>
              {amount ? (
                <View style={[s.amountBadge, { backgroundColor: plan_.fill, borderColor: plan_.edge }]}>
                  <Txt variant="data" color={plan_.ink} style={s.amount}>{amount}</Txt>
                </View>
              ) : (
                <View style={s.amountBadgeEmpty} />
              )}
              <Txt variant="body" style={s.ingredientName}>{name}</Txt>
            </View>
          );
        })}
      </View>

      {cook.length > 0 && (
        <View style={[s.subCard, { backgroundColor: c.well, borderColor: c.line, marginTop: Space.base }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Space.md }}>
            <Icon name="plate" size={16} color={plan_.ink} />
            <Eyebrow color={plan_.ink} style={{ marginLeft: 6 }}>{t('recipe.method')}</Eyebrow>
          </View>
          {steps(cook, 'c', true, plan_.ink)}
        </View>
      )}

      {reheat.length > 0 && (
        <View style={[s.subCard, { backgroundColor: c.goldWash, borderColor: c.gold, marginTop: Space.base }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Space.md }}>
            <Icon name="flame" size={16} color={c.gold} />
            <Eyebrow color={c.gold} style={{ marginLeft: 6 }}>{t('recipe.reheat')}</Eyebrow>
          </View>
          {steps(reheat, 'r', false, c.gold)}
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: 170,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Space.sm,
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  chefImageBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  favBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  subCard: {
    padding: Space.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Space.base,
  },
  recipeTitle: { marginTop: Space.xs, fontSize: 22, fontWeight: '700' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Space.xs },
  complexityBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.pill, borderWidth: 1,
  },
  fallback: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Space.md,
  },
  fallbackText: { flex: 1, marginLeft: Space.sm },
  macros: {
    flexDirection: 'row',
    marginTop: Space.base,
    marginRight: -Space.xs,
  },
  macro: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Space.sm,
    paddingHorizontal: 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginRight: Space.xs,
  },
  macroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginBottom: 4,
  },
  ingredientHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.md,
  },
  batchNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Space.md,
  },
  portions: { flexDirection: 'row' },
  portion: {
    paddingHorizontal: Space.sm,
    minHeight: 28,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.xs,
  },
  ingredient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  amountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minWidth: 54,
    alignItems: 'center',
    marginRight: Space.sm,
  },
  amountBadgeEmpty: { width: 54, marginRight: Space.sm },
  amount: { fontSize: 12, fontWeight: '600' },
  ingredientName: { flex: 1 },
  step: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Space.sm },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
    marginTop: 1,
  },
  boxNumbered: { borderRadius: Radius.pill },
  stepText: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
});
