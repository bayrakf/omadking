import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Tap, Bar, Divider, NavRow, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import DayDial from '@/components/DayDial';
import {
  dailyTargets, fastingState, formatCountdown, toMinutes, DEFAULT_PROFILE,
  type UserProfile, type FastingState,
} from '@/lib/nutrition';
import {
  loadProfileOrDefault, loadHydration, saveHydration, loadFastLog, markFastComplete,
  currentStreak, loadLastPlan, todayISO, type Hydration,
} from '@/lib/store';
import type { MealPlan } from '@/lib/ai';

const WATER_TARGET_ML = 3500;

export default function DashboardScreen() {
  const router = useRouter();
  const c = useTheme();

  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [fast, setFast] = useState<FastingState | null>(null);
  const [hydration, setHydration] = useState<Hydration>({ date: todayISO(), ml: 0, electrolytes: false });
  const [streak, setStreak] = useState(0);
  const [fastLogged, setFastLogged] = useState(false);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [nowMin, setNowMin] = useState(0);
  const [dateLabel, setDateLabel] = useState('');

  useEffect(() => {
    setDateLabel(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }));
    setMounted(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, h, log, last] = await Promise.all([
          loadProfileOrDefault(), loadHydration(), loadFastLog(), loadLastPlan<MealPlan>(),
        ]);
        if (!active) return;
        setProfile(p);
        setHydration(h);
        setStreak(currentStreak(log));
        setFastLogged(log.includes(todayISO()));
        setPlan(last?.date === todayISO() ? last : null);
      })();
      return () => { active = false; };
    }, [])
  );

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setFast(fastingState(profile, d));
      setNowMin(d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [profile]);

  if (!mounted || !fast) return null;

  const baseline = dailyTargets(profile, null);
  const kcal = plan ? plan.total_kcal : baseline.kcal;
  const protein = plan ? plan.protein_g : baseline.protein_g;

  const addWater = async (ml: number) => {
    const next = { ...hydration, ml: Math.min(6000, hydration.ml + ml) };
    setHydration(next);
    await saveHydration(next);
  };
  const toggleSalt = async () => {
    const next = { ...hydration, electrolytes: !hydration.electrolytes };
    setHydration(next);
    await saveHydration(next);
  };
  const logFast = async () => {
    const log = await markFastComplete();
    setStreak(currentStreak(log));
    setFastLogged(true);
  };

  const waterPct = Math.min(100, (hydration.ml / WATER_TARGET_ML) * 100);
  const stateColor = fast.isEating ? c.ember : c.accent;

  // The eyebrow carries the day's actual shape, not a decorative kicker.
  const windowLabel =
    `${fast.windowStart}–${fast.windowEnd} · ${fast.fastingHours}H FAST` +
    (plan?.training_start_time ? ` · SESSION ${plan.training_start_time}` : '');

  return (
    <Screen>
      <Enter index={0}>
        <View style={s.head}>
          <Eyebrow>{dateLabel}</Eyebrow>
          <Txt variant="title" style={{ marginTop: Space.sm }}>
            {fast.isEating ? 'Window open' : 'Fasting'}
          </Txt>
        </View>
      </Enter>

      <Enter index={1}>
        <DayDial
          nowMin={nowMin}
          windowStartMin={toMinutes(profile.omad_window_start)}
          windowLengthMin={profile.omad_window_hours * 60}
          trainingStartMin={plan?.training_start_time ? toMinutes(plan.training_start_time) : null}
          trainingDurationMin={plan?.training_duration_min ?? 0}
          isEating={fast.isEating}
          headline={formatCountdown(fast.remainingMs)}
          caption={fast.isEating ? `left · closes ${fast.windowEnd}` : `until ${fast.windowStart}`}
        />
        <Eyebrow style={{ textAlign: 'center', marginTop: Space.base }}>{windowLabel}</Eyebrow>
      </Enter>

      <Enter index={2}>
        <Card style={{ marginTop: Space.xl }}>
          <View style={s.row}>
            <View style={s.third}>
              <Eyebrow>Energy</Eyebrow>
              <Txt variant="heading" style={s.figure}>{kcal}</Txt>
              <Txt variant="small" color={c.textFaint}>kcal</Txt>
            </View>
            <Divider style={s.vline} />
            <View style={s.third}>
              <Eyebrow>Protein</Eyebrow>
              <Txt variant="heading" style={s.figure}>{protein}</Txt>
              <Txt variant="small" color={c.textFaint}>grams</Txt>
            </View>
            <Divider style={s.vline} />
            <View style={s.third}>
              <Eyebrow>Meal at</Eyebrow>
              <Txt variant="heading" style={[s.figure, { color: stateColor }]}>
                {plan ? plan.main_meal_time : fast.windowStart}
              </Txt>
              <Txt variant="small" color={c.textFaint}>{plan ? 'planned' : 'window opens'}</Txt>
            </View>
          </View>
          <Txt variant="small" color={c.textDim} style={{ marginTop: Space.base }}>
            {plan
              ? `From today's plan${plan.training_burn_kcal > 0 ? `, including ${plan.training_burn_kcal} kcal burned training` : ''}.`
              : 'Rest-day baseline. Plan a session to fuel it properly.'}
          </Txt>
        </Card>
      </Enter>

      <Enter index={3}>
        <Button
          label={plan ? 'Update today’s plan' : 'Plan today’s meal'}
          icon="plate"
          onPress={() => router.push('/planner')}
          style={{ marginTop: Space.base }}
        />
      </Enter>

      <Enter index={4}>
        <Card style={{ marginTop: Space.base }}>
          <View style={s.cardHead}>
            <View style={s.rowCentre}>
              <Icon name="drop" size={18} color={c.accent} />
              <Txt variant="subheading" style={{ marginLeft: Space.sm }}>Hydration</Txt>
            </View>
            <Txt variant="data" color={c.textDim}>
              {(hydration.ml / 1000).toFixed(1)} / {(WATER_TARGET_ML / 1000).toFixed(1)} L
            </Txt>
          </View>

          <Bar pct={waterPct} color={c.accent} />

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

      <Enter index={5}>
        <Card style={{ marginTop: Space.base }} tone={streak > 0 ? 'ember' : 'default'}>
          <View style={s.cardHead}>
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
            <Tap onPress={logFast} disabled={fastLogged} accessibilityLabel="Log today's fast">
              <View style={[s.logBtn, {
                backgroundColor: fastLogged ? 'transparent' : c.ember,
                borderColor: fastLogged ? c.line : c.ember,
              }]}>
                <Txt variant="small" color={fastLogged ? c.textFaint : c.onAccent}>
                  {fastLogged ? 'Logged' : 'Log'}
                </Txt>
              </View>
            </Tap>
          </View>
        </Card>
      </Enter>

      <Enter index={6} style={{ marginTop: Space.xl }}>
        <Eyebrow style={{ marginBottom: Space.md }}>More</Eyebrow>
        <NavRow icon="basket" title="Shopping list" sub="Ingredients from your recent plans" onPress={() => router.push('/grocery')} />
        <NavRow icon="chart" title="Progress" sub="Weight and trend over time" onPress={() => router.push('/progress')} />
        <NavRow icon="coach" title="Coach" sub="Fasting, electrolytes and fuelling" onPress={() => router.push('/chat')} />
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { paddingTop: Space.sm, paddingBottom: Space.xl },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowCentre: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  third: { flex: 1 },
  figure: { fontSize: 26, marginTop: 6 },
  vline: { width: 1, height: 38, marginHorizontal: Space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Space.base },
  actions: { flexDirection: 'row', marginTop: Space.base, marginRight: -Space.sm },
  action: { flex: 1, marginRight: Space.sm },
  pill: { height: 40, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  logBtn: {
    paddingHorizontal: Space.base, height: 36, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
});
