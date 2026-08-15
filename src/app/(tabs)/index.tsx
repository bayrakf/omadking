import { useCallback, useEffect, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Tap, Bar, Divider, NavRow, Columns, PageHeader, useTheme,
} from '@/components/ui';
import { useLang } from '@/components/lang';
import { Icon, type IconName } from '@/components/icons';
import { DayBand } from '@/components/DayBand';
import {
  dailyTargets, fastingState, fastingStage, formatCountdown, hydrationTargetMl, toMinutes, DEFAULT_PROFILE,
  type UserProfile, type FastingState,
} from '@/lib/nutrition';
import { dayAgenda, minutesUntil, type AgendaItem } from '@/lib/agenda';
import {
  loadProfileOrDefault, loadHydration, saveHydration, loadFastLog, markFastComplete,
  currentStreak, loadLastPlan, loadCookLog, markCooked, loadWeightLog, saveWeightLog,
  remindersOffered, markRemindersOffered,
  saveProfile, recordIntake, loadIntakeLog, isPremium, todayISO, type Hydration,
} from '@/lib/store';
import {
  readTrend, effectiveMaintenance, intakeQuestionFor, scaleJump, readiness,
  type IntakeQuestion, type ScaleJump, type Readiness,
} from '@/lib/energy';
import { INTAKE_OPTIONS, intakeKcal, intakeLabel } from '@/lib/review';
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

  useEffect(() => {
    setDateLabel(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }));
    setMounted(true);
  }, []);

  const refresh = useCallback(async () => {
    const [p, h, fl, cl, last, weights, intake, prem] = await Promise.all([
      loadProfileOrDefault(), loadHydration(), loadFastLog(), loadCookLog(),
      loadLastPlan<MealPlan>(), loadWeightLog(), loadIntakeLog(), isPremium(),
    ]);
    setQuestion(intakeQuestionFor(p, intake));
    // Keep the answer visible instead of letting the card vanish: the measured
    // maintenance is built on these, so a mistap has to be fixable.
    // The most recent answer, whichever day it belongs to — asking about
    // yesterday while showing today's answer would be two different days on
    // one screen.
    const latest = [...(intake ?? [])].sort((a, b) => a.date.localeCompare(b.date)).pop();
    setAnswered(latest ? { date: latest.date, factor: latest.factor } : null);
    setTrend(readTrend(weights));
    setJump(scaleJump(weights, intake));
    setNeed(readiness(intake, weights));
    setMeasured(effectiveMaintenance(intake, weights, dailyTargets(p, null).maintenance_kcal, prem));
    setProfile(p);
    setHydration(h);
    setStreak(currentStreak(fl));
    setFastLogged(fl.includes(todayISO()));
    setCooked(cl.includes(todayISO()));
    setPlan(last?.date === todayISO() ? last : null);
    setWeighedToday(weights.some((w) => w.date === todayISO()));
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
  /**
   * The target the evening question is actually about.
   *
   * The question can be about yesterday — the window has to close before it
   * appears, so answering the morning after is normal — and the answer was
   * being recorded against today's plan, which yesterday may not have had.
   * Nothing stores past targets, so the rest-day baseline is the only figure
   * for a past day that is not made up.
   */
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
      setStreak(currentStreak(await markFastComplete()));
      setFastLogged(true);
      // The moment to raise reminders: the app has delivered a day and the
      // person came back to log it. Asking at launch, before anything has been
      // shown, is the fastest route to a permanent refusal — which is why
      // nothing asked at all, and why nobody had reminders on.
      if (!(await remindersOffered())) setOfferReminders(true);
    } else if (kind === 'cook') {
      // Pass the plan so the recipe joins the rotation, not just the date.
      await markCooked(todayISO(), plan);
      setCooked(true);
    }
    // A completed step should stop reminding.
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
        {/* The one badge in the app that changes colour, because the one
            thing it reports changes: cold while the fast runs, ember the
            moment the window opens. That is the whole product in a pill, and
            it is the palette's own rule rather than an exception to it. */}
        <PageHeader
          tone={fast.isEating ? 'ember' : 'accent'}
          eyebrow={dateLabel}
          title={fast.isEating ? t('today.windowOpen') : t('today.fasting')}
        />
      </Enter>

      {/* The strip rather than the ring, for one reason: the ring had nowhere
          to put the moments. Cooking, the meal and the log were listed as rows
          below it, so the timeline and the instrument were two things saying
          one thing. Here the moments are marks on the day itself, and the
          countdown — which used to sit inside the ring, where it was the
          smallest large number on the screen — leads instead. */}
      <Enter index={1}>
        <View style={[s.hero, { backgroundColor: c.heroFill }]}>
          <View style={s.heroTop}>
            <View style={[s.heroBadge, { backgroundColor: fast.isEating ? c.emberWash : 'rgba(56, 189, 248, 0.2)' }]}>
              <Icon name={fast.isEating ? 'plate' : 'flame'} size={14} color={fast.isEating ? c.ember : '#38BDF8'} />
              <Txt variant="data" color={fast.isEating ? c.ember : '#38BDF8'} style={{ marginLeft: 5, fontSize: 11, fontWeight: '700' }}>
                {fast.isEating ? 'ESSENSFENSTER' : 'FASTENLÄUFT'}
              </Txt>
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
        </View>
        <Eyebrow style={{ textAlign: 'center', marginTop: Space.base }}>{windowLabel}</Eyebrow>

        {/* Metabolic physiology stage card with rich icon and color */}
        {!fast.isEating && (
          <Card
            style={{ marginTop: Space.lg }}
            tone={
              stage.id === 'deep'
                ? 'accent'
                : stage.id === 'ketosis-rising'
                  ? 'body'
                  : stage.id === 'glycogen-falling'
                    ? 'ember'
                    : 'plan'
            }
          >
            <View style={s.stageHeader}>
              <View
                style={[
                  s.stageIconBadge,
                  {
                    backgroundColor:
                      stage.id === 'deep'
                        ? c.accentWash
                        : stage.id === 'ketosis-rising'
                          ? c.bodyWash
                          : stage.id === 'glycogen-falling'
                            ? c.emberWash
                            : c.planWash,
                  },
                ]}
              >
                <Icon
                  name={
                    stage.id === 'deep'
                      ? 'coach'
                      : stage.id === 'ketosis-rising'
                        ? 'coach'
                        : stage.id === 'glycogen-falling'
                          ? 'flame'
                          : 'drop'
                  }
                  size={18}
                  color={
                    stage.id === 'deep'
                      ? c.accent
                      : stage.id === 'ketosis-rising'
                        ? c.body
                        : stage.id === 'glycogen-falling'
                          ? c.ember
                          : c.plan
                  }
                />
              </View>
              <View style={{ flex: 1, marginLeft: Space.md }}>
                <Eyebrow>Metabolische Phase</Eyebrow>
                <Txt variant="subheading" style={{ marginTop: 2, fontWeight: '700' }}>
                  {stage.label}
                </Txt>
              </View>
            </View>
            <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm, lineHeight: 20 }}>
              {stage.note}
            </Txt>
            <Eyebrow style={{ marginTop: Space.sm }}>{t('today.approximate')}</Eyebrow>
          </Card>
        )}
      </Enter>

      {/* Asked about the day the eating window belonged to, and stays askable
          until the next one closes. The first version only offered it for six
          hours after the window shut, so anyone opening the app next morning
          lost that day without ever being asked. */}
      {question && (
        <Enter index={2}>
          <Card style={{ marginTop: Space.xl }} tone="accent">
            <Eyebrow color={c.accent}>
              {question.date === todayISO() ? 'How did today go?' : 'How did yesterday go?'}
            </Eyebrow>
            <Txt variant="body" style={{ marginTop: Space.sm }}>
              Roughly, against the {questionKcal} kcal target. This is what lets the app measure what your
              body actually costs.
            </Txt>
            {/* Kilocalories, not percent. The target is two lines above in
                kcal, so a percentage meant doing arithmetic at the one moment
                that is supposed to be a single tap. Both ends of the scale are
                open, because every closed end biases the measurement in one
                direction: a capped top records a runaway day as less than it
                was and pulls the measured maintenance down, a capped bottom
                records a day barely eaten as more and pulls it up. The options
                and the figures come from lib, not from here. */}
            {/* The cell owns the width, not the Tap. `Tap` puts its style on
                the view *inside* the Pressable, so a percentage width measured
                against a Pressable that had already collapsed to its text —
                every option came out as wide as its own label. Four options hid
                it well enough; six did not. */}
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
        <Enter index={2}>
          <Card style={{ marginTop: Space.xl }}>
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

      {/* One progress line, on the screen people actually land on. The
          countdown existed only on Progress, spread across half a dozen cards
          that each said what they could not do yet — which reads as an app
          that cannot do anything rather than one that is still counting. */}
      {need && !need.ready && (
        <Enter index={2}>
          <View style={[s.readiness, { borderColor: c.line }]}>
            <Eyebrow>Until your maintenance can be measured</Eyebrow>
            <Txt variant="small" color={c.textDim} style={{ marginTop: 4 }}>{need.note}</Txt>
          </View>
        </Enter>
      )}

      {/* An answer that cannot be corrected is worse than none here: the
          measured maintenance rests on these taps. */}
      {!question && answered && (
        <Enter index={2}>
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

      {/* The one thing to do next, rather than a restatement of state. */}
      {next && (
        <Enter index={2}>
          <Card style={{ marginTop: Space.xl }} tone={nextMins <= 60 ? 'ember' : 'accent'}>
            <View style={s.nextTop}>
              <Eyebrow color={nextColor}>
                {nextMins <= 0 ? 'Now' : nextMins < 60 ? `In ${Math.round(nextMins)} min` : `At ${next.at}`}
              </Eyebrow>
              {nextMins < 60 && <Txt variant="data" color={c.textFaint}>{next.at}</Txt>}
            </View>
            <View style={s.nextBody}>
              <Icon name={ICONS[next.kind]} size={22} color={nextColor} />
              <View style={[s.flex, { marginLeft: Space.md }]}>
                <Txt variant="heading" style={{ fontSize: 19 }}>{next.title}</Txt>
                <Txt variant="small" color={c.textDim} style={{ marginTop: 3 }}>{next.body}</Txt>
              </View>
            </View>
            {next.actionable && (
              <Button
                label={next.kind === 'cook' ? 'Mark as cooked' : 'Log it'}
                variant="secondary"
                onPress={() => doAction(next.kind)}
                style={{ marginTop: Space.base }}
              />
            )}
          </Card>
        </Enter>
      )}

      {/* Full day, so the shape of it is visible at a glance. */}
      <Enter index={3}>
        <Card style={{ marginTop: Space.base, paddingVertical: Space.sm }}>
          <Eyebrow style={{ paddingVertical: Space.md }}>{t('today.agenda')}</Eyebrow>
          {items.map((item, i) => {
            const dim = item.past || item.done;
            return (
              <View key={item.kind}>
                {i > 0 && <Divider />}
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
                      <Txt variant="small" color={c.accent}>Tick</Txt>
                    )}
                  </View>
                </Tap>
              </View>
            );
          })}
        </Card>
      </Enter>

      {/* Reference numbers, deliberately smaller than the actions above.
          Green because they are the plan's figures — the same hue the planner
          and the shopping list carry, so the three read as one subject. */}
      {/* The hero, the stage and what happens next are a sequence and stay
          in one column. From here down the cards are parallel — energy,
          water, the streak, the rest — so on a wide screen they sit
          beside each other instead of below the fold. */}
      <Columns>
      <Enter index={4}>
        <Card style={{ marginTop: Space.base }} tone="plan">
          <View style={s.statRow}>
            <View style={s.flex}>
              <Eyebrow>{t('today.energy')}</Eyebrow>
              <Txt variant="heading" style={s.figure}>{kcal}<Txt variant="small" color={c.textFaint}> kcal</Txt></Txt>
            </View>
            <Divider style={s.vline} />
            <View style={s.flex}>
              <Eyebrow>{t('today.protein')}</Eyebrow>
              <Txt variant="heading" style={s.figure}>{protein}<Txt variant="small" color={c.textFaint}> g</Txt></Txt>
            </View>
          </View>
          <Txt variant="small" color={c.textDim} style={{ marginTop: Space.md }}>
            {plan
              ? `From today's plan${plan.training_burn_kcal > 0 ? `, including ${plan.training_burn_kcal} kcal burned training` : ''}.`
              : 'Rest-day baseline. Plan a session to fuel it properly.'}
          </Txt>
          {!plan && (
            <Button label="Plan today's meal" icon="plate" onPress={() => router.push('/planner')} style={{ marginTop: Space.base }} />
          )}
        </Card>
      </Enter>

      <Enter index={5}>
        <Card style={{ marginTop: Space.base }} tone="hydro">
          <View style={s.cardHead}>
            <View style={s.rowCentre}>
              <Icon name="drop" size={18} color={c.hydro} />
              <Txt variant="subheading" style={{ marginLeft: Space.sm }}>Hydration</Txt>
            </View>
            <Txt variant="data" color={c.textDim}>
              {(hydration.ml / 1000).toFixed(1)} / {(waterTarget / 1000).toFixed(1)} L
            </Txt>
          </View>
          <Bar pct={waterPct} color={c.hydro} />
          <View style={s.actions}>
            {[250, 500].map((ml) => (
              <Tap key={ml} onPress={() => addWater(ml)} accessibilityLabel={`Add ${ml} millilitres`} style={s.action}>
                <View style={[s.pill, { backgroundColor: c.well }]}>
                  <Icon name="plus" size={14} color={c.textDim} />
                  <Txt variant="small" color={c.text} style={{ marginLeft: 5 }}>{ml} ml</Txt>
                </View>
              </Tap>
            ))}
            <Tap onPress={toggleSalt} accessibilityLabel="Electrolytes taken" style={s.action}>
              <View style={[s.pill, {
                backgroundColor: hydration.electrolytes ? c.emberWash : c.well,
                borderWidth: 1,
                borderColor: hydration.electrolytes ? c.ember : 'transparent',
              }]}>
                <Icon name={hydration.electrolytes ? 'check' : 'salt'} size={14} color={hydration.electrolytes ? c.ember : c.textDim} />
                <Txt variant="small" color={hydration.electrolytes ? c.ember : c.text} style={{ marginLeft: 5 }}>Salt</Txt>
              </View>
            </Tap>
          </View>
          {!hydration.electrolytes && !fast.isEating && (
            <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.md }}>
              Water alone through a long fast thins your sodium. Add a pinch.
            </Txt>
          )}
        </Card>
      </Enter>

      {/* Streak is now read-only: the logging action lives in the timeline. */}
      <Enter index={6}>
        <Card style={{ marginTop: Space.base }} tone={streak > 0 ? 'ember' : 'default'}>
          <View style={s.rowCentre}>
            <Icon name="flame" size={18} color={streak > 0 ? c.ember : c.textFaint} />
            <View style={{ marginLeft: Space.sm, flex: 1 }}>
              <Txt variant="subheading">
                {streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} clean` : 'No streak yet'}
              </Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                {streak > 0 ? 'Consecutive fasts completed' : 'Log your first completed fast'}
              </Txt>
            </View>
          </View>

          {!weighedToday && (
            <>
              <Divider style={{ marginVertical: Space.base }} />
              <Eyebrow style={{ marginBottom: Space.md }}>Weigh-in</Eyebrow>
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
            </>
          )}

          {/* The day someone deletes the app is the day the scale jumps. Every
              soothing app says "it's just water", which is a claim about a body
              it has not looked at. This says what that much fat would have
              cost first — arithmetic, not comfort — and names the mechanism
              second, hedged like the fasting bands. */}
          {jump && (
            <>
              <Divider style={{ marginVertical: Space.base }} />
              <Eyebrow color={c.ember}>Up {jump.kg} kg</Eyebrow>
              <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
                {jump.note}
              </Txt>
            </>
          )}

          {/* The sentence a scale cannot produce. Someone weighing daily sees a
              jump and concludes the week went wrong; the fitted line usually
              has not moved at all. */}
          {trend && trend.state !== 'insufficient' && (
            <>
              <Divider style={{ marginVertical: Space.base }} />
              <Txt variant="small" color={trend.state === 'steady' ? c.textDim : c.text}>
                {trend.note}
              </Txt>
            </>
          )}
        </Card>
      </Enter>

      <Enter index={7} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>More</Eyebrow>
        {plan && <NavRow icon="plate" tone="plan" title="Today's plan" sub={plan.recipe.title} onPress={() => router.push('/planner')} />}
        <NavRow icon="basket" tone="plan" title="Shopping list" sub="Ingredients from your recent plans" onPress={() => router.push('/grocery')} />
        <NavRow icon="chart" tone="body" title="Progress" sub="Weight and trend over time" onPress={() => router.push('/progress')} />
        <NavRow icon="coach" title="Coach" sub="Fasting, electrolytes and fuelling" onPress={() => router.push('/chat')} />
      </Enter>
      </Columns>
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

  nextTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Space.md },
  nextBody: { flexDirection: 'row', alignItems: 'flex-start' },

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
});
