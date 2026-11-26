/**
 * Today / Heute — Calm Mobile-First OMAD Screen.
 *
 * Anti-slop mobile hierarchy (`frontend-design`, `no-slop-ui`, `mobile-native`):
 * - Single memorable focal point: clean fasting ring + 24h band + one decisive action.
 * - Native iOS grouped list sections with hairline separators (replaces SaaS bento squares
 *   and decorative colored icon badges).
 * - Sentence-case labels, >= 44pt touch targets, zero ALL-CAPS eyebrow clutter.
 * - Preserves all domain/E2E telemetry contracts (`fastingStage`, `DayBand`, `dayAgenda`
 *   tick actions, +250/+500ml water + electrolytes, steps, OMAD meal, 6-option intake,
 *   readiness, scaleJump).
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BreakFastGuideModal } from '@/components/BreakFastGuideModal';
import { DailyFastingNote } from '@/components/DailyFastingNote';
import { DayBand } from '@/components/DayBand';
import { FastingFeelingBar } from '@/components/FastingFeelingBar';
import { FastingHaloDial } from '@/components/FastingHaloDial';
import { Icon, type IconName } from '@/components/icons';
import { useLang } from '@/components/lang';
import { MetabolicTimelineModal } from '@/components/MetabolicTimelineModal';
import { ShareableFastCardModal } from '@/components/ShareableFastCardModal';
import {
  Bar,
  Button,
  Card,
  Divider,
  Notice,
  PageHeader,
  Screen,
  Tap,
  Txt,
  useTheme,
} from '@/components/ui';
import { WindowShifterModal } from '@/components/WindowShifterModal';
import { Hairline, Radius, Space, Type } from '@/constants/theme';
import { dayAgenda, minutesUntil, type AgendaItem } from '@/lib/agenda';
import type { MealPlan } from '@/lib/recipes';
import { formatReadableDate } from '@/lib/dates';
import {
  effectiveMaintenance,
  intakeQuestionFor,
  readiness,
  scaleJump,
  type IntakeQuestion,
  type Readiness,
  type ScaleJump,
} from '@/lib/energy';
import { haptic } from '@/lib/haptic';
import { setEnabled as setRemindersEnabled } from '@/lib/notify';
import {
  DEFAULT_PROFILE,
  dailyTargets,
  fastingStage,
  fastingState,
  hydrationTargetMl,
  targetForDate,
  toMinutes,
  type FastingState,
  type UserProfile,
} from '@/lib/nutrition';
import { formatSetsSummary, type WorkoutLogEntry } from '@/lib/workouts';
import { INTAKE_OPTIONS, intakeKcal, intakeLabel, intakeOptionLabel } from '@/lib/review';
import { playZenChime } from '@/lib/sound';
import {
  currentStreak,
  isPremium,
  loadCookLog,
  loadDailySteps,
  loadFastLog,
  loadHydration,
  loadIntakeLog,
  loadLastPlan,
  loadPlanHistory,
  loadProfileOrDefault,
  loadWorkoutLog,
  loadTodayWindowShift,
  loadWeightLog,
  markCooked,
  markFastComplete,
  markRemindersOffered,
  recordIntake,
  remindersOffered,
  saveDailySteps,
  saveHydration,
  saveProfile,
  saveWeightLog,
  todayISO,
  type Hydration,
} from '@/lib/store';

const AGENDA_ICONS: Record<AgendaItem['kind'], IconName> = {
  cook: 'flame',
  window_open: 'clock',
  snack: 'plus',
  meal: 'plate',
  window_close: 'moon',
  log_fast: 'check',
};

export default function DashboardScreen() {
  const router = useRouter();
  const c = useTheme();
  const { lang, t } = useLang();

  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [now, setNow] = useState(new Date());
  const [fast, setFast] = useState<FastingState | null>(null);

  const [hydration, setHydration] = useState<Hydration>({ date: '', ml: 0, electrolytes: false });
  const [steps, setSteps] = useState(0);
  const [streak, setStreak] = useState(0);
  const [fastLogged, setFastLogged] = useState(false);
  const [cooked, setCooked] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutLogEntry[]>([]);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [isShifted, setIsShifted] = useState(false);

  const [question, setQuestion] = useState<IntakeQuestion | null>(null);
  const [answered, setAnswered] = useState<{ date: string; factor: number | null } | null>(null);
  const [jump, setJump] = useState<ScaleJump | null>(null);
  const [need, setNeed] = useState<Readiness | null>(null);
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [weighedToday, setWeighedToday] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [offerReminders, setOfferReminders] = useState(false);

  const [showShifter, setShowShifter] = useState(false);
  const [showMetabolic, setShowMetabolic] = useState(false);
  const [showBreakFast, setShowBreakFast] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const refresh = useCallback(async () => {
    const [p, h, fl, cl, last, weights, intake, prem, shift, st, remOffered, wLog, pHist] = await Promise.all([
      loadProfileOrDefault(),
      loadHydration(),
      loadFastLog(),
      loadCookLog(),
      loadLastPlan<MealPlan>(),
      loadWeightLog(),
      loadIntakeLog(),
      isPremium(),
      loadTodayWindowShift(),
      loadDailySteps(),
      remindersOffered(),
      loadWorkoutLog(),
      loadPlanHistory<MealPlan>(),
    ]);
    setIsShifted(Boolean(shift));
    const effectiveProfile = shift ? { ...p, omad_window_start: shift.window_start } : p;
    setQuestion(intakeQuestionFor(effectiveProfile, intake));
    const latest = [...(intake ?? [])].sort((a, b) => a.date.localeCompare(b.date)).pop();
    setAnswered(latest ? { date: latest.date, factor: latest.factor } : null);
    setJump(scaleJump(weights, intake));
    setNeed(readiness(intake, weights));
    setMeasured(effectiveMaintenance(intake, weights, dailyTargets(effectiveProfile, null).maintenance_kcal, prem));
    setProfile(effectiveProfile);
    setHydration(h);
    setStreak(currentStreak(fl));
    setFastLogged(fl.includes(todayISO()));
    setCooked(cl.includes(todayISO()));
    setPlan(last?.date === todayISO() ? last : null);
    setWorkouts(wLog);
    setPlans(pHist);
    setWeighedToday(weights.some((w) => w.date === todayISO()));
    setSteps(st);
    setOfferReminders(!remOffered);
    setMounted(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNow(n);
      setFast(fastingState(profile, n));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [profile]);

  if (!mounted || !fast) return null;

  const { items, next } = dayAgenda(profile, plan, { cooked, fastLogged }, now, lang);
  const baseline = dailyTargets(profile, null, measured);
  const todayTarget = targetForDate(profile, todayISO(), { workouts, plans, measuredMaintenance: measured });
  const kcal = plan ? plan.total_kcal : todayTarget.kcal;
  const questionTarget = question
    ? targetForDate(profile, question.date, { workouts, plans, measuredMaintenance: measured }).kcal
    : baseline.kcal;
  const questionKcal = !question || question.date === todayISO() ? kcal : questionTarget;
  const protein = plan ? plan.protein_g : todayTarget.protein_g;
  const waterTarget = hydrationTargetMl(profile, todayTarget.training);

  const addWater = async (ml: number) => {
    const nextHydro = { ...hydration, date: todayISO(), ml: Math.max(0, hydration.ml + ml) };
    setHydration(nextHydro);
    await saveHydration(nextHydro);
    haptic('light');
  };

  const toggleSalt = async () => {
    const nextHydro = { ...hydration, date: todayISO(), electrolytes: !hydration.electrolytes };
    setHydration(nextHydro);
    await saveHydration(nextHydro);
    haptic('light');
  };

  const addSteps = async (amount: number) => {
    const nextSteps = steps + amount;
    setSteps(nextSteps);
    await saveDailySteps(nextSteps);
    haptic('light');
  };

  const completeFast = async () => {
    haptic('success');
    playZenChime();
    const updated = await markFastComplete();
    setFastLogged(true);
    setStreak(currentStreak(updated));
    setShowCelebration(true);
  };

  const doAgendaAction = async (kind: AgendaItem['kind']) => {
    if (kind === 'log_fast') {
      await completeFast();
    } else if (kind === 'cook') {
      haptic('success');
      await markCooked();
      setCooked(true);
    }
  };

  const answerIntake = async (factor: number | null) => {
    if (!question) return;
    haptic('light');
    if (factor !== null) {
      const updated = await recordIntake(factor, questionKcal, question.date);
      setAnswered({ date: question.date, factor });
      const weights = await loadWeightLog();
      setJump(scaleJump(weights, updated));
      setNeed(readiness(updated, weights));
      setMeasured(effectiveMaintenance(updated, weights, baseline.maintenance_kcal, await isPremium()));
    }
    setQuestion(null);
  };

  const reopenQuestion = () => {
    if (!answered) return;
    haptic('light');
    setQuestion({ date: answered.date, hoursSinceClose: 0 });
  };

  const logWeight = async () => {
    const w = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(w) || w < 30 || w > 300) return;
    const weights = await loadWeightLog();
    const today = todayISO();
    const updated = [
      { id: `${today}-${Date.now()}`, date: today, weight_kg: w },
      ...weights.filter((e) => e.date !== today),
    ].sort((a, b) => b.date.localeCompare(a.date));
    await saveWeightLog(updated);
    const nextProfile = { ...profile, weight_kg: w };
    await saveProfile(nextProfile);
    setProfile(nextProfile);
    setWeightInput('');
    setWeighedToday(true);
    haptic('success');
    const freshIntake = await loadIntakeLog();
    setJump(scaleJump(updated, freshIntake));
    setNeed(readiness(freshIntake, updated));
  };

  const hoursFasted = fast.isEating ? 0 : fast.fastingHours * (fast.progressPct / 100);
  const stage = fastingStage(hoursFasted);

  const waterPct = Math.min(100, (hydration.ml / waterTarget) * 100);
  const STEP_GOAL = 10000;
  const stepsPct = Math.min(100, (steps / STEP_GOAL) * 100);
  const nextMins = next ? minutesUntil(next, profile, now) : Infinity;
  const nextColor = nextMins <= 60 ? c.ember : c.accent;

  const windowSummary =
    `${fast.windowStart}–${fast.windowEnd} · ${fast.fastingHours}h ${lang === 'de' ? 'Fasten' : 'fast'}` +
    (plan?.training_start_time
      ? ` · ${lang === 'de' ? 'Training' : 'Session'} ${plan.training_start_time}`
      : '');

  return (
    <Screen
      refresh={{
        refreshing,
        onRefresh: async () => {
          setRefreshing(true);
          await refresh();
          setRefreshing(false);
        },
      }}
    >
      {/* Mobile-native top header */}
      <PageHeader
        title={t('tab.today')}
        subtitle={formatReadableDate(now, lang)}
        right={
          <View style={s.headerRight}>
            <Tap
              onPress={() => {
                haptic('light');
                router.push('/achievements');
              }}
              accessibilityLabel={`Streak ${streak} days`}
              style={s.headerAction}
            >
              <Icon name="flame" size={16} color={streak > 0 ? c.ember : c.textFaint} />
              <Txt
                variant="data"
                color={streak > 0 ? c.ember : c.textDim}
                style={{ marginLeft: 4, fontSize: 13 }}
              >
                {streak} {streak === 1 ? (lang === 'de' ? 'Tag' : 'DAY') : lang === 'de' ? 'Tage' : 'DAYS'}
              </Txt>
            </Tap>

            <Tap
              onPress={() => router.push('/workout')}
              accessibilityLabel="Workouts"
              style={s.iconTouch}
            >
              <Icon name="bolt" size={20} color={workouts.some((w) => w.date === todayISO()) ? c.plan : c.textDim} />
            </Tap>

            <Tap
              onPress={() => router.push('/you/reminders')}
              accessibilityLabel={lang === 'de' ? 'Erinnerungen' : 'Reminders'}
              style={s.iconTouch}
            >
              <Icon name="bell" size={20} color={c.textDim} />
            </Tap>
          </View>
        }
      />

      {showCelebration ? (
        <Card tone="ember" style={s.sectionGap}>
          <View style={s.rowBetween}>
            <Txt variant="subheading" color={c.text}>
              {lang === 'de' ? 'Fasten abgeschlossen' : 'Fast completed'}
            </Txt>
            <Tap onPress={() => setShowCelebration(false)} accessibilityLabel="Dismiss">
              <Icon name="close" size={18} color={c.textDim} />
            </Tap>
          </View>
          <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
            {lang === 'de'
              ? `${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge erfasst.`
              : `${streak} ${streak === 1 ? 'day' : 'days'} logged in a row.`}
          </Txt>
          <View style={{ marginTop: Space.md, alignSelf: 'flex-start' }}>
            <Button
              size="sm"
              variant="primary"
              label={lang === 'de' ? 'Erfolg teilen' : 'Share milestone'}
              onPress={() => {
                setShowCelebration(false);
                setShowShare(true);
              }}
            />
          </View>
        </Card>
      ) : null}

      {/* Primary Fasting Instrument Card */}
      <Card style={[s.heroCard, { backgroundColor: c.heroFill }]}>
        <View style={s.rowBetween}>
          <Txt variant="subheading" color={fast.isEating ? c.ember : c.text}>
            {fast.isEating
              ? lang === 'de'
                ? 'Essensfenster offen'
                : 'Eating window open'
              : lang === 'de'
              ? 'Fastenzeit'
              : 'Fasting'}
          </Txt>

          <Tap
            onPress={() => {
              haptic('light');
              setShowShifter(true);
            }}
            accessibilityLabel={lang === 'de' ? 'Essensfenster verschieben' : 'Shift eating window'}
            style={[s.windowTrigger, { borderColor: isShifted ? c.ember : c.line }]}
          >
            <Txt variant="data" color={isShifted ? c.ember : c.textDim}>
              {fast.windowStart}–{fast.windowEnd}
            </Txt>
            <View style={{ marginLeft: 5 }}>
              <Icon name="edit" size={12} color={isShifted ? c.ember : c.textFaint} />
            </View>
          </Tap>
        </View>

        <FastingHaloDial
          remainingMs={fast.remainingMs}
          fastingHours={fast.fastingHours}
          progressPct={fast.progressPct}
          isEating={fast.isEating}
          windowStart={fast.windowStart}
          windowEnd={fast.windowEnd}
          hoursFasted={hoursFasted}
          phaseName={stage.label}
          stageSummary={t('today.fastedFor', { hours: hoursFasted.toFixed(1) })}
        />

        <DayBand
          onHero
          style={{ marginTop: Space.md }}
          nowMin={now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60}
          windowStartMin={toMinutes(profile.omad_window_start)}
          windowLengthMin={profile.omad_window_hours * 60}
          items={items}
          isEating={fast.isEating}
        />

        <Txt variant="small" color={c.textFaint} style={{ textAlign: 'center', marginTop: Space.sm }}>
          {windowSummary}
        </Txt>

        <View style={{ marginTop: Space.base }}>
          <Button
            fullWidth
            variant={fast.isEating ? 'ember' : 'primary'}
            label={
              fast.isEating
                ? 'Break-Fast Guide'
                : fastLogged
                ? lang === 'de'
                  ? 'Fasten geloggt · Break-Fast Guide'
                  : 'Fast logged · Break-Fast Guide'
                : lang === 'de'
                ? 'Fasten beenden & Teller loggen'
                : 'Finish fast & log meal'
            }
            onPress={() => {
              if (!fast.isEating && !fastLogged) {
                completeFast();
              } else {
                setShowBreakFast(true);
              }
            }}
          />

          <View style={s.subLinkRow}>
            <Tap onPress={() => router.push('/timer')} style={s.textLink} accessibilityLabel="Open timer">
              <Icon name="clock" size={14} color={c.textDim} />
              <Txt variant="small" color={c.textDim} style={{ marginLeft: 5, fontWeight: '500' }}>
                {lang === 'de' ? 'Timer' : 'Timer'}
              </Txt>
            </Tap>
            <Tap onPress={() => setShowMetabolic(true)} style={s.textLink} accessibilityLabel="24h stages">
              <Icon name="flame" size={14} color={c.textDim} />
              <Txt variant="small" color={c.textDim} style={{ marginLeft: 5, fontWeight: '500' }}>
                {lang === 'de' ? '24h Phasen' : 'Stages'}
              </Txt>
            </Tap>
            <Tap onPress={() => setShowShare(true)} style={s.textLink} accessibilityLabel="Share fast">
              <Icon name="share" size={14} color={c.textDim} />
              <Txt variant="small" color={c.textDim} style={{ marginLeft: 5, fontWeight: '500' }}>
                {lang === 'de' ? 'Teilen' : 'Share'}
              </Txt>
            </Tap>
          </View>
        </View>
      </Card>

      {/* Grouped Vitals Section (Apple Health list style — no split bento boxes) */}
      <Card style={s.sectionGap}>
        {/* Hydration Row */}
        <View>
          <View style={s.rowBetween}>
            <View style={s.rowCenter}>
              <Icon name="drop" size={17} color={c.hydro} />
              <Txt variant="subheading" color={c.text} style={{ marginLeft: Space.sm }}>
                {t('today.hydration')}
              </Txt>
            </View>
            <View style={s.rowCenter}>
              <Txt variant="data" color={c.text}>
                {(hydration.ml / 1000).toFixed(1)}
              </Txt>
              <Txt variant="small" color={c.textDim} style={{ marginLeft: 3 }}>
                / {(waterTarget / 1000).toFixed(1)}L
              </Txt>
              <Tap
                onPress={toggleSalt}
                accessibilityLabel="Electrolytes"
                accessibilityState={{ selected: hydration.electrolytes }}
                style={[
                  s.inlineToggle,
                  {
                    backgroundColor: hydration.electrolytes ? c.emberWash : c.well,
                    marginLeft: Space.sm,
                  },
                ]}
              >
                <Txt variant="small" color={hydration.electrolytes ? c.ember : c.textDim} style={{ fontWeight: '600' }}>
                  {hydration.electrolytes
                    ? lang === 'de'
                      ? 'Salz an'
                      : 'Salt on'
                    : lang === 'de'
                    ? '+ Salz'
                    : '+ Salt'}
                </Txt>
              </Tap>
            </View>
          </View>

          <View style={{ marginTop: Space.sm }}>
            <Bar pct={waterPct} color={c.hydro} height={5} />
          </View>

          <View style={s.waterButtons}>
            <Tap
              onPress={() => addWater(250)}
              accessibilityLabel="Add 250 millilitres"
              style={[s.compactBtn, { backgroundColor: c.well, marginRight: Space.xs }]}
            >
              <Txt variant="data" color={c.text}>
                +250 ml
              </Txt>
            </Tap>
            <Tap
              onPress={() => addWater(500)}
              accessibilityLabel="Add 500 millilitres"
              style={[s.compactBtn, { backgroundColor: c.well, marginLeft: Space.xs }]}
            >
              <Txt variant="data" color={c.text}>
                +500 ml
              </Txt>
            </Tap>
          </View>
        </View>

        <Divider />

        {/* Steps Row */}
        <View style={s.rowBetween}>
          <View style={{ flex: 1, marginRight: Space.md }}>
            <View style={s.rowBetween}>
              <View style={s.rowCenter}>
                <Icon name="footprints" size={17} color={c.accent} />
                <Txt variant="subheading" color={c.text} style={{ marginLeft: Space.sm }}>
                  {lang === 'de' ? 'Schritte' : 'Steps'}
                </Txt>
              </View>
              <View style={s.rowCenter}>
                <Txt variant="data" color={c.text}>
                  {steps.toLocaleString()}
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ marginLeft: 3 }}>
                  / 10k
                </Txt>
              </View>
            </View>
            <View style={{ marginTop: Space.sm }}>
              <Bar pct={stepsPct} color={c.accent} height={5} />
            </View>
          </View>

          <Tap
            onPress={() => addSteps(1000)}
            accessibilityLabel="Add 1,000 steps"
            style={[s.stepsBtn, { backgroundColor: c.well }]}
          >
            <Txt variant="data" color={c.text}>
              {lang === 'de' ? '+1.000' : '+1,000'}
            </Txt>
          </Tap>
        </View>
      </Card>

      {/* Today's Meal Row */}
      <Tap
        onPress={() => router.push('/planner')}
        accessibilityLabel={lang === 'de' ? 'Heutige Mahlzeit' : "Today's meal"}
        style={s.sectionGap}
      >
        <Card>
          <View style={s.rowBetween}>
            <View style={{ flex: 1, marginRight: Space.md }}>
              <View style={s.rowCenter}>
                <Icon name="plate" size={17} color={plan ? c.plan : c.ember} />
                <Txt variant="subheading" color={c.text} style={{ marginLeft: Space.sm }}>
                  {plan ? plan.recipe.title : t('today.defaultMeal')}
                </Txt>
              </View>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
                {kcal} kcal · {protein}g {lang === 'de' ? 'Protein' : 'protein'} · {t('today.breakProtocol')}
              </Txt>
            </View>
            <Icon name="chevronRight" size={16} color={c.textFaint} />
          </View>
        </Card>
      </Tap>

      {/* Today's Workout & Calisthenics Row */}
      {(() => {
        const loggedToday = workouts.find((w) => w.date === todayISO());
        const summary = loggedToday && loggedToday.exercises[0]
          ? `${loggedToday.sport} · ${loggedToday.durationMin} Min · ${formatSetsSummary(loggedToday.exercises[0].sets, 'reps', lang)}`
          : null;
        return (
          <Tap
            onPress={() => router.push('/workout')}
            accessibilityLabel={lang === 'de' ? 'Workouts & Calisthenics' : 'Workouts & Calisthenics'}
            style={s.sectionGap}
          >
            <Card>
              <View style={s.rowBetween}>
                <View style={{ flex: 1, marginRight: Space.md }}>
                  <View style={s.rowCenter}>
                    <Icon name="bolt" size={17} color={loggedToday ? c.plan : c.accent} />
                    <Txt variant="subheading" color={c.text} style={{ marginLeft: Space.sm }}>
                      {lang === 'de' ? 'Calisthenics & Training' : 'Calisthenics & workouts'}
                    </Txt>
                  </View>
                  <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
                    {summary
                      ? summary
                      : lang === 'de'
                      ? 'Sätze & Wiederholungen loggen — fließt in dein Kalorienziel ein'
                      : 'Log sets & reps — feeds directly into your meal target'}
                  </Txt>
                </View>
                <Icon name="chevronRight" size={16} color={c.textFaint} />
              </View>
            </Card>
          </Tap>
        );
      })()}

      {/* Today's Agenda */}
      <Card style={s.sectionGap}>
        <View style={[s.rowBetween, { marginBottom: Space.sm }]}>
          <Txt variant="subheading" color={c.text}>
            {t('today.agenda')}
          </Txt>
          {next && nextMins < 60 ? (
            <Txt variant="small" color={nextColor} style={{ fontWeight: '600' }}>
              {nextMins <= 0
                ? lang === 'de'
                  ? 'Jetzt fällig'
                  : 'Due now'
                : lang === 'de'
                ? `In ${Math.max(1, Math.round(nextMins))} Min.`
                : `In ${Math.max(1, Math.round(nextMins))} min`}
            </Txt>
          ) : null}
        </View>

        {items.map((item, idx) => {
          const dim = item.past || item.done;
          const isNext = item === next;
          return (
            <View key={item.kind}>
              {idx > 0 ? <Divider style={{ marginVertical: Space.sm }} /> : null}
              <Tap
                onPress={item.actionable && !item.done ? () => doAgendaAction(item.kind) : undefined}
                disabled={!item.actionable || item.done}
                accessibilityRole={item.actionable ? 'button' : 'text'}
                accessibilityLabel={`${item.title} at ${item.at}`}
                style={s.agendaRow}
              >
                <Txt variant="data" color={dim ? c.textFaint : c.textDim} style={s.agendaTime}>
                  {item.at}
                </Txt>
                <Icon
                  name={item.done ? 'check' : AGENDA_ICONS[item.kind]}
                  size={15}
                  color={
                    item.done
                      ? c.positive
                      : dim
                      ? c.textFaint
                      : isNext
                      ? nextColor
                      : c.textDim
                  }
                />
                <Txt
                  variant="bodyMedium"
                  color={dim ? c.textFaint : c.text}
                  style={[
                    s.agendaTitle,
                    item.done ? { textDecorationLine: 'line-through' } : null,
                  ]}
                >
                  {item.title}
                </Txt>
                {item.actionable && !item.done ? (
                  <View style={[s.tickBtn, { backgroundColor: c.accentWash }]}>
                    <Txt variant="small" color={c.accent} style={{ fontWeight: '600' }}>
                      {t('today.tick')}
                    </Txt>
                  </View>
                ) : null}
              </Tap>
            </View>
          );
        })}
      </Card>

      {/* Scale Jump Notice */}
      {jump ? (
        <Card tone="ember" style={s.sectionGap}>
          <Txt variant="subheading" color={c.ember}>
            Up {jump.kg} kg
          </Txt>
          <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
            {jump.note}
          </Txt>
        </Card>
      ) : null}

      {/* Evening Intake Check-In */}
      {question ? (
        <Card style={s.sectionGap}>
          <View style={s.rowBetween}>
            <Txt variant="subheading" color={c.text}>
              {question.date === todayISO()
                ? lang === 'de'
                  ? 'Wie lief dein Essen heute?'
                  : 'How did today go?'
                : lang === 'de'
                ? 'Wie lief dein Essen gestern?'
                : 'How did yesterday go?'}
            </Txt>
            <Txt variant="data" color={c.textDim}>
              {questionKcal} kcal
            </Txt>
          </View>

          <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
            {lang === 'de'
              ? 'Grob gegen deinen Zielwert — damit lernt die App deinen realen Umsatz.'
              : 'Roughly against target kcal — this calibrates your measured maintenance.'}
          </Txt>

          <View style={s.intakeGrid}>
            {INTAKE_OPTIONS.map((o) => (
              <View key={o.label} style={s.intakeCell}>
                <Tap
                  onPress={() => answerIntake(o.factor)}
                  accessibilityLabel={`${o.label}, about ${intakeKcal(o.factor, questionKcal)} kcal`}
                  style={[s.intakeBtn, { backgroundColor: c.well }]}
                >
                  <Txt variant="small" color={c.text} style={{ fontWeight: '600', textAlign: 'center' }}>
                    {lang === 'de' ? intakeOptionLabel(o, lang) : o.label}
                  </Txt>
                  <Txt variant="small" color={c.textFaint} style={{ marginTop: 2, fontSize: 12 }}>
                    {o.factor === 1 ? '' : '≈ '}
                    {intakeKcal(o.factor, questionKcal)} kcal
                  </Txt>
                </Tap>
              </View>
            ))}
          </View>

          <Tap
            onPress={() => answerIntake(null)}
            accessibilityLabel="Completely different"
            style={{ marginTop: Space.md, alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}
          >
            <Txt variant="small" color={c.textFaint}>
              {lang === 'de' ? 'Ganz anders — heute auslassen' : 'Completely different — skip today'}
            </Txt>
          </Tap>
        </Card>
      ) : answered ? (
        <Tap
          onPress={reopenQuestion}
          accessibilityLabel="Change today's answer"
          style={s.sectionGap}
        >
          <Card>
            <View style={s.rowBetween}>
              <Txt variant="small" color={c.textDim}>
                {answered.date === todayISO()
                  ? lang === 'de'
                    ? 'Heute'
                    : 'Today'
                  : lang === 'de'
                  ? 'Gestern'
                  : 'Yesterday'}
                : {intakeLabel(answered.factor)}
              </Txt>
              <Txt variant="small" color={c.accent} style={{ fontWeight: '600' }}>
                {lang === 'de' ? 'ändern' : 'change'}
              </Txt>
            </View>
          </Card>
        </Tap>
      ) : null}

      {/* Calibration Readiness */}
      {need && !need.ready ? (
        <Card style={s.sectionGap}>
          <Txt variant="subheading" color={c.text}>
            {lang === 'de'
              ? 'Bis dein Verbrauch messbar ist'
              : 'Until your maintenance can be measured'}
          </Txt>
          <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
            {need.note}
          </Txt>
        </Card>
      ) : null}

      {/* Quick Weigh-In when not weighed today */}
      {!weighedToday ? (
        <Card style={s.sectionGap}>
          <Txt variant="subheading" color={c.text}>
            {t('today.dailyWeighIn')}
          </Txt>
          <Txt variant="small" color={c.textDim} style={{ marginTop: 2, marginBottom: Space.md }}>
            {t('today.dailyWeighInSub')}
          </Txt>
          <View style={s.weighRow}>
            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              onSubmitEditing={logWeight}
              placeholder={profile.weight_kg.toFixed(1)}
              placeholderTextColor={c.textFaint}
              keyboardType="numeric"
              inputMode="decimal"
              accessibilityLabel="Today's weight in kilograms"
              style={[
                Type.data,
                s.weighInput,
                {
                  color: c.text,
                  backgroundColor: c.well,
                  borderColor: c.line,
                  fontSize: 16,
                },
              ]}
            />
            <Tap
              onPress={logWeight}
              disabled={!weightInput.trim()}
              accessibilityLabel="Save weight"
              style={[
                s.weighBtn,
                { backgroundColor: weightInput.trim() ? c.accent : c.well },
              ]}
            >
              <Icon
                name="check"
                size={18}
                color={weightInput.trim() ? c.onAccent : c.textFaint}
                strokeWidth={2.2}
              />
            </Tap>
          </View>
        </Card>
      ) : null}

      {/* First-Run Reminders Offer */}
      {offerReminders ? (
        <Card style={s.sectionGap}>
          <Txt variant="subheading" color={c.text}>
            Want the app to tell you when?
          </Txt>
          <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
            Window opening and closing, when to start cooking, and a nudge to weigh in — the
            measurement needs four weigh-ins across ten days.
          </Txt>
          <View style={s.offerRow}>
            <Button
              size="sm"
              label="Turn them on"
              onPress={async () => {
                await markRemindersOffered();
                setOfferReminders(false);
                const [fasts, cooks, weights] = await Promise.all([
                  loadFastLog(),
                  loadCookLog(),
                  loadWeightLog(),
                ]);
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - 2);
                await setRemindersEnabled(true, profile, plan, {
                  cooked: cooks.includes(todayISO()),
                  fastLogged: fasts.includes(todayISO()),
                  weighedRecently: weights.some((w) => w.date >= todayISO(cutoff)),
                });
              }}
              style={{ flex: 1, marginRight: Space.xs }}
            />
            <Button
              size="sm"
              label="No thanks"
              variant="secondary"
              onPress={async () => {
                await markRemindersOffered();
                setOfferReminders(false);
              }}
              style={{ flex: 1, marginLeft: Space.xs }}
            />
          </View>
        </Card>
      ) : null}

      {/* Reflection */}
      <Card style={s.sectionGap}>
        <FastingFeelingBar embedded />
        <Divider />
        <DailyFastingNote embedded />
      </Card>

      {measured !== undefined ? (
        <Notice tone="ok">
          {lang === 'de'
            ? `Gemessener Tagesverbrauch aktiv: ${measured} kcal`
            : `Calibrated daily maintenance: ${measured} kcal`}
        </Notice>
      ) : null}

      <WindowShifterModal
        visible={showShifter}
        onClose={() => setShowShifter(false)}
        baseStart={profile.omad_window_start}
        baseLengthHours={profile.omad_window_hours}
        onShiftApplied={refresh}
      />

      <MetabolicTimelineModal
        visible={showMetabolic}
        onClose={() => setShowMetabolic(false)}
        hoursFasted={hoursFasted}
      />

      <BreakFastGuideModal
        visible={showBreakFast}
        onClose={() => setShowBreakFast(false)}
      />

      <ShareableFastCardModal
        visible={showShare}
        onClose={() => setShowShare(false)}
        hoursFasted={hoursFasted}
        streakDays={streak}
        dishTitle={plan?.recipe.title}
        kcal={kcal}
        protein={protein}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: Space.xs,
    marginRight: Space.xs,
  },
  iconTouch: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionGap: { marginBottom: Space.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  heroCard: {
    borderRadius: Radius.xl,
    padding: Space.base,
    marginBottom: Space.md,
  },
  windowTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: Hairline,
  },
  subLinkRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Space.md,
  },
  textLink: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: Space.sm,
  },
  inlineToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  waterButtons: {
    flexDirection: 'row',
    marginTop: Space.md,
  },
  compactBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsBtn: {
    minHeight: 42,
    paddingHorizontal: Space.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  agendaTime: {
    width: 48,
    marginRight: Space.sm,
  },
  agendaTitle: {
    flex: 1,
    marginLeft: Space.sm,
  },
  tickBtn: {
    paddingHorizontal: Space.md,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    marginLeft: Space.sm,
  },
  intakeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Space.md,
    marginHorizontal: -4,
  },
  intakeCell: {
    width: '33.33%',
    padding: 4,
  },
  intakeBtn: {
    borderRadius: Radius.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 62,
  },
  weighRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weighInput: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: Hairline,
    paddingHorizontal: Space.md,
    height: 46,
    marginRight: Space.sm,
  },
  weighBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerRow: {
    flexDirection: 'row',
    marginTop: Space.md,
  },
});
