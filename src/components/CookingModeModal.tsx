import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Space, Radius, Font } from '@/constants/theme';
import { Txt, Eyebrow } from './ui';
import { Icon } from './icons';
import { useLang } from './lang';
import { splitSteps, scaleIngredients, splitAmount } from '@/lib/grocery';
import { playZenChime } from '@/lib/sound';
import { haptic } from '@/lib/haptic';
import type { MealPlan } from '@/lib/ai';

interface CookingModeModalProps {
  visible: boolean;
  onClose: () => void;
  plan: MealPlan;
  portions?: number;
}

export function CookingModeModal({
  visible,
  onClose,
  plan,
  portions = 1,
}: CookingModeModalProps) {
  const { lang } = useLang();

  const steps = splitSteps(plan.recipe.instructions);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);

  // Step timer state
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerInitial, setTimerInitial] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  const activeStep = steps[currentStepIdx] || '';
  const scaledIngredients = scaleIngredients(plan.recipe.ingredients, portions).map(splitAmount);

  // Detect minutes in step (e.g., "10 Min", "15 Minuten", "5 min")
  const detectedMins = extractMinutes(activeStep);

  // Timer interval
  useEffect(() => {
    let interval: any = null;
    if (timerRunning && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev !== null && prev <= 1) {
            clearInterval(interval);
            setTimerRunning(false);
            playZenChime();
            haptic('success');
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  // Reset timer when changing step
  useEffect(() => {
    setTimerRunning(false);
    if (detectedMins) {
      setTimerSeconds(detectedMins * 60);
      setTimerInitial(detectedMins * 60);
    } else {
      setTimerSeconds(null);
      setTimerInitial(null);
    }
  }, [currentStepIdx, activeStep]);

  const startTimer = (mins: number) => {
    setTimerInitial(mins * 60);
    setTimerSeconds(mins * 60);
    setTimerRunning(true);
    haptic('light');
  };

  const toggleTimer = () => {
    setTimerRunning(!timerRunning);
    haptic('light');
  };

  const resetTimer = () => {
    setTimerRunning(false);
    if (timerInitial !== null) {
      setTimerSeconds(timerInitial);
    }
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[s.container, { backgroundColor: '#070A0F' }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Eyebrow color="#10B981" style={{ fontSize: 9, fontWeight: '800' }}>
                  {lang === 'de' ? 'KOCHMODUS AKTIV' : 'KITCHEN MODE'}
                </Eyebrow>
              </View>
              <Txt variant="eyebrow" color="#94A3B8" style={{ marginLeft: 8, fontSize: 9.5 }}>
                {plan.recipe.prep_time_min} Min · {portions} {portions === 1 ? 'Portion' : 'Portionen'}
              </Txt>
            </View>
            <Txt variant="heading" color="#F8FAFC" numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', marginTop: 2 }}>
              {plan.recipe.title}
            </Txt>
          </View>

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={[s.closeBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}
          >
            <Icon name="close" size={16} color="#F8FAFC" />
          </TouchableOpacity>
        </View>

        {/* Main Content Area */}
        <View style={s.mainBody}>
          {/* Step Progress Pill Indicator */}
          <View style={s.progressRow}>
            {steps.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setCurrentStepIdx(i)}
                style={[
                  s.progressSegment,
                  {
                    backgroundColor:
                      i === currentStepIdx
                        ? '#10B981'
                        : i < currentStepIdx
                        ? 'rgba(16, 185, 129, 0.4)'
                        : 'rgba(255, 255, 255, 0.1)',
                  },
                ]}
              />
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.stepScroll}>
            {/* Step Number Badge */}
            <View style={s.stepBadgeRow}>
              <View style={s.stepNumberPill}>
                <Txt variant="eyebrow" color="#10B981" style={{ fontSize: 12, fontWeight: '900' }}>
                  {lang === 'de'
                    ? `SCHRITT ${currentStepIdx + 1} VON ${steps.length}`
                    : `STEP ${currentStepIdx + 1} OF ${steps.length}`}
                </Txt>
              </View>
            </View>

            {/* Huge Cooking Step Typography */}
            <Text style={s.stepHeroText}>{activeStep}</Text>

            {/* Integrated Step Timer (if detected) */}
            {detectedMins && (
              <View style={[s.timerCard, { backgroundColor: '#121824', borderColor: 'rgba(255, 255, 255, 0.1)' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon name="clock" size={18} color="#38BDF8" />
                    <View style={{ marginLeft: 8 }}>
                      <Eyebrow color="#38BDF8" style={{ fontSize: 10, fontWeight: '800' }}>
                        {lang === 'de' ? 'GARZEIT-TIMER' : 'COOKING TIMER'}
                      </Eyebrow>
                      <Txt variant="hero" color={timerSeconds === 0 ? '#10B981' : '#F8FAFC'} style={{ fontSize: 32, lineHeight: 36, fontWeight: '900' }}>
                        {timerSeconds !== null ? formatSecs(timerSeconds) : `${detectedMins}:00`}
                      </Txt>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {timerSeconds !== null && timerSeconds !== timerInitial && (
                      <TouchableOpacity onPress={resetTimer} style={s.timerSecBtn}>
                        <Txt variant="eyebrow" color="#94A3B8">Reset</Txt>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={timerRunning ? toggleTimer : () => startTimer(detectedMins)}
                      activeOpacity={0.8}
                      style={[
                        s.timerActionBtn,
                        { backgroundColor: timerRunning ? '#EF4444' : '#38BDF8' },
                      ]}
                    >
                      <Icon name="clock" size={14} color="#080C14" />
                      <Txt variant="subheading" color="#080C14" style={{ marginLeft: 4, fontSize: 13, fontWeight: '800' }}>
                        {timerRunning ? (lang === 'de' ? 'Pause' : 'Pause') : (lang === 'de' ? 'Starten' : 'Start')}
                      </Txt>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Ingredients Drawer Button */}
            <TouchableOpacity
              onPress={() => setShowIngredients(!showIngredients)}
              activeOpacity={0.8}
              style={[s.ingredientsToggle, { backgroundColor: '#182030', borderColor: 'rgba(255, 255, 255, 0.08)' }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="basket" size={15} color="#10B981" />
                <Txt variant="subheading" color="#F8FAFC" style={{ marginLeft: 6, fontSize: 13, fontWeight: '700' }}>
                  {lang === 'de' ? 'Zutatenliste für diesen Kochschritt' : 'Ingredients List'}
                </Txt>
              </View>
              <Icon name="chevronRight" size={14} color="#94A3B8" />
            </TouchableOpacity>

            {showIngredients && (
              <View style={[s.ingredientsCard, { backgroundColor: '#101520', borderColor: 'rgba(255, 255, 255, 0.06)' }]}>
                {scaledIngredients.map((item, idx) => (
                  <View key={idx} style={s.ingredientRow}>
                    <View style={s.ingDot} />
                    <Txt variant="body" color="#F8FAFC" style={{ flex: 1, fontSize: 13 }}>
                      {item.name}
                    </Txt>
                    {item.amount && (
                      <Txt variant="data" color="#10B981" style={{ fontSize: 13, fontWeight: '700' }}>
                        {item.amount}
                      </Txt>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>

        {/* Big Touch Target Bottom Navigation */}
        <View style={[s.footer, { borderTopColor: 'rgba(255, 255, 255, 0.08)' }]}>
          <TouchableOpacity
            disabled={currentStepIdx === 0}
            onPress={() => {
              if (currentStepIdx > 0) {
                setCurrentStepIdx(currentStepIdx - 1);
                haptic('light');
              }
            }}
            style={[
              s.navBtn,
              s.prevBtn,
              { opacity: currentStepIdx === 0 ? 0.3 : 1 },
            ]}
          >
            <Icon name="chevronLeft" size={16} color="#F8FAFC" />
            <Txt variant="subheading" color="#F8FAFC" style={{ marginLeft: 4, fontWeight: '700' }}>
              {lang === 'de' ? 'Zurück' : 'Back'}
            </Txt>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (currentStepIdx < steps.length - 1) {
                setCurrentStepIdx(currentStepIdx + 1);
                haptic('light');
              } else {
                playZenChime();
                haptic('success');
                onClose();
              }
            }}
            style={[s.navBtn, s.nextBtn, { backgroundColor: '#10B981' }]}
          >
            <Txt variant="subheading" color="#FFFFFF" style={{ marginRight: 4, fontWeight: '800' }}>
              {currentStepIdx === steps.length - 1
                ? lang === 'de'
                  ? 'Fertig gekocht! 🎉'
                  : 'Finished Cooking! 🎉'
                : lang === 'de'
                ? 'Nächster Schritt'
                : 'Next Step'}
            </Txt>
            {currentStepIdx < steps.length - 1 && (
              <Icon name="chevronRight" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function extractMinutes(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:-|–|\s)?\s*(?:minuten|minute|min)/i);
  if (match && match[1]) {
    const n = parseInt(match[1], 10);
    return isNaN(n) || n <= 0 || n > 180 ? null : n;
  }
  return null;
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderBottomWidth: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBody: {
    flex: 1,
    paddingHorizontal: Space.lg,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: Space.md,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepScroll: {
    paddingBottom: 40,
  },
  stepBadgeRow: {
    flexDirection: 'row',
    marginBottom: Space.md,
  },
  stepNumberPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  stepHeroText: {
    fontSize: 24,
    lineHeight: 34,
    fontFamily: Font.bodySemi,
    color: '#F8FAFC',
    letterSpacing: -0.3,
  },
  timerCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginTop: Space.xl,
  },
  timerSecBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  timerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  ingredientsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Space.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginTop: Space.lg,
  },
  ingredientsCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Space.md,
    marginTop: Space.xs,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  ingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.base,
    borderTopWidth: 1,
  },
  navBtn: {
    height: 52,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.lg,
  },
  prevBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  nextBtn: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
});
