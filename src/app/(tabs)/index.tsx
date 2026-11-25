/**
 * Today / Heute — Precision Metabolic Telemetry Cockpit.
 *
 * Designed from DESIGN.md:
 * - Responsive 2-column Bento Instrument layout on wide viewports (>= 840px),
 *   ordered single-column cadence on phones.
 * - Strict dual-polarity parity (`c.*` theme tokens only, zero hardcoded white/dark fills).
 * - Preserves full domain & E2E telemetry contracts (`fastingStage`, `DayBand`, `dayAgenda`
 *   tick actions, +250/+500ml water + electrolytes, steps, OMAD plate summary, full 6-option
 *   evening intake check-in, `readiness`, and `scaleJump`).
 */

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BreakFastGuideModal } from '@/components/BreakFastGuideModal';
import { DailyBioHackCard } from '@/components/DailyBioHackCard';
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
  Columns,
  Divider,
  Enter,
  Eyebrow,
  Notice,
  PageHeader,
  Screen,
  Tap,
  Txt,
  useTheme,
  washOf,
} from '@/components/ui';
import { WindowShifterModal } from '@/components/WindowShifterModal';
import { Radius, Space, Type } from '@/constants/theme';
import { dayAgenda, minutesUntil, type AgendaItem } from '@/lib/agenda';
import type { MealPlan } from '@/lib/ai';
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
  toMinutes,
  type FastingState,
  type UserProfile,
} from '@/lib/nutrition';
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
  loadProfileOrDefault,
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
    const [p, h, fl, cl, last, weights, intake, prem, shift, st, remOffered] = await Promise.all([
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
  const kcal = plan ? plan.total_kcal : baseline.kcal;
  const questionKcal = !question || question.date === todayISO() ? kcal : baseline.kcal;
  const protein = plan ? plan.protein_g : baseline.protein_g;
  const waterTarget = hydrationTargetMl(
    profile,
    plan?.training_start_time
      ? {
          sport: 'session',
          duration_min: plan.training_duration_min,
          intensity: 'medium',
          start_time: plan.training_start_time,
        }
      : null
  );

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
  const phaseHue =
    hoursFasted >= 18
      ? ('plan' as const)
      : hoursFasted >= 12
      ? ('accent' as const)
      : hoursFasted >= 4
      ? ('ember' as const)
      : ('gold' as const);

  const waterPct = Math.min(100, (hydration.ml / waterTarget) * 100);
  const STEP_GOAL = 10000;
  const stepsPct = Math.min(100, (steps / STEP_GOAL) * 100);
  const nextMins = next ? minutesUntil(next, profile, now) : Infinity;
  const nextColor = nextMins <= 60 ? c.ember : c.accent;

  const windowMeta =
    `${fast.windowStart}–${fast.windowEnd} · ${fast.fastingHours}h ${lang === 'de' ? 'Fasten' : 'fast'}` +
    (plan?.training_start_time
      ? ` · ${lang === 'de' ? 'Training' : 'session'} ${plan.training_start_time}`
      : '');

  return (
    <Screen
      wide
      refresh={{
        refreshing,
        onRefresh: async () => {
          setRefreshing(true);
          await refresh();
          setRefreshing(false);
        },
      }}
    >
      {/* Top Header */}
      <Enter index={0}>
        <PageHeader
          eyebrow={formatReadableDate(now, lang)}
          title={t('tab.today')}
          right={
            <View style={s.headerRight}>
              <Tap
                onPress={() => {
                  haptic('light');
                  router.push('/achievements');
                }}
                accessibilityLabel={`Streak ${streak} days`}
                style={[
                  s.streakPill,
                  {
                    backgroundColor: streak > 0 ? c.emberWash : c.surface,
                    borderColor: streak > 0 ? c.ember : c.line,
                  },
                ]}
              >
                <Icon name="flame" size={13} color={streak > 0 ? c.ember : c.textFaint} />
                <Txt
                  variant="data"
                  color={streak > 0 ? c.ember : c.textDim}
                  style={{ marginLeft: 5, fontSize: 11.5, fontWeight: '700' }}
                >
                  {streak} {streak === 1 ? (lang === 'de' ? 'TAG' : 'DAY') : (lang === 'de' ? 'TAGE' : 'DAYS')}
                </Txt>
              </Tap>

              <Tap
                onPress={() => router.push('/chat')}
                accessibilityLabel="Coach"
                style={[s.iconSquare, { backgroundColor: c.surface, borderColor: c.line }]}
              >
                <Icon name="coach" size={16} color={c.textDim} />
              </Tap>

              <Tap
                onPress={() => router.push('/you/reminders')}
                accessibilityLabel={lang === 'de' ? 'Erinnerungen' : 'Reminders'}
                style={[s.iconSquare, { backgroundColor: c.surface, borderColor: c.line }]}
              >
                <Icon name="bell" size={16} color={c.textDim} />
              </Tap>
            </View>
          }
        />
      </Enter>

      {/* Fast Celebration Notice */}
      {showCelebration ? (
        <Enter index={0}>
          <Card tone="ember" style={s.blockGap}>
            <View style={s.rowBetween}>
              <View style={s.rowCenter}>
                <Icon name="flame" size={18} color={c.ember} />
                <Txt variant="subheading" color={c.text} style={{ marginLeft: Space.sm }}>
                  {lang === 'de' ? 'Fasten abgeschlossen' : 'Fast completed'}
                </Txt>
              </View>
              <Tap onPress={() => setShowCelebration(false)} accessibilityLabel="Dismiss">
                <Icon name="close" size={16} color={c.textDim} />
              </Tap>
            </View>
            <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
              {lang === 'de'
                ? `${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge erfasst.`
                : `${streak} ${streak === 1 ? 'day' : 'days'} logged in a row.`}
            </Txt>
            <View style={{ marginTop: Space.md, flexDirection: 'row' }}>
              <Button
                size="sm"
                variant="primary"
                icon="share"
                label={lang === 'de' ? 'Erfolg teilen' : 'Share milestone'}
                onPress={() => {
                  setShowCelebration(false);
                  setShowShare(true);
                }}
              />
            </View>
          </Card>
        </Enter>
      ) : null}

      {/* Primary Two-Column Cockpit */}
      <Columns>
        {/* Left Column: Hero Fasting Instrument + 24h Band */}
        <Enter index={1}>
          <Card
            style={[
              s.heroCard,
              {
                backgroundColor: c.heroFill,
                borderColor: c.lineStrong,
              },
            ]}
          >
            <View style={s.heroTopRow}>
              <View
                style={[
                  s.statusPill,
                  {
                    backgroundColor: fast.isEating ? c.emberWash : c.accentWash,
                    borderColor: fast.isEating ? c.ember : c.accent,
                  },
                ]}
              >
                <View
                  style={[
                    s.statusDot,
                    { backgroundColor: fast.isEating ? c.ember : c.accent },
                  ]}
                />
                <Txt
                  variant="eyebrow"
                  color={fast.isEating ? c.ember : c.accent}
                  style={{ fontSize: 10 }}
                >
                  {fast.isEating ? t('today.windowEating') : t('today.windowRunning')}
                </Txt>
              </View>

              <Tap
                onPress={() => {
                  haptic('light');
                  setShowShifter(true);
                }}
                accessibilityLabel={lang === 'de' ? 'Essensfenster verschieben' : 'Shift eating window'}
                style={[
                  s.shiftPill,
                  {
                    backgroundColor: c.surfaceElevated,
                    borderColor: isShifted ? c.ember : c.line,
                  },
                ]}
              >
                <Icon name="clock" size={12} color={isShifted ? c.ember : c.textDim} />
                <Txt variant="data" color={c.text} style={{ marginHorizontal: 5, fontSize: 11.5 }}>
                  {fast.windowStart}–{fast.windowEnd}
                </Txt>
                <Icon name="edit" size={11} color={c.textFaint} />
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
              phaseHue={phaseHue}
              stageSummary={t('today.fastedFor', { hours: hoursFasted.toFixed(1) })}
            />

            <View style={s.windowMetaWrap}>
              <Eyebrow color={c.textFaint}>{windowMeta}</Eyebrow>
            </View>

            <DayBand
              onHero
              style={{ marginTop: Space.md }}
              nowMin={now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60}
              windowStartMin={toMinutes(profile.omad_window_start)}
              windowLengthMin={profile.omad_window_hours * 60}
              items={items}
              isEating={fast.isEating}
            />

            <View style={s.heroActionStack}>
              <Button
                fullWidth
                variant={fast.isEating ? 'ember' : 'primary'}
                icon={fast.isEating ? 'plate' : 'check'}
                label={
                  fast.isEating
                    ? lang === 'de'
                      ? 'Break-Fast Guide'
                      : 'Break-Fast Guide'
                    : fastLogged
                    ? lang === 'de'
                      ? 'Fasten geloggt · Break-Fast Guide'
                      : 'Fast logged · Break-Fast Guide'
                    : lang === 'de'
                    ? 'Fasten beenden & Teller loggen'
                    : 'Finish fast & log plate'
                }
                onPress={() => {
                  if (!fast.isEating && !fastLogged) {
                    completeFast();
                  } else {
                    setShowBreakFast(true);
                  }
                }}
              />

              <View style={s.heroSubActions}>
                <Tap
                  onPress={() => router.push('/timer')}
                  accessibilityLabel={lang === 'de' ? 'Live-Timer öffnen' : 'Open live timer'}
                  style={[
                    s.heroMiniBtn,
                    { backgroundColor: c.surfaceElevated, borderColor: c.line, marginRight: Space.xs },
                  ]}
                >
                  <Icon name="clock" size={14} color={c.textDim} />
                  <Txt variant="small" color={c.text} style={{ marginLeft: 5, fontWeight: '600' }}>
                    {lang === 'de' ? 'Timer' : 'Timer'}
                  </Txt>
                </Tap>

                <Tap
                  onPress={() => setShowMetabolic(true)}
                  accessibilityLabel={lang === 'de' ? '24h Phasen' : '24h Phases'}
                  style={[
                    s.heroMiniBtn,
                    { backgroundColor: c.surfaceElevated, borderColor: c.line, marginHorizontal: Space.xs / 2 },
                  ]}
                >
                  <Icon name="flame" size={14} color={c.accent} />
                  <Txt variant="small" color={c.text} style={{ marginLeft: 5, fontWeight: '600' }}>
                    {lang === 'de' ? '24h Phasen' : 'Phases'}
                  </Txt>
                </Tap>

                <Tap
                  onPress={() => setShowShare(true)}
                  accessibilityLabel={lang === 'de' ? 'Fasten teilen' : 'Share fast'}
                  style={[
                    s.heroMiniBtn,
                    { backgroundColor: c.surfaceElevated, borderColor: c.line, marginLeft: Space.xs },
                  ]}
                >
                  <Icon name="share" size={14} color={c.textDim} />
                  <Txt variant="small" color={c.text} style={{ marginLeft: 5, fontWeight: '600' }}>
                    {lang === 'de' ? 'Teilen' : 'Share'}
                  </Txt>
                </Tap>
              </View>
            </View>
          </Card>
        </Enter>

        {/* Right Column: Hydration + Steps + OMAD Plate + Agenda Checklist */}
        <View>
          {/* Paired Vitals Row */}
          <Enter index={2}>
            <View style={[s.vitalsRow, s.blockGap]}>
              {/* Hydration Card */}
              <Card style={[s.vitalCard, { marginRight: Space.sm / 2 }]}>
                <View style={s.rowBetween}>
                  <View style={[s.vitalBadge, { backgroundColor: c.hydroWash }]}>
                    <Icon name="drop" size={14} color={c.hydro} />
                  </View>
                  <Tap
                    onPress={toggleSalt}
                    accessibilityLabel="Electrolytes"
                    accessibilityState={{ selected: hydration.electrolytes }}
                    style={[
                      s.saltChip,
                      {
                        backgroundColor: hydration.electrolytes ? c.emberWash : c.surfaceElevated,
                        borderColor: hydration.electrolytes ? c.ember : c.line,
                      },
                    ]}
                  >
                    <Icon
                      name="salt"
                      size={11}
                      color={hydration.electrolytes ? c.ember : c.textDim}
                    />
                    <Txt
                      variant="eyebrow"
                      color={hydration.electrolytes ? c.ember : c.textDim}
                      style={{ marginLeft: 4, fontSize: 9.5 }}
                    >
                      {hydration.electrolytes
                        ? lang === 'de'
                          ? 'SALZ AKTIV'
                          : 'SALT ON'
                        : lang === 'de'
                        ? '+ SALZ'
                        : '+ SALT'}
                    </Txt>
                  </Tap>
                </View>

                <View style={s.vitalFigureWrap}>
                  <Txt variant="title" color={c.text} style={{ fontVariant: ['tabular-nums'] }}>
                    {(hydration.ml / 1000).toFixed(1)}
                  </Txt>
                  <Txt variant="small" color={c.textDim} style={{ marginLeft: 4, marginBottom: 3 }}>
                    / {(waterTarget / 1000).toFixed(1)}L
                  </Txt>
                </View>

                <Eyebrow color={c.textFaint} style={{ marginBottom: Space.sm }}>
                  {t('today.hydration')}
                </Eyebrow>
                <Bar pct={waterPct} color={c.hydro} height={5} />

                <View style={s.waterActionRow}>
                  <Tap
                    onPress={() => addWater(250)}
                    accessibilityLabel="Add 250 millilitres"
                    style={[
                      s.tileActionHalf,
                      { backgroundColor: c.surfaceElevated, borderColor: c.line, marginRight: 4 },
                    ]}
                  >
                    <Txt variant="data" color={c.text} style={{ fontSize: 11.5 }}>
                      +250 ml
                    </Txt>
                  </Tap>
                  <Tap
                    onPress={() => addWater(500)}
                    accessibilityLabel="Add 500 millilitres"
                    style={[
                      s.tileActionHalf,
                      { backgroundColor: c.surfaceElevated, borderColor: c.line, marginLeft: 4 },
                    ]}
                  >
                    <Txt variant="data" color={c.text} style={{ fontSize: 11.5 }}>
                      +500 ml
                    </Txt>
                  </Tap>
                </View>
              </Card>

              {/* Steps Card */}
              <Card style={[s.vitalCard, { marginLeft: Space.sm / 2 }]}>
                <View style={s.rowBetween}>
                  <View style={[s.vitalBadge, { backgroundColor: c.accentWash }]}>
                    <Icon name="footprints" size={14} color={c.accent} />
                  </View>
                  <View style={[s.goalTag, { backgroundColor: c.accentWash }]}>
                    <Txt variant="eyebrow" color={c.accent} style={{ fontSize: 9.5 }}>
                      {lang === 'de' ? 'ZIEL 10K' : '10K GOAL'}
                    </Txt>
                  </View>
                </View>

                <View style={s.vitalFigureWrap}>
                  <Txt variant="title" color={c.text} style={{ fontVariant: ['tabular-nums'] }}>
                    {steps.toLocaleString()}
                  </Txt>
                  <Txt variant="small" color={c.textDim} style={{ marginLeft: 4, marginBottom: 3 }}>
                    / 10k
                  </Txt>
                </View>

                <Eyebrow color={c.textFaint} style={{ marginBottom: Space.sm }}>
                  {lang === 'de' ? 'SCHRITTE' : 'STEPS'}
                </Eyebrow>
                <Bar pct={stepsPct} color={c.accent} height={5} />

                <Tap
                  onPress={() => addSteps(1000)}
                  accessibilityLabel="Add 1,000 steps"
                  style={[
                    s.tileActionFull,
                    { backgroundColor: c.surfaceElevated, borderColor: c.line },
                  ]}
                >
                  <Icon name="plus" size={11} color={c.accent} strokeWidth={2.3} />
                  <Txt variant="data" color={c.text} style={{ marginLeft: 5, fontSize: 12 }}>
                    {lang === 'de' ? '1.000 Schritte' : '1,000 steps'}
                  </Txt>
                </Tap>
              </Card>
            </View>
          </Enter>

          {/* Today's OMAD Plate Summary */}
          <Enter index={3}>
            <Tap
              onPress={() => router.push('/planner')}
              accessibilityLabel={lang === 'de' ? 'Heutiger OMAD Teller' : "Today's OMAD plate"}
              style={s.blockGap}
            >
              <Card>
                <View style={s.rowBetween}>
                  <View style={s.rowCenter}>
                    <View
                      style={[
                        s.plateIconBox,
                        { backgroundColor: plan ? c.planWash : c.emberWash, borderColor: c.line },
                      ]}
                    >
                      <Icon name="plate" size={18} color={plan ? c.plan : c.ember} />
                    </View>
                    <View style={{ marginLeft: Space.md, flex: 1 }}>
                      <Eyebrow color={plan ? c.plan : c.ember}>
                        {lang === 'de' ? 'HEUTIGER OMAD TELLER' : "TODAY'S OMAD PLATE"}
                      </Eyebrow>
                      <Txt variant="subheading" color={c.text} style={{ marginTop: 3 }}>
                        {plan ? plan.recipe.title : t('today.defaultMeal')}
                      </Txt>
                    </View>
                  </View>
                  <Icon name="chevronRight" size={16} color={c.textFaint} />
                </View>

                <View style={s.plateFooter}>
                  <View
                    style={[
                      s.macroTag,
                      { backgroundColor: c.surfaceElevated, borderColor: c.line },
                    ]}
                  >
                    <Txt variant="data" color={c.text} style={{ fontSize: 11.5 }}>
                      {kcal} kcal · {protein}g P
                    </Txt>
                  </View>
                  <Txt variant="small" color={c.textDim} style={{ marginLeft: Space.sm, flex: 1 }}>
                    {t('today.breakProtocol')}
                  </Txt>
                </View>
              </Card>
            </Tap>
          </Enter>

          {/* Today's Timeline / Actionable Checklist */}
          <Enter index={4}>
            <Card style={s.blockGap}>
              <View style={[s.rowBetween, { marginBottom: Space.sm }]}>
                <Eyebrow>{t('today.agenda')}</Eyebrow>
                {next && nextMins < 60 ? (
                  <View
                    style={[
                      s.dueTag,
                      { backgroundColor: washOf(nextColor), borderColor: nextColor },
                    ]}
                  >
                    <Txt variant="eyebrow" color={nextColor} style={{ fontSize: 9.5 }}>
                      {nextMins <= 0
                        ? t('today.dueNow')
                        : t('today.dueIn', { min: Math.max(1, Math.round(nextMins)) })}
                    </Txt>
                  </View>
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
                      <Txt
                        variant="data"
                        color={dim ? c.textFaint : c.textDim}
                        style={s.agendaTime}
                      >
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
                        <View
                          style={[
                            s.tickPill,
                            { backgroundColor: c.accentWash, borderColor: c.accent },
                          ]}
                        >
                          <Txt variant="data" color={c.accent} style={{ fontSize: 11.5 }}>
                            {t('today.tick')}
                          </Txt>
                        </View>
                      ) : null}
                    </Tap>
                  </View>
                );
              })}
            </Card>
          </Enter>
        </View>
      </Columns>

      {/* Secondary Calibration, Evening Check-In & Signals */}
      <Columns>
        <View>
          {/* Scale Jump Explainer */}
          {jump ? (
            <Enter index={5}>
              <Card tone="ember" style={s.blockGap}>
                <Eyebrow color={c.ember}>Up {jump.kg} kg</Eyebrow>
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.xs }}>
                  {jump.note}
                </Txt>
              </Card>
            </Enter>
          ) : null}

          {/* Full 6-Option Evening Check-In OR Answered Pill */}
          {question ? (
            <Enter index={5}>
              <Card style={s.blockGap}>
                <View style={s.rowBetween}>
                  <Eyebrow color={c.accent}>
                    {question.date === todayISO()
                      ? lang === 'de'
                        ? 'Wie lief dein Essen heute?'
                        : 'How did today go?'
                      : lang === 'de'
                      ? 'Wie lief dein Essen gestern?'
                      : 'How did yesterday go?'}
                  </Eyebrow>
                  <Txt variant="data" color={c.textDim}>
                    {questionKcal} kcal
                  </Txt>
                </View>

                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.xs }}>
                  {lang === 'de'
                    ? 'Grob im Vergleich zu deinem Zielwert — damit kalibriert die App deinen echten Verbrauch.'
                    : 'Roughly against target kcal — this calibrates your measured maintenance.'}
                </Txt>

                <View style={s.intakeGrid}>
                  {INTAKE_OPTIONS.map((o) => (
                    <View key={o.label} style={s.intakeCell}>
                      <Tap
                        onPress={() => answerIntake(o.factor)}
                        accessibilityLabel={`${o.label}, about ${intakeKcal(o.factor, questionKcal)} kcal`}
                        style={[
                          s.intakeBtn,
                          { backgroundColor: c.surfaceElevated, borderColor: c.line },
                        ]}
                      >
                        <Txt variant="small" color={c.text} style={{ fontWeight: '600', textAlign: 'center' }}>
                          {lang === 'de' ? intakeOptionLabel(o, lang) : o.label}
                        </Txt>
                        <Eyebrow color={c.textFaint} style={{ marginTop: 3, fontSize: 9.5 }}>
                          {o.factor === 1 ? '' : '≈ '}
                          {intakeKcal(o.factor, questionKcal)} kcal
                        </Eyebrow>
                      </Tap>
                    </View>
                  ))}
                </View>

                <Tap
                  onPress={() => answerIntake(null)}
                  accessibilityLabel="Completely different"
                  style={{ marginTop: Space.md, alignSelf: 'center' }}
                >
                  <Txt variant="small" color={c.textFaint}>
                    {lang === 'de' ? 'Ganz anders — heute auslassen' : 'Completely different — skip today'}
                  </Txt>
                </Tap>
              </Card>
            </Enter>
          ) : answered ? (
            <Enter index={5}>
              <Tap
                onPress={reopenQuestion}
                accessibilityLabel="Change today's answer"
                style={s.blockGap}
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
                    <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>
                      {lang === 'de' ? 'ändern' : 'change'}
                    </Txt>
                  </View>
                </Card>
              </Tap>
            </Enter>
          ) : null}

          {/* Calibration Readiness Line */}
          {need && !need.ready ? (
            <Enter index={6}>
              <Card style={s.blockGap}>
                <View style={s.rowCenter}>
                  <Icon name="chart" size={14} color={c.accent} />
                  <Eyebrow color={c.accent} style={{ marginLeft: 6 }}>
                    {lang === 'de'
                      ? 'Stoffwechsel-Kalibrierung'
                      : 'Until your maintenance can be measured'}
                  </Eyebrow>
                </View>
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.xs }}>
                  {need.note}
                </Txt>
              </Card>
            </Enter>
          ) : null}
        </View>

        <View>
          {/* Quick Weigh-In Card when missing today */}
          {!weighedToday ? (
            <Enter index={5}>
              <Card style={s.blockGap}>
                <Eyebrow color={c.body}>{t('today.dailyWeighIn')}</Eyebrow>
                <Txt variant="small" color={c.textDim} style={{ marginTop: 4, marginBottom: Space.md }}>
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
                        borderColor: c.lineStrong,
                      },
                    ]}
                  />
                  <Tap
                    onPress={logWeight}
                    disabled={!weightInput.trim()}
                    accessibilityLabel="Save weight"
                    style={[
                      s.weighBtn,
                      { backgroundColor: weightInput.trim() ? c.accent : c.well, borderColor: c.line },
                    ]}
                  >
                    <Icon
                      name="check"
                      size={16}
                      color={weightInput.trim() ? c.onAccent : c.textFaint}
                      strokeWidth={2.2}
                    />
                  </Tap>
                </View>
              </Card>
            </Enter>
          ) : null}

          {/* Reminders Opt-In Offer */}
          {offerReminders ? (
            <Enter index={6}>
              <Card style={s.blockGap}>
                <Eyebrow color={c.textDim}>Want the app to tell you when?</Eyebrow>
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.xs }}>
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
            </Enter>
          ) : null}

          {/* Mood, Reflection Note & Daily BioHack */}
          <Enter index={6}>
            <Card style={s.blockGap}>
              <FastingFeelingBar embedded />
              <Divider />
              <DailyFastingNote embedded />
            </Card>
          </Enter>

          <Enter index={7}>
            <View style={s.blockGap}>
              <DailyBioHackCard />
            </View>
          </Enter>
        </View>
      </Columns>

      {measured !== null ? (
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
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  iconSquare: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.xs,
  },
  blockGap: { marginBottom: Space.base },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  heroCard: {
    borderRadius: Radius.xl,
    padding: Space.lg,
    marginBottom: Space.base,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  shiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  windowMetaWrap: {
    alignItems: 'center',
    marginTop: Space.xs,
  },
  heroActionStack: {
    marginTop: Space.lg,
  },
  heroSubActions: {
    flexDirection: 'row',
    marginTop: Space.sm,
  },
  heroMiniBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  vitalsRow: {
    flexDirection: 'row',
  },
  vitalCard: {
    flex: 1,
    padding: Space.md,
  },
  vitalBadge: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saltChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  goalTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  vitalFigureWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: Space.md,
    marginBottom: 2,
  },
  waterActionRow: {
    flexDirection: 'row',
    marginTop: Space.md,
  },
  tileActionHalf: {
    flex: 1,
    minHeight: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActionFull: {
    flexDirection: 'row',
    minHeight: 34,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.md,
  },
  plateIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.md,
  },
  macroTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  dueTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  agendaTime: {
    width: 48,
    marginRight: Space.sm,
  },
  agendaTitle: {
    flex: 1,
    marginLeft: Space.sm,
  },
  tickPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
    paddingHorizontal: Space.md,
    height: 44,
    marginRight: Space.sm,
  },
  weighBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerRow: {
    flexDirection: 'row',
    marginTop: Space.md,
  },
});
