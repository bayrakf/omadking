import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Switch, Share, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Chip, Tap, Divider, Notice, PageHeader, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import RecipeCard from '@/components/RecipeCard';
import {
  dailyTargets, breakFastSteps, mealTiming, DEFAULT_PROFILE,
  type Intensity, type Training, type UserProfile,
} from '@/lib/nutrition';
import { generateMealPlan, QuotaError, type MealPlan } from '@/lib/ai';
import {
  loadProfileOrDefault, loadPlanHistory, savePlan, getQuota, consumeQuota,
  loadLastSession, saveLastSession, loadPortions, savePortions,
  loadIntakeLog, loadWeightLog, isPremium, loadCookedRecipes, todayISO, type Quota,
} from '@/lib/store';
import type { CookedRecipe } from '@/lib/grocery';
import { effectiveMaintenance } from '@/lib/energy';
import { resync } from '@/lib/notify';

const SPORTS = [
  { id: 'running', label: 'Running' },
  { id: 'weights', label: 'Weights' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'soccer', label: 'Football' },
  { id: 'boxing', label: 'Boxing' },
  { id: 'yoga', label: 'Yoga' },
];
const DURATIONS = [30, 45, 60, 90, 120];
const INTENSITIES: { id: Intensity; label: string }[] = [
  { id: 'low', label: 'Easy' },
  { id: 'medium', label: 'Moderate' },
  { id: 'high', label: 'Hard' },
  { id: 'max', label: 'All out' },
];
const TIMES = ['06:00', '12:00', '17:00', '18:00', '19:00', '20:00'];

export default function PlannerScreen() {
  const c = useTheme();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [quota, setQuota] = useState<Quota | null>(null);
  /** One rejection per paid build. See the comment on `generate`. */
  const [retryFree, setRetryFree] = useState(false);

  const [isRestDay, setIsRestDay] = useState(false);
  const [sport, setSport] = useState('weights');
  const [duration, setDuration] = useState(60);
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [trainingTime, setTrainingTime] = useState('18:00');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [portions, setPortions] = useState(1);
  // Undefined until measured — dailyTargets then behaves exactly as before.
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [rotation, setRotation] = useState<CookedRecipe[]>([]);
  const [history, setHistory] = useState<MealPlan[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const p = await loadProfileOrDefault();
        const [h, q, batch, intake, weights, prem, cooked, last] = await Promise.all([
          loadPlanHistory<MealPlan>(),
          getQuota(),
          loadPortions(),
          loadIntakeLog(),
          loadWeightLog(),
          isPremium(),
          loadCookedRecipes(),
          // Prefill from the last session, falling back to the profile's usual
          // training time when there is nothing stored yet.
          loadLastSession(p.default_training_time),
        ]);
        if (!active) return;
        setProfile(p);
        setIsRestDay(last.restDay);
        setSport(last.sport);
        setDuration(last.duration_min);
        setIntensity(last.intensity);
        setTrainingTime(last.start_time);
        setHistory(h);
        setQuota(q);
        setPortions(batch);
        setRotation(cooked);
        setMeasured(
          effectiveMaintenance(intake, weights, dailyTargets(p, null).maintenance_kcal, prem)
        );
        setMounted(true);
      })();
      return () => { active = false; };
    }, [])
  );

  if (!mounted) return null;

  const training: Training | null = isRestDay
    ? null
    : { sport, duration_min: duration, intensity, start_time: trainingTime };

  // Live preview — the figures move as you change the session, so it is obvious
  // that intensity and duration actually drive the plan.
  // Follows the measured maintenance once there is one; otherwise the formula.
  const preview = dailyTargets(profile, training, measured);

  /**
   * The numbers a re-cooked recipe hangs on when nothing is on screen yet.
   *
   * Tapping "Cooked before" used to spread the recipe onto `{}`, so the timing
   * row and the macro row rendered `undefined`. Everything here is already
   * computed above for the live preview.
   */
  const planShell = (): MealPlan => {
    const t = mealTiming(profile, training);
    return {
      date: todayISO(),
      eating_window_start: t.eating_window_start,
      eating_window_end: t.eating_window_end,
      total_kcal: preview.kcal,
      protein_g: preview.protein_g,
      carbs_g: preview.carbs_g,
      fat_g: preview.fat_g,
      pre_training_snack_time: t.pre_training_snack_time,
      main_meal_time: t.main_meal_time,
      ai_reasoning: '',
      timing_warning: t.warning,
      training_burn_kcal: preview.burn_kcal,
      recipe_source: 'offline',
      recipe_note: null,
      timing_pattern: t.pattern,
      training_start_time: training?.start_time ?? null,
      training_duration_min: training?.duration_min ?? 0,
      recipe: { title: '', ingredients: [], instructions: '', reheat_instructions: '', prep_time_min: 0, is_meal_prep: true },
    };
  };

  /**
   * ponytail: the free-rejection flag lives in screen state, not storage, so
   * navigating away loses it. Persist it if anyone complains — a rejection is
   * something you do within seconds of seeing the plate.
   */
  const generate = async (free = false) => {
    if (quota && !quota.premium && quota.remaining <= 0) return router.push('/paywall');
    setLoading(true);
    setError(null);
    try {
      const next = await generateMealPlan(profile, training, measured);
      // Remembered only once a plan was actually built, so idly tapping through
      // the options does not overwrite what worked yesterday.
      await saveLastSession({
        restDay: isRestDay,
        sport,
        duration_min: duration,
        intensity,
        start_time: trainingTime,
      });
      setPlan(next);
      setHistory(await savePlan(next));
      // Only a real generated recipe costs one of the three weekly plans.
      // Charging for the built-in fallback would bill the user for an outage —
      // and neither should the one free rejection, or a recipe someone cannot
      // eat would cost them a third of their week.
      if (next.recipe_source === 'ai' && !free) await consumeQuota();
      // A paid build earns a rejection; a rejection does not earn another.
      setRetryFree(!free);
      // Cook and meal times just moved, so the schedule has to follow.
      await resync();
      setQuota(await getQuota());
    } catch (e) {
      if (e instanceof QuotaError) router.push('/paywall');
      else setError('Could not reach the planner. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const share = async (p: MealPlan) => {
    const text =
      `${p.recipe.title}\n\n` +
      `Eat at ${p.main_meal_time} · window ${p.eating_window_start}–${p.eating_window_end}\n` +
      (p.pre_training_snack_time ? `Pre-training snack at ${p.pre_training_snack_time}\n` : '') +
      `\n${p.total_kcal} kcal · P ${p.protein_g}g · C ${p.carbs_g}g · F ${p.fat_g}g\n\n` +
      `Ingredients\n${p.recipe.ingredients.map((i) => `- ${i}`).join('\n')}\n\n` +
      `Method\n${p.recipe.instructions}` +
      (p.recipe.reheat_instructions ? `\n\nReheat\n${p.recipe.reheat_instructions}` : '');

    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError('Clipboard is blocked in this browser.');
      }
    } else {
      await Share.share({ message: text });
    }
  };

  const macros = [
    ['Energy', String(preview.kcal), 'kcal'],
    ['Protein', String(preview.protein_g), 'g'],
    ['Carbs', String(preview.carbs_g), 'g'],
    ['Fat', String(preview.fat_g), 'g'],
  ] as const;

  return (
    <Screen>
      <Enter index={0}>
        <PageHeader
          eyebrow={isRestDay ? 'Rest day' : `${sport} · ${duration} min · ${intensity}`}
          title="Plan the meal"
          sub="Your targets follow the session you actually do."
        />
      </Enter>

      {quota && !quota.premium && (
        <Enter index={1}>
          <Tap onPress={() => router.push('/paywall')} accessibilityLabel="Upgrade">
            <View style={[s.quota, { borderColor: c.line, backgroundColor: c.surface }]}>
              <Eyebrow color={quota.remaining > 0 ? c.textDim : c.ember}>
                {quota.remaining > 0 ? `${quota.remaining} of ${quota.limit} plans left this week` : 'Weekly plans used'}
              </Eyebrow>
              <Txt variant="small" color={c.accent}>Upgrade</Txt>
            </View>
          </Tap>
        </Enter>
      )}

      {/* Live targets */}
      <Enter index={2}>
        <Card style={{ marginTop: Space.base }} tone="accent">
          <View style={s.macroRow}>
            {macros.map(([label, value, unit], i) => (
              <React.Fragment key={label}>
                {i > 0 && <Divider style={s.vline} />}
                <View style={s.macro}>
                  <Eyebrow>{label}</Eyebrow>
                  {/* Unit sits under the figure: inline, a four-digit kcal value
                      collided with the next column's divider. */}
                  <Txt variant="heading" style={{ fontSize: 21, marginTop: 5 }}>{value}</Txt>
                  <Txt variant="small" color={c.textFaint}>{unit}</Txt>
                </View>
              </React.Fragment>
            ))}
          </View>
          {preview.burn_kcal > 0 && (
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.base }}>
              Includes about {preview.burn_kcal} kcal for the session.
            </Txt>
          )}
        </Card>
      </Enter>

      {/* Session */}
      <Enter index={3}>
        <Card style={{ marginTop: Space.base }}>
          <View style={s.restRow}>
            <View style={s.rowCentre}>
              <Icon name="moon" size={18} color={isRestDay ? c.accent : c.textFaint} />
              <Txt variant="subheading" style={{ marginLeft: Space.sm }}>Rest day</Txt>
            </View>
            <Switch
              value={isRestDay}
              onValueChange={setIsRestDay}
              trackColor={{ false: c.well, true: c.accentDim }}
              thumbColor={isRestDay ? c.accent : '#FFFFFF'}
            />
          </View>

          {!isRestDay && (
            <View style={{ marginTop: Space.lg }}>
              <Field label="Sport">
                {SPORTS.map((x) => (
                  <Chip key={x.id} label={x.label} selected={sport === x.id} onPress={() => setSport(x.id)} style={s.chip} />
                ))}
              </Field>
              <Field label="Duration">
                {DURATIONS.map((d) => (
                  <Chip key={d} label={`${d} min`} selected={duration === d} onPress={() => setDuration(d)} style={s.chip} />
                ))}
              </Field>
              <Field label="Effort">
                {INTENSITIES.map((x) => (
                  <Chip key={x.id} label={x.label} selected={intensity === x.id} onPress={() => setIntensity(x.id)} style={s.chip} />
                ))}
              </Field>
              <Field label="Starts at" last>
                {TIMES.map((t) => (
                  <Chip key={t} label={t} selected={trainingTime === t} onPress={() => setTrainingTime(t)} style={s.chip} />
                ))}
              </Field>
            </View>
          )}
        </Card>
      </Enter>

      <Enter index={4}>
        <View style={{ marginTop: Space.base }}>
          {loading ? (
            <View style={[s.loading, { backgroundColor: c.well }]}>
              <ActivityIndicator color={c.accent} />
              <Txt variant="small" color={c.textDim} style={{ marginLeft: Space.md }}>
                Building your plan…
              </Txt>
            </View>
          ) : (
            <Button label="Build the plan" icon="plate" onPress={() => generate()} />
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {copied && <Notice tone="ok">Copied to clipboard.</Notice>}
        </View>
      </Enter>

      {plan ? (
        <Enter index={5}>
          <Timing plan={plan} />
          <RecipeCard
            plan={plan}
            portions={portions}
            onPortions={(n) => { setPortions(n); savePortions(n); }}
          />
          {/* A plate you cannot eat used to cost a third of your week. */}
          {retryFree && (
            <Button
              label="Not this one"
              variant="secondary"
              onPress={() => generate(true)}
              style={{ marginTop: Space.md }}
            />
          )}
          <Button
            label={Platform.OS === 'web' ? 'Copy plan' : 'Share plan'}
            icon="share"
            variant="ghost"
            onPress={() => share(plan)}
            style={{ marginTop: Space.md }}
          />
        </Enter>
      ) : (
        <Enter index={5}>
          <Card style={{ marginTop: Space.base, alignItems: 'center', paddingVertical: Space.xxl }}>
            <Icon name="clock" size={24} color={c.textFaint} />
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md, textAlign: 'center' }}>
              Set the session above, then build a plan with the exact times to eat.
            </Txt>
          </Card>
        </Enter>
      )}

      {/* The meals actually cooked, which outlive the ten-plan window. Tapping
          one costs no quota: nothing is generated, it is the user's own recipe
          coming back. Three weeks in, this is what people want — their
          rotation, not another stranger. */}
      {rotation.length > 0 && (
        <Enter index={6} style={{ marginTop: Space.xxl }}>
          <View style={s.rotationHead}>
            <Eyebrow>Cooked before</Eyebrow>
            <Txt variant="data" color={c.textFaint}>no plan used</Txt>
          </View>
          {rotation.slice(0, 6).map((r) => (
            <Tap
              key={r.title}
              // Without a plan on screen this used to produce a MealPlan with
              // no macros and no times, and Timing and RecipeCard rendered
              // `undefined`. The numbers come from the same targets the screen
              // is already showing above.
              onPress={() => r.recipe && setPlan({ ...(plan ?? planShell()), recipe: r.recipe } as MealPlan)}
              accessibilityLabel={`Cook ${r.title} again`}
            >
              <View style={[s.histRow, { borderColor: c.line, backgroundColor: c.surface }]}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium" numberOfLines={2}>{r.title}</Txt>
                  <Txt variant="data" color={c.textFaint} style={{ marginTop: 3 }}>
                    cooked {r.count}×{r.lastCooked ? ` · last ${r.lastCooked}` : ''}
                  </Txt>
                </View>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </Tap>
          ))}
        </Enter>
      )}

      {history.length > 0 && (
        <Enter index={6} style={{ marginTop: Space.xxl }}>
          <Eyebrow style={{ marginBottom: Space.md }}>Recent plans</Eyebrow>
          {history.map((h, i) => (
            <Tap key={`${h.date}-${i}`} onPress={() => setPlan(h)} accessibilityLabel={h.recipe.title}>
              <View style={[s.histRow, { borderColor: c.line, backgroundColor: c.surface }]}>
                <View style={{ flex: 1 }}>
                  {/* Two lines: at one, "Seared Honey-Sesame Chicken Breast with Jasm…" is a
                      riddle rather than a title. */}
                  <Txt variant="bodyMedium" numberOfLines={2}>{h.recipe.title}</Txt>
                  <Txt variant="data" color={c.textFaint} style={{ marginTop: 3 }}>
                    {h.date} · {h.total_kcal} kcal · {h.protein_g}g P
                  </Txt>
                </View>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </Tap>
          ))}
        </Enter>
      )}
    </Screen>
  );
}

function Field({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={{ marginBottom: last ? 0 : Space.lg }}>
      <Eyebrow style={{ marginBottom: Space.md }}>{label}</Eyebrow>
      <View style={s.wrap}>{children}</View>
    </View>
  );
}

/** The answer the product exists to give. */
function Timing({ plan }: { plan: MealPlan }) {
  const c = useTheme();
  const rows: [string, string, boolean][] = [];
  if (plan.pre_training_snack_time) rows.push(['Pre-training snack', plan.pre_training_snack_time, false]);
  rows.push(['Main meal', plan.main_meal_time, true]);
  rows.push(['Window closes', plan.eating_window_end, false]);

  return (
    <Card style={{ marginTop: Space.lg }} tone="ember">
      <Eyebrow style={{ marginBottom: Space.base }}>Today’s timing</Eyebrow>
      {rows.map(([label, time, primary], i) => (
        <View key={label}>
          {i > 0 && <Divider style={{ marginVertical: Space.md }} />}
          <View style={s.timeRow}>
            <Txt variant={primary ? 'subheading' : 'body'} color={primary ? c.text : c.textDim}>{label}</Txt>
            <Txt
              variant="heading"
              color={primary ? c.ember : c.text}
              style={{ fontSize: primary ? 24 : 18 }}
            >
              {time}
            </Txt>
          </View>
        </View>
      ))}
      <Txt variant="small" color={c.textDim} style={{ marginTop: Space.base }}>{plan.ai_reasoning}</Txt>
      {plan.timing_warning && <Notice tone="warn">{plan.timing_warning}</Notice>}

      {/* The app has worked out when to eat since the timing engine landed and
          never said how. After twenty-odd hours the order matters. */}
      <Divider style={{ marginVertical: Space.base }} />
      <Eyebrow style={{ marginBottom: Space.md }}>Breaking the fast</Eyebrow>
      {breakFastSteps(plan.timing_pattern).map((step, i) => (
        <View key={i} style={s.breakRow}>
          <Txt variant="data" color={c.ember} style={s.breakNum}>{i + 1}</Txt>
          <Txt variant="small" color={c.textDim} style={{ flex: 1 }}>{step}</Txt>
        </View>
      ))}
    </Card>
  );
}

const s = StyleSheet.create({
  quota: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.base, height: 44, borderRadius: Radius.sm, borderWidth: 1,
  },
  macroRow: { flexDirection: 'row', alignItems: 'center' },
  macro: { flex: 1 },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5 },
  vline: { width: 1, height: 34, marginHorizontal: Space.sm },
  restRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCentre: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -Space.sm },
  chip: { marginRight: Space.sm, marginBottom: Space.sm },
  loading: {
    height: 54, borderRadius: Radius.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rotationHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.md },
  breakRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Space.md },
  breakNum: { width: 20 },
  histRow: {
    flexDirection: 'row', alignItems: 'center', padding: Space.base,
    borderRadius: Radius.md, borderWidth: 1, marginBottom: Space.sm,
  },
});
