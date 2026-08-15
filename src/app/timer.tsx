import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Space, Radius, Type } from '@/constants/theme';
import { Screen, Txt, Eyebrow, Enter, Button, useTheme, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useLang } from '@/components/lang';
import {
  loadProfileOrDefault, loadHydration, saveHydration, markFastComplete,
  loadTodayWindowShift, type Hydration,
} from '@/lib/store';
import { fastingState, fastingStage, formatCountdown, type UserProfile, type FastingState } from '@/lib/nutrition';
import { FastingFeelingBar } from '@/components/FastingFeelingBar';
import { DailyFastingNote } from '@/components/DailyFastingNote';
import { WindowShifterModal } from '@/components/WindowShifterModal';
import { MetabolicTimelineModal } from '@/components/MetabolicTimelineModal';
import { BreakFastGuideModal } from '@/components/BreakFastGuideModal';
import { todayISO } from '@/lib/dates';

const { width } = Dimensions.get('window');
const DIAL_SIZE = Math.min(width - 48, 300);
const STROKE_WIDTH = 14;
const RADIUS = (DIAL_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function TimerScreen() {
  const c = useTheme();
  const { lang, t } = useLang();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fast, setFast] = useState<FastingState | null>(null);
  const [hydration, setHydration] = useState<Hydration>({ date: todayISO(), ml: 0, electrolytes: false });
  const [logged, setLogged] = useState(false);
  const [showShifter, setShowShifter] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showMetabolic, setShowMetabolic] = useState(false);
  const [showBreakFast, setShowBreakFast] = useState(false);

  const refresh = useCallback(async () => {
    const [p, h, shift] = await Promise.all([
      loadProfileOrDefault(),
      loadHydration(),
      loadTodayWindowShift(),
    ]);
    const effectiveProfile = shift ? { ...p, omad_window_start: shift.window_start } : p;
    setProfile(effectiveProfile);
    setHydration(h);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!profile) return;
    const tick = () => {
      const d = new Date();
      setFast(fastingState(profile, d));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [profile]);

  if (!fast || !profile) return null;

  const hoursFasted = fast.isEating ? 0 : fast.fastingHours * (fast.progressPct / 100);
  const stage = fastingStage(hoursFasted);
  const strokeDashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(100, fast.progressPct)) / 100;

  const addWater = async (ml: number) => {
    const nextH = { ...hydration, ml: Math.min(8000, hydration.ml + ml) };
    setHydration(nextH);
    await saveHydration(nextH);
  };

  const endAndLog = async () => {
    await markFastComplete();
    setLogged(true);
    setShowCelebration(true);
  };

  const closeCelebrationAndLeave = () => {
    setShowCelebration(false);
    router.push('/(tabs)');
  };

  const phaseColor =
    stage.id === 'deep'
      ? '#10B981'
      : stage.id === 'ketosis-rising'
        ? '#8B5CF6'
        : stage.id === 'glycogen-falling'
          ? '#FF6B4A'
          : '#F59E0B';

  return (
    <Screen wide>
      <Enter index={0}>
        <PageHeader
          back
          eyebrow="Live Fasten-Tracker"
          title={fast.isEating ? t('today.windowOpen') : t('today.fasting')}
          tone={fast.isEating ? 'ember' : 'accent'}
        />
      </Enter>

      {/* Hero Timer Dial */}
      <Enter index={1} style={{ alignItems: 'center', marginVertical: Space.lg }}>
        <View style={[s.dialWrap, { width: DIAL_SIZE, height: DIAL_SIZE }]}>
          <Svg width={DIAL_SIZE} height={DIAL_SIZE}>
            <Defs>
              <LinearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={fast.isEating ? c.ember : '#38BDF8'} />
                <Stop offset="1" stopColor={phaseColor} />
              </LinearGradient>
            </Defs>

            {/* Background Track */}
            <Circle
              cx={DIAL_SIZE / 2}
              cy={DIAL_SIZE / 2}
              r={RADIUS}
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={STROKE_WIDTH}
              fill="transparent"
            />

            {/* Progress Arc */}
            <Circle
              cx={DIAL_SIZE / 2}
              cy={DIAL_SIZE / 2}
              r={RADIUS}
              stroke="url(#dialGrad)"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              transform={`rotate(-90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
            />
          </Svg>

          {/* Center Content */}
          <View style={s.centerContent}>
            <View
              style={[
                s.statusBadge,
                { backgroundColor: fast.isEating ? c.emberWash : 'rgba(56, 189, 248, 0.18)' },
              ]}
            >
              <Icon
                name={fast.isEating ? 'plate' : 'flame'}
                size={14}
                color={fast.isEating ? c.ember : '#38BDF8'}
              />
              <Txt
                variant="eyebrow"
                color={fast.isEating ? c.ember : '#38BDF8'}
                style={{ marginLeft: 4, fontSize: 10, fontWeight: '800' }}
              >
                {fast.isEating ? 'ESSENSFENSTER' : 'FASTEN LÄUFT'}
              </Txt>
            </View>

            <Txt variant="hero" style={[Type.hero, s.countdownNum, { color: c.text }]}>
              {formatCountdown(fast.remainingMs)}
            </Txt>

            <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
              {fast.isEating ? `Schließt um ${fast.windowEnd}` : `Essensfenster ab ${fast.windowStart}`}
            </Txt>

            <Txt variant="data" color={phaseColor} style={{ fontSize: 12, fontWeight: '700', marginTop: 6 }}>
              {Math.round(fast.progressPct)}% abgeschlossen
            </Txt>
          </View>
        </View>

        {/* Quick Shift Button */}
        <TouchableOpacity
          onPress={() => setShowShifter(true)}
          activeOpacity={0.7}
          style={[s.shiftBtn, { backgroundColor: c.well, borderColor: c.line }]}
        >
          <Icon name="clock" size={13} color={c.accent} />
          <Txt variant="eyebrow" color={c.accent} style={{ marginLeft: 6, fontSize: 11, fontWeight: '800' }}>
            {lang === 'de' ? 'FENSTER HEUTE VERSCHIEBEN' : 'SHIFT TODAY’S WINDOW'}
          </Txt>
        </TouchableOpacity>
      </Enter>

      {/* Biological Phase Details Card */}
      <Enter index={2}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowMetabolic(true)}
          style={[s.phaseCard, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}
        >
          <View style={s.phaseHead}>
            <View style={[s.phaseIconBox, { backgroundColor: `${phaseColor}22` }]}>
              <Icon name="flame" size={18} color={phaseColor} />
            </View>
            <View style={{ flex: 1, marginLeft: Space.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Eyebrow color={phaseColor}>Biologische Stoffwechsel-Phase</Eyebrow>
                <Txt variant="eyebrow" color={c.accent} style={{ fontSize: 10, fontWeight: '800' }}>
                  24H GUIDE ›
                </Txt>
              </View>
              <Txt variant="subheading" style={{ fontSize: 16, fontWeight: '800', marginTop: 1 }}>
                {stage.label} ({hoursFasted.toFixed(1)}h gefastet)
              </Txt>
            </View>
          </View>
          <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm, lineHeight: 19 }}>
            {stage.note}
          </Txt>
        </TouchableOpacity>
      </Enter>

      {/* Quick Hydration Chips */}
      <Enter index={3}>
        <View style={[s.quickHydration, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="drop" size={16} color={c.hydro} />
              <Txt variant="subheading" style={{ fontSize: 14, marginLeft: 6 }}>Hydration heute</Txt>
            </View>
            <Txt variant="data" color={c.textDim}>{(hydration.ml / 1000).toFixed(1)} L</Txt>
          </View>
          <View style={s.waterBtnRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => addWater(250)}
              style={[s.waterBtn, { backgroundColor: c.well, borderColor: c.line }]}
            >
              <Icon name="plus" size={12} color={c.hydro} />
              <Txt variant="data" color={c.text} style={{ marginLeft: 4, fontSize: 12 }}>+250ml</Txt>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => addWater(500)}
              style={[s.waterBtn, { backgroundColor: c.well, borderColor: c.line }]}
            >
              <Icon name="plus" size={12} color={c.hydro} />
              <Txt variant="data" color={c.text} style={{ marginLeft: 4, fontSize: 12 }}>+500ml</Txt>
            </TouchableOpacity>
          </View>
        </View>
      </Enter>

      {/* Daily Feeling Logger & Journal */}
      <Enter index={4}>
        <FastingFeelingBar />
        <DailyFastingNote />
      </Enter>

      {/* Break Fast Guide Button */}
      <Enter index={5} style={{ marginBottom: Space.md }}>
        <TouchableOpacity
          onPress={() => setShowBreakFast(true)}
          activeOpacity={0.75}
          style={[s.breakFastRow, { backgroundColor: c.surface, borderColor: '#10B981' }]}
        >
          <View style={[s.breakIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Icon name="shield" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1, marginLeft: Space.sm }}>
            <Txt variant="subheading" style={{ fontSize: 14, fontWeight: '700' }}>
              {lang === 'de' ? 'Fastenbrechen-Protokoll' : 'Break-Fast Protocol'}
            </Txt>
            <Txt variant="small" color={c.textDim} style={{ fontSize: 11 }}>
              {lang === 'de' ? '3-Stufen-Regel gegen das Food-Coma' : '3 steps to prevent food coma'}
            </Txt>
          </View>
          <Icon name="chevronRight" size={16} color="#10B981" />
        </TouchableOpacity>
      </Enter>

      {/* End Fast Button */}
      <Enter index={6} style={{ marginBottom: 40 }}>
        <Button
          label={logged ? 'Fasten geloggt ✓' : 'Fasten für heute abschließen & loggen'}
          icon="check"
          tone={logged ? 'plan' : 'accent'}
          onPress={endAndLog}
        />
      </Enter>

      {/* Modals */}
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

      {/* Celebration Modal */}
      <Modal visible={showCelebration} transparent animationType="fade" onRequestClose={closeCelebrationAndLeave}>
        <View style={s.modalBackdrop}>
          <View style={[s.celebrationCard, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
            <View style={[s.flameBigBadge, { backgroundColor: c.emberWash }]}>
              <Icon name="flame" size={36} color={c.ember} />
            </View>

            <Txt variant="heading" style={{ fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: Space.md }}>
              {lang === 'de' ? 'Fasten erfolgreich beendet!' : 'Fast Completed!'}
            </Txt>
            <Txt variant="body" color={c.textDim} style={{ textAlign: 'center', marginTop: Space.xs, lineHeight: 20 }}>
              {lang === 'de'
                ? `Du hast heute ${hoursFasted.toFixed(1)} Stunden gefastet und die Stufe "${stage.label}" erreicht.`
                : `You fasted ${hoursFasted.toFixed(1)} hours today and reached the "${stage.label}" phase.`}
            </Txt>

            <View style={[s.celebrationStats, { backgroundColor: c.well, borderColor: c.line }]}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Eyebrow color={c.accent}>{lang === 'de' ? 'GEFASTET' : 'FASTED'}</Eyebrow>
                <Txt variant="heading" style={{ fontSize: 20, fontWeight: '800', marginTop: 2 }}>
                  {hoursFasted.toFixed(1)}h
                </Txt>
              </View>
              <View style={{ width: 1, height: 32, backgroundColor: c.line }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Eyebrow color={phaseColor}>{lang === 'de' ? 'PHASE' : 'PHASE'}</Eyebrow>
                <Txt variant="heading" color={phaseColor} style={{ fontSize: 20, fontWeight: '800', marginTop: 2 }}>
                  {stage.label}
                </Txt>
              </View>
            </View>

            <Button
              label={lang === 'de' ? 'Guten Appetit! (Zur Übersicht)' : 'Enjoy your meal! (Dashboard)'}
              onPress={closeCelebrationAndLeave}
              style={{ marginTop: Space.lg }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  dialWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: DIAL_SIZE - 40,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    marginBottom: Space.xs,
  },
  countdownNum: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  shiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginTop: Space.md,
  },
  phaseCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  phaseHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickHydration: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  waterBtnRow: {
    flexDirection: 'row',
    marginTop: Space.sm,
  },
  waterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: Space.xs,
  },
  breakFastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Space.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  breakIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Space.base,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Space.lg,
    alignItems: 'center',
  },
  flameBigBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.xs,
  },
  celebrationStats: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: Space.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Space.md,
  },
});
