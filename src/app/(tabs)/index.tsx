import { BreakFastGuideModal } from '@/components/BreakFastGuideModal';
import { DailyBioHackCard } from '@/components/DailyBioHackCard';
import { DailyFastingNote } from '@/components/DailyFastingNote';
import { DayBand } from '@/components/DayBand';
import { FastingFeelingBar } from '@/components/FastingFeelingBar';
import { FastingHaloDial } from '@/components/FastingHaloDial';
import { ShareableFastCardModal } from '@/components/ShareableFastCardModal';
import { Icon } from '@/components/icons';
import { useLang } from '@/components/lang';
import { MetabolicProgressBar } from '@/components/MetabolicProgressBar';
import { MetabolicTimelineModal } from '@/components/MetabolicTimelineModal';
import {
  Button,
  Card,
  Divider,
  Enter,
  Eyebrow,
  PageHeader,
  Screen,
  Tap,
  Txt,
  useTheme,
  useWide,
  washOf,
} from '@/components/ui';
import { WeekdayPillStrip } from '@/components/WeekdayPillStrip';
import { WindowShifterModal } from '@/components/WindowShifterModal';
import { Radius, Space, Type } from '@/constants/theme';
import { dayAgenda, type AgendaItem } from '@/lib/agenda';
import type { MealPlan } from '@/lib/ai';
import { formatReadableDate, longestStreak } from '@/lib/dates';
import {
  effectiveMaintenance, intakeQuestionFor, scaleJump, readiness as getReadiness,
  type IntakeQuestion, type ScaleJump, type Readiness,
} from '@/lib/energy';
import { haptic } from '@/lib/haptic';
import { setEnabled as setRemindersEnabled } from '@/lib/notify';
import {
  dailyTargets,
  DEFAULT_PROFILE,
  fastingState,
  fromMinutes,
  hydrationTargetMl, toMinutes,
  type FastingState,
  type UserProfile,
} from '@/lib/nutrition';
import { INTAKE_OPTIONS, intakeKcal, intakeLabel } from '@/lib/review';
import { playZenChime } from '@/lib/sound';
import {
  clearTodayWindowShift,
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
  markFastComplete,
  markCooked,
  markRemindersOffered,
  recordIntake,
  remindersOffered,
  saveDailySteps,
  saveHydration,
  saveProfile,
  saveTodayWindowShift,
  saveWeightLog,
  todayISO,
  type Hydration,
} from '@/lib/store';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const AGENDA_ICONS: Record<string, any> = {
  cook: 'plate',
  window_open: 'flame',
  snack: 'plate',
  meal: 'plate',
  window_close: 'moon',
  log_fast: 'check',
};

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
  const [readiness, setReadiness] = useState<Readiness | null>(null);
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
    const ready = getReadiness(intake ?? [], weights ?? []);
    setReadiness(ready);
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

  const doAction = async (kind: AgendaItem['kind']) => {
    if (kind === 'cook') {
      await markCooked(todayISO(), plan);
      setCooked(true);
      haptic('success');
    } else if (kind === 'log_fast') {
      await quickFinishFast();
    }
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
  /** Daily step goal. A round, reachable number to walk towards. */
  const STEP_GOAL = 10000;
  const stepsPct = Math.min(100, (steps / STEP_GOAL) * 100);

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

  // Phase metadata for FastingHaloDial
  const phaseInfo = hoursFasted >= 18
    ? { name: lang === 'de' ? 'Autophagie' : 'Autophagy', hue: 'plan' as const }
    : hoursFasted >= 12
    ? { name: lang === 'de' ? 'Ketose' : 'Ketosis', hue: 'accent' as const }
    : hoursFasted >= 4
    ? { name: lang === 'de' ? 'Fettstart' : 'Fat Burn', hue: 'ember' as const }
    : { name: lang === 'de' ? 'Blutzucker' : 'Glucose', hue: 'gold' as const };

  // Context-aware coaching anticipation chips
  const smartChips = fast.isEating
    ? [
        {
          id: 'coma',
          icon: 'shield' as const,
          label: lang === 'de' ? '😴 Food-Coma verhindern' : '😴 Prevent Food-Coma',
          q: lang === 'de' ? 'Wie verhindere ich Müdigkeit und Food-Coma nach meiner OMAD Mahlzeit?' : 'How do I prevent fatigue and food coma after my OMAD meal?',
        },
        {
          id: 'drink',
          icon: 'drop' as const,
          label: lang === 'de' ? '💧 Trinken nach dem Essen' : '💧 Water after eating',
          q: lang === 'de' ? 'Wann und wie viel sollte ich nach dem Fastenbrechen trinken?' : 'When and how much should I drink after breaking my fast?',
        },
      ]
    : hoursFasted >= 18
    ? [
        {
          id: 'break',
          icon: 'plate' as const,
          label: lang === 'de' ? '🥗 Optimaler 1. Bissen' : '🥗 Perfect 1st bite',
          q: lang === 'de' ? 'Was ist der beste erste Bissen nach einem 18h+ Fasten, um den Magen zu schonen?' : 'What is the best first bite after an 18h+ fast for digestion?',
        },
        {
          id: 'autophagy',
          icon: 'coach' as const,
          label: lang === 'de' ? '⚡ Autophagie-Effekt' : '⚡ Autophagy peak',
          q: lang === 'de' ? 'Welche Vorteile hat die Autophagie ab Stunde 18 wissenschaftlich?' : 'What are the scientific benefits of autophagy past hour 18?',
        },
      ]
    : hoursFasted >= 12
    ? [
        {
          id: 'salt',
          icon: 'salt' as const,
          label: lang === 'de' ? '🧂 Sofort-Trick gegen Hunger' : '🧂 Quick hunger fix',
          q: lang === 'de' ? 'Wie hilft eine Prise Salz oder Elektrolyte gegen Fasten-Hunger und Kopfschmerzen?' : 'How does a pinch of salt or electrolytes fix fasting hunger?',
        },
        {
          id: 'ketosis',
          icon: 'flame' as const,
          label: lang === 'de' ? '🔥 Ketose-Booster' : '🔥 Ketosis booster',
          q: lang === 'de' ? 'Wie kann ein leichter 15 Min Spaziergang die Ketose im Fasten beschleunigen?' : 'How does a light 15 min walk accelerate ketosis while fasting?',
        },
      ]
    : [
        {
          id: 'coffee',
          icon: 'shield' as const,
          label: lang === 'de' ? '☕ Was bricht das Fasten?' : '☕ What breaks a fast?',
          q: lang === 'de' ? 'Was bricht das Fasten wirklich? (Schwarzer Kaffee, Tee, Süßstoff, Zitrone)' : 'What actually breaks a fast? (Black coffee, tea, stevia, lemon)',
        },
        {
          id: 'focus',
          icon: 'coach' as const,
          label: lang === 'de' ? '🧠 Mentaler Fokus am Start' : '🧠 Morning focus',
          q: lang === 'de' ? 'Warum fällt das Denken beim Fastenstart oft leichter und wie nutze ich das?' : 'Why is mental clarity higher in the morning while fasting?',
        },
      ];

  const leftColumnContent = (
    <>
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

          {/* Halo Fasting Dial */}
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

          {/* DayBand 24h timeline */}
          <DayBand
            onHero
            style={{ marginTop: Space.xs }}
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
                accessibilityLabel={lang === 'de' ? 'Fasten beenden & Essen loggen' : 'End fast & log meal'}
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

      {/* CONTEXT-AWARE COACHING ANTICIPATION CHIPS */}
      <Enter index={4}>
        <View style={s.smartChipSection}>
          <Eyebrow color={c.textDim} style={{ marginBottom: Space.xs, fontSize: 10 }}>
            {lang === 'de' ? 'AKTUELLE BIO-TIPPS' : 'SMART BIO-TIPS'}
          </Eyebrow>
          <View style={s.smartChipGrid}>
            {smartChips.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/chat', params: { q: chip.q } })}
                style={[s.smartChipPill, { backgroundColor: c.surface, borderColor: c.line }]}
              >
                <Icon name={chip.icon} size={13} color={c.accent} />
                <Txt variant="body" color={c.text} numberOfLines={1} style={{ marginLeft: 6, fontSize: 12, fontWeight: '600', flex: 1 }}>
                  {chip.label}
                </Txt>
                <Icon name="chevronRight" size={11} color={c.textDim} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Enter>

      {/* 4. DAILY TRACKING — Wasser */}
      <Enter index={5}>
        <Eyebrow style={{ marginTop: Space.base, marginBottom: Space.sm }}>
          {lang === 'de' ? 'Hydration & Elektrolyte' : 'Hydration & Electrolytes'}
        </Eyebrow>

        <Card>
          <View style={s.trackHead}>
            <View style={[s.trackIcon, { backgroundColor: c.hydroWash }]}>
              <Icon name="drop" size={16} color={c.hydro} />
            </View>
            <View style={s.trackMeta}>
              <Eyebrow color={c.hydro}>{lang === 'de' ? 'Wasser' : 'Water'}</Eyebrow>
              <Txt variant="heading" style={{ fontSize: 20, marginTop: 1 }}>
                {(hydration.ml / 1000).toFixed(1)}
                <Txt variant="small" color={c.textDim}> / {(waterTarget / 1000).toFixed(1)}L</Txt>
              </Txt>
            </View>
            <TouchableOpacity
              onPress={toggleSalt}
              accessibilityLabel={lang === 'de' ? 'Elektrolyte umschalten' : 'Toggle electrolytes'}
              style={[
                s.trackSidePill,
                {
                  backgroundColor: hydration.electrolytes ? c.emberWash : c.well,
                  borderColor: hydration.electrolytes ? c.ember : 'transparent',
                },
              ]}
            >
              <Icon name="salt" size={13} color={hydration.electrolytes ? c.ember : c.textDim} />
              <Txt variant="eyebrow" color={hydration.electrolytes ? c.ember : c.textDim} style={{ marginLeft: 4 }}>
                {lang === 'de' ? 'Salz' : 'Salt'}
              </Txt>
            </TouchableOpacity>
          </View>

          <View style={[s.trackBar, { backgroundColor: c.well }]}>
            <View
              style={[
                s.trackBarFill,
                { width: `${waterPct}%`, backgroundColor: waterPct >= 100 ? c.positive : c.hydro },
              ]}
            />
          </View>

          <View style={s.trackBtnRow}>
            {[250, 500, 750].map((ml, i) => (
              <TouchableOpacity
                key={ml}
                onPress={() => addWater(ml)}
                accessibilityLabel={lang === 'de' ? `+${ml} ml Wasser` : `Add ${ml} millilitres`}
                style={[s.trackBtn, { backgroundColor: c.well, marginRight: i < 2 ? Space.sm : 0 }]}
              >
                <Icon name="plus" size={12} color={c.hydro} strokeWidth={2.2} />
                <Txt variant="data" color={c.text} style={{ marginLeft: 4, fontSize: 12.5, fontWeight: '700' }}>
                  {ml}
                </Txt>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      </Enter>

      {/* 24h Tages-Agenda Timeline */}
      <Enter index={6}>
        <Card style={{ marginTop: Space.base }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.xs }}>
            <Eyebrow color={c.accent}>{lang === 'de' ? 'Tages-Agenda' : 'Day timeline'}</Eyebrow>
          </View>
          {items.map((item, i) => {
            const dim = item.past || item.done;
            return (
              <View key={item.kind}>
                {i > 0 && <Divider style={{ marginVertical: 4 }} />}
                <Tap
                  onPress={item.actionable && !item.done ? () => doAction(item.kind) : undefined}
                  disabled={!item.actionable || item.done}
                  accessibilityRole={item.actionable ? 'button' : 'text'}
                  accessibilityLabel={item.kind === 'log_fast' && !item.done ? (lang === 'de' ? 'Fasten beenden & Essen loggen' : `Log the fast at ${item.at}`) : `${item.title} at ${item.at}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                    <Txt variant="data" color={dim ? c.textFaint : c.text} style={{ width: 48, fontSize: 13 }}>{item.at}</Txt>
                    <Icon
                      name={item.done ? 'check' : AGENDA_ICONS[item.kind] ?? 'flame'}
                      size={15}
                      color={item.done ? c.positive : dim ? c.textFaint : c.accent}
                    />
                    <View style={{ flex: 1, marginLeft: Space.sm }}>
                      <Txt
                        variant="bodyMedium"
                        color={dim ? c.textFaint : c.text}
                        style={item.done ? { textDecorationLine: 'line-through' } : undefined}
                      >
                        {item.title}
                      </Txt>
                    </View>
                    {item.actionable && !item.done && (
                      <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>
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

      {/* Calibration Readiness Countdown */}
      {readiness && !readiness.ready && (
        <Enter index={7}>
          <Card style={{ marginTop: Space.base }}>
            <Eyebrow color={c.textDim}>{t('card.calibrating')}</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
              {readiness.note}
            </Txt>
          </Card>
        </Enter>
      )}

      {/* MORNING INTAKE CHECK-IN (Only when question is active) */}
      {question && (
        <Enter index={8}>
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
                : `Roughly, against the ${questionKcal} kcal target. This is what lets the app measure what your body actually costs.`}
            </Txt>
            <View style={s.intakeGrid}>
              {INTAKE_OPTIONS.map((opt) => {
                const sel = answered?.date === question.date && answered?.factor === opt.factor;
                const cal = intakeKcal(opt.factor, questionKcal);
                return (
                  <Tap
                    key={String(opt.factor)}
                    onPress={() => answerIntake(opt.factor)}
                    accessibilityLabel={`${opt.label}, about ${cal} kcal`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    style={s.intakeCell}
                  >
                    <View
                      style={[
                        s.intakeBtn,
                        {
                          backgroundColor: sel ? c.accent : c.well,
                          borderWidth: 1,
                          borderColor: sel ? c.accent : c.line,
                        },
                      ]}
                    >
                      <Txt
                        variant="small"
                        color={sel ? c.onAccent : c.text}
                        style={{ fontSize: 12, fontWeight: '700', textAlign: 'center' }}
                      >
                        {opt.label}
                      </Txt>
                      <Eyebrow
                        color={sel ? c.onAccent : c.textFaint}
                        style={{ marginTop: 2, fontSize: 10, textAlign: 'center' }}
                      >
                        {opt.factor === 1 ? '' : '≈ '}{cal} kcal
                      </Eyebrow>
                    </View>
                  </Tap>
                );
              })}
            </View>
          </Card>
        </Enter>
      )}

      {/* ANSWERED SUMMARY CARD */}
      {answered && !question && (
        <Enter index={8}>
          <Tap
            onPress={() => setQuestion({ date: answered.date, hoursSinceClose: 0 })}
            accessibilityLabel="Change today's answer"
          >
            <Card style={{ marginTop: Space.base }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt variant="small" color={c.textDim}>
                  {answered.date === todayISO() ? 'Today' : 'Yesterday'}: {intakeLabel(answered.factor, 'en')}
                </Txt>
                <Txt variant="small" color={c.accent} style={{ fontWeight: '700' }}>
                  {lang === 'de' ? 'ändern' : 'change'}
                </Txt>
              </View>
            </Card>
          </Tap>
        </Enter>
      )}
    </>
  );

  const rightColumnContent = (
    <>
      {/* 5. HEUTIGER OMAD TELLER */}
      <Enter index={7}>
        <Tap onPress={() => router.push('/planner')} accessibilityLabel="Open meal planner">
          <Card style={{ marginTop: isWide ? 0 : Space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.plateIcon, { backgroundColor: plan ? c.planWash : c.emberWash }]}>
                <Icon name="plate" size={20} color={plan ? c.plan : c.ember} />
              </View>
              <View style={s.trackMeta}>
                <Eyebrow color={plan ? c.plan : c.ember}>
                  {lang === 'de' ? 'Heutiger OMAD Teller' : "Today's OMAD plate"}
                </Eyebrow>
                <Txt variant="subheading" color={c.text} numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', marginTop: 2 }}>
                  {plan ? plan.recipe.title : t('today.defaultMeal')}
                </Txt>
                <Txt variant="small" color={c.textDim} style={{ fontSize: 12, marginTop: 1 }}>
                  {kcal} kcal · {protein}g Protein
                </Txt>
              </View>
              <Icon name="chevronRight" size={18} color={c.textFaint} />
            </View>
          </Card>
        </Tap>
      </Enter>

      {/* Schritte & Fasted Workout */}
      <Enter index={8}>
        <Card style={{ marginTop: Space.sm }}>
          <View style={s.trackHead}>
            <View style={[s.trackIcon, { backgroundColor: c.accentWash }]}>
              <Icon name="footprints" size={16} color={c.accent} />
            </View>
            <View style={s.trackMeta}>
              <Eyebrow color={c.accent}>{lang === 'de' ? 'Schritte & Aktivität' : 'Steps & Activity'}</Eyebrow>
              <Txt variant="heading" style={{ fontSize: 20, marginTop: 1 }}>
                {steps.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')}
                <Txt variant="small" color={c.textDim}> / 10.000</Txt>
              </Txt>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/workout')}
              accessibilityLabel={lang === 'de' ? 'Zu den Workouts' : 'Open workouts'}
              style={[s.trackSidePill, { backgroundColor: c.well }]}
            >
              <Icon name="dumbbell" size={13} color={c.textDim} />
              <Txt variant="eyebrow" color={c.textDim} style={{ marginLeft: 4 }}>
                {lang === 'de' ? 'Workout' : 'Workout'}
              </Txt>
            </TouchableOpacity>
          </View>

          <View style={[s.trackBar, { backgroundColor: c.well }]}>
            <View
              style={[
                s.trackBarFill,
                { width: `${stepsPct}%`, backgroundColor: stepsPct >= 100 ? c.positive : c.accent },
              ]}
            />
          </View>

          <View style={s.trackBtnRow}>
            {[500, 1000, 2500].map((n, i) => (
              <TouchableOpacity
                key={n}
                onPress={() => addSteps(n)}
                accessibilityLabel={`+${n} Schritte`}
                style={[s.trackBtn, { backgroundColor: c.well, marginRight: i < 2 ? Space.sm : 0 }]}
              >
                <Icon name="plus" size={12} color={c.accent} strokeWidth={2.2} />
                <Txt variant="data" color={c.text} style={{ marginLeft: 4, fontSize: 12.5, fontWeight: '700' }}>
                  {n >= 1000 ? `${n / 1000}k` : n}
                </Txt>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      </Enter>

      {/* 6. DAILY SCIENTIFIC BIO-HACK */}
      <Enter index={9}>
        <DailyBioHackCard />
      </Enter>

      {/* WEIGH-IN IF NOT YET LOGGED */}
      {!weighedToday && (
        <Enter index={10}>
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

      {/* FASTING JOURNAL NOTE */}
      <Enter index={11}>
        <Card style={{ marginTop: Space.base, padding: Space.base }}>
          <DailyFastingNote embedded />
        </Card>
      </Enter>

      {/* QUICK TOOLS */}
      <Enter index={12} style={{ marginTop: Space.base, marginBottom: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.sm }}>{lang === 'de' ? 'Schnellzugriff' : 'Quick Tools'}</Eyebrow>
        <View style={s.quickToolGrid}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/grocery')}
            style={[s.quickToolCard, { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <View style={[s.quickToolIconCircle, { backgroundColor: washOf(c.plan) }]}>
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
            <View style={[s.quickToolIconCircle, { backgroundColor: washOf(c.positive) }]}>
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
            <View style={[s.quickToolIconCircle, { backgroundColor: washOf(c.accent) }]}>
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
    </>
  );

  return (
    <Screen wide={true} contentStyle={{ maxWidth: isWide ? 1080 : 640, alignSelf: 'center', width: '100%' }}>
      {/* 1. Greeting row — avatar, salutation, date */}
      <Enter index={0}>
        <View style={s.greetRow}>
          <View style={[s.avatar, { backgroundColor: c.accentWash, borderColor: c.accent }]}>
            <Icon name="flame" size={20} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="small" color={c.textDim}>{timeGreeting}!</Txt>
            <Txt variant="title" style={{ fontWeight: '800', letterSpacing: -0.4 }}>{dateLabel}</Txt>
          </View>
          <Tap onPress={() => router.push('/you/reminders')} accessibilityLabel={t('you.reminders')}>
            <View style={[s.bellBtn, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="bell" size={18} color={c.text} />
              {streak > 0 && <View style={[s.bellDot, { backgroundColor: c.ember }]} />}
            </View>
          </Tap>
        </View>
        <PageHeader
          tone={fast.isEating ? 'ember' : 'accent'}
          eyebrow={
            streak > 0
              ? (lang === 'de' ? `${streak} TAGE FASTEN-SERIE` : `${streak}-DAY FAST STREAK`)
              : undefined
          }
          title={fast.isEating ? (lang === 'de' ? `${t('today.windowOpen')} · Window open` : t('today.windowOpen')) : (lang === 'de' ? `${t('today.fasting')} · Fasting` : t('today.fasting'))}
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

      {/* Command Center Layout: 2 Columns on Wide Desktop/Tablet, 1 Column on Mobile */}
      {isWide ? (
        <View style={s.wideContainer}>
          <View style={s.wideCol}>{leftColumnContent}</View>
          <View style={[s.wideCol, { marginLeft: Space.base }]}>{rightColumnContent}</View>
        </View>
      ) : (
        <>
          {leftColumnContent}
          {rightColumnContent}
        </>
      )}

      {/* Reminder activation notice if offered */}
      {offerReminders && (
        <Enter index={13}>
          <Card style={{ marginTop: Space.base }}>
            <Eyebrow>{lang === 'de' ? 'Erinnerungen aktivieren?' : 'Want the app to tell you when?'}</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
              {lang === 'de'
                ? 'Benachrichtigungen für Start & Ende des Essensfensters, Kochbeginn und Wiege-Erinnerungen.'
                : 'Window opening and closing, when to start cooking, and a nudge to weigh in.'}
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
        <Enter index={14}>
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
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space.base,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  celebrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  zenPrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.base,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
    marginRight: Space.xs,
  },
  zenResetBtn: {
    height: 44,
    paddingHorizontal: Space.base,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Daily tracking cards (Wasser & Schritte) ---
  trackHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Space.md,
  },
  trackIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  trackMeta: {
    flex: 1,
    minWidth: 0,
  },
  trackSidePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  trackBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  trackBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  trackBtnRow: {
    flexDirection: 'row',
    marginTop: Space.md,
  },
  trackBtn: {
    flex: 1,
    height: 40,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- OMAD plate card ---
  plateIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Space.md,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
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
  wideContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  wideCol: {
    flex: 1,
    minWidth: 0,
  },
  smartChipSection: {
    marginTop: Space.sm,
    marginBottom: Space.xs,
  },
  smartChipGrid: {
    flexDirection: 'row',
    gap: Space.xs,
    flexWrap: 'wrap',
  },
  smartChipPill: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  intakeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Space.base,
    marginRight: -Space.sm,
  },
  intakeCell: {
    width: '50%',
    paddingRight: Space.sm,
    marginBottom: Space.sm,
  },
  intakeBtn: {
    minHeight: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
});
