import { useCallback, useState } from 'react';
import { View, StyleSheet, Switch, Share, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
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
import { generateMealPlan, QuotaError, type MealPlan, type MealComplexity } from '@/lib/ai';
import { haptic } from '@/lib/haptic';
import {
  loadProfileOrDefault, loadPlanHistory, savePlan, getQuota, consumeQuota,
  loadLastSession, saveLastSession, loadPortions, savePortions,
  loadIntakeLog, loadWeightLog, isPremium, loadCookedRecipes, loadFavoriteRecipes, todayISO, type Quota,
} from '@/lib/store';
import type { CookedRecipe } from '@/lib/grocery';
import { effectiveMaintenance } from '@/lib/energy';
import { resync } from '@/lib/notify';

const SPORTS = [
  { id: 'running', label: 'Running', labelDe: 'Laufen' },
  { id: 'weights', label: 'Weights', labelDe: 'Kraft' },
  { id: 'cycling', label: 'Cycling', labelDe: 'Radfahren' },
  { id: 'soccer', label: 'Football', labelDe: 'Fußball' },
  { id: 'boxing', label: 'Boxing', labelDe: 'Boxen' },
  { id: 'yoga', label: 'Yoga', labelDe: 'Yoga & Flow' },
];
const DURATIONS = [30, 45, 60, 90, 120];
const INTENSITIES: { id: Intensity; label: string; labelDe: string }[] = [
  { id: 'low', label: 'Easy', labelDe: 'Leicht' },
  { id: 'medium', label: 'Moderate', labelDe: 'Moderat' },
  { id: 'high', label: 'Hard', labelDe: 'Intensiv' },
  { id: 'max', label: 'All out', labelDe: 'Maximal' },
];
const TIMES = ['06:00', '12:00', '17:00', '18:00', '19:00', '20:00'];

const COMPLEXITY_OPTIONS: { id: MealComplexity; emoji: string; label: string; labelDe: string; sub: string; subDe: string; premiumOnly: boolean }[] = [
  { id: 'quick',    emoji: '⚡', label: 'Quick',     labelDe: 'Schnell',    sub: '≤15 min · 1 pan',      subDe: '≤15 Min · 1 Pfanne',   premiumOnly: false },
  { id: 'balanced', emoji: '🍽', label: 'Balanced',  labelDe: 'Ausgewogen', sub: '≤30 min · meal-prep',  subDe: '≤30 Min · Meal-Prep',   premiumOnly: false },
  { id: 'chef',     emoji: '👨‍🍳', label: 'Chef-Level', labelDe: 'Chef-Level', sub: 'Gourmet · plating',   subDe: 'Gourmet · Anrichten', premiumOnly: true },
];

function localizeRecipeTitle(title: string, lang: 'de' | 'en'): string {
  if (lang !== 'de') return title;
  const t = title.trim();
  if (/pan-seared.*chicken.*breast/i.test(t)) {
    return 'Gebratene Honig-Zitronen Hähnchenbrust mit Jasminreis & Süßkartoffel';
  }
  if (/recovery plate/i.test(t)) return t.replace(/recovery plate/gi, 'Regenerations-Teller');
  if (/maintenance plate/i.test(t)) return t.replace(/maintenance plate/gi, 'OMAD Hauptmahlzeit');
  return t
    .replace(/Pan-Seared/gi, 'Gebratene')
    .replace(/Chicken Breast/gi, 'Hähnchenbrust')
    .replace(/Steamed/gi, 'Gedämpfter')
    .replace(/Jasmine Rice/gi, 'Jasminreis')
    .replace(/Sweet Potato/gi, 'Süßkartoffel')
    .replace(/Asparagus/gi, 'Spargel')
    .replace(/with/gi, 'mit');
}

export default function PlannerScreen() {
  const c = useTheme();
  const { lang, t } = useLang();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [premium, setPremium] = useState(false);
  /** One rejection per paid build. See the comment on `generate`. */
  const [retryFree, setRetryFree] = useState(false);

  const [isRestDay, setIsRestDay] = useState(false);
  const [sport, setSport] = useState('weights');
  const [duration, setDuration] = useState(60);
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [trainingTime, setTrainingTime] = useState('18:00');
  const [complexity, setComplexity] = useState<MealComplexity>('balanced');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [portions, setPortions] = useState(1);
  // Undefined until measured — dailyTargets then behaves exactly as before.
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [rotation, setRotation] = useState<CookedRecipe[]>([]);
  const [history, setHistory] = useState<MealPlan[]>([]);
  const [favorites, setFavorites] = useState<MealPlan[]>([]);
  const [plannerTab, setPlannerTab] = useState<'today' | 'week' | 'saved'>('today');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const p = await loadProfileOrDefault();
        const [h, q, batch, intake, weights, prem, cooked, last, favs] = await Promise.all([
          loadPlanHistory<MealPlan>(),
          getQuota(),
          loadPortions(),
          loadIntakeLog(),
          loadWeightLog(),
          isPremium(),
          loadCookedRecipes(),
          loadLastSession(p.default_training_time),
          loadFavoriteRecipes(),
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
        setPremium(prem);
        setPortions(batch);
        setRotation(cooked);
        setFavorites(favs);
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
      complexity: 'balanced',
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
      const next = await generateMealPlan(profile, training, lang, measured, complexity);
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
      haptic(next.recipe_source === 'ai' ? 'success' : 'medium');
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
      else { setError('Could not reach the planner. Check your connection and try again.'); haptic('error'); }
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
            { id: 'week', label: lang === 'de' ? '7-Tage-Woche' : '7-Day Week', icon: 'chart' },
            { id: 'saved', label: t('plan.tabSaved'), icon: 'clock' },
          ]}
          selected={plannerTab}
          onSelect={(id) => setPlannerTab(id as any)}
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
                    {quota.remaining > 0
                      ? lang === 'de'
                        ? `${quota.remaining} von ${quota.limit} Plänen diese Woche verfügbar`
                        : `${quota.remaining} of ${quota.limit} plans left this week`
                      : lang === 'de'
                      ? 'Wöchentliche Pläne aufgebraucht'
                      : 'Weekly plans used'}
                  </Eyebrow>
                  <Txt variant="small" color={c.accent}>Upgrade</Txt>
                </View>
              </Tap>
            </Enter>
          )}

          {/* Live targets: High-End Macro & Calorie Center */}
          <Enter index={2}>
            {(() => {
              const totalKcal = preview.kcal;
              const pKcal = preview.protein_g * 4;
              const cKcal = preview.carbs_g * 4;
              const fKcal = preview.fat_g * 9;
              const macroSum = pKcal + cKcal + fKcal || totalKcal;
              const pPct = Math.round((pKcal / macroSum) * 100);
              const cPct = Math.round((cKcal / macroSum) * 100);
              const fPct = Math.max(0, 100 - pPct - cPct);
              const proteinPerKg = profile.weight_kg ? (preview.protein_g / profile.weight_kg).toFixed(1) : null;

              return (
                <Card style={{ marginTop: Space.base, padding: Space.base, borderRadius: Radius.lg }}>
                  {/* Hero Calorie Header */}
                  <View style={s.macroHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[s.calIconCircle, { backgroundColor: c.emberWash, borderColor: c.ember }]}>
                        <Icon name="flame" size={20} color={c.ember} />
                      </View>
                      <View style={{ marginLeft: Space.md }}>
                        <Eyebrow color={c.textDim} style={{ fontSize: 10, letterSpacing: 0.8 }}>
                          {lang === 'de' ? 'TAGESZIEL (OMAD)' : 'DAILY TARGET (OMAD)'}
                        </Eyebrow>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 1 }}>
                          <Txt variant="hero" color={c.text} style={{ fontSize: 30, lineHeight: 34, fontWeight: '800' }}>
                            {totalKcal.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')}
                          </Txt>
                          <Txt variant="subheading" color={c.textDim} style={{ marginLeft: 6, fontWeight: '600' }}>
                            kcal
                          </Txt>
                        </View>
                      </View>
                    </View>

                    {preview.burn_kcal > 0 && (
                      <View style={[s.workoutBonusPill, { backgroundColor: 'rgba(255, 107, 74, 0.12)', borderColor: 'rgba(255, 107, 74, 0.3)' }]}>
                        <Txt variant="eyebrow" color="#FF6B4A" style={{ fontSize: 10, fontWeight: '800' }}>
                          +{preview.burn_kcal} KCAL WORKOUT
                        </Txt>
                      </View>
                    )}
                  </View>

                  {/* Proportional Macro Distribution Bar */}
                  <View style={s.macroBarTrack}>
                    <View style={[s.macroBarSeg, { flex: pPct, backgroundColor: '#10B981', borderTopLeftRadius: 5, borderBottomLeftRadius: 5 }]} />
                    <View style={[s.macroBarSeg, { flex: cPct, backgroundColor: '#38BDF8', marginLeft: 2 }]} />
                    <View style={[s.macroBarSeg, { flex: fPct, backgroundColor: '#F59E0B', marginLeft: 2, borderTopRightRadius: 5, borderBottomRightRadius: 5 }]} />
                  </View>

                  {/* Macro Trio Cards */}
                  <View style={s.macroTrioRow}>
                    {/* Protein */}
                    <View style={[s.macroTrioCard, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[s.macroDot, { backgroundColor: '#10B981' }]} />
                        <Eyebrow color="#10B981" style={{ fontSize: 10, fontWeight: '800' }}>PROTEIN</Eyebrow>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                        <Txt variant="heading" color={c.text} style={{ fontSize: 22, fontWeight: '800' }}>
                          {preview.protein_g}
                        </Txt>
                        <Txt variant="small" color={c.textDim} style={{ marginLeft: 2, fontSize: 12 }}>g</Txt>
                      </View>
                      <Txt variant="eyebrow" color="#10B981" style={{ fontSize: 9.5, marginTop: 3, fontWeight: '700' }}>
                        {pPct}% {proteinPerKg ? `· ${proteinPerKg}g/kg` : ''}
                      </Txt>
                    </View>

                    {/* Carbs */}
                    <View style={[s.macroTrioCard, { backgroundColor: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)', marginHorizontal: Space.xs }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[s.macroDot, { backgroundColor: '#38BDF8' }]} />
                        <Eyebrow color="#38BDF8" style={{ fontSize: 10, fontWeight: '800' }}>{t('macro.carbs')}</Eyebrow>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                        <Txt variant="heading" color={c.text} style={{ fontSize: 22, fontWeight: '800' }}>
                          {preview.carbs_g}
                        </Txt>
                        <Txt variant="small" color={c.textDim} style={{ marginLeft: 2, fontSize: 12 }}>g</Txt>
                      </View>
                      <Txt variant="eyebrow" color="#38BDF8" style={{ fontSize: 9.5, marginTop: 3, fontWeight: '700' }}>
                        {cPct}%
                      </Txt>
                    </View>

                    {/* Fat */}
                    <View style={[s.macroTrioCard, { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[s.macroDot, { backgroundColor: '#F59E0B' }]} />
                        <Eyebrow color="#F59E0B" style={{ fontSize: 10, fontWeight: '800' }}>{t('macro.fat')}</Eyebrow>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                        <Txt variant="heading" color={c.text} style={{ fontSize: 22, fontWeight: '800' }}>
                          {preview.fat_g}
                        </Txt>
                        <Txt variant="small" color={c.textDim} style={{ marginLeft: 2, fontSize: 12 }}>g</Txt>
                      </View>
                      <Txt variant="eyebrow" color="#F59E0B" style={{ fontSize: 9.5, marginTop: 3, fontWeight: '700' }}>
                        {fPct}%
                      </Txt>
                    </View>
                  </View>
                </Card>
              );
            })()}
          </Enter>

          {/* Training session config */}
          <Enter index={3}>
            <Card style={{ marginTop: Space.base }}>
              <View style={s.restRow}>
                <Eyebrow>{t('plan.restDay')}</Eyebrow>
                <Switch
                  value={isRestDay}
                  onValueChange={setIsRestDay}
                  trackColor={{ false: c.line, true: c.plan }}
                  thumbColor={c.surface}
                  accessibilityLabel="Rest day toggle"
                />
              </View>

              {!isRestDay && (
                <>
                  <View style={s.chipSection}>
                    <Eyebrow style={s.chipLabel}>{t('plan.sport')}</Eyebrow>
                    <View style={s.chips}>
                      {SPORTS.map((sp) => (
                        <Chip
                          key={sp.id}
                          label={lang === 'de' ? sp.labelDe : sp.label}
                          selected={sport === sp.id}
                          tone="plan"
                          onPress={() => setSport(sp.id)}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={s.chipSection}>
                    <Eyebrow style={s.chipLabel}>{t('plan.duration')}</Eyebrow>
                    <View style={s.chips}>
                      {DURATIONS.map((d) => (
                        <Chip
                          key={d}
                          label={`${d}m`}
                          selected={duration === d}
                          tone="plan"
                          onPress={() => setDuration(d)}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={s.chipSection}>
                    <Eyebrow style={s.chipLabel}>{lang === 'de' ? 'Intensität' : 'Intensity'}</Eyebrow>
                    <View style={s.chips}>
                      {INTENSITIES.map((it) => (
                        <Chip
                          key={it.id}
                          label={lang === 'de' ? it.labelDe : it.label}
                          selected={intensity === it.id}
                          tone="plan"
                          onPress={() => setIntensity(it.id)}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={s.chipSection}>
                    <Eyebrow style={s.chipLabel}>{lang === 'de' ? 'Trainingszeit' : 'Training Time'}</Eyebrow>
                    <View style={s.chips}>
                      {TIMES.map((tm) => (
                        <Chip
                          key={tm}
                          label={tm}
                          selected={trainingTime === tm}
                          tone="plan"
                          onPress={() => setTrainingTime(tm)}
                        />
                      ))}
                    </View>
                  </View>
                </>
              )}
            </Card>
          </Enter>

          {/* Complexity Selector */}
          <Enter index={4}>
            <Card style={{ marginTop: Space.base }}>
              <Eyebrow style={{ marginBottom: Space.md }}>
                {lang === 'de' ? 'REZEPT-KOMPLEXITÄT' : 'RECIPE COMPLEXITY'}
              </Eyebrow>
              <View style={s.complexityGrid}>
                {COMPLEXITY_OPTIONS.map((opt) => {
                  const isSelected = complexity === opt.id;
                  const locked = opt.premiumOnly && !premium;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      activeOpacity={0.75}
                      onPress={() => {
                        if (locked) {
                          router.push('/paywall');
                          return;
                        }
                        setComplexity(opt.id);
                      }}
                      style={[
                        s.complexityCard,
                        {
                          borderColor: isSelected ? c.plan : c.line,
                          backgroundColor: isSelected ? c.planWash : c.surface,
                        },
                      ]}
                      accessibilityLabel={`${lang === 'de' ? opt.labelDe : opt.label}${locked ? ' – Premium' : ''}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      {/* Lock overlay for premium */}
                      {locked && (
                        <View style={[s.premiumBadge, { backgroundColor: c.ember }]}>
                          <Txt variant="eyebrow" color="#fff" style={{ fontSize: 9, fontWeight: '800' }}>
                            PREMIUM
                          </Txt>
                        </View>
                      )}
                      <Txt style={{ fontSize: 24, textAlign: 'center' }}>{opt.emoji}</Txt>
                      <Txt
                        variant="subheading"
                        color={isSelected ? c.plan : c.text}
                        style={{ fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: 'center' }}
                      >
                        {lang === 'de' ? opt.labelDe : opt.label}
                      </Txt>
                      <Txt
                        variant="small"
                        color={c.textDim}
                        style={{ fontSize: 10, textAlign: 'center', marginTop: 2, lineHeight: 14 }}
                      >
                        {lang === 'de' ? opt.subDe : opt.sub}
                      </Txt>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          </Enter>

          {/* Generate button */}
          <Enter index={5}>
            {error && (
              <View style={{ marginTop: Space.base }}>
                <Notice tone="error">{error}</Notice>
              </View>
            )}
            <View style={[s.generateRow, { marginTop: Space.base }]}>
              <Button
                label={loading
                  ? (lang === 'de' ? 'Generiere...' : 'Generating...')
                  : plan
                  ? (lang === 'de' ? 'Neu generieren' : 'Generate new')
                  : (lang === 'de' ? 'Plan generieren' : 'Generate plan')}
                onPress={() => generate()}
                disabled={loading}
                tone="plan"
                style={s.generateBtn}
              />
              {loading && <ActivityIndicator style={s.spinner} color={c.plan} />}
            </View>

            {plan && retryFree && (
              <Button
                label={lang === 'de' ? 'Anderes Rezept (kostenlos)' : 'Different recipe (free)'}
                variant="ghost"
                onPress={() => generate(true)}
                style={{ marginTop: Space.sm }}
              />
            )}
          </Enter>

          {/* Cooked before shortcut */}
          {rotation.length > 0 && !plan && (
            <Enter index={6}>
              <Card style={{ marginTop: Space.base, padding: Space.base }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="plate" size={14} color={c.plan} />
                    <Eyebrow color={c.plan} style={{ marginLeft: 6, fontSize: 10, fontWeight: '800' }}>
                      {lang === 'de' ? 'SCHON GEKOCHT & BEWÄHRT' : 'COOKED BEFORE & FAVORITES'}
                    </Eyebrow>
                  </View>
                  <View style={[s.freeBadge, { backgroundColor: c.planWash }]}>
                    <Txt variant="eyebrow" color={c.plan} style={{ fontSize: 8.5, fontWeight: '800' }}>
                      {lang === 'de' ? '0 PLAN-KOSTEN' : 'FREE TO RE-COOK'}
                    </Txt>
                  </View>
                </View>

                {rotation.slice(0, 3).map((r) => (
                  <TouchableOpacity
                    key={r.title}
                    activeOpacity={0.8}
                    onPress={async () => {
                      const shell = planShell();
                      setPlan({
                        ...shell,
                        recipe: {
                          title: r.title,
                          ingredients: [],
                          instructions: '',
                          reheat_instructions: null,
                          prep_time_min: 30,
                          is_meal_prep: true,
                        },
                        recipe_source: 'offline',
                        recipe_note: null,
                      });
                      haptic('medium');
                    }}
                    style={[s.cookedCard, { backgroundColor: c.well, borderColor: c.line }]}
                  >
                    <View style={s.cookedCardHead}>
                      <View style={[s.cookedIconCircle, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
                        <Icon name="flame" size={14} color={c.ember} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Txt variant="subheading" color={c.text} style={{ fontSize: 13.5, fontWeight: '700', lineHeight: 18 }}>
                          {localizeRecipeTitle(r.title, lang)}
                        </Txt>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <View style={[s.countBadge, { backgroundColor: c.emberWash }]}>
                            <Txt variant="eyebrow" color={c.ember} style={{ fontSize: 9, fontWeight: '800' }}>
                              {t('rotation.cookedTimes', { n: r.count })}
                            </Txt>
                          </View>
                          <Txt variant="small" color={c.textFaint} style={{ marginLeft: 6, fontSize: 11 }}>
                            {lang === 'de' ? 'Tippen zum Laden' : 'Tap to load'}
                          </Txt>
                        </View>
                      </View>
                      <View style={[s.cookedActionBtn, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
                        <Icon name="chevronRight" size={13} color={c.textDim} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}

                <View style={[s.rotationFooter, { borderTopColor: c.line }]}>
                  <Icon name="shield" size={12} color={c.textDim} />
                  <Txt variant="small" color={c.textDim} style={{ marginLeft: 6, fontSize: 11, flex: 1 }}>
                    {t('rotation.noQuota')}
                  </Txt>
                </View>
              </Card>
            </Enter>
          )}

          {/* The plan */}
          {plan && (
            <Enter index={7}>
              {plan.timing_warning && (
                <View style={{ marginTop: Space.base }}>
                  <Notice tone="warn">{plan.timing_warning}</Notice>
                </View>
              )}
              <Card style={{ marginTop: Space.base }}>
                <View style={s.timingRow}>
                  <View style={s.timingCell}>
                    <Eyebrow color={c.textDim}>{lang === 'de' ? 'ESSFENSTER' : 'WINDOW'}</Eyebrow>
                    <Txt variant="heading" style={{ marginTop: 2 }}>
                      {plan.eating_window_start}–{plan.eating_window_end}
                    </Txt>
                  </View>
                  {plan.pre_training_snack_time && (
                    <View style={s.timingCell}>
                      <Eyebrow color={c.textDim}>{lang === 'de' ? 'PRE-SNACK' : 'PRE-SNACK'}</Eyebrow>
                      <Txt variant="heading" style={{ marginTop: 2 }}>{plan.pre_training_snack_time}</Txt>
                    </View>
                  )}
                  <View style={s.timingCell}>
                    <Eyebrow color={c.textDim}>{lang === 'de' ? 'MAHLZEIT' : 'MAIN MEAL'}</Eyebrow>
                    <Txt variant="heading" style={{ marginTop: 2 }}>{plan.main_meal_time}</Txt>
                  </View>
                </View>
                {plan.ai_reasoning ? (
                  <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                    {plan.ai_reasoning}
                  </Txt>
                ) : null}
              </Card>
              <RecipeCard
                plan={plan}
                portions={portions}
                onPortions={async (n) => {
                  setPortions(n);
                  await savePortions(n);
                }}
              />
              <View style={s.planActions}>
                <Button
                  label={copied ? (lang === 'de' ? 'Kopiert!' : 'Copied!') : (lang === 'de' ? 'Teilen' : 'Share')}
                  variant="secondary"
                  onPress={() => share(plan)}
                  style={s.planAction}
                />
              </View>
            </Enter>
          )}

          {/* Break-fast steps */}
          {plan && (
            <Enter index={8}>
              <Card style={{ marginTop: Space.base }}>
                <Eyebrow style={{ marginBottom: Space.md }}>
                  {lang === 'de' ? 'Fasten brechen — in dieser Reihenfolge' : 'Break your fast — in this order'}
                </Eyebrow>
                {breakFastSteps(plan.timing_pattern).map((step, i) => (
                  <View key={i} style={[s.breakStep, { borderColor: c.line }]}>
                    <View style={[s.breakNum, { backgroundColor: c.plan }]}>
                      <Txt variant="data" color={c.onAccent}>{i + 1}</Txt>
                    </View>
                    <View style={s.breakText}>
                      <Txt variant="bodyMedium">{step}</Txt>
                    </View>
                  </View>
                ))}
              </Card>
            </Enter>
          )}

          {/* Weekly plan quota for free users — shown at bottom as soft upsell */}
          {quota && !quota.premium && plan && (
            <Enter index={9}>
              <Tap onPress={() => router.push('/paywall')} accessibilityLabel="Upgrade to Premium">
                <View style={[s.upsellBanner, { borderColor: c.ember, backgroundColor: c.emberWash }]}>
                  <View style={{ flex: 1 }}>
                    <Eyebrow color={c.ember}>
                      {lang === 'de' ? 'UNBEGRENZTE PLÄNE + CHEF-LEVEL REZEPTE' : 'UNLIMITED PLANS + CHEF-LEVEL RECIPES'}
                    </Eyebrow>
                    <Txt variant="small" color={c.textDim} style={{ marginTop: 3 }}>
                      {lang === 'de'
                        ? 'Hole dir Premium und generiere täglich neue Gourmet-Rezepte vom KI-Koch.'
                        : 'Get Premium to generate daily gourmet recipes with the AI chef.'}
                    </Txt>
                  </View>
                  <Txt variant="small" color={c.ember} style={{ fontWeight: '700', marginLeft: Space.sm }}>
                    Upgrade
                  </Txt>
                </View>
              </Tap>
            </Enter>
          )}
        </>
      ) : plannerTab === 'week' ? (
        /* 7-Day Week Planner Tab */
        <>
          <Enter index={1}>
            <Card style={{ marginTop: Space.base }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.md }}>
                <View>
                  <Eyebrow color={c.plan}>{lang === 'de' ? '7-TAGE MAHLZEIT-PERIODISIERUNG' : '7-DAY MEAL PERIODISATION'}</Eyebrow>
                  <Txt variant="heading" style={{ fontSize: 20, marginTop: 2 }}>
                    {lang === 'de' ? 'Wochen-Mahlzeitenplan' : 'Weekly Meal Plan'}
                  </Txt>
                </View>
                {!premium && (
                  <View style={[s.premiumPill, { backgroundColor: c.goldWash, borderColor: c.gold }]}>
                    <Txt variant="eyebrow" color={c.gold} style={{ fontSize: 10, fontWeight: '800' }}>★ PREMIUM</Txt>
                  </View>
                )}
              </View>

              {!premium ? (
                <>
                  <Txt variant="body" color={c.textDim} style={{ lineHeight: 22 }}>
                    {lang === 'de'
                      ? 'Plane deine gesamte Trainings- & Fastenwoche im Voraus. Die KI passt Kalorien & Makros automatisch an harte Einheiten und Ruhetage an.'
                      : 'Plan your entire training and fasting week in advance. AI automatically adjusts macros for hard training sessions vs. recovery days.'}
                  </Txt>

                  <View style={[s.weekFeatureGrid, { marginTop: Space.base }]}>
                    <View style={[s.weekFeatureCard, { backgroundColor: c.well, borderColor: c.line }]}>
                      <Txt style={{ fontSize: 20 }}>🗓</Txt>
                      <Txt variant="subheading" style={{ fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                        {lang === 'de' ? '7-Tage-Vorschau' : '7-Day Overview'}
                      </Txt>
                      <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 2 }}>
                        {lang === 'de' ? 'Mo–So Mahlzeiten im Blick' : 'Mon–Sun meals organized'}
                      </Txt>
                    </View>
                    <View style={[s.weekFeatureCard, { backgroundColor: c.well, borderColor: c.line }]}>
                      <Txt style={{ fontSize: 20 }}>⚡</Txt>
                      <Txt variant="subheading" style={{ fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                        {lang === 'de' ? 'Makro-Periodisierung' : 'Macro Periodisation'}
                      </Txt>
                      <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 2 }}>
                        {lang === 'de' ? 'Mehr Carbs an Beintagen' : 'High carbs on workout days'}
                      </Txt>
                    </View>
                    <View style={[s.weekFeatureCard, { backgroundColor: c.well, borderColor: c.line }]}>
                      <Txt style={{ fontSize: 20 }}>🛒</Txt>
                      <Txt variant="subheading" style={{ fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                        {lang === 'de' ? '1x Wocheneinkauf' : '1x Weekly Shopping'}
                      </Txt>
                      <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 2 }}>
                        {lang === 'de' ? 'Konsolidierte Einkaufsliste' : 'Aggregated grocery list'}
                      </Txt>
                    </View>
                  </View>

                  <Button
                    label={lang === 'de' ? 'Wochenplan freischalten' : 'Unlock Weekly Planner'}
                    onPress={() => router.push('/paywall')}
                    tone="plan"
                    style={{ marginTop: Space.base }}
                  />
                </>
              ) : (
                /* Premium 7-Day Day-by-Day View */
                <View style={{ marginTop: Space.sm }}>
                  {['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'].map((dayName, idx) => {
                    const isWorkoutDay = idx % 2 === 0;
                    return (
                      <View key={dayName} style={[s.weekDayRow, { borderColor: c.line }]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Txt variant="bodyMedium" style={{ fontWeight: '700' }}>{dayName}</Txt>
                            <View style={[s.workoutDayBadge, {
                              backgroundColor: isWorkoutDay ? c.planWash : c.well,
                              borderColor: isWorkoutDay ? c.plan : c.line,
                            }]}>
                              <Txt variant="eyebrow" color={isWorkoutDay ? c.plan : c.textDim} style={{ fontSize: 9 }}>
                                {isWorkoutDay ? (lang === 'de' ? 'TRAINING' : 'WORKOUT') : (lang === 'de' ? 'RUHETAG' : 'REST')}
                              </Txt>
                            </View>
                          </View>
                          <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                            {isWorkoutDay
                              ? `${preview.kcal} kcal · ${preview.protein_g}g P · ${preview.carbs_g}g C`
                              : `${Math.round(preview.kcal * 0.85)} kcal · ${preview.protein_g}g P · Moderate Carbs`}
                          </Txt>
                        </View>
                        <Tap
                          onPress={() => {
                            setIsRestDay(!isWorkoutDay);
                            setPlannerTab('today');
                          }}
                        >
                          <View style={[s.dayPlanBtn, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
                            <Icon name="plate" size={14} color={c.plan} />
                            <Txt variant="eyebrow" color={c.plan} style={{ marginLeft: 4, fontSize: 10, fontWeight: '700' }}>
                              {lang === 'de' ? 'PLANEN' : 'PLAN'}
                            </Txt>
                          </View>
                        </Tap>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </Enter>
        </>
      ) : (
        /* Saved plans tab */
        <>
          {favorites.length > 0 && (
            <Enter index={1}>
              <Card style={{ marginTop: Space.base }}>
                <Eyebrow style={{ marginBottom: Space.md }}>
                  {lang === 'de' ? 'Favoriten' : 'Favorites'}
                </Eyebrow>
                {favorites.map((p, i) => (
                  <Tap
                    key={`${p.recipe.title}-${i}`}
                    onPress={() => { setPlan(p); setPlannerTab('today'); }}
                    accessibilityLabel={`Load favorite: ${p.recipe.title}`}
                  >
                    <View style={[s.historyRow, { borderColor: c.line }]}>
                      <View style={s.historyInfo}>
                        <Txt variant="bodyMedium">{p.recipe.title}</Txt>
                        <Txt variant="small" color={c.textDim}>{p.date} · {p.total_kcal} kcal</Txt>
                      </View>
                      <Icon name="plate" size={16} color={c.textDim} />
                    </View>
                  </Tap>
                ))}
              </Card>
            </Enter>
          )}
          <Enter index={2}>
            <Card style={{ marginTop: Space.base }}>
              <Eyebrow style={{ marginBottom: Space.md }}>
                {lang === 'de' ? 'Verlauf' : 'History'}
              </Eyebrow>
              {history.length === 0 ? (
                <Txt variant="small" color={c.textDim}>
                  {lang === 'de' ? 'Noch kein Plan generiert.' : 'No plans yet.'}
                </Txt>
              ) : (
                history.slice(0, 10).map((p, i) => (
                  <Tap
                    key={`${p.recipe.title}-${i}`}
                    onPress={() => { setPlan(p); setPlannerTab('today'); }}
                    accessibilityLabel={`Load plan: ${p.recipe.title}`}
                  >
                    <View style={[s.historyRow, { borderColor: c.line }]}>
                      <View style={s.historyInfo}>
                        <Txt variant="bodyMedium">{p.recipe.title}</Txt>
                        <Txt variant="small" color={c.textDim}>{p.date} · {p.total_kcal} kcal</Txt>
                      </View>
                      <Icon name="plate" size={16} color={c.textDim} />
                    </View>
                  </Tap>
                ))
              )}
            </Card>
          </Enter>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  quota: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Space.base,
    paddingVertical: Space.md, marginTop: Space.base,
  },
  restRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  chipSection: { marginTop: Space.base },
  chipLabel: { marginBottom: Space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.xs },

  // Complexity Selector
  complexityGrid: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  complexityCard: {
    flex: 1,
    paddingVertical: Space.base,
    paddingHorizontal: Space.xs,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    minHeight: 110,
  },
  premiumBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopRightRadius: Radius.lg,
    borderBottomLeftRadius: Radius.md,
  },

  // Macro Center
  macroHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Space.base,
  },
  calIconCircle: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  workoutBonusPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.pill, borderWidth: 1,
  },
  macroBarTrack: {
    flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden',
    marginBottom: Space.base,
  },
  macroBarSeg: { height: 10 },
  macroTrioRow: { flexDirection: 'row', marginTop: Space.xs },
  macroTrioCard: {
    flex: 1, padding: 10, borderRadius: Radius.lg, borderWidth: 1,
  },
  macroDot: {
    width: 7, height: 7, borderRadius: 4, marginRight: 5,
  },

  generateRow: { flexDirection: 'row', alignItems: 'center' },
  generateBtn: { flex: 1 },
  spinner: { marginLeft: Space.sm },

  timingRow: {
    flexDirection: 'row', alignItems: 'flex-start',
  },
  timingCell: { flex: 1 },

  planActions: {
    flexDirection: 'row', marginTop: Space.base, marginRight: -Space.sm,
  },
  planAction: { flex: 1, marginRight: Space.sm },

  cookedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Space.md, borderBottomWidth: 1,
  },

  breakStep: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: Space.md, borderBottomWidth: 1,
  },
  breakNum: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: Space.md, marginTop: 1,
  },
  breakText: { flex: 1 },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Space.md, borderBottomWidth: 1,
  },
  historyInfo: { flex: 1, marginRight: Space.sm },

  upsellBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Space.base, paddingVertical: Space.md,
    marginTop: Space.base, marginBottom: Space.xl,
  },
  premiumPill: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.pill, borderWidth: 1,
  },
  weekFeatureGrid: {
    flexDirection: 'row', gap: Space.sm,
  },
  weekFeatureCard: {
    flex: 1, padding: Space.sm,
    borderRadius: Radius.md, borderWidth: 1,
  },
  weekDayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Space.md, borderBottomWidth: 1,
  },
  workoutDayBadge: {
    marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.pill, borderWidth: 1,
  },
  dayPlanBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.pill, borderWidth: 1,
  },
  freeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  cookedCard: {
    padding: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Space.xs,
    marginBottom: Space.xs,
  },
  cookedCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cookedIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.pill,
  },
  cookedActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.xs,
  },
  rotationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.sm,
    paddingTop: Space.sm,
    borderTopWidth: 1,
  },
});
