import { useCallback, useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Tap, PageHeader, useTheme,
} from '@/components/ui';
import { useLang } from '@/components/lang';
import { Icon } from '@/components/icons';
import { DayBand } from '@/components/DayBand';
import { WeekdayPillStrip } from '@/components/WeekdayPillStrip';
import { FastingFeelingBar } from '@/components/FastingFeelingBar';
import {
  dailyTargets, fastingState, formatCountdown, hydrationTargetMl, toMinutes, fromMinutes, DEFAULT_PROFILE,
  type UserProfile, type FastingState,
} from '@/lib/nutrition';
import { dayAgenda } from '@/lib/agenda';
import { formatReadableDate, longestStreak } from '@/lib/dates';
import { WindowShifterModal } from '@/components/WindowShifterModal';
import { MetabolicTimelineModal } from '@/components/MetabolicTimelineModal';
import { MetabolicProgressBar } from '@/components/MetabolicProgressBar';
import { DailyBioHackCard } from '@/components/DailyBioHackCard';
import { BreakFastGuideModal } from '@/components/BreakFastGuideModal';
import { DailyFastingNote } from '@/components/DailyFastingNote';
import { playZenChime } from '@/lib/sound';
import {
  loadProfileOrDefault, loadHydration, saveHydration, loadFastLog, markFastComplete,
  currentStreak, loadLastPlan, loadCookLog, loadWeightLog, saveWeightLog,
  remindersOffered, markRemindersOffered,
  saveProfile, recordIntake, loadIntakeLog, isPremium, todayISO, loadTodayWindowShift,
  saveTodayWindowShift, clearTodayWindowShift,
  loadDailySteps, saveDailySteps, type Hydration,
} from '@/lib/store';
import {
  effectiveMaintenance, intakeQuestionFor, scaleJump,
  type IntakeQuestion, type ScaleJump,
} from '@/lib/energy';
import { INTAKE_OPTIONS, intakeOptionLabel } from '@/lib/review';
import { haptic } from '@/lib/haptic';
import type { MealPlan } from '@/lib/ai';
import { setEnabled as setRemindersEnabled } from '@/lib/notify';

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
  /** Shown once, after the app has delivered something. Never twice. */
  const [offerReminders, setOfferReminders] = useState(false);
  const [dateLabel, setDateLabel] = useState('');
  const [question, setQuestion] = useState<IntakeQuestion | null>(null);
  const [answered, setAnswered] = useState<{ date: string; factor: number } | null>(null);
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [showShifter, setShowShifter] = useState(false);
  const [showMetabolic, setShowMetabolic] = useState(false);
  const [showBreakFast, setShowBreakFast] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isShifted, setIsShifted] = useState(false);
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
    setIsShifted(!!shift);
    const effectiveProfile = shift ? { ...p, omad_window_start: shift.window_start } : p;
    setQuestion(intakeQuestionFor(effectiveProfile, intake));
    const latest = [...(intake ?? [])].sort((a, b) => a.date.localeCompare(b.date)).pop();
    setAnswered(latest ? { date: latest.date, factor: latest.factor } : null);
    setJump(scaleJump(weights, intake));
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

  const { items } = dayAgenda(profile, plan, { cooked, fastLogged }, now, lang);

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

  const resetShift = async () => {
    await clearTodayWindowShift();
    haptic('medium');
    await refresh();
  };

  const quickFinishFast = async () => {
    const updatedFasts = await markFastComplete();
    setFastLog(updatedFasts);
    setStreak(currentStreak(updatedFasts));
    setFastLogged(true);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nextStart = fromMinutes(nowMin);
    const nextEndMin = (nowMin + profile.omad_window_hours * 60) % 1440;
    const nextEnd = fromMinutes(nextEndMin);
    await saveTodayWindowShift(nextStart, nextEnd);
    playZenChime();
    haptic('success');
    setShowCelebration(true);
    if (!(await remindersOffered())) setOfferReminders(true);
    await refresh();
  };

  /**
   * The whole intake signal, in one tap. Deliberately not a food diary — the
   * app promises fewer decisions, and a fortnight of rough answers measures a
   * metabolism better than a precise diary nobody keeps up.
   */
  const answerIntake = async (factor: number | null) => {
    if (!question) return;
    if (factor !== null) {
      await recordIntake(factor, questionKcal, question.date);
      setAnswered({ date: question.date, factor });
    }
    setQuestion(null);
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
    const freshIntake = await loadIntakeLog();
    setJump(scaleJump(updated, freshIntake));
  };

  // Hours into the current fast, for the physiology band.
  const hoursFasted = fast.isEating ? 0 : fast.fastingHours * (fast.progressPct / 100);

  const waterPct = Math.min(100, (hydration.ml / waterTarget) * 100);

  const hour = now.getHours();
  const timeGreeting =
    hour < 11
      ? (lang === 'de' ? 'Guten Morgen' : 'Good morning')
      : hour < 17
      ? (lang === 'de' ? 'Guten Tag' : 'Good afternoon')
      : (lang === 'de' ? 'Guten Abend' : 'Good evening');

  const bioInsight = fast.isEating
    ? (lang === 'de' ? 'Essensfenster geöffnet · Genieße deine Mahlzeit bewusst' : 'Eating window open · Enjoy your meal')
    : hoursFasted >= 18
    ? (lang === 'de' ? 'Tiefe Autophagie aktiv · Zellregeneration läuft auf Hochtouren' : 'Deep autophagy active · Cellular recovery at peak')
    : hoursFasted >= 12
    ? (lang === 'de' ? 'Ketose aktiv · Dein Körper greift reine Fettreserven an' : 'Ketosis active · Burning pure fat reserves')
    : (lang === 'de' ? 'Verdauung ruht · Insulin sinkt für optimalen Fokus' : 'Digestion resting · Insulin dropping for optimal focus');

  return (
    <Screen contentStyle={{ maxWidth: 640, alignSelf: 'center', width: '100%' }}>
      {/* 1. Header & Weekday Streak Record */}
      <Enter index={0}>
        <PageHeader
          tone={fast.isEating ? 'ember' : 'accent'}
          eyebrow={`${timeGreeting} · ${dateLabel}`}
          title={fast.isEating ? t('today.windowOpen') : t('today.fasting')}
          sub={bioInsight}
        />
        <WeekdayPillStrip
          fastLog={fastLog}
          streak={streak}
          longestStreakCount={longestStreak(fastLog)}
        />
      </Enter>

      {/* Celebration Notification */}
      {showCelebration && (
        <Enter index={1}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowCelebration(false)}
            style={[s.celebrationCard, { backgroundColor: c.emberWash, borderColor: c.ember }]}
          >
            <Icon name="flame" size={18} color={c.ember} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Txt variant="subheading" color={c.ember} style={{ fontWeight: '800', fontSize: 14 }}>
                {lang === 'de' ? 'Fasten erfolgreich abgeschlossen! 🎉' : 'Fast completed! 🎉'}
              </Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 2, fontSize: 12 }}>
                {lang === 'de'
                  ? `${streak} Tage Fasten-Serie aktiv. Großartige Leistung!`
                  : `${streak}-day streak active. Great consistency!`}
              </Txt>
            </View>
            <Icon name="check" size={16} color={c.ember} />
          </TouchableOpacity>
        </Enter>
      )}

      {/* 2. THE MAJESTIC ZEN FASTING HERO */}
      <Enter index={2}>
        <View style={[s.zenHeroCard, { backgroundColor: c.heroFill }]}>
          {/* Top Mini-Pill Header */}
          <View style={s.zenHeroTop}>
            <View style={[s.heroBadge, { backgroundColor: fast.isEating ? c.emberWash : 'rgba(255, 255, 255, 0.12)' }]}>
              <Icon name={fast.isEating ? 'plate' : 'flame'} size={12} color={fast.isEating ? c.ember : c.onHero} />
              <Txt variant="data" color={fast.isEating ? c.ember : c.onHero} style={{ marginLeft: 4, fontSize: 10, fontWeight: '700' }}>
                {fast.isEating ? t('today.windowEating') : t('today.windowRunning')}
              </Txt>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowShifter(true)}
              style={[s.zenAdjustPill, { backgroundColor: 'rgba(255, 255, 255, 0.12)' }]}
            >
              <Icon name="clock" size={11} color={c.onHero} />
              <Txt variant="eyebrow" color={c.onHero} style={{ marginLeft: 4, fontSize: 9.5, fontWeight: '700' }}>
                {fast.windowStart}–{fast.windowEnd}
              </Txt>
              <View style={{ marginLeft: 4, opacity: 0.8 }}>
                <Icon name="edit" size={10} color={c.onHero} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Hero Countdown */}
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/timer')} style={s.zenCountContainer}>
            <Txt variant="hero" color={c.onHero} style={s.zenHeroFigure}>
              {formatCountdown(fast.remainingMs)}
            </Txt>
            <Txt variant="small" color={c.onHero} style={s.zenCountCaption}>
              {lang === 'de'
                ? (fast.isEating ? `verbleibend bis Essensfenster-Ende` : `gefastet · Essensfenster öffnet um ${fast.windowStart}`)
                : (fast.isEating ? `remaining in eating window` : `fasted · opens at ${fast.windowStart}`)}
            </Txt>
          </TouchableOpacity>

          {/* DayBand 24h timeline */}
          <DayBand
            onHero
            style={{ marginTop: Space.md }}
            nowMin={now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60}
            windowStartMin={toMinutes(profile.omad_window_start)}
            windowLengthMin={profile.omad_window_hours * 60}
            items={items}
            isEating={fast.isEating}
          />

          {/* 4-Stage Metabolic Progress Bar */}
          {!fast.isEating && (
            <View style={{ marginTop: Space.md }}>
              <MetabolicProgressBar
                hoursFasted={hoursFasted}
                onPress={() => setShowMetabolic(true)}
              />
            </View>
          )}

          {/* Zen Hero Action Button */}
          <View style={s.zenActionRow}>
            {!fast.isEating ? (
              <TouchableOpacity
                onPress={quickFinishFast}
                activeOpacity={0.8}
                style={[s.zenPrimaryBtn, { backgroundColor: c.ember }]}
              >
                <Icon name="plate" size={14} color="#FFFFFF" />
                <Txt variant="subheading" color="#FFFFFF" style={{ marginLeft: 6, fontSize: 13, fontWeight: '800' }}>
                  {lang === 'de' ? 'Fasten beenden & Essen loggen' : 'End Fast & Log Plate'}
                </Txt>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setShowBreakFast(true)}
                activeOpacity={0.8}
                style={[s.zenPrimaryBtn, { backgroundColor: c.plan }]}
              >
                <Icon name="shield" size={14} color="#FFFFFF" />
                <Txt variant="subheading" color="#FFFFFF" style={{ marginLeft: 6, fontSize: 13, fontWeight: '800' }}>
                  {lang === 'de' ? 'Fastenbrechen-Guide ansehen' : 'View Break-Fast Guide'}
                </Txt>
              </TouchableOpacity>
            )}

            {isShifted && (
              <TouchableOpacity
                onPress={resetShift}
                activeOpacity={0.7}
                style={[s.zenResetBtn, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}
                accessibilityLabel="Zeitfenster zurücksetzen"
              >
                <Txt variant="eyebrow" color={c.onHero} style={{ fontSize: 9.5, fontWeight: '700' }}>
                  {lang === 'de' ? 'Standard-Zeit' : 'Reset'}
                </Txt>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Enter>

      {/* 3. FASTING FEELING 1-TAP (Subtle & clean) */}
      <Enter index={3}>
        <View style={{ marginTop: Space.sm, marginBottom: Space.xs }}>
          <FastingFeelingBar embedded />
        </View>
      </Enter>

      {/* 4. THE TWO CORE PILLARS: HYDRATION & HEUTIGER OMAD TELLER */}
      <Enter index={4}>
        <View style={s.corePillarsRow}>
          {/* Hydration Pillar */}
          <View style={[s.corePillarCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="drop" size={14} color={c.hydro} />
                <Eyebrow color={c.hydro} style={{ marginLeft: 4, fontSize: 9.5, fontWeight: '800' }}>
                  WASSER
                </Eyebrow>
              </View>
              <Txt variant="data" color={c.text} style={{ fontSize: 12, fontWeight: '800' }}>
                {(hydration.ml / 1000).toFixed(1)} <Txt variant="small" color={c.textDim}>/ {(waterTarget / 1000).toFixed(1)}L</Txt>
              </Txt>
            </View>

            <View style={[s.waterFillTrack, { backgroundColor: c.well, marginVertical: 8 }]}>
              <View
                style={[
                  s.waterFillBar,
                  {
                    width: `${waterPct}%`,
                    backgroundColor: waterPct >= 100 ? '#10B981' : c.hydro,
                  },
                ]}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
              <TouchableOpacity onPress={() => addWater(250)} style={[s.pillarMiniBtn, { backgroundColor: c.well }]}>
                <Txt variant="eyebrow" color={c.text} style={{ fontSize: 9.5 }}>+250</Txt>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => addWater(500)} style={[s.pillarMiniBtn, { backgroundColor: c.well }]}>
                <Txt variant="eyebrow" color={c.text} style={{ fontSize: 9.5 }}>+500</Txt>
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleSalt} style={[s.pillarMiniBtn, { backgroundColor: hydration.electrolytes ? c.emberWash : c.well }]}>
                <Txt variant="eyebrow" color={hydration.electrolytes ? c.ember : c.textDim} style={{ fontSize: 9.5 }}>
                  {hydration.electrolytes ? 'Salz ✓' : 'Salz'}
                </Txt>
              </TouchableOpacity>
            </View>
          </View>

          {/* Dinner Plate Pillar */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/planner')}
            style={[s.corePillarCard, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="plate" size={14} color={c.ember} />
                <Eyebrow color={c.ember} style={{ marginLeft: 4, fontSize: 9.5, fontWeight: '800' }}>
                  OMAD TELLER
                </Eyebrow>
              </View>
              <View style={[s.countBadge, { backgroundColor: plan ? 'rgba(16, 185, 129, 0.15)' : c.emberWash }]}>
                <Txt variant="eyebrow" color={plan ? '#10B981' : c.ember} style={{ fontSize: 8, fontWeight: '800' }}>
                  {plan ? 'BEREIT' : 'PLANEN'}
                </Txt>
              </View>
            </View>

            <Txt variant="subheading" color={c.text} numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', marginTop: 5 }}>
              {plan ? plan.recipe.title : t('today.defaultMeal')}
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 1 }}>
              {kcal} kcal · {protein}g Protein
            </Txt>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Txt variant="eyebrow" color={c.accent} style={{ fontSize: 9.5, fontWeight: '800' }}>
                {plan ? (lang === 'de' ? 'Rezept ansehen ➔' : 'View recipe ➔') : (lang === 'de' ? '1 Tap Generieren ➔' : 'Generate ➔')}
              </Txt>
            </View>
          </TouchableOpacity>
        </View>
      </Enter>

      {/* 5. WORKOUT & ACTIVITY (Sleek 1-line Card) */}
      <Enter index={5}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/workout')}
          style={[s.zenSecondaryCard, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[s.sportIconBox, { backgroundColor: 'rgba(255, 107, 74, 0.12)' }]}>
              <Icon name="dumbbell" size={15} color="#FF6B4A" />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Eyebrow color="#FF6B4A" style={{ fontSize: 9.5, fontWeight: '800' }}>
                {lang === 'de' ? 'GEFASTETES WORKOUT & AKTIVITÄT' : 'FASTED WORKOUT & ACTIVITY'}
              </Eyebrow>
              <Txt variant="subheading" color={c.text} style={{ fontSize: 13, fontWeight: '700', marginTop: 1 }}>
                {steps > 0 ? `${steps.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')} Schritte erfasst` : (lang === 'de' ? '6 Hypertrophie-Routinen verfügbar' : '6 routines available')}
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => addSteps(1000)} style={[s.miniStepPill, { backgroundColor: c.well, marginRight: 6 }]}>
              <Txt variant="eyebrow" color={c.text} style={{ fontSize: 9.5 }}>+1k</Txt>
            </TouchableOpacity>
            <Icon name="chevronRight" size={14} color={c.textDim} />
          </View>
        </TouchableOpacity>
      </Enter>

      {/* 6. DAILY SCIENTIFIC BIO-HACK */}
      <Enter index={6}>
        <DailyBioHackCard />
      </Enter>

      {/* 7. MORNING INTAKE CHECK-IN (Only when question is active) */}
      {question && (
        <Enter index={7}>
          <Card style={{ marginTop: Space.base }} tone="accent">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Eyebrow color={c.accent}>
                {lang === 'de'
                  ? (question.date === todayISO() ? '1-TAP TRACKING: WIE LIEF ES HEUTE?' : 'MORGEN-CHECK-IN: WIE LIEF ES GESTERN?')
                  : (question.date === todayISO() ? '1-TAP TRACKING: TODAY' : 'CHECK-IN: YESTERDAY')}
              </Eyebrow>
              <View style={[s.countBadge, { backgroundColor: c.accentWash }]}>
                <Txt variant="eyebrow" color={c.accent} style={{ fontSize: 9, fontWeight: '800' }}>
                  {lang === 'de' ? '1-TAP' : '1-TAP'}
                </Txt>
              </View>
            </View>
            <Txt variant="small" color={c.textDim} style={{ marginTop: 4, fontSize: 12 }}>
              {lang === 'de'
                ? `Gegen das Ziel von ${questionKcal} kcal. Kalibriert deinen echten Stoffwechsel.`
                : `Against ${questionKcal} kcal target to calibrate your real metabolism.`}
            </Txt>
            <View style={{ flexDirection: 'row', marginTop: Space.sm, gap: Space.xs }}>
              {INTAKE_OPTIONS.map((opt) => {
                const sel = answered?.date === question.date && answered?.factor === opt.factor;
                return (
                  <Tap
                    key={String(opt.factor)}
                    onPress={() => answerIntake(opt.factor)}
                    accessibilityLabel={intakeOptionLabel(opt, lang)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    style={{ flex: 1 }}
                  >
                    <View
                      style={[
                        s.pill,
                        {
                          backgroundColor: sel ? c.accent : c.well,
                          borderWidth: sel ? 0 : 1,
                          borderColor: c.line,
                          paddingHorizontal: 2,
                        },
                      ]}
                    >
                      <Txt
                        variant="data"
                        color={sel ? c.onAccent : c.text}
                        style={{ fontSize: 11, fontWeight: '700', textAlign: 'center' }}
                      >
                        {opt.factor === 1 ? '100%' : `${Math.round(opt.factor * 100)}%`}
                      </Txt>
                    </View>
                  </Tap>
                );
              })}
            </View>
          </Card>
        </Enter>
      )}

      {/* 8. WEIGH-IN IF NOT YET LOGGED */}
      {!weighedToday && (
        <Enter index={8}>
          <Card style={{ marginTop: Space.base }} tone="body">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.xs }}>
              <Eyebrow color={c.body}>{t('today.dailyWeighIn')}</Eyebrow>
              <Txt variant="small" color={c.textDim}>{profile.weight_kg.toFixed(1)} kg Basis</Txt>
            </View>
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

      {/* 9. FASTING JOURNAL NOTE */}
      <Enter index={9}>
        <Card style={{ marginTop: Space.base, padding: Space.base }}>
          <DailyFastingNote embedded />
        </Card>
      </Enter>

      {/* 10. QUICK TOOLS (Einkauf, Verlauf, Coach) */}
      <Enter index={10} style={{ marginTop: Space.base, marginBottom: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.sm }}>{lang === 'de' ? 'Schnellzugriff' : 'Quick Tools'}</Eyebrow>
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
              {lang === 'de' ? 'Einkauf' : 'Grocery'}
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ fontSize: 11, textAlign: 'center', marginTop: 2 }}>
              {lang === 'de' ? 'Zutatenliste' : 'Ingredients'}
            </Txt>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/progress')}
            style={[s.quickToolCard, { backgroundColor: c.surface, borderColor: c.line, marginHorizontal: Space.sm }]}
          >
            <View style={[s.quickToolIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Icon name="chart" size={18} color={c.positive} />
            </View>
            <Txt variant="subheading" color={c.text} style={{ fontSize: 13, fontWeight: '700', marginTop: 8 }}>
              {lang === 'de' ? 'Fortschritt' : 'Progress'}
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ fontSize: 11, textAlign: 'center', marginTop: 2 }}>
              {lang === 'de' ? 'Gewicht & Trend' : 'Weight'}
            </Txt>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/chat')}
            style={[s.quickToolCard, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <View style={[s.quickToolIconCircle, { backgroundColor: 'rgba(255, 107, 74, 0.15)' }]}>
              <Icon name="coach" size={18} color={c.accent} />
            </View>
            <Txt variant="subheading" color={c.text} style={{ fontSize: 13, fontWeight: '700', marginTop: 8 }}>
              {lang === 'de' ? 'Coach' : 'Coach'}
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ fontSize: 11, textAlign: 'center', marginTop: 2 }}>
              {lang === 'de' ? 'KI-Beratung' : 'AI Advice'}
            </Txt>
          </TouchableOpacity>
        </View>
      </Enter>

      {/* Asked once, whatever the answer. */}
      {offerReminders && (
        <Enter index={11}>
          <Card style={{ marginTop: Space.base }}>
            <Eyebrow>{lang === 'de' ? 'Erinnerungen aktivieren?' : 'Want the app to tell you when?'}</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
              {lang === 'de'
                ? 'Benachrichtigungen für Start & Ende des Essensfensters, Kochbeginn und Wiege-Erinnerungen.'
                : 'Window opening and closing, when to start cooking, and a nudge to weigh in — the measurement needs four weigh-ins across ten days.'}
            </Txt>
            <View style={s.offerRow}>
              <Button
                label={lang === 'de' ? 'Aktivieren' : 'Turn them on'}
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
                label={lang === 'de' ? 'Nein danke' : 'No thanks'}
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

      {jump && (
        <Enter index={12}>
          <Card style={{ marginTop: Space.base }} tone="ember">
            <Eyebrow color={c.ember}>Up {jump.kg} kg</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
              {jump.note}
            </Txt>
          </Card>
        </Enter>
      )}

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
  celebrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Space.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Space.sm,
  },
  zenHeroCard: {
    borderRadius: Radius.xl,
    padding: Space.base,
    paddingTop: Space.base,
    marginTop: Space.xs,
  },
  zenHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.xs,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  zenAdjustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  zenCountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.sm,
  },
  zenHeroFigure: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  zenCountCaption: {
    opacity: 0.85,
    fontSize: 12.5,
    marginTop: 4,
    textAlign: 'center',
  },
  zenActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.md,
    gap: Space.xs,
  },
  zenPrimaryBtn: {
    flex: 1,
    height: 42,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.base,
  },
  zenResetBtn: {
    height: 42,
    paddingHorizontal: Space.base,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corePillarsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Space.sm,
    marginTop: Space.xs,
  },
  corePillarCard: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    justifyContent: 'space-between',
  },
  pillarMiniBtn: {
    flex: 1,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zenSecondaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Space.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Space.sm,
  },
  miniStepPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  sportIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: Radius.pill,
  },
  waterFillTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  waterFillBar: {
    height: '100%',
    borderRadius: 3,
  },
  weighRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weighInput: {
    flex: 1,
    height: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Space.md,
    fontSize: 14,
    marginRight: Space.sm,
  },
  weighBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: 38,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  offerRow: {
    flexDirection: 'row',
    marginTop: Space.base,
    marginRight: -Space.sm,
  },
  offerBtn: {
    flex: 1,
    marginRight: Space.sm,
  },
});
