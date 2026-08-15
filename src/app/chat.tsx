import { useState, useEffect, useRef } from 'react';
import {
  View, TextInput, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Space, Radius, Type, MaxContentWidth } from '@/constants/theme';
import { Txt, Eyebrow, Tap, Markdown, useTheme, useReducedMotion } from '@/components/ui';
import type { Key } from '@/lib/i18n';
import { useLang } from '@/components/lang';
import { Icon } from '@/components/icons';
import { askCoach, conversationOf, type ChatTurn, type MealPlan, type CoachState } from '@/lib/ai';
import {
  loadProfile, loadLastPlan, loadChat, saveChat, clearChat,
  loadIntakeLog, loadWeightLog, isPremium, todayISO,
} from '@/lib/store';
import { dailyTargets } from '@/lib/nutrition';
import { measuredMaintenance, readTrend, readPlateau, weekdayPattern } from '@/lib/energy';
import type { UserProfile } from '@/lib/nutrition';

type Message = { id: string; sender: 'user' | 'ai'; text: string; failed?: boolean };

/**
 * Keys, not sentences.
 *
 * These were module constants, which is one tick before any language is
 * known — the greeting would have been fixed in English for the life of the
 * process and would not have changed when the switch was flipped.
 */
const PROMPT_KEYS: Key[] = ['coach.p1', 'coach.p2', 'coach.p3', 'coach.p4'];

/** Only offered once there is a plan the coach can actually talk about. */
const PLAN_PROMPT_KEYS: Key[] = ['coach.p5', 'coach.p6'];

/** Three dots that breathe. The only ambient motion in the app. */
function Thinking({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const v = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (reduced) return;
    const loops = v.map((val, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(val, { toValue: 1, duration: 380, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0.3, duration: 380, useNativeDriver: true }),
          Animated.delay((2 - i) * 140),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduced, v]);

  return (
    <View style={s.dots}>
      {v.map((val, i) => (
        <Animated.View key={i} style={[s.dot, { backgroundColor: color, opacity: val }]} />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const c = useTheme();
  const { lang, t } = useLang();
  const router = useRouter();
  const scroller = useRef<ScrollView>(null);

  const greeting: Message = { id: 'greeting', sender: 'ai', text: t('coach.greeting') };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [state, setState] = useState<CoachState | null>(null);
  const [restored, setRestored] = useState(false);
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    loadProfile().then(setProfile);
    loadLastPlan<MealPlan>().then((p) => setPlan(p?.date === todayISO() ? p : null));

    // What the app knows about this person, so the coach stops answering with
    // ranges when it could answer with their numbers.
    (async () => {
      const [prof, intake, weights, prem] = await Promise.all([
        loadProfile(), loadIntakeLog(), loadWeightLog(), isPremium(),
      ]);
      setPremium(prem);
      // Without premium the coach still answers, unlimited — it just answers
      // with ranges instead of this person's own figures. Saying so beats
      // silently being worse, which is what it did before.
      if (!prof || !prem) return;
      const est = dailyTargets(prof, null);
      const m = measuredMaintenance(intake, weights, est.maintenance_kcal);
      const t = readTrend(weights);
      const stall = readPlateau(intake, weights, prof.goal, 500);
      const pat = weekdayPattern(intake);
      setState({
        measured_maintenance_kcal: m.kcal,
        formula_was_off_by_kcal: m.deltaToEstimate,
        trend_kg_per_week: t.kgPerWeek,
        trend_state: t.state,
        plateau_days: stall.stalled ? stall.days : null,
        answered_days: m.intakeDays,
        weekday_pattern: pat.worst ? pat.note : null,
      });
    })();
    // The greeting is not stored; it is prepended at render.
    loadChat().then((stored) => {
      if (stored.length) setMessages(stored);
      setRestored(true);
    });
  }, []);

  const toBottom = () => setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const history: ChatTurn[] = conversationOf(messages).map((m) => ({
      role: m.sender,
      content: m.text,
    }));

    setMessages((p) => [...p, { id: `u${Date.now()}`, sender: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);
    toBottom();

    try {
      const reply = await askCoach(trimmed, history, lang, profile, plan, state);
      setMessages((p) => [...p, { id: `a${Date.now()}`, sender: 'ai', text: reply }]);
    } catch (err: any) {
      // Previously this swallowed the error and printed a canned tip, so a broken
      // API looked like a working coach giving irrelevant answers.
      setMessages((p) => [...p, {
        id: `e${Date.now()}`,
        sender: 'ai',
        text: `${err?.message || 'Could not reach the coach.'} Check your connection and try again.`,
        failed: true,
      }]);
    } finally {
      setLoading(false);
      toBottom();
    }
  };

  // Persist after every change, but never before the restore has run — an
  // early write would save the greeting-only state over a real thread.
  useEffect(() => {
    if (restored) saveChat(messages);
  }, [messages, restored]);

  const wipe = async () => {
    await clearChat();
    setMessages([]);
  };

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderBottomColor: c.line }]}>
        <Tap onPress={() => router.back()} accessibilityLabel={t('nav.back')}>
          <View style={s.back}><Icon name="chevronLeft" size={20} color={c.text} /></View>
        </Tap>
        <View style={s.flex}>
          <Txt variant="subheading">{t('coach.title')}</Txt>
          <Eyebrow numberOfLines={1}>{t('coach.disclaimer')}</Eyebrow>
        </View>
        {messages.length > 0 && (
          <Tap onPress={wipe} accessibilityLabel={t('coach.clear')}>
            <View style={s.clear}>
              <Txt variant="small" color={c.textDim}>{t('coach.clearShort')}</Txt>
            </View>
          </Tap>
        )}
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          ref={scroller}
          contentContainerStyle={s.feed}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* The greeting is prepended at render rather than stored, so it
              speaks whatever language is set right now. `conversationOf`
              already drops anything with this id, so it never reaches the
              model either way. */}
          {[greeting, ...messages].map((m) => {
            const ai = m.sender === 'ai';
            return (
              <View
                key={m.id}
                style={[
                  s.bubble,
                  ai
                    ? {
                        backgroundColor: m.failed ? 'transparent' : c.surface,
                        borderColor: m.failed ? c.negative : c.line,
                        // The coach's own voice, attributed by an edge rather
                        // than by a fill. Your messages keep the tint and the
                        // right side, which is the convention every messaging
                        // app has taught already — inverting it to add colour
                        // would cost more than the colour is worth.
                        borderLeftWidth: 3,
                        borderLeftColor: m.failed ? c.negative : c.accent,
                        alignSelf: 'flex-start',
                      }
                    : { backgroundColor: c.accentWash, borderColor: c.accentDim, alignSelf: 'flex-end' },
                ]}
              >
                {ai && !m.failed ? (
                  <Markdown text={m.text} />
                ) : (
                  <Txt variant="body" color={m.failed ? c.negative : c.text}>{m.text}</Txt>
                )}
              </View>
            );
          })}
          {loading && (
            <View
              style={[
                s.bubble,
                { backgroundColor: c.surface, borderColor: c.line, borderLeftWidth: 3, borderLeftColor: c.accent, alignSelf: 'flex-start' },
              ]}
            >
              <Thinking color={c.textDim} />
            </View>
          )}
          {messages.length === 0 && (
            <View style={s.starterGrid}>
              <Eyebrow style={{ marginBottom: Space.sm, marginTop: Space.sm }}>
                {lang === 'de' ? 'Häufige Fragen an deinen Fasten-Coach' : 'Frequent Coach Questions'}
              </Eyebrow>
              <View style={s.starterCardsRow}>
                {[
                  {
                    icon: 'drop' as const,
                    title: lang === 'de' ? 'Elektrolyte im Fasten' : 'Electrolytes in Fasting',
                    sub: lang === 'de' ? 'Wie viel Salz brauche ich wirklich?' : 'How much sodium do I need?',
                    color: '#38BDF8',
                  },
                  {
                    icon: 'plate' as const,
                    title: lang === 'de' ? 'Proteinziel erreichen' : 'Hit Protein Target',
                    sub: lang === 'de' ? '150g+ in einer OMAD-Mahlzeit?' : '150g+ in a single OMAD sitting?',
                    color: '#10B981',
                  },
                  {
                    icon: 'flame' as const,
                    title: lang === 'de' ? 'Gefastetes Training' : 'Fasted Training',
                    sub: lang === 'de' ? 'Wann ist der beste Zeitpunkt?' : 'When is the ideal window?',
                    color: '#FF6B4A',
                  },
                  {
                    icon: 'check' as const,
                    title: lang === 'de' ? 'Fastenbrechen Taktik' : 'Fast Break Tactics',
                    sub: lang === 'de' ? 'Was esse ich als Erstes?' : 'What should I eat first?',
                    color: '#8B5CF6',
                  },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.title}
                    activeOpacity={0.7}
                    onPress={() => send(`${item.title}: ${item.sub}`)}
                    style={[s.starterCard, { backgroundColor: c.surface, borderColor: c.line }]}
                  >
                    <View style={[s.starterIconBadge, { backgroundColor: `${item.color}20` }]}>
                      <Icon name={item.icon} size={15} color={item.color} />
                    </View>
                    <Txt variant="subheading" style={{ fontSize: 13, fontWeight: '700', marginTop: Space.xs }}>
                      {item.title}
                    </Txt>
                    <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 2 }}>
                      {item.sub}
                    </Txt>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* The gate that used to be invisible. The chat is unlimited either
              way; what premium buys is what it reasons with. Withholding that
              quietly meant nobody could ask for it. */}
          {restored && !premium && (
            <Tap onPress={() => router.push('/paywall')} accessibilityLabel={t('coach.knows')}>
              <View style={[s.hint, { borderColor: c.line }]}>
                <Txt variant="small" color={c.textDim}>
                  {t('coach.free')}
                </Txt>
              </View>
            </Tap>
          )}
        </ScrollView>

        {/* A horizontal ScrollView inside a column stretches to fill on
            react-native-web instead of hugging its row, which left the
            suggestions floating in the middle of an empty conversation with a
            gap above and below. flexGrow: 0 pins them to the input, where the
            thing they are suggesting actually happens. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.promptsRow}
          contentContainerStyle={s.prompts}
          keyboardShouldPersistTaps="handled"
        >
          {[...(plan ? PLAN_PROMPT_KEYS : []), ...PROMPT_KEYS].map((k) => t(k)).map((p) => (
            <Tap key={p} onPress={() => send(p)} disabled={loading} accessibilityLabel={p}>
              <View style={[s.prompt, { borderColor: c.line, backgroundColor: c.surface }]}>
                <Txt variant="small" color={c.textDim}>{p}</Txt>
              </View>
            </Tap>
          ))}
        </ScrollView>

        <View style={[s.inputBar, { borderTopColor: c.line, backgroundColor: c.bg }]}>
          <TextInput
            placeholder={t('coach.placeholder')}
            placeholderTextColor={c.textFaint}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            editable={!loading}
            multiline
            maxLength={1000}
            accessibilityLabel={t('coach.message')}
            style={[Type.body, s.input, { color: c.text, backgroundColor: c.well, borderColor: c.line }]}
          />
          <Tap onPress={() => send(input)} disabled={!input.trim() || loading} accessibilityLabel={t('coach.send')}>
            <View style={[s.send, { backgroundColor: input.trim() && !loading ? c.accent : c.well }]}>
              {loading
                ? <ActivityIndicator size="small" color={c.textDim} />
                : <Icon name="chevronRight" size={20} color={input.trim() ? c.onAccent : c.textFaint} />}
            </View>
          </Tap>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 0,
    paddingHorizontal: Space.base, paddingBottom: Space.md, borderBottomWidth: 1,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: Space.xs },
  clear: { paddingHorizontal: Space.md, paddingVertical: Space.sm },
  feed: {
    padding: Space.lg, paddingBottom: Space.sm,
    maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%',
  },
  bubble: {
    maxWidth: '88%', paddingHorizontal: Space.base, paddingVertical: Space.md,
    borderRadius: Radius.md, borderWidth: 1, marginBottom: Space.md,
  },
  hint: {
    borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed',
    paddingHorizontal: Space.base, paddingVertical: Space.md, marginBottom: Space.md,
  },
  dots: { flexDirection: 'row', alignItems: 'center', height: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  promptsRow: { flexGrow: 0 },
  prompts: { paddingHorizontal: Space.lg, paddingBottom: Space.md },
  prompt: {
    height: 36, paddingHorizontal: Space.base, borderRadius: Radius.pill,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: Space.sm,
  },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: Space.md,
    borderTopWidth: 1, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%',
  },
  input: {
    flex: 1, borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Space.base, paddingVertical: Space.md,
    maxHeight: 120, marginRight: Space.sm,
  },
  send: { width: 48, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  starterGrid: {
    marginVertical: Space.md,
  },
  starterCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  starterCard: {
    width: '48%',
    flexGrow: 1,
    padding: Space.base,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  starterIconBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
