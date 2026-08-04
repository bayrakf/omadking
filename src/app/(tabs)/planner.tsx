import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Switch, Share, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Chip, Tap, Divider, Notice, PageHeader, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import RecipeCard from '@/components/RecipeCard';
import { dailyTargets, DEFAULT_PROFILE, type Intensity, type Training, type UserProfile } from '@/lib/nutrition';
import { generateMealPlan, QuotaError, type MealPlan } from '@/lib/ai';
import { loadProfileOrDefault, loadPlanHistory, savePlan, getQuota, consumeQuota, type Quota } from '@/lib/store';
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

  const [isRestDay, setIsRestDay] = useState(false);
  const [sport, setSport] = useState('weights');
  const [duration, setDuration] = useState(60);
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [trainingTime, setTrainingTime] = useState('18:00');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [history, setHistory] = useState<MealPlan[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, h, q] = await Promise.all([loadProfileOrDefault(), loadPlanHistory<MealPlan>(), getQuota()]);
        if (!active) return;
        setProfile(p);
        setTrainingTime(p.default_training_time);
        setHistory(h);
        setQuota(q);
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
  const preview = dailyTargets(profile, training);

  const generate = async () => {
    if (quota && !quota.premium && quota.remaining <= 0) return router.push('/paywall');
    setLoading(true);
    setError(null);
    try {
      const next = await generateMealPlan(profile, training);
      setPlan(next);
      setHistory(await savePlan(next));
      // Only a real generated recipe costs one of the three weekly plans.
      // Charging for the built-in fallback would bill the user for an outage.
      if (next.recipe_source === 'ai') await consumeQuota();
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
            <Button label="Build the plan" icon="plate" onPress={generate} />
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {copied && <Notice tone="ok">Copied to clipboard.</Notice>}
        </View>
      </Enter>

      {plan ? (
        <Enter index={5}>
          <Timing plan={plan} />
          <RecipeCard plan={plan} />
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

      {history.length > 0 && (
        <Enter index={6} style={{ marginTop: Space.xxl }}>
          <Eyebrow style={{ marginBottom: Space.md }}>Recent plans</Eyebrow>
          {history.map((h, i) => (
            <Tap key={`${h.date}-${i}`} onPress={() => setPlan(h)} accessibilityLabel={h.recipe.title}>
              <View style={[s.histRow, { borderColor: c.line, backgroundColor: c.surface }]}>
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyMedium" numberOfLines={1}>{h.recipe.title}</Txt>
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
  histRow: {
    flexDirection: 'row', alignItems: 'center', padding: Space.base,
    borderRadius: Radius.md, borderWidth: 1, marginBottom: Space.sm,
  },
});
