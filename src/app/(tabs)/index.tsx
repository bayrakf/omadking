import { useCallback, useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Tap, Divider, PageHeader, useTheme,
} from '@/components/ui';
import { useLang } from '@/components/lang';
import { Icon, type IconName } from '@/components/icons';
import { DayBand } from '@/components/DayBand';
import { WeekdayPillStrip } from '@/components/WeekdayPillStrip';
import { FastingFeelingBar } from '@/components/FastingFeelingBar';
import { BentoGrid, BentoTile } from '@/components/BentoGrid';
import {
  dailyTargets, fastingState, fastingStage, formatCountdown, hydrationTargetMl, toMinutes, DEFAULT_PROFILE,
  type UserProfile, type FastingState,
} from '@/lib/nutrition';
import { dayAgenda, minutesUntil, type AgendaItem } from '@/lib/agenda';
import { formatReadableDate } from '@/lib/dates';
import { WindowShifterModal } from '@/components/WindowShifterModal';
import { MetabolicTimelineModal } from '@/components/MetabolicTimelineModal';
import { BreakFastGuideModal } from '@/components/BreakFastGuideModal';
import { DailyFastingNote } from '@/components/DailyFastingNote';
import {
  loadProfileOrDefault, loadHydration, saveHydration, loadFastLog, markFastComplete,
  currentStreak, loadLastPlan, loadCookLog, markCooked, loadWeightLog, saveWeightLog,
  remindersOffered, markRemindersOffered,
  saveProfile, recordIntake, loadIntakeLog, isPremium, todayISO, loadTodayWindowShift,
  loadDailySteps, saveDailySteps, type Hydration,
} from '@/lib/store';
import {
  readTrend, effectiveMaintenance, intakeQuestionFor, scaleJump, readiness,
  type IntakeQuestion, type ScaleJump, type Readiness,
} from '@/lib/energy';
import { INTAKE_OPTIONS, intakeKcal, intakeLabel } from '@/lib/review';
import { haptic } from '@/lib/haptic';
import type { MealPlan } from '@/lib/ai';
import { resync, setEnabled as setRemindersEnabled } from '@/lib/notify';

const ICONS: Record<AgendaItem['kind'], IconName> = {
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
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [fast, setFast] = useState<FastingState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [hydration, setHydration] = useState<Hydration>({ date: todayISO(), ml: 0, electrolytes: false });
  const [streak, setStreak] = useState(0);
  const [fastLog, setFastLog] = useState<string[]>([]);
  const [fastLogged, setFastLogged] = useState(false);
  const [cooked, setCooked] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [weighedToday, setWeighedToday] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [jump, setJump] = useState<ScaleJump | null>(null);
  const [need, setNeed] = useState<Readiness | null>(null);
  /** Shown once, after the app has delivered something. Never twice. */
  const [offerReminders, setOfferReminders] = useState(false);
  const [dateLabel, setDateLabel] = useState('');
  const [question, setQuestion] = useState<IntakeQuestion | null>(null);
  const [answered, setAnswered] = useState<{ date: string; factor: number } | null>(null);
  const [trend, setTrend] = useState<ReturnType<typeof readTrend> | null>(null);
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [showShifter, setShowShifter] = useState(false);
  const [showMetabolic, setShowMetabolic] = useState(false);
  const [showBreakFast, setShowBreakFast] = useState(false);
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    setDateLabel(formatReadableDate(new Date(), lang));
    setMounted(true);
  }, [lang]);

  const addSteps = async (count: number) => {
    const next = steps + count;
    setSteps(next);
    await saveDailySteps(next);
  };

  const refresh = useCallback(async () => {
    const [p, h, fl, cl, last, weights, intake, prem, shift, st] = await Promise.all([
      loadProfileOrDefault(), loadHydration(), loadFastLog(), loadCookLog(),
      loadLastPlan<MealPlan>(), loadWeightLog(), loadIntakeLog(), isPremium(),
      loadTodayWindowShift(), loadDailySteps(),
    ]);
    const effectiveProfile = shift ? { ...p, omad_window_start: shift.window_start } : p;
    setQuestion(intakeQuestionFor(effectiveProfile, intake));
    const latest = [...(intake ?? [])].sort((a, b) => a.date.localeCompare(b.date)).pop();
    setAnswered(latest ? { date: latest.date, factor: latest.factor } : null);
    setTrend(readTrend(weights));
    setJump(scaleJump(weights, intake));
    setNeed(readiness(intake, weights));
    setMeasured(effectiveMaintenance(intake, weights, dailyTargets(effectiveProfile, null).maintenance_kcal, prem));
    setProfile(effectiveProfile);
    setHydration(h);
    setFastLog(fl);
    setStreak(currentStreak(fl));
    setFastLogged(fl.includes(todayISO()));
    setCooked(cl.includes(todayISO()));
    setPlan(last?.date === todayISO() ? last : null);
    setWeighedToday(weights.some((w) => w.date === todayISO()));
    setSteps(st);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refresh().then(() => active);
      return () => { active = false; };
    }, [refresh])
  );

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      setFast(fastingState(profile, d));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [profile]);

  if (!mounted || !fast) return null;

  const { items, next } = dayAgenda(profile, plan, { cooked, fastLogged }, now, lang);

  const baseline = dailyTargets(profile, null, measured);
  const kcal = plan ? plan.total_kcal : baseline.kcal;
  const questionKcal = !question || question.date === todayISO() ? kcal : baseline.kcal;
  const protein = plan ? plan.protein_g : baseline.protein_g;
  const waterTarget = hydrationTargetMl(profile, plan?.training_start_time
    ? { sport: 'session', duration_min: plan.training_duration_min, intensity: 'medium', start_time: plan.training_start_time }
    : null);

  const addWater = async (ml: number) => {
    const nextH = { ...hydration, ml: Math.min(8000, hydration.ml + ml) };
    setHydration(nextH);
    await saveHydration(nextH);
  };
  const toggleSalt = async () => {
    const nextH = { ...hydration, electrolytes: !hydration.electrolytes };
    setHydration(nextH);
    await saveHydration(nextH);
  };

  const doAction = async (kind: AgendaItem['kind']) => {
    if (kind === 'log_fast') {
      const updatedFasts = await markFastComplete();
      setFastLog(updatedFasts);
      setStreak(currentStreak(updatedFasts));
      setFastLogged(true);
      haptic('success');
      if (!(await remindersOffered())) setOfferReminders(true);
    } else if (kind === 'cook') {
      await markCooked(todayISO(), plan);
      setCooked(true);
      haptic('medium');
    }
    await resync();
  };

  /**
   * The whole intake signal, in one tap. Deliberately not a food diary — the
   * app promises fewer decisions, and a fortnight of rough answers measures a
   * metabolism better than a precise diary nobody keeps up.
   */
  const answerIntake = async (factor: number | null) => {
    if (!question) return;
    // Recorded against the day the window belonged to, not against now — the
    // answer is just as valid the morning after.
    if (factor !== null) {
      await recordIntake(factor, questionKcal, question.date);
      setAnswered({ date: question.date, factor });
    }
    setQuestion(null);
  };

  /** Puts the question back so a wrong tap can be replaced. */
  const reopenQuestion = async () => {
    if (!answered) return;
    const intake = await loadIntakeLog();
    setAnswered(null);
    // Hide the day being corrected so the question comes back for exactly it.
    setQuestion(intakeQuestionFor(profile, intake.filter((e) => e.date !== answered.date)));
  };

  const logWeight = async () => {
    const w = parseFloat(weightInput.replace(',', '.'));
    if (!isFinite(w) || w < 30 || w > 300) return;
    const log = await loadWeightLog();
    const updated = [
      { id: `${todayISO()}-${Date.now()}`, date: todayISO(), weight_kg: w },
      ...log.filter((e) => e.date !== todayISO()),
    ].sort((a, b) => b.date.localeCompare(a.date));
    await saveWeightLog(updated);
    // Targets follow real bodyweight, same rule as the Progress screen.
    const nextProfile = { ...profile, weight_kg: w };
    await saveProfile(nextProfile);
    setProfile(nextProfile);
    setWeightInput('');
    setWeighedToday(true);
    haptic('success');
    // The jump is about the entry that was just made, so it has to be read
    // from the log that now includes it.
    const freshIntake = await loadIntakeLog();
    setJump(scaleJump(updated, freshIntake));
    setNeed(readiness(freshIntake, updated));
  };

  // Hours into the current fast, for the physiology band.
  const hoursFasted = fast.isEating ? 0 : fast.fastingHours * (fast.progressPct / 100);
  const stage = fastingStage(hoursFasted);

  const waterPct = Math.min(100, (hydration.ml / waterTarget) * 100);
  const windowLabel =
    `${fast.windowStart}–${fast.windowEnd} · ${fast.fastingHours}H FAST` +
    (plan?.training_start_time ? ` · SESSION ${plan.training_start_time}` : '');

  // Imminent moments go warm; everything else stays in the resting palette.
  const nextMins = next ? minutesUntil(next, profile, now) : Infinity;
  const nextColor = nextMins <= 60 ? c.ember : c.accent;

  return (
    <Screen wide>
      <Enter index={0}>
        <PageHeader
          tone={fast.isEating ? 'ember' : 'accent'}
          eyebrow={dateLabel}
          title={fast.isEating ? t('today.windowOpen') : t('today.fasting')}
        />
        <WeekdayPillStrip fastLog={fastLog} streak={streak} />
      </Enter>

      <Enter index={1}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/timer')}
          style={[s.hero, { backgroundColor: c.heroFill }]}
        >
          <View style={s.heroTop}>
            <View style={[s.heroBadge, { backgroundColor: fast.isEating ? c.emberWash : 'rgba(56, 189, 248, 0.2)' }]}>
              <Icon name={fast.isEating ? 'plate' : 'flame'} size={14} color={fast.isEating ? c.ember : '#38BDF8'} />
              <Txt variant="data" color={fast.isEating ? c.ember : '#38BDF8'} style={{ marginLeft: 5, fontSize: 11, fontWeight: '700' }}>
                {fast.isEating ? 'ESSENSFENSTER' : 'FASTEN LÄUFT'}
              </Txt>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Txt variant="eyebrow" color={c.onHero} style={{ opacity: 0.8, fontSize: 10, marginRight: 4 }}>
                LIVE-TIMER
              </Txt>
              <Icon name="chevronRight" size={12} color={c.onHero} />
            </View>
          </View>
          <View style={s.countRow}>
            <Txt variant="hero" color={c.onHero} style={s.heroFigure}>
              {formatCountdown(fast.remainingMs)}
            </Txt>
            <Txt variant="small" color={c.onHero} style={s.countCaption}>
              {fast.isEating ? `left · closes ${fast.windowEnd}` : `until ${fast.windowStart}`}
            </Txt>
          </View>
          <DayBand
            onHero
            style={{ marginTop: Space.lg }}
            nowMin={now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60}
            windowStartMin={toMinutes(profile.omad_window_start)}
            windowLengthMin={profile.omad_window_hours * 60}
            items={items}
            isEating={fast.isEating}
          />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Space.base }}>
          <Eyebrow>{windowLabel}</Eyebrow>
          <TouchableOpacity
            onPress={() => setShowShifter(true)}
            activeOpacity={0.7}
            style={[s.shiftPill, { backgroundColor: c.well, borderColor: c.line }]}
          >
            <Icon name="clock" size={11} color={c.accent} />
            <Txt variant="eyebrow" color={c.accent} style={{ marginLeft: 4, fontSize: 10, fontWeight: '700' }}>
              {lang === 'de' ? 'VERSCHIEBEN' : 'SHIFT'}
            </Txt>
          </TouchableOpacity>
        </View>
      </Enter>

      {/* Vibrant Bento Grid */}
      <Enter index={2}>
        <BentoGrid>
          <BentoTile
            title={t('today.bentoPhase')}
            value={stage.label}
            badge={hoursFasted >= 18 ? 'Autophagie' : hoursFasted >= 12 ? 'Ketose' : 'Glukose'}
            icon="flame"
            color="#8B5CF6"
            wash="rgba(139, 92, 246, 0.18)"
            subtitle={`${hoursFasted.toFixed(1)}h gefastet · 24h Bio-Guide`}
            actionLabel="Guide"
            onPress={() => setShowMetabolic(true)}
          />

          <BentoTile
            title={t('today.bentoHydration')}
            value={(hydration.ml / 1000).toFixed(1)}
            unit={`/ ${(waterTarget / 1000).toFixed(1)}L`}
            badge={hydration.electrolytes ? 'Salz ✓' : '+Salz'}
            icon="drop"
            color="#38BDF8"
            wash="rgba(56, 189, 248, 0.18)"
            subtitle={`${Math.round(waterPct)}% Tagesziel · Trinken`}
          >
            <View style={s.bentoActions}>
              <Tap onPress={() => addWater(250)} style={{ flex: 1, marginRight: 4 }}>
                <View style={[s.miniPill, { backgroundColor: c.well }]}>
                  <Txt variant="eyebrow" color={c.text} style={{ fontSize: 9 }}>+250</Txt>
                </View>
              </Tap>
              <Tap onPress={() => addWater(500)} style={{ flex: 1, marginRight: 4 }}>
                <View style={[s.miniPill, { backgroundColor: c.well }]}>
                  <Txt variant="eyebrow" color={c.text} style={{ fontSize: 9 }}>+500</Txt>
                </View>
              </Tap>
              <Tap onPress={toggleSalt} style={{ flex: 1 }}>
                <View style={[s.miniPill, { backgroundColor: hydration.electrolytes ? c.emberWash : c.well }]}>
                  <Txt variant="eyebrow" color={hydration.electrolytes ? c.ember : c.textDim} style={{ fontSize: 9 }}>
                    {hydration.electrolytes ? 'Salz ✓' : 'Salz'}
                  </Txt>
                </View>
              </Tap>
            </View>
          </BentoTile>

          <BentoTile
            title={t('today.bentoMeal')}
            value={`${kcal}`}
            unit="kcal"
            badge={plan ? 'Geplant' : 'Basis'}
            icon="plate"
            color="#EA580C"
            wash="rgba(234, 88, 12, 0.18)"
            subtitle={`${protein}g Protein · Fenster ${fast.windowStart}`}
            actionLabel="Plan ansehen"
            onPress={() => router.push('/planner')}
          />

          <BentoTile
            title={t('today.bentoBody')}
            value={`${profile.weight_kg.toFixed(1)}`}
            unit="kg"
            badge={weighedToday ? 'Gewogen ✓' : 'Offen'}
            icon="chart"
            color="#10B981"
            wash="rgba(16, 185, 129, 0.18)"
            subtitle={weighedToday ? 'Tagesgewicht erfasst' : 'Noch wiegen für Trend'}
            actionLabel="Verlauf"
            onPress={() => router.push('/progress')}
          />

          <BentoTile
            title={lang === 'de' ? 'Schritte & Aktivität' : 'Steps & Activity'}
            value={steps > 0 ? `${steps.toLocaleString()}` : '0'}
            unit={lang === 'de' ? 'Schritte' : 'steps'}
            badge={steps >= 8000 ? 'Ziel ✓' : `${Math.round((steps / 8000) * 100)}%`}
            icon="flame"
            color="#F59E0B"
            wash="rgba(245, 158, 11, 0.18)"
            subtitle={`~${Math.round(steps * 0.038)} kcal Bonus`}
          >
            <View style={s.bentoActions}>
              <Tap onPress={() => addSteps(1000)} style={{ flex: 1, marginRight: 4 }}>
                <View style={[s.miniPill, { backgroundColor: c.well }]}>
                  <Txt variant="eyebrow" color={c.text} style={{ fontSize: 9 }}>+1k</Txt>
                </View>
              </Tap>
              <Tap onPress={() => addSteps(2500)} style={{ flex: 1, marginRight: 4 }}>
                <View style={[s.miniPill, { backgroundColor: c.well }]}>
                  <Txt variant="eyebrow" color={c.text} style={{ fontSize: 9 }}>+2.5k</Txt>
                </View>
              </Tap>
              <Tap onPress={() => router.push('/health')} style={{ flex: 1 }}>
                <View style={[s.miniPill, { backgroundColor: c.accentWash }]}>
                  <Txt variant="eyebrow" color={c.accent} style={{ fontSize: 9 }}>Health</Txt>
                </View>
              </Tap>
            </View>
          </BentoTile>

          <BentoTile
            title={lang === 'de' ? 'Fastenbrechen-Guide' : 'Break-Fast Protocol'}
            value="3 Stufen"
            badge="Food-Coma"
            icon="shield"
            color="#10B981"
            wash="rgba(16, 185, 129, 0.18)"
            subtitle="1. Brühe → 2. Protein → 3. Carbs"
            actionLabel="Guide"
            onPress={() => setShowBreakFast(true)}
          />
        </BentoGrid>
      </Enter>

      <Enter index={3}>
        <Card style={{ marginTop: Space.base, padding: Space.base }}>
          <FastingFeelingBar embedded />
          <Divider style={{ marginVertical: Space.base }} />
          <DailyFastingNote embedded />
        </Card>
      </Enter>

      {/* Asked about the day the eating window belonged to */}
      {question && (
        <Enter index={4}>
          <Card style={{ marginTop: Space.base }} tone="accent">
            <Eyebrow color={c.accent}>
              {question.date === todayISO() ? 'How did today go?' : 'How did yesterday go?'}
            </Eyebrow>
            <Txt variant="body" style={{ marginTop: Space.sm }}>
              Roughly, against the {questionKcal} kcal target. This is what lets the app measure what your
              body actually costs.
            </Txt>
            <View style={s.intakeGrid}>
              {INTAKE_OPTIONS.map((o) => (
                <View key={o.label} style={s.intakeCell}>
                  <Tap
                    onPress={() => answerIntake(o.factor)}
                    accessibilityLabel={`${o.label}, about ${intakeKcal(o.factor, questionKcal)} kcal`}
                  >
                    <View style={[s.intakeBtn, { borderColor: c.line, backgroundColor: c.well }]}>
                      <Txt variant="small" style={{ textAlign: 'center' }}>{o.label}</Txt>
                      <Eyebrow style={{ marginTop: 2 }}>
                        {o.factor === 1 ? '' : '≈ '}{intakeKcal(o.factor, questionKcal)} kcal
                      </Eyebrow>
                    </View>
                  </Tap>
                </View>
              ))}
            </View>
            <Tap onPress={() => answerIntake(null)} accessibilityLabel="Completely different">
              <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.md, textAlign: 'center' }}>
                Completely different — skip today
              </Txt>
            </Tap>
          </Card>
        </Enter>
      )}

      {/* Asked once, whatever the answer. */}
      {offerReminders && (
        <Enter index={4}>
          <Card style={{ marginTop: Space.base }}>
            <Eyebrow>Want the app to tell you when?</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
              Window opening and closing, when to start cooking, and a nudge to weigh in — the
              measurement needs four weigh-ins across ten days.
            </Txt>
            <View style={s.offerRow}>
              <Button
                label="Turn them on"
                onPress={async () => {
                  await markRemindersOffered();
                  setOfferReminders(false);
                  const [fasts, cooks] = await Promise.all([loadFastLog(), loadCookLog()]);
                  const weights = await loadWeightLog();
                  const cutoff = new Date();
                  cutoff.setDate(cutoff.getDate() - 2);
                  await setRemindersEnabled(true, profile, plan, {
                    cooked: cooks.includes(todayISO()),
                    fastLogged: fasts.includes(todayISO()),
                    weighedRecently: weights.some((w) => w.date >= todayISO(cutoff)),
                  });
                }}
                style={s.offerBtn}
              />
              <Button
                label="No thanks"
                variant="ghost"
                onPress={async () => {
                  await markRemindersOffered();
                  setOfferReminders(false);
                }}
                style={s.offerBtn}
              />
            </View>
          </Card>
        </Enter>
      )}

      {need && !need.ready && (
        <Enter index={4}>
          <View style={[s.readiness, { borderColor: c.line, backgroundColor: c.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="chart" size={13} color={c.accent} />
              <Eyebrow color={c.accent} style={{ marginLeft: 6 }}>
                {lang === 'de' ? 'STOFFWECHSEL-KALIBRIERUNG' : 'UNTIL YOUR MAINTENANCE CAN BE MEASURED'}
              </Eyebrow>
            </View>
            <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>
              {lang === 'de' && need.note.includes('evenings')
                ? need.note
                    .replace('of 8 evenings', 'von 8 Abenden')
                    .replace('of 4 weigh-ins', 'von 4 Wägungen')
                    .replace('across', 'über')
                    .replace('of 10 days', 'von 10 Tagen')
                : need.note}
            </Txt>
          </View>
        </Enter>
      )}

      {!question && answered && (
        <Enter index={4}>
          <Tap onPress={reopenQuestion} accessibilityLabel="Change today's answer">
            <View style={[s.answered, { borderColor: c.line }]}>
              <Txt variant="small" color={c.textDim}>
                {answered.date === todayISO() ? 'Today' : 'Yesterday'}:{' '}
                {intakeLabel(answered.factor)}
              </Txt>
              <Txt variant="small" color={c.accent}>change</Txt>
            </View>
          </Tap>
        </Enter>
      )}

      {/* Unified smart Agenda with integrated active milestone */}
      <Enter index={5}>
        <Card style={{ marginTop: Space.base, paddingVertical: Space.sm }}>
          <View style={{ paddingHorizontal: Space.base, paddingVertical: Space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Eyebrow>{t('today.agenda')}</Eyebrow>
            {next && nextMins < 60 && (
              <View style={[s.badgePill, { backgroundColor: nextColor, paddingHorizontal: 8, paddingVertical: 3 }]}>
                <Txt variant="eyebrow" color="#080C14" style={{ fontSize: 10, fontWeight: '800' }}>
                  {nextMins <= 0 ? 'JETZT FÄLLIG' : `IN ${Math.round(nextMins)} MIN`}
                </Txt>
              </View>
            )}
          </View>

          {/* Active next step highlight banner if present */}
          {next && (
            <View style={[s.activeNextBanner, { backgroundColor: nextMins <= 60 ? c.emberWash : c.accentWash, borderColor: nextColor }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Icon name={ICONS[next.kind]} size={18} color={nextColor} />
                  <View style={{ marginLeft: Space.sm, flex: 1 }}>
                    <Txt variant="subheading" color={c.text} style={{ fontSize: 15, fontWeight: '700' }}>
                      {next.title}
                    </Txt>
                    <Txt variant="small" color={c.textDim} style={{ marginTop: 2, fontSize: 12 }}>
                      {next.body}
                    </Txt>
                  </View>
                </View>
                <Txt variant="data" color={nextColor} style={{ fontWeight: '700', marginLeft: Space.sm }}>
                  {next.at}
                </Txt>
              </View>
              {next.actionable && (
                <Button
                  label={next.kind === 'cook' ? (lang === 'de' ? 'Als gekocht markieren' : 'Mark as cooked') : (lang === 'de' ? 'Fasten eintragen' : 'Log it')}
                  variant="secondary"
                  onPress={() => doAction(next.kind)}
                  style={{ marginTop: Space.sm }}
                />
              )}
            </View>
          )}

          {items.map((item, i) => {
            const dim = item.past || item.done;
            return (
              <View key={item.kind}>
                {(i > 0 || next) && <Divider />}
                <Tap
                  onPress={item.actionable && !item.done ? () => doAction(item.kind) : undefined}
                  disabled={!item.actionable || item.done}
                  accessibilityRole={item.actionable ? 'button' : 'text'}
                  accessibilityLabel={`${item.title} at ${item.at}`}
                >
                  <View style={s.row}>
                    <Txt variant="data" color={dim ? c.textFaint : c.text} style={s.time}>{item.at}</Txt>
                    <Icon
                      name={item.done ? 'check' : ICONS[item.kind]}
                      size={16}
                      color={item.done ? c.positive : dim ? c.textFaint : item === next ? nextColor : c.textDim}
                    />
                    <View style={[s.flex, { marginLeft: Space.md }]}>
                      <Txt
                        variant="bodyMedium"
                        color={dim ? c.textFaint : c.text}
                        style={item.done ? s.struck : undefined}
                      >
                        {item.title}
                      </Txt>
                    </View>
                    {item.actionable && !item.done && (
                      <Txt variant="small" color={c.accent}>
                        {lang === 'de' ? 'Erledigen' : 'Tick'}
                      </Txt>
                    )}
                  </View>
                </Tap>
              </View>
            );
          })}
        </Card>
      </Enter>

      {/* Weigh-in field if not weighed today */}
      {!weighedToday && (
        <Enter index={6}>
          <Card style={{ marginTop: Space.base }} tone="body">
            <Eyebrow style={{ marginBottom: Space.sm }}>Tages-Wägung</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginBottom: Space.md }}>
              Erfasse dein morgendliches Gewicht für die Stoffwechsel-Messung.
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
                style={[Type.data, s.weighInput, { color: c.text, backgroundColor: c.well, borderColor: c.line }]}
              />
              <Tap onPress={logWeight} disabled={!weightInput.trim()} accessibilityLabel="Save weight">
                <View style={[s.weighBtn, { backgroundColor: weightInput.trim() ? c.accent : c.well }]}>
                  <Icon name="check" size={16} color={weightInput.trim() ? c.onAccent : c.textFaint} strokeWidth={2.2} />
                </View>
              </Tap>
            </View>
          </Card>
        </Enter>
      )}

      {jump && (
        <Enter index={7}>
          <Card style={{ marginTop: Space.base }} tone="ember">
            <Eyebrow color={c.ember}>Up {jump.kg} kg</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
              {jump.note}
            </Txt>
          </Card>
        </Enter>
      )}

      {trend && trend.state !== 'insufficient' && (
        <Enter index={7}>
          <Card style={{ marginTop: Space.base }} tone="body">
            <Eyebrow color={c.body}>Gewichts-Trend</Eyebrow>
            <Txt variant="small" color={trend.state === 'steady' ? c.textDim : c.text} style={{ marginTop: Space.sm }}>
              {trend.note}
            </Txt>
          </Card>
        </Enter>
      )}

      {/* Visual Showcase Cards */}
      <Enter index={8} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>OMAD Training & Rezepte</Eyebrow>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/workout')}
          style={[s.showcaseCard, { borderColor: c.line }]}
        >
          <Image
            source={require('../../../assets/images/fasted_workout_hero.jpg')}
            style={s.showcaseImage}
            resizeMode="cover"
          />
          <View style={s.showcaseOverlay} />
          <View style={s.showcaseContent}>
            <View style={[s.badgePill, { backgroundColor: '#FF6B4A' }]}>
              <Txt variant="eyebrow" color="#080C14" style={{ fontSize: 10, fontWeight: '800' }}>
                OMAD TRAINING
              </Txt>
            </View>
            <Txt variant="heading" color="#FFFFFF" style={{ fontSize: 18, fontWeight: '800', marginTop: 4 }}>
              Gefastetes Workout & Hypertrophie
            </Txt>
            <Txt variant="small" color="rgba(255, 255, 255, 0.85)" style={{ marginTop: 2 }}>
              6 Einheiten mit automatischer Makro- & Kalorien-Synchronisation
            </Txt>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/planner')}
          style={[s.showcaseCard, { borderColor: c.line, marginTop: Space.md }]}
        >
          <Image
            source={require('../../../assets/images/omad_plate_hero.jpg')}
            style={s.showcaseImage}
            resizeMode="cover"
          />
          <View style={s.showcaseOverlay} />
          <View style={s.showcaseContent}>
            <View style={[s.badgePill, { backgroundColor: '#F59E0B' }]}>
              <Txt variant="eyebrow" color="#080C14" style={{ fontSize: 10, fontWeight: '800' }}>
                {plan ? 'HEUTIGER OMAD TELLER' : 'MAHLZEIT PLANEN'}
              </Txt>
            </View>
            <Txt variant="heading" color="#FFFFFF" style={{ fontSize: 18, fontWeight: '800', marginTop: 4 }}>
              {plan ? plan.recipe.title : 'Nährstoffreiche OMAD-Hauptmahlzeit'}
            </Txt>
            <Txt variant="small" color="rgba(255, 255, 255, 0.85)" style={{ marginTop: 2 }}>
              {kcal} kcal · {protein}g Protein · Zeitfenster {fast.windowStart}–{fast.windowEnd}
            </Txt>
          </View>
        </TouchableOpacity>
      </Enter>

      {/* Modern 3-Column Quick Tools Widget Grid */}
      <Enter index={9} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>Schnellzugriff & Tools</Eyebrow>
        <View style={s.quickToolGrid}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/grocery')}
            style={[s.quickToolCard, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <View style={[s.quickToolIconCircle, { backgroundColor: 'rgba(129, 140, 248, 0.15)' }]}>
              <Icon name="basket" size={18} color={c.plan} />
            </View>
            <Txt variant="subheading" color={c.text} style={{ fontSize: 13, fontWeight: '700', marginTop: 8 }}>
              Einkaufsliste
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ fontSize: 11, textAlign: 'center', marginTop: 2 }}>
              Zutaten sortiert
            </Txt>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/progress')}
            style={[s.quickToolCard, { backgroundColor: c.surface, borderColor: c.line, marginHorizontal: Space.sm }]}
          >
            <View style={[s.quickToolIconCircle, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
              <Icon name="chart" size={18} color={c.body} />
            </View>
            <Txt variant="subheading" color={c.text} style={{ fontSize: 13, fontWeight: '700', marginTop: 8 }}>
              Verlauf & Trend
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ fontSize: 11, textAlign: 'center', marginTop: 2 }}>
              Gewicht & Daten
            </Txt>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/chat')}
            style={[s.quickToolCard, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <View style={[s.quickToolIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Icon name="coach" size={18} color={c.accent} />
            </View>
            <Txt variant="subheading" color={c.text} style={{ fontSize: 13, fontWeight: '700', marginTop: 8 }}>
              Fasten-Coach
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ fontSize: 11, textAlign: 'center', marginTop: 2 }}>
              KI-Beratung
            </Txt>
          </TouchableOpacity>
        </View>
      </Enter>

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
    </Screen>
  );
}

const s = StyleSheet.create({
  stage: { marginTop: Space.lg, paddingHorizontal: Space.sm },
  answered: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Space.base,
    paddingVertical: Space.md, marginTop: Space.xl,
  },
  // Two by two. Four across left no room for a label and a figure under it.
  offerRow: { flexDirection: 'row', marginTop: Space.base, marginRight: -Space.sm },
  offerBtn: { flex: 1, marginRight: Space.sm },
  readiness: {
    borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed',
    paddingHorizontal: Space.base, paddingVertical: Space.md, marginTop: Space.base,
  },
  intakeGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginTop: Space.base, marginRight: -Space.sm,
  },
  intakeCell: { width: '50%', paddingRight: Space.sm, marginBottom: Space.sm },
  intakeBtn: {
    minHeight: 56, borderRadius: Radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8,
  },
  stageLabel: { textAlign: 'center' },
  stageNote: { textAlign: 'center', marginTop: 4, lineHeight: 19 },
  flex: { flex: 1 },
  rowCentre: { flexDirection: 'row', alignItems: 'center' },

  activeNextBanner: {
    marginHorizontal: Space.base,
    marginBottom: Space.sm,
    padding: Space.base,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  quickToolGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickToolCard: {
    flex: 1,
    paddingVertical: Space.base,
    paddingHorizontal: Space.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickToolIconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Space.md },
  time: { width: 54 },
  struck: { textDecorationLine: 'line-through' },

  hero: { borderRadius: Radius.xl, padding: Space.lg, paddingTop: Space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: Space.sm },
  heroBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  stageHeader: { flexDirection: 'row', alignItems: 'center' },
  stageIconBadge: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  // The caption rides the baseline of a 56pt numeral, so it needs its own
  // opacity rather than a dimmer token — there is no dim-on-hero colour.
  heroFigure: { marginRight: Space.sm },
  countRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  countCaption: { opacity: 0.7 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  figure: { fontSize: 24, marginTop: 5 },
  vline: { width: 1, height: 34, marginHorizontal: Space.base },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.base },
  actions: { flexDirection: 'row', marginTop: Space.base, marginRight: -Space.sm },
  action: { flex: 1, marginRight: Space.sm },
  pill: { height: 40, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },

  weighRow: { flexDirection: 'row', alignItems: 'center' },
  weighInput: { flex: 1, height: 44, borderRadius: Radius.sm, borderWidth: 1, paddingHorizontal: Space.md, fontSize: 14, marginRight: Space.sm },
  weighBtn: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  bentoActions: { flexDirection: 'row', alignItems: 'center', marginTop: Space.xs },
  miniPill: { height: 26, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  showcaseCard: {
    height: 140,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  showcaseImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  showcaseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 12, 20, 0.65)',
  },
  showcaseContent: {
    flex: 1,
    padding: Space.base,
    justifyContent: 'flex-end',
  },
  badgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    marginBottom: 2,
  },
  shiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginLeft: Space.sm,
  },
});
