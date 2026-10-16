import { BreakFastGuideModal } from '@/components/BreakFastGuideModal';
import { FastingHaloDial } from '@/components/FastingHaloDial';
import { ShareableFastCardModal } from '@/components/ShareableFastCardModal';
import { Icon } from '@/components/icons';
import { useLang } from '@/components/lang';
import { MetabolicTimelineModal } from '@/components/MetabolicTimelineModal';
import {
  Card,
  Enter,
  Screen,
  Tap,
  Txt,
  useTheme,
  useWide,
} from '@/components/ui';
import { WindowShifterModal } from '@/components/WindowShifterModal';
import { Radius, Space } from '@/constants/theme';
import type { MealPlan } from '@/lib/ai';
import { formatReadableDate } from '@/lib/dates';
import {
  effectiveMaintenance, intakeQuestionFor,
  type IntakeQuestion,
} from '@/lib/energy';
import { haptic } from '@/lib/haptic';
import {
  dailyTargets,
  DEFAULT_PROFILE,
  fastingState,
  fromMinutes,
  hydrationTargetMl,
  type FastingState,
  type UserProfile,
} from '@/lib/nutrition';
import { INTAKE_OPTIONS, INTAKE_LABELS_SHORT_DE } from '@/lib/review';
import { playZenChime } from '@/lib/sound';
import {
  clearTodayWindowShift,
  currentStreak,
  isPremium,
  loadDailySteps,
  loadFastLog,
  loadHydration,
  loadIntakeLog,
  loadLastPlan,
  loadProfileOrDefault,
  loadTodayWindowShift,
  loadWeightLog,
  markFastComplete,
  recordIntake,
  saveDailySteps,
  saveHydration,
  saveTodayWindowShift,
  todayISO,
  type Hydration,
} from '@/lib/store';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export default function DashboardScreen() {
  const router = useRouter();
  const c = useTheme();
  const { lang, t } = useLang();
  const isWide = useWide();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [fast, setFast] = useState<FastingState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [hydration, setHydration] = useState<Hydration>({ date: todayISO(), ml: 0, electrolytes: false });
  const [streak, setStreak] = useState(0);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [dateLabel, setDateLabel] = useState('');
  const [question, setQuestion] = useState<IntakeQuestion | null>(null);
  const [answered, setAnswered] = useState<{ date: string; factor: number } | null>(null);
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [showShifter, setShowShifter] = useState(false);
  const [showMetabolic, setShowMetabolic] = useState(false);
  const [showBreakFast, setShowBreakFast] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [isShifted, setIsShifted] = useState(false);
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    setDateLabel(formatReadableDate(new Date(), lang));
    setMounted(true);
  }, [lang]);

  const addSteps = async (count: number) => {
    const next = steps + count;
    setSteps(next);
    haptic('light');
    await saveDailySteps(next);
  };

  const refresh = useCallback(async () => {
    const [p, h, fl, last, weights, intake, prem, shift, st] = await Promise.all([
      loadProfileOrDefault(), loadHydration(), loadFastLog(),
      loadLastPlan<MealPlan>(), loadWeightLog(), loadIntakeLog(), isPremium(),
      loadTodayWindowShift(), loadDailySteps(),
    ]);
    setIsShifted(!!shift);
    const effectiveProfile = shift ? { ...p, omad_window_start: shift.window_start } : p;
    setQuestion(intakeQuestionFor(effectiveProfile, intake));
    const latest = [...(intake ?? [])].sort((a, b) => a.date.localeCompare(b.date)).pop();
    setAnswered(latest ? { date: latest.date, factor: latest.factor } : null);
    setMeasured(effectiveMaintenance(intake, weights, dailyTargets(effectiveProfile, null).maintenance_kcal, prem));
    setProfile(effectiveProfile);
    setHydration(h);
    setStreak(currentStreak(fl));
    setPlan(last?.date === todayISO() ? last : null);
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
    haptic('light');
    await saveHydration(nextH);
  };
  const toggleSalt = async () => {
    const nextH = { ...hydration, electrolytes: !hydration.electrolytes };
    setHydration(nextH);
    haptic('light');
    await saveHydration(nextH);
  };

  const resetShift = async () => {
    await clearTodayWindowShift();
    haptic('medium');
    await refresh();
  };

  const quickFinishFast = async () => {
    const updatedFasts = await markFastComplete();
    setStreak(currentStreak(updatedFasts));
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const nextStart = fromMinutes(nowMin);
    const nextEndMin = (nowMin + profile.omad_window_hours * 60) % 1440;
    const nextEnd = fromMinutes(nextEndMin);
    await saveTodayWindowShift(nextStart, nextEnd);
    playZenChime();
    haptic('success');
    setShowCelebration(true);
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

  // Hours into the current fast, for the physiology band.
  const hoursFasted = fast.isEating ? 0 : fast.fastingHours * (fast.progressPct / 100);

  const waterPct = Math.min(100, (hydration.ml / waterTarget) * 100);
  /** Daily step goal. A round, reachable number to walk towards. */
  const STEP_GOAL = 10000;
  const stepsPct = Math.min(100, (steps / STEP_GOAL) * 100);

  // Phase metadata for FastingHaloDial
  const phaseInfo = hoursFasted >= 18
    ? { name: lang === 'de' ? 'Autophagie' : 'Autophagy', hue: 'plan' as const }
    : hoursFasted >= 12
    ? { name: lang === 'de' ? 'Ketose' : 'Ketosis', hue: 'accent' as const }
    : hoursFasted >= 4
    ? { name: lang === 'de' ? 'Fettstart' : 'Fat Burn', hue: 'ember' as const }
    : { name: lang === 'de' ? 'Blutzucker' : 'Glucose', hue: 'gold' as const };

  const bentoGridContent = (
    <>
      {/* 2-TILE BENTO ROW: WASSER & SCHRITTE */}
      <Enter index={2}>
        <View style={s.bentoRow}>
          {/* Tile 1: Hydration */}
          <View style={[s.bentoTile, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={s.tileHeader}>
              <View style={[s.tileIconCircle, { backgroundColor: c.hydroWash }]}>
                <Icon name="drop" size={14} color={c.hydro} />
              </View>
              <TouchableOpacity
                onPress={toggleSalt}
                activeOpacity={0.7}
                style={[
                  s.saltBadge,
                  {
                    backgroundColor: hydration.electrolytes ? c.emberWash : 'rgba(255,255,255,0.06)',
                    borderColor: hydration.electrolytes ? c.ember : 'transparent',
                  },
                ]}
                accessibilityLabel="Elektrolyte umschalten"
              >
                <Txt
                  variant="eyebrow"
                  color={hydration.electrolytes ? c.ember : c.textDim}
                  style={{ fontSize: 9, fontWeight: '800' }}
                >
                  {hydration.electrolytes ? '🧂 SALZ ON' : '+ SALZ'}
                </Txt>
              </TouchableOpacity>
            </View>

            <View style={s.tileStatBlock}>
              <Txt variant="title" color="#FFFFFF" style={s.tileNumber}>
                {(hydration.ml / 1000).toFixed(1)}
                <Txt variant="small" color={c.textFaint} style={{ fontSize: 13 }}> / {(waterTarget / 1000).toFixed(1)}L</Txt>
              </Txt>
              <Txt variant="eyebrow" color={c.textDim} style={s.tileLabel}>
                {lang === 'de' ? 'WASSER' : 'HYDRATION'}
              </Txt>
            </View>

            <View style={[s.miniTrack, { backgroundColor: c.well }]}>
              <View
                style={[
                  s.miniTrackFill,
                  { width: `${waterPct}%`, backgroundColor: waterPct >= 100 ? c.positive : c.hydro },
                ]}
              />
            </View>

            <TouchableOpacity
              onPress={() => addWater(250)}
              activeOpacity={0.75}
              style={[s.tileActionBtn, { backgroundColor: c.surfaceElevated ?? c.well, borderColor: c.line }]}
              accessibilityLabel="+250 ml Wasser"
            >
              <Icon name="plus" size={11} color={c.hydro} strokeWidth={2.4} />
              <Txt variant="data" color="#FFFFFF" style={s.tileActionText}>
                250 ml
              </Txt>
            </TouchableOpacity>
          </View>

          {/* Tile 2: Schritte */}
          <View style={[s.bentoTile, { backgroundColor: c.surface, borderColor: c.line, marginLeft: Space.sm }]}>
            <View style={s.tileHeader}>
              <View style={[s.tileIconCircle, { backgroundColor: c.accentWash }]}>
                <Icon name="footprints" size={14} color={c.accent} />
              </View>
              <View style={[s.goalPill, { backgroundColor: c.accentWash }]}>
                <Txt variant="eyebrow" color={c.accent} style={{ fontSize: 9, fontWeight: '800' }}>
                  ZIEL 10K
                </Txt>
              </View>
            </View>

            <View style={s.tileStatBlock}>
              <Txt variant="title" color="#FFFFFF" style={s.tileNumber}>
                {steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps}
                <Txt variant="small" color={c.textFaint} style={{ fontSize: 13 }}> / 10k</Txt>
              </Txt>
              <Txt variant="eyebrow" color={c.textDim} style={s.tileLabel}>
                {lang === 'de' ? 'SCHRITTE' : 'STEPS'}
              </Txt>
            </View>

            <View style={[s.miniTrack, { backgroundColor: c.well }]}>
              <View
                style={[
                  s.miniTrackFill,
                  { width: `${stepsPct}%`, backgroundColor: stepsPct >= 100 ? c.positive : c.accent },
                ]}
              />
            </View>

            <TouchableOpacity
              onPress={() => addSteps(1000)}
              activeOpacity={0.75}
              style={[s.tileActionBtn, { backgroundColor: c.surfaceElevated ?? c.well, borderColor: c.line }]}
              accessibilityLabel="+1000 Schritte"
            >
              <Icon name="plus" size={11} color={c.accent} strokeWidth={2.4} />
              <Txt variant="data" color="#FFFFFF" style={s.tileActionText}>
                1.000
              </Txt>
            </TouchableOpacity>
          </View>
        </View>
      </Enter>

      {/* TILE 3: HEUTIGER OMAD TELLER BANNER */}
      <Enter index={3}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/planner')}
          style={[s.mealBanner, { backgroundColor: c.surface, borderColor: c.line }]}
          accessibilityLabel="Heutigen OMAD Teller öffnen"
        >
          <View style={[s.mealBannerIcon, { backgroundColor: plan ? c.planWash : c.emberWash }]}>
            <Icon name="plate" size={18} color={plan ? c.plan : c.ember} />
          </View>
          <View style={s.mealBannerBody}>
            <View style={s.mealBannerTopRow}>
              <Txt variant="eyebrow" color={plan ? c.plan : c.ember} style={{ fontSize: 9.5, fontWeight: '800' }}>
                {lang === 'de' ? 'HEUTIGER OMAD TELLER' : "TODAY'S OMAD MEAL"}
              </Txt>
              <View style={[s.macroBadge, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
                <Txt variant="data" color="#FFFFFF" style={{ fontSize: 11, fontWeight: '700' }}>
                  {kcal} kcal · {protein}g P
                </Txt>
              </View>
            </View>
            <Txt variant="subheading" color="#FFFFFF" numberOfLines={1} style={s.mealBannerTitle}>
              {plan ? plan.recipe.title : t('today.defaultMeal')}
            </Txt>
          </View>
          <View style={s.mealChevronCircle}>
            <Icon name="chevronRight" size={14} color={c.textDim} />
          </View>
        </TouchableOpacity>
      </Enter>

      {/* TILE 4: 1-TAP INTAKE CHECK-IN (Nur bei offener Frage) */}
      {question && (
        <Enter index={4}>
          <View style={[s.intakeBanner, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={s.intakeBannerHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[s.intakeDot, { backgroundColor: c.accent }]} />
                <Txt variant="eyebrow" color={c.accent} style={{ fontSize: 9.5, fontWeight: '800', marginLeft: 6 }}>
                  {lang === 'de'
                    ? (question.date === todayISO() ? 'Tages-Check-in: Heute' : 'Tages-Check-in: Gestern')
                    : (question.date === todayISO() ? 'Intake: Today' : 'Intake: Yesterday')}
                </Txt>
              </View>
              <Txt variant="eyebrow" color={c.textDim} style={{ fontSize: 9.5 }}>
                {questionKcal} kcal
              </Txt>
            </View>
            <View style={s.intakePillRow}>
              {INTAKE_OPTIONS.slice(0, 3).map((opt, i) => {
                const sel = answered?.date === question.date && answered?.factor === opt.factor;
                return (
                  <TouchableOpacity
                    key={String(opt.factor)}
                    activeOpacity={0.8}
                    onPress={() => answerIntake(opt.factor)}
                    style={[
                      s.intakePillBtn,
                      {
                        backgroundColor: sel ? c.accent : (c.surfaceElevated ?? c.well),
                        borderColor: sel ? c.accent : c.line,
                        marginRight: i < 2 ? Space.xs : 0,
                      },
                    ]}
                  >
                    <Txt
                      variant="data"
                      color={sel ? c.onAccent : '#FFFFFF'}
                      style={{ fontSize: 12, fontWeight: '700' }}
                    >
                      {lang === 'de' ? (INTAKE_LABELS_SHORT_DE[opt.label] ?? opt.label) : opt.label}
                    </Txt>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Enter>
      )}
    </>
  );

  const heroFastingContent = (
    <Enter index={1}>
      <View style={[s.machinedHeroCard, { backgroundColor: c.heroFill }]}>
        {/* Top Header inside Hero */}
        <View style={s.heroCardTop}>
          <View style={[s.heroBadgePill, { backgroundColor: fast.isEating ? c.emberWash : c.accentWash }]}>
            <View style={[s.stateDot, { backgroundColor: fast.isEating ? c.ember : c.accent }]} />
            <Txt
              variant="eyebrow"
              color={fast.isEating ? c.ember : c.accent}
              style={{ fontSize: 10, fontWeight: '800', marginLeft: 5, letterSpacing: 0.6 }}
            >
              {fast.isEating ? (lang === 'de' ? 'ESSENSFENSTER' : 'EATING WINDOW') : (lang === 'de' ? 'FASTENPHASE' : 'FASTING PHASE')}
            </Txt>
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setShowShifter(true)}
            style={s.heroWindowPill}
            accessibilityLabel="Zeitfenster anpassen"
          >
            <Icon name="clock" size={11} color="rgba(255, 255, 255, 0.85)" />
            <Txt variant="eyebrow" color="rgba(255, 255, 255, 0.85)" style={s.heroWindowText}>
              {fast.windowStart}–{fast.windowEnd}
            </Txt>
            <View style={{ marginLeft: 3, opacity: 0.6 }}>
              <Icon name="edit" size={10} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Central Halo Dial */}
        <FastingHaloDial
          remainingMs={fast.remainingMs}
          fastingHours={fast.fastingHours}
          progressPct={fast.progressPct}
          isEating={fast.isEating}
          windowStart={fast.windowStart}
          windowEnd={fast.windowEnd}
          hoursFasted={hoursFasted}
          phaseName={phaseInfo.name}
          phaseHue={phaseInfo.hue}
          onPressTimer={() => router.push('/timer')}
          onPressAdjust={() => setShowShifter(true)}
        />

        {/* Tactile Primary Action Button */}
        <View style={s.heroActionWrap}>
          {!fast.isEating ? (
            <TouchableOpacity
              onPress={quickFinishFast}
              activeOpacity={0.85}
              accessibilityLabel={lang === 'de' ? 'Fasten beenden & Mahlzeit loggen' : 'End fast & log meal'}
              style={[s.primaryTactileBtn, { backgroundColor: c.ember }]}
            >
              <Icon name="plate" size={15} color="#FFFFFF" />
              <Txt variant="subheading" color="#FFFFFF" style={s.primaryTactileText}>
                {lang === 'de' ? 'Fasten beenden & Teller loggen' : 'End Fast & Log Plate'}
              </Txt>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowBreakFast(true)}
              activeOpacity={0.85}
              style={[s.primaryTactileBtn, { backgroundColor: c.accent }]}
            >
              <Icon name="shield" size={15} color="#08090C" />
              <Txt variant="subheading" color="#08090C" style={s.primaryTactileText}>
                {lang === 'de' ? 'Fastenbrechen-Guide' : 'Break-Fast Guide'}
              </Txt>
            </TouchableOpacity>
          )}

          {isShifted && (
            <TouchableOpacity
              onPress={resetShift}
              activeOpacity={0.7}
              style={s.resetShiftBtn}
              accessibilityLabel="Zeitfenster zurücksetzen"
            >
              <Txt variant="eyebrow" color="rgba(255, 255, 255, 0.85)" style={{ fontSize: 9.5, fontWeight: '700' }}>
                {lang === 'de' ? 'Standard-Zeit' : 'Reset'}
              </Txt>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Enter>
  );

  return (
    <Screen wide={true} contentStyle={{ maxWidth: isWide ? 1040 : 540, alignSelf: 'center', width: '100%', paddingHorizontal: Space.sm }}>
      {/* 1. MINIMAL ATHLETIC TOP BAR */}
      <Enter index={0}>
        <View style={s.athleticTopBar}>
          <View style={s.topBarLeft}>
            <Txt variant="eyebrow" color={c.textDim} style={s.dateMicro}>
              {dateLabel.toUpperCase()}
            </Txt>
            <Txt variant="title" color="#FFFFFF" style={s.screenHeadline}>
              {fast.isEating ? (lang === 'de' ? 'Essensfenster' : 'Eating Window') : (lang === 'de' ? 'Fastenuhr' : 'Fasting Clock')}
            </Txt>
          </View>

          <View style={s.topBarRight}>
            {streak > 0 && (
              <View style={[s.streakPill, { backgroundColor: c.emberWash, borderColor: c.ember }]}>
                <Icon name="flame" size={13} color={c.ember} />
                <Txt variant="eyebrow" color={c.ember} style={s.streakPillText}>
                  {streak} {lang === 'de' ? 'TAGE' : 'DAYS'}
                </Txt>
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/you/reminders')}
              style={[s.topBarIconBtn, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}
              accessibilityLabel={t('you.reminders')}
            >
              <Icon name="bell" size={16} color={c.text} />
              {streak > 0 && <View style={[s.bellDot, { backgroundColor: c.ember }]} />}
            </TouchableOpacity>
          </View>
        </View>
      </Enter>

      {/* Celebration Notification */}
      {showCelebration && (
        <Enter index={1}>
          <Tap onPress={() => setShowCelebration(false)} accessibilityLabel="Dismiss">
            <Card tone="ember" style={s.celebrationCard}>
              <Icon name="flame" size={18} color={c.ember} />
              <View style={{ flex: 1, marginLeft: Space.sm }}>
                <Txt variant="subheading" color={c.ember} style={{ fontWeight: '800', fontSize: 14 }}>
                  {lang === 'de' ? 'Fasten erfolgreich abgeschlossen! 🎉' : 'Fast completed! 🎉'}
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ marginTop: 2, fontSize: 12 }}>
                  {lang === 'de'
                    ? `${streak} Tage Fasten-Serie aktiv. Großartige Leistung!`
                    : `${streak}-day streak active. Great consistency!`}
                </Txt>
                <TouchableOpacity
                  onPress={() => setShowShareCard(true)}
                  style={{ alignSelf: 'flex-start', marginTop: 6 }}
                >
                  <Txt variant="eyebrow" color={c.ember} style={{ fontSize: 10, fontWeight: '800' }}>
                    {lang === 'de' ? '📲 STORY TEILEN' : '📲 SHARE STORY'}
                  </Txt>
                </TouchableOpacity>
              </View>
              <Icon name="close" size={16} color={c.ember} />
            </Card>
          </Tap>
        </Enter>
      )}

      {/* Layout: 2 Columns on Desktop, Clean 1 Column on Mobile */}
      {isWide ? (
        <View style={s.wideContainer}>
          <View style={s.wideCol}>{heroFastingContent}</View>
          <View style={[s.wideCol, { marginLeft: Space.base }]}>{bentoGridContent}</View>
        </View>
      ) : (
        <>
          {heroFastingContent}
          {bentoGridContent}
        </>
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

      <ShareableFastCardModal
        visible={showShareCard}
        onClose={() => setShowShareCard(false)}
        hoursFasted={hoursFasted}
        streakDays={streak}
        dishTitle={plan?.recipe.title}
        kcal={plan?.total_kcal}
        protein={plan?.protein_g}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  athleticTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.md,
    marginTop: Space.xs,
  },
  topBarLeft: {
    flex: 1,
  },
  dateMicro: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  screenHeadline: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: Space.xs,
  },
  streakPillText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  topBarIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  celebrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space.sm,
  },
  machinedHeroCard: {
    borderRadius: Radius.xl,
    padding: Space.base,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderTopColor: 'rgba(255, 255, 255, 0.16)',
    marginBottom: Space.base,
  },
  heroCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.xs,
  },
  heroBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroWindowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroWindowText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  heroActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.sm,
  },
  primaryTactileBtn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.base,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 0, 0, 0.40)',
  },
  primaryTactileText: {
    marginLeft: 6,
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  resetShiftBtn: {
    height: 48,
    paddingHorizontal: Space.base,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginLeft: Space.xs,
  },
  // --- Bento Grid ---
  bentoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: Space.base,
  },
  bentoTile: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Space.md,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  tileIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saltBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  goalPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  tileStatBlock: {
    marginVertical: 2,
  },
  tileNumber: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  tileLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0.6,
  },
  miniTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: Space.sm,
  },
  miniTrackFill: {
    height: '100%',
    borderRadius: 3,
  },
  tileActionBtn: {
    height: 34,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.16)',
  },
  tileActionText: {
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 4,
  },
  // --- Meal Banner ---
  mealBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Space.md,
    borderWidth: 1,
    marginBottom: Space.base,
  },
  mealBannerIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  mealBannerBody: {
    flex: 1,
    minWidth: 0,
  },
  mealBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  macroBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  mealBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  mealChevronCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.sm,
  },
  // --- 1-Tap Intake Banner ---
  intakeBanner: {
    borderRadius: Radius.lg,
    padding: Space.md,
    borderWidth: 1,
    marginBottom: Space.base,
  },
  intakeBannerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  intakeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  intakePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  intakePillBtn: {
    flex: 1,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  wideContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  wideCol: {
    flex: 1,
    minWidth: 0,
  },
});
