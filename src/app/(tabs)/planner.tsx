import { Icon, type IconName } from '@/components/icons';
import { useLang } from '@/components/lang';
import RecipeCard from '@/components/RecipeCard';
import { CookingModeModal } from '@/components/CookingModeModal';
import {
  Button,
  Card,
  Chip,
  Enter,
  Eyebrow,
  Notice,
  PageHeader,
  Screen,
  SegmentedControl,
  Tap,
  Txt,
  useTheme,
} from '@/components/ui';
import { Radius, Space } from '@/constants/theme';
import { generateMealPlan, type MealComplexity, type MealPlan, type RecipeEnergyContext } from '@/lib/recipes';
import {
  cycleWeek,
  deficitSpell,
  effectiveMaintenance,
  proteinAdherence,
  readPlateau,
  trainingDaysPerWeek,
  weekBudget,
  type DeficitSpell,
  type PlateauRead,
  type ProteinAdherence,
  type WeekBudget,
} from '@/lib/energy';
import type { CookedRecipe } from '@/lib/grocery';
import { haptic } from '@/lib/haptic';
import { resync } from '@/lib/notify';
import {
  adaptiveTarget,
  bmr,
  breakFastSteps,
  dailyTargets,
  DEFAULT_PROFILE,
  mealTiming,
  type AdaptiveMode,
  type Intensity,
  type Training,
  type UserProfile,
} from '@/lib/nutrition';
import {
  isPremium,
  loadCookedRecipes,
  loadFavoriteRecipes,
  loadIntakeLog,
  loadLastSession,
  loadPlanHistory,
  loadPortions,
  loadProfileOrDefault,
  loadWeightLog,
  loadWorkoutLog,
  saveLastSession,
  savePlan,
  savePortions,
  todayISO,
} from '@/lib/store';
import type { WorkoutLogEntry } from '@/lib/workouts';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Share, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

const SPORTS: { id: string; label: string; labelDe: string; icon: IconName }[] = [
  { id: 'calisthenics', label: 'Calisthenics', labelDe: 'Calisthenics', icon: 'bolt' },
  { id: 'weights', label: 'Weights', labelDe: 'Kraft', icon: 'dumbbell' },
  { id: 'running', label: 'Running', labelDe: 'Laufen', icon: 'run' },
  { id: 'cycling', label: 'Cycling', labelDe: 'Radfahren', icon: 'bike' },
  { id: 'soccer', label: 'Football', labelDe: 'Fußball', icon: 'ball' },
  { id: 'boxing', label: 'Boxing', labelDe: 'Boxen', icon: 'boxing' },
  { id: 'yoga', label: 'Yoga', labelDe: 'Yoga & Flow', icon: 'yoga' },
];
const DURATIONS = [30, 45, 60, 90, 120];
const INTENSITIES: { id: Intensity; label: string; labelDe: string }[] = [
  { id: 'low', label: 'Easy', labelDe: 'Leicht' },
  { id: 'medium', label: 'Moderate', labelDe: 'Moderat' },
  { id: 'high', label: 'Hard', labelDe: 'Intensiv' },
  { id: 'max', label: 'All out', labelDe: 'Maximal' },
];
const TIMES = ['06:00', '12:00', '17:00', '18:00', '19:00', '20:00'];

const COMPLEXITY_OPTIONS: { id: MealComplexity; icon: IconName; label: string; labelDe: string; sub: string; subDe: string; premiumOnly: boolean }[] = [
  { id: 'quick', icon: 'bolt', label: 'Quick', labelDe: 'Schnell', sub: '≤15 min · 1 pan', subDe: '≤15 Min · 1 Pfanne', premiumOnly: false },
  { id: 'balanced', icon: 'plate', label: 'Balanced', labelDe: 'Ausgewogen', sub: '≤30 min · meal-prep', subDe: '≤30 Min · Meal-Prep', premiumOnly: false },
  { id: 'chef', icon: 'chefHat', label: 'Chef-Level', labelDe: 'Chef-Level', sub: 'Gourmet · plating', subDe: 'Gourmet · Anrichten', premiumOnly: true },
];

/**
 * The day's energy split as one ring with the target at its centre. A bar
 * reads like a progress meter that is always "full"; a ring reads like a
 * composition — the same widget language as the fasting dial on Today.
 */
function MacroRing({ pPct, cPct, fPct }: { pPct: number; cPct: number; fPct: number }) {
  const c = useTheme();
  const size = 116;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const gap = 5; // px of air between segments, so each macro reads on its own
  const segs = [
    { pct: pPct, color: c.plan },
    { pct: cPct, color: c.hydro },
    { pct: fPct, color: c.gold },
  ];
  let acc = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} originX={size / 2} originY={size / 2}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.well} strokeWidth={stroke} fill="none" />
        {segs.map((seg, i) => {
          const len = Math.max(0, (circ * seg.pct) / 100 - (i < segs.length - 1 ? gap : 0));
          const offset = -acc;
          acc += (circ * seg.pct) / 100;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={seg.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          );
        })}
      </G>
    </Svg>
  );
}

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
  const [premium, setPremium] = useState(false);

  const [isRestDay, setIsRestDay] = useState(false);
  const [sport, setSport] = useState('weights');
  const [duration, setDuration] = useState(60);
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [trainingTime, setTrainingTime] = useState('18:00');
  const [complexity, setComplexity] = useState<MealComplexity>('balanced');

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [portions, setPortions] = useState(1);
  const [showCookingMode, setShowCookingMode] = useState(false);
  // Undefined until measured — dailyTargets then behaves exactly as before.
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [rotation, setRotation] = useState<CookedRecipe[]>([]);
  const [history, setHistory] = useState<MealPlan[]>([]);
  const [favorites, setFavorites] = useState<MealPlan[]>([]);
  const [plannerTab, setPlannerTab] = useState<'today' | 'week' | 'saved'>('today');

  // Energy-tracking integration state
  const [energyMode, setEnergyMode] = useState<AdaptiveMode>('standard');
  const [intakeLog, setIntakeLog] = useState<any[]>([]);
  const [stall, setStall] = useState<PlateauRead | null>(null);
  const [spell, setSpell] = useState<DeficitSpell | null>(null);
  const [adherence, setAdherence] = useState<ProteinAdherence>(null);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutLogEntry | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const p = await loadProfileOrDefault();
        const [h, batch, intake, weights, prem, cooked, last, favs, wLog] = await Promise.all([
          loadPlanHistory<MealPlan>(),
          loadPortions(),
          loadIntakeLog(),
          loadWeightLog(),
          isPremium(),
          loadCookedRecipes(),
          loadLastSession(p.default_training_time),
          loadFavoriteRecipes(),
          loadWorkoutLog(),
        ]);
        if (!active) return;
        const todayLog = wLog.find((w) => w.date === todayISO()) ?? null;
        setProfile(p);
        setTodayWorkout(todayLog);
        setIsRestDay(last.restDay);
        setSport(last.sport);
        setDuration(last.duration_min);
        setIntensity(last.intensity);
        setTrainingTime(last.start_time);
        setHistory(h);
        setPremium(prem);
        setPortions(batch);
        setRotation(cooked);
        setFavorites(favs);
        setIntakeLog(intake);
        const m = effectiveMaintenance(intake, weights, dailyTargets(p, null).maintenance_kcal, prem);
        setMeasured(m);
        setStall(readPlateau(intake, weights, p.goal, 500));
        setSpell(deficitSpell(intake, weights, p.goal));
        setAdherence(proteinAdherence(intake));
        setMounted(true);
      })();
      return () => { active = false; };
    }, [])
  );

  if (!mounted) return null;

  const training: Training | null = isRestDay
    ? null
    : { sport, duration_min: duration, intensity, start_time: trainingTime };

  const previewBase = dailyTargets(profile, training, measured);
  const budget: WeekBudget | null = weekBudget(previewBase.kcal, intakeLog);
  const floorKcal = bmr(profile);
  const hasBudgetOption = Boolean(
    budget && budget.daysLeft > 0 && budget.perDayLeft > 0 && Math.max(floorKcal, budget.perDayLeft) < previewBase.kcal - 40
  );
  const preview = adaptiveTarget(profile, previewBase, {
    mode: energyMode,
    plateauTarget: stall?.newTarget ?? null,
    budgetPerDayLeft: budget?.perDayLeft ?? null,
    maintenanceKcal: spell?.maintenanceKcal ?? null,
  });

  /**
   * The numbers a re-cooked recipe hangs on when nothing is on screen yet.
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
      ai_reasoning: t.reasoning,
      timing_warning: t.warning,
      training_burn_kcal: previewBase.burn_kcal,
      recipe_source: premium ? 'premium' : 'standard',
      recipe_note: null,
      timing_pattern: t.pattern,
      training_start_time: training?.start_time ?? null,
      training_duration_min: training?.duration_min ?? 0,
      complexity: 'balanced',
      recipe: { title: '', ingredients: [], instructions: '', reheat_instructions: '', prep_time_min: 0, is_meal_prep: true },
    };
  };

  const generate = async (swap = false) => {
    setError(null);
    const energyCtx: RecipeEnergyContext = {
      mode: energyMode,
      plateauStalled: Boolean(stall?.stalled),
      dietBreakDue: Boolean(spell?.breakDue),
      proteinAdherenceLow: Boolean(adherence && adherence.days >= 5 && adherence.hit / adherence.days < 0.8),
      budgetDeficitActive: energyMode === 'budget',
      adjustedTargets: preview,
    };
    const next = generateMealPlan(profile, training, lang, {
      measuredMaintenance: measured,
      complexity,
      isPremium: premium,
      historyTitles: history.map((h) => h.recipe.title),
      excludeRecipeId: swap ? plan?.recipe.id : undefined,
      energy: energyCtx,
      date: todayISO(),
    });
    await saveLastSession({
      restDay: isRestDay,
      sport,
      duration_min: duration,
      intensity,
      start_time: trainingTime,
    });
    setPlan(next);
    haptic('success');
    setHistory(await savePlan(next));
    await resync();
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
      <PageHeader
        title={t('plan.title')}
        subtitle={
          isRestDay
            ? lang === 'de'
              ? 'Ruhetag'
              : 'Rest day'
            : lang === 'de'
            ? `${SPORTS.find((sp) => sp.id === sport)?.labelDe ?? sport} · ${duration} Min · ${intensity === 'low' ? 'Leicht' : intensity === 'medium' ? 'Mittel' : 'Hoch'}`
            : `${sport} · ${duration} min · ${intensity}`
        }
      />
      <SegmentedControl
          values={[
            { id: 'today', label: lang === 'de' ? 'Heute' : 'Today', icon: 'plate' },
            { id: 'week', label: lang === 'de' ? 'Woche' : 'Week', icon: 'chart' },
            { id: 'saved', label: lang === 'de' ? 'Rezepte' : 'Saved', icon: 'clock' },
          ]}
          selected={plannerTab}
          onSelect={(id) => setPlannerTab(id as any)}
          tone="plan"
          style={{ marginBottom: Space.base }}
        />

      {plannerTab === 'today' ? (
        <>
          {/* Quick link to Calisthenics & Rep-Log + today's energy signal */}
          <Enter index={1}>
            <Tap onPress={() => router.push('/workout')} accessibilityLabel="Workouts">
              <Card style={{ marginTop: Space.base }}>
                <View style={s.quotaRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Icon name="bolt" size={16} color={todayWorkout ? c.plan : c.accent} />
                    <Txt variant="small" color={c.text} style={{ marginLeft: 8, fontWeight: '600' }}>
                      {todayWorkout
                        ? lang === 'de'
                          ? `Heute geloggt: ${todayWorkout.sport} (${todayWorkout.durationMin} Min)`
                          : `Logged today: ${todayWorkout.sport} (${todayWorkout.durationMin}m)`
                        : lang === 'de'
                        ? 'Calisthenics & Wiederholungen loggen'
                        : 'Log Calisthenics & rep progress'}
                    </Txt>
                  </View>
                  <Icon name="chevronRight" size={16} color={c.textFaint} />
                </View>
              </Card>
            </Tap>
          </Enter>

          {(hasBudgetOption || (stall?.stalled && stall.newTarget) || spell?.breakDue || measured !== undefined) && (
            <Enter index={1}>
              <Card style={{ marginTop: Space.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Eyebrow color={c.body}>
                    {lang === 'de' ? 'Energie- & Kalorien-Steuerung' : 'Adaptive calorie tracking'}
                  </Eyebrow>
                  {measured !== undefined && (
                    <Txt variant="small" color={c.positive} style={{ fontSize: 11, fontWeight: '600' }}>
                      {lang === 'de' ? 'Gemessen' : 'Measured'}
                    </Txt>
                  )}
                </View>
                <View style={[s.chips, { marginTop: Space.sm }]}>
                  <Chip
                    label={lang === 'de' ? `Standard (${previewBase.kcal})` : `Standard (${previewBase.kcal})`}
                    selected={energyMode === 'standard'}
                    onPress={() => setEnergyMode('standard')}
                    style={s.chipGap}
                  />
                  {hasBudgetOption && budget ? (
                    <Chip
                      label={lang === 'de' ? `Wochenbudget (${Math.max(floorKcal, budget.perDayLeft)})` : `Week budget (${Math.max(floorKcal, budget.perDayLeft)})`}
                      selected={energyMode === 'budget'}
                      onPress={() => setEnergyMode('budget')}
                      style={s.chipGap}
                    />
                  ) : null}
                  {stall?.stalled && stall.newTarget ? (
                    <Chip
                      label={lang === 'de' ? `Plateau (${stall.newTarget})` : `Plateau (${stall.newTarget})`}
                      selected={energyMode === 'plateau'}
                      onPress={() => setEnergyMode('plateau')}
                      style={s.chipGap}
                    />
                  ) : null}
                  {spell?.breakDue ? (
                    <Chip
                      label={lang === 'de' ? 'Erhaltungswoche' : 'Diet break'}
                      selected={energyMode === 'diet_break'}
                      onPress={() => setEnergyMode('diet_break')}
                      style={s.chipGap}
                    />
                  ) : null}
                </View>
                {adherence && adherence.days >= 5 && adherence.hit / adherence.days < 0.8 ? (
                  <Txt variant="small" color={c.textDim} style={{ marginTop: Space.xs }}>
                    {lang === 'de'
                      ? 'Hinweis: Protein war zuletzt unter Ziel — proteinreiche Rezepte werden bevorzugt.'
                      : 'Protein adherence was low recently — boosting high-protein meals automatically.'}
                  </Txt>
                ) : null}
              </Card>
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
                  {/* Header: what this is, and what training added. */}
                  <View style={s.macroHeader}>
                    <Eyebrow color={c.textDim}>
                      {lang === 'de' ? 'Tagesziel (OMAD)' : 'Daily target (OMAD)'}
                    </Eyebrow>
                  </View>

                  {/* Ring left, legend right: clean separation on narrow phones */}
                  <View style={s.macroRow}>
                    <View style={s.ringWrap}>
                      <MacroRing pPct={pPct} cPct={cPct} fPct={fPct} />
                      <View style={s.ringCenter} pointerEvents="none">
                        <Txt variant="heading" style={{ fontSize: 18, lineHeight: 20, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                          {totalKcal.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')}
                          {'\n'}
                          <Txt variant="small" color={c.textDim} style={{ fontSize: 11, lineHeight: 14, fontWeight: '500' }}>kcal</Txt>
                        </Txt>
                      </View>
                    </View>

                    <View style={{ flex: 1, marginLeft: Space.md }}>
                      {[
                        { label: 'Protein', v: preview.protein_g, pct: pPct, color: c.plan, extra: proteinPerKg ? ` · ${proteinPerKg} g/kg` : '' },
                        { label: t('macro.carbs'), v: preview.carbs_g, pct: cPct, color: c.hydro, extra: '' },
                        { label: t('macro.fat'), v: preview.fat_g, pct: fPct, color: c.gold, extra: '' },
                      ].map((m, i) => (
                        <View key={m.label}>
                          {i > 0 && <View style={[s.statDivider, { backgroundColor: c.line }]} />}
                          <View style={s.macroLine}>
                            <View style={{ flex: 1, marginRight: Space.sm }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[s.macroDot, { backgroundColor: m.color }]} />
                                <Eyebrow color={c.textDim} style={{ fontSize: 12 }}>{m.label}</Eyebrow>
                              </View>
                              <Txt variant="small" color={c.textFaint} style={{ marginLeft: 12, marginTop: 1, fontSize: 11 }}>
                                {m.pct}%{m.extra}
                              </Txt>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                              <Txt variant="heading" style={{ fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{m.v}</Txt>
                              <Txt variant="small" color={c.textFaint} style={{ marginLeft: 2, fontSize: 12 }}>g</Txt>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {preview.burn_kcal > 0 && (
                    <View style={{ marginTop: Space.sm, paddingTop: Space.xs, borderTopWidth: 1, borderTopColor: c.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Txt variant="small" color={c.textDim}>
                        {lang === 'de' ? 'Trainings-Bonus enthalten' : 'Includes workout bonus'}
                      </Txt>
                      <Txt variant="data" color={c.ember} style={{ fontSize: 12 }}>
                        +{preview.burn_kcal} kcal
                      </Txt>
                    </View>
                  )}
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
                          icon={sp.icon}
                          selected={sport === sp.id}
                          onPress={() => setSport(sp.id)}
                          style={s.chipGap}
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
                          onPress={() => setDuration(d)}
                          style={s.chipGap}
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
                          onPress={() => setIntensity(it.id)}
                          style={s.chipGap}
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
                          onPress={() => setTrainingTime(tm)}
                          style={s.chipGap}
                        />
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* One card for the whole session: training above the line,
                  recipe character below it. Two cards for one decision made
                  the form read longer than it is. */}
              <View style={[s.complexityDivider, { backgroundColor: c.line }]} />
              <Eyebrow style={{ marginBottom: Space.md }}>
                {lang === 'de' ? 'Rezept-Komplexität' : 'Recipe complexity'}
              </Eyebrow>
              <View style={s.complexityGrid}>
                {COMPLEXITY_OPTIONS.map((opt, i) => {
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
                          // The plan's own green, not the global cyan: inside
                          // the planner every selection speaks the same hue.
                          borderColor: isSelected ? c.plan : c.line,
                          backgroundColor: isSelected ? c.planWash : c.surface,
                          marginRight: i < COMPLEXITY_OPTIONS.length - 1 ? Space.sm : 0,
                        },
                      ]}
                      accessibilityLabel={`${lang === 'de' ? opt.labelDe : opt.label}${locked ? ' – Premium' : ''}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      {/* Lock overlay for premium */}
                      {locked && (
                        <View style={[s.premiumBadge, { backgroundColor: c.gold }]}>
                          <Txt variant="eyebrow" color={c.onAccent} style={{ fontSize: 9, fontWeight: '800' }}>
                            PRO
                          </Txt>
                        </View>
                      )}
                      <View style={{ alignItems: 'center', justifyContent: 'center', height: 28, marginTop: 4 }}>
                        <Icon name={opt.icon} size={22} color={isSelected ? c.plan : c.textDim} />
                      </View>
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
                label={plan
                  ? (lang === 'de' ? 'Neu generieren' : 'Generate new')
                  : (lang === 'de' ? 'Plan generieren' : 'Generate plan')}
                onPress={() => generate(false)}
                tone="plan"
                style={s.generateBtn}
              />
            </View>

            {plan && (
              <Button
                label={lang === 'de' ? 'Anderes Rezept' : 'Swap recipe'}
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
                    <Eyebrow color={c.plan} style={{ marginLeft: 6, fontSize: 11, fontWeight: '700' }}>
                      {lang === 'de' ? 'Schon gekocht & bewährt' : 'Cooked before'}
                    </Eyebrow>
                  </View>
                  <View style={[s.freeBadge, { backgroundColor: c.planWash }]}>
                    <Txt variant="small" color={c.plan} style={{ fontSize: 11, fontWeight: '600' }}>
                      {lang === 'de' ? 'Jederzeit frei' : 'Always free'}
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
                        recipe_source: premium ? 'premium' : 'standard',
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
                    <Eyebrow color={c.textDim}>{lang === 'de' ? 'Essfenster' : 'Window'}</Eyebrow>
                    <Txt variant="heading" style={{ marginTop: 2 }}>
                      {plan.eating_window_start}–{plan.eating_window_end}
                    </Txt>
                  </View>
                  {plan.pre_training_snack_time && (
                    <View style={s.timingCell}>
                      <Eyebrow color={c.textDim}>{lang === 'de' ? 'Pre-Snack' : 'Pre-snack'}</Eyebrow>
                      <Txt variant="heading" style={{ marginTop: 2 }}>{plan.pre_training_snack_time}</Txt>
                    </View>
                  )}
                  <View style={s.timingCell}>
                    <Eyebrow color={c.textDim}>{lang === 'de' ? 'Hauptmahlzeit' : 'Main meal'}</Eyebrow>
                    <Txt variant="heading" style={{ marginTop: 2 }}>{plan.main_meal_time}</Txt>
                  </View>
                </View>
                {plan.ai_reasoning ? (
                  <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                    {plan.ai_reasoning}
                  </Txt>
                ) : null}
              </Card>
              <View style={{ marginTop: Space.base }}>
                <Button
                  label={lang === 'de' ? 'Kochmodus starten (Hands-Free)' : 'Start Cooking Mode'}
                  icon="chefHat"
                  onPress={() => setShowCookingMode(true)}
                  tone="plan"
                />
              </View>

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

              <CookingModeModal
                visible={showCookingMode}
                onClose={() => setShowCookingMode(false)}
                plan={plan}
                portions={portions}
              />
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

          {!premium && plan && (
            <Enter index={9}>
              <Tap onPress={() => router.push('/paywall')} accessibilityLabel="Upgrade to Premium">
                <View style={[s.upsellBanner, { borderColor: c.gold, backgroundColor: c.goldWash }]}>
                  <View style={{ flex: 1 }}>
                    <Eyebrow color={c.gold}>
                      {lang === 'de' ? 'Performance- & Chef-Rezeptbibliothek' : 'Performance & chef recipe catalog'}
                    </Eyebrow>
                    <Txt variant="small" color={c.textDim} style={{ marginTop: 3 }}>
                      {lang === 'de'
                        ? 'Schalte 20+ spezialisierte OMAD-Rezepte, Chef-Level und 7-Tage-Periodisierung frei.'
                        : 'Unlock 20+ specialized OMAD plates, chef-level meals, and 7-day periodisation.'}
                    </Txt>
                  </View>
                  <Txt variant="small" color={c.gold} style={{ fontWeight: '700', marginLeft: Space.sm }}>
                    Upgrade
                  </Txt>
                </View>
              </Tap>
            </Enter>
          )}
        </>
      ) : plannerTab === 'week' ? (
        /* 7-Day Week Planner Tab using real cycleWeek() from energy.ts */
        <>
          <Enter index={1}>
            <Card style={{ marginTop: Space.base }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.md }}>
                <View>
                  <Eyebrow color={c.plan}>{lang === 'de' ? '7-Tage Makro-Periodisierung' : '7-day macro periodisation'}</Eyebrow>
                  <Txt variant="heading" style={{ fontSize: 20, marginTop: 2 }}>
                    {lang === 'de' ? 'Wochen-Mahlzeitenplan' : 'Weekly Meal Plan'}
                  </Txt>
                </View>
                {!premium && (
                  <View style={[s.premiumPill, { backgroundColor: c.goldWash, borderColor: c.gold, flexDirection: 'row', alignItems: 'center' }]}>
                    <Icon name="crown" size={11} color={c.gold} />
                    <Txt variant="eyebrow" color={c.gold} style={{ fontSize: 10, fontWeight: '800', marginLeft: 4 }}>PRO</Txt>
                  </View>
                )}
              </View>

              {!premium ? (
                <>
                  <Txt variant="body" color={c.textDim} style={{ lineHeight: 22 }}>
                    {lang === 'de'
                      ? 'Verteile deine Wochenkalorien über Trainingstage und Ruhetage (nie unter deinem Grundumsatz) und generiere mit einem Tipp die komplette Einkaufsliste.'
                      : 'Distribute weekly energy across training and rest days cleanly (never below resting BMR) and prep your full weekly shopping list in one tap.'}
                  </Txt>

                  <View style={[s.weekFeatureGrid, { marginTop: Space.base }]}>
                    <View style={[s.weekFeatureCard, { backgroundColor: c.well, borderColor: c.line, marginRight: Space.sm }]}>
                      <Icon name="calendar" size={18} color={c.gold} />
                      <Txt variant="subheading" style={{ fontSize: 13, fontWeight: '700', marginTop: 6 }}>
                        {lang === 'de' ? '7-Tage-Vorschau' : '7-Day Overview'}
                      </Txt>
                      <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 2 }}>
                        {lang === 'de' ? 'Mo–So Mahlzeiten im Blick' : 'Mon–Sun meals organized'}
                      </Txt>
                    </View>
                    <View style={[s.weekFeatureCard, { backgroundColor: c.well, borderColor: c.line, marginRight: Space.sm }]}>
                      <Icon name="bolt" size={18} color={c.ember} />
                      <Txt variant="subheading" style={{ fontSize: 13, fontWeight: '700', marginTop: 6 }}>
                        {lang === 'de' ? 'Makro-Periodisierung' : 'Macro Periodisation'}
                      </Txt>
                      <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 2 }}>
                        {lang === 'de' ? 'Mehr Carbs an Trainingstagen' : 'High carbs on workout days'}
                      </Txt>
                    </View>
                    <View style={[s.weekFeatureCard, { backgroundColor: c.well, borderColor: c.line }]}>
                      <Icon name="basket" size={18} color={c.plan} />
                      <Txt variant="subheading" style={{ fontSize: 13, fontWeight: '700', marginTop: 6 }}>
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
                    tone="gold"
                    style={{ marginTop: Space.base }}
                  />
                </>
              ) : (() => {
                const daysOfWeek = lang === 'de'
                  ? ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
                  : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const trainFreq = trainingDaysPerWeek(history) ?? 4;
                const cycle = cycleWeek(previewBase.kcal * 7, trainFreq, floorKcal);
                const workoutKcal = cycle ? cycle.trainingKcal : previewBase.kcal;
                const restKcal = cycle ? cycle.restKcal : Math.max(floorKcal, dailyTargets(profile, null, measured).kcal);
                const workoutCarbs = Math.max(20, Math.round((workoutKcal - previewBase.protein_g * 4 - previewBase.fat_g * 9) / 4));
                const restCarbs = Math.max(20, Math.round((restKcal - previewBase.protein_g * 4 - previewBase.fat_g * 9) / 4));

                return (
                  <View style={{ marginTop: Space.sm }}>
                    {cycle ? (
                      <Txt variant="small" color={c.textDim} style={{ marginBottom: Space.sm }}>
                        {cycle.note}
                      </Txt>
                    ) : null}
                    {daysOfWeek.map((dayName, idx) => {
                      const isWorkoutDay = idx < trainFreq && (idx % 2 === 0 || trainFreq > 4);
                      const dKcal = isWorkoutDay ? workoutKcal : restKcal;
                      const dCarbs = isWorkoutDay ? workoutCarbs : restCarbs;
                      return (
                        <View key={dayName} style={[s.weekDayRow, { borderColor: c.line }]}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Txt variant="bodyMedium" style={{ fontWeight: '700' }}>{dayName}</Txt>
                              <View style={[s.workoutDayBadge, {
                                backgroundColor: isWorkoutDay ? c.planWash : c.well,
                                borderColor: isWorkoutDay ? c.plan : c.line,
                              }]}>
                                <Txt variant="eyebrow" color={isWorkoutDay ? c.plan : c.textDim} style={{ fontSize: 10 }}>
                                  {isWorkoutDay ? (lang === 'de' ? 'Training' : 'Workout') : (lang === 'de' ? 'Ruhetag' : 'Rest')}
                                </Txt>
                              </View>
                            </View>
                            <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                              {`${dKcal} kcal · ${previewBase.protein_g}g P · ${dCarbs}g C`}
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
                              <Txt variant="small" color={c.plan} style={{ marginLeft: 4, fontSize: 12, fontWeight: '600' }}>
                                {lang === 'de' ? 'Planen' : 'Plan'}
                              </Txt>
                            </View>
                          </Tap>
                        </View>
                      );
                    })}
                    <Button
                      label={lang === 'de' ? 'Wocheneinkauf füllen (3 Tage-Mix)' : 'Prep 3-day rotated grocery list'}
                      variant="secondary"
                      icon="basket"
                      onPress={async () => {
                        const sess: Training = { sport, duration_min: duration, intensity, start_time: trainingTime };
                        const usedTitles: string[] = [];
                        for (let i = 0; i < 3; i++) {
                          const pDay = generateMealPlan(profile, i % 2 === 0 ? sess : null, lang, {
                            measuredMaintenance: measured,
                            complexity,
                            isPremium: true,
                            historyTitles: usedTitles,
                          });
                          usedTitles.push(pDay.recipe.title);
                          await savePlan(pDay);
                        }
                        setHistory(await loadPlanHistory<MealPlan>());
                        router.push('/grocery');
                      }}
                      style={{ marginTop: Space.base }}
                    />
                  </View>
                );
              })()}
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
                {lang === 'de' ? 'Gespeicherte Pläne' : 'Saved plans'}
              </Eyebrow>
              {history.length === 0 ? (
                <View>
                  <Txt variant="small" color={c.textDim}>
                    {lang === 'de' ? 'Noch kein Plan generiert.' : 'No plans yet.'}
                  </Txt>
                  <Button
                    size="sm"
                    variant="secondary"
                    label={lang === 'de' ? 'Mahlzeit planen' : "Plan today's meal"}
                    onPress={() => setPlannerTab('today')}
                    style={{ marginTop: Space.md, alignSelf: 'flex-start' }}
                  />
                </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Space.base,
    paddingBottom: Space.md,
  },
  quotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  quotaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  restRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  chipSection: { marginTop: Space.md },
  chipLabel: { marginBottom: Space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chipGap: { marginRight: Space.xs, marginBottom: Space.xs },

  // Complexity Selector
  complexityDivider: {
    height: 1,
    marginTop: Space.lg,
    marginBottom: Space.lg,
  },
  complexityGrid: {
    flexDirection: 'row',
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
  macroRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  ringWrap: {
    width: 116, height: 116,
    alignItems: 'center', justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute', alignItems: 'center',
  },
  macroLine: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Space.sm,
  },
  statDivider: { height: 1 },
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
    flexDirection: 'row',
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
