import React, { useState, useEffect, useRef } from 'react';
import {
  View, TextInput, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Space, Radius, Type, MaxContentWidth } from '@/constants/theme';
import { Txt, Eyebrow, Tap, Markdown, useTheme, useReducedMotion } from '@/components/ui';
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

const PROMPTS = [
  'Best electrolytes for a long fast?',
  'Why do I crash mid-session?',
  'Pre-workout on OMAD?',
  'How much protein do I need?',
];

/** Only offered once there is a plan the coach can actually talk about. */
const PLAN_PROMPTS = ['Is tonight’s meal enough?', 'Can I swap an ingredient?'];

const GREETING: Message = {
  id: 'greeting',
  sender: 'ai',
  text: 'Ask me about meal timing, electrolytes, or fuelling a hard session on one meal a day.',
};

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
  const router = useRouter();
  const scroller = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([GREETING]);
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
    // The greeting stays at the top; restored messages follow it.
    loadChat().then((stored) => {
      if (stored.length) setMessages([GREETING, ...stored]);
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
      const reply = await askCoach(trimmed, history, profile, plan, state);
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
    setMessages([GREETING]);
  };

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: c.bg }]} edges={['top', 'bottom']}>
      <View style={[s.header, { borderBottomColor: c.line }]}>
        <Tap onPress={() => router.back()} accessibilityLabel="Back">
          <View style={s.back}><Icon name="chevronLeft" size={20} color={c.text} /></View>
        </Tap>
        <View style={s.flex}>
          <Txt variant="subheading">Coach</Txt>
          <Eyebrow numberOfLines={1}>Not medical advice</Eyebrow>
        </View>
        {messages.length > 1 && (
          <Tap onPress={wipe} accessibilityLabel="Clear conversation">
            <View style={s.clear}>
              <Txt variant="small" color={c.textDim}>Clear</Txt>
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
          {messages.map((m) => {
            const ai = m.sender === 'ai';
            return (
              <View
                key={m.id}
                style={[
                  s.bubble,
                  ai
                    ? { backgroundColor: m.failed ? 'transparent' : c.surface, borderColor: m.failed ? c.negative : c.line, alignSelf: 'flex-start' }
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
            <View style={[s.bubble, { backgroundColor: c.surface, borderColor: c.line, alignSelf: 'flex-start' }]}>
              <Thinking color={c.textDim} />
            </View>
          )}
          {/* The gate that used to be invisible. The chat is unlimited either
              way; what premium buys is what it reasons with. Withholding that
              quietly meant nobody could ask for it. */}
          {restored && !premium && (
            <Tap onPress={() => router.push('/paywall')} accessibilityLabel="What the coach could know">
              <View style={[s.hint, { borderColor: c.line }]}>
                <Txt variant="small" color={c.textDim}>
                  Answers use general ranges. With Premium the coach reasons with your measured
                  maintenance, your trend and your weekday pattern instead.
                </Txt>
              </View>
            </Tap>
          )}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.prompts}
          keyboardShouldPersistTaps="handled"
        >
          {[...(plan ? PLAN_PROMPTS : []), ...PROMPTS].map((p) => (
            <Tap key={p} onPress={() => send(p)} disabled={loading} accessibilityLabel={p}>
              <View style={[s.prompt, { borderColor: c.line, backgroundColor: c.surface }]}>
                <Txt variant="small" color={c.textDim}>{p}</Txt>
              </View>
            </Tap>
          ))}
        </ScrollView>

        <View style={[s.inputBar, { borderTopColor: c.line, backgroundColor: c.bg }]}>
          <TextInput
            placeholder="Ask the coach"
            placeholderTextColor={c.textFaint}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            editable={!loading}
            multiline
            maxLength={1000}
            accessibilityLabel="Message"
            style={[Type.body, s.input, { color: c.text, backgroundColor: c.well, borderColor: c.line }]}
          />
          <Tap onPress={() => send(input)} disabled={!input.trim() || loading} accessibilityLabel="Send">
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
});
