import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Switch, Share, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Chip, Tap, Notice, PageHeader,
  SegmentedControl, useTheme,
} from '@/components/ui';
import { useLang } from '@/components/lang';
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
  const { lang, t } = useLang();
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
  const [plannerTab, setPlannerTab] = useState<'today' | 'saved'>('today');

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
      const next = await generateMealPlan(profile, training, lang, measured);
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

  return (
    <Screen>
      <Enter index={0}>
        <PageHeader
          tone="plan"
          eyebrow={isRestDay ? t('plan.restDay') : `${sport} · ${duration} min · ${intensity}`}
          title={t('plan.title')}
          sub={t('plan.sub')}
        />
        <SegmentedControl
          values={[
            { id: 'today', label: t('plan.tabToday'), icon: 'plate' },
            { id: 'saved', label: t('plan.tabSaved'), icon: 'clock' },
          ]}
          selected={plannerTab}
          onSelect={setPlannerTab}
          tone="plan"
          style={{ marginBottom: Space.base }}
        />
      </Enter>

      {plannerTab === 'today' ? (
        <>
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
            <Card style={{ marginTop: Space.base }} tone="plan">
              <View style={s.macroRow}>
                {[
                  { label: 'Energy', value: String(preview.kcal), unit: 'kcal', color: c.gold, bg: c.goldWash },
                  { label: 'Protein', value: String(preview.protein_g), unit: 'g', color: c.body, bg: c.bodyWash },
                  { label: 'Carbs', value: String(preview.carbs_g), unit: 'g', color: c.plan, bg: c.planWash },
                  { label: 'Fat', value: String(preview.fat_g), unit: 'g', color: c.hydro, bg: c.hydroWash },
                ].map((m) => (
                  <View key={m.label} style={[s.macroBox, { backgroundColor: m.bg, borderColor: m.color }]}>
                    <Eyebrow color={m.color}>{m.label}</Eyebrow>
                    <Txt variant="heading" style={{ fontSize: 18, marginTop: 4, color: m.color, fontWeight: '700' }}>
                      {m.value}
                    </Txt>
                    <Txt variant="small" color={m.color} style={{ opacity: 0.8, fontSize: 11 }}>
                      {m.unit}
                    </Txt>
                  </View>
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
                  <Txt variant="subheading" style={{ marginLeft: Space.sm }}>{t('plan.restDay')}</Txt>
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
                  <Field label={t('plan.sport')}>
                    {SPORTS.map((x) => (
                      <Chip key={x.id} label={x.label} selected={sport === x.id} onPress={() => setSport(x.id)} tone="plan" style={s.chip} />
                    ))}
                  </Field>
                  <Field label={t('plan.duration')}>
                    {DURATIONS.map((d) => (
                      <Chip key={d} label={`${d} min`} selected={duration === d} onPress={() => setDuration(d)} tone="plan" style={s.chip} />
                    ))}
                  </Field>
                  <Field label={t('plan.effort')}>
                    {INTENSITIES.map((x) => (
                      <Chip key={x.id} label={x.label} selected={intensity === x.id} onPress={() => setIntensity(x.id)} tone="plan" style={s.chip} />
                    ))}
                  </Field>
                  <Field label={t('plan.startsAt')} last>
                    {TIMES.map((t) => (
                      <Chip key={t} label={t} selected={trainingTime === t} onPress={() => setTrainingTime(t)} tone="plan" style={s.chip} />
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
                    {t('plan.building')}
                  </Txt>
                </View>
              ) : (
                <Button label={t('plan.build')} icon="plate" tone="plan" onPress={() => generate()} />
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
                  {t('plan.empty')}
                </Txt>
              </Card>
            </Enter>
          )}
        </>
      ) : (
        <>
          {/* Saved & History Tab */}
          {rotation.length > 0 && (
            <Enter index={1}>
              <View style={[s.rotationHead, { marginTop: Space.base }]}>
                <Eyebrow color={c.plan}>Cooked before</Eyebrow>
                <Txt variant="data" color={c.textFaint}>no quota used</Txt>
              </View>
              {rotation.slice(0, 6).map((r) => (
                <Tap
                  key={r.title}
                  onPress={() => {
                    if (r.recipe) {
                      setPlan({ ...(plan ?? planShell()), recipe: r.recipe } as MealPlan);
                      setPlannerTab('today');
                    }
                  }}
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
            <Enter index={2} style={{ marginTop: rotation.length > 0 ? Space.xl : Space.base }}>
              <Eyebrow color={c.plan} style={{ marginBottom: Space.md }}>{t('plan.recent')}</Eyebrow>
              {history.map((h, i) => (
                <Tap
                  key={`${h.date}-${i}`}
                  onPress={() => {
                    setPlan(h);
                    setPlannerTab('today');
                  }}
                  accessibilityLabel={h.recipe.title}
                >
                  <View style={[s.histRow, { borderColor: c.line, backgroundColor: c.surface }]}>
                    <View style={{ flex: 1 }}>
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

          {rotation.length === 0 && history.length === 0 && (
            <Enter index={1}>
              <Card style={{ marginTop: Space.base, alignItems: 'center', paddingVertical: Space.xxl }}>
                <Icon name="plate" size={28} color={c.textFaint} />
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md, textAlign: 'center' }}>
                  {t('plan.noHistory')}
                </Txt>
              </Card>
            </Enter>
          )}
        </>
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

function Timing({ plan }: { plan: MealPlan }) {
  const c = useTheme();
  const rows: [string, string, boolean, string][] = [];
  if (plan.pre_training_snack_time) rows.push(['Pre-training Snack', plan.pre_training_snack_time, false, 'Snack für Leistung']);
  rows.push(['Hauptmahlzeit', plan.main_meal_time, true, `${plan.total_kcal} kcal · ${plan.protein_g}g Protein`]);
  rows.push(['Fenster schließt', plan.eating_window_end, false, 'Fasten beginnt']);

  return (
    <Card style={{ marginTop: Space.lg }} tone="ember">
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Space.base }}>
        <Icon name="clock" size={18} color={c.ember} />
        <Eyebrow color={c.ember} style={{ marginLeft: 6 }}>Tages-Timing & Essensfenster</Eyebrow>
      </View>

      <View style={s.timingGrid}>
        {rows.map(([label, time, primary, desc]) => (
          <View
            key={label}
            style={[
              s.timingTile,
              {
                backgroundColor: primary ? c.emberWash : c.well,
                borderColor: primary ? c.ember : c.line,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Txt variant={primary ? 'subheading' : 'body'} color={primary ? c.text : c.textDim} style={{ fontWeight: '700' }}>
                {label}
              </Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                {desc}
              </Txt>
            </View>
            <View style={[s.timeBadge, { backgroundColor: primary ? c.ember : c.surface, borderColor: primary ? c.ember : c.line }]}>
              <Txt
                variant="heading"
                color={primary ? c.onAccent : c.text}
                style={{ fontSize: primary ? 20 : 16, fontWeight: '800' }}
              >
                {time}
              </Txt>
            </View>
          </View>
        ))}
      </View>

      {plan.ai_reasoning ? (
        <View style={[s.reasonBox, { backgroundColor: c.well, borderColor: c.line }]}>
          <Txt variant="small" color={c.textDim}>{plan.ai_reasoning}</Txt>
        </View>
      ) : null}

      {plan.timing_warning && <Notice tone="warn">{plan.timing_warning}</Notice>}

      <View style={[s.breakCard, { backgroundColor: c.well, borderColor: c.line }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Space.md }}>
          <Icon name="plate" size={16} color={c.ember} />
          <Eyebrow color={c.ember} style={{ marginLeft: 6 }}>Fastenbrechen — Die richtige Reihenfolge</Eyebrow>
        </View>
        {breakFastSteps(plan.timing_pattern).map((step, i) => (
          <View key={i} style={s.breakRow}>
            <View style={[s.breakNumCircle, { backgroundColor: c.emberWash, borderColor: c.ember }]}>
              <Txt variant="data" color={c.ember} style={{ fontWeight: '700' }}>{i + 1}</Txt>
            </View>
            <Txt variant="small" color={c.text} style={{ flex: 1, marginLeft: Space.sm, marginTop: 2 }}>{step}</Txt>
          </View>
        ))}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  quota: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.base, height: 44, borderRadius: Radius.sm, borderWidth: 1,
  },
  macroRow: { flexDirection: 'row', alignItems: 'center', marginRight: -Space.xs },
  macroBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Space.sm,
    paddingHorizontal: 2,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginRight: Space.xs,
  },
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
  timingGrid: { marginBottom: Space.sm },
  timingTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Space.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Space.sm,
  },
  timeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginLeft: Space.md,
  },
  reasonBox: {
    padding: Space.base,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Space.md,
  },
  breakCard: {
    padding: Space.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Space.sm,
  },
  breakNumCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
