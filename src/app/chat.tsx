import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, MaxContentWidth } from '@/constants/theme';
import { askCoach, type ChatTurn } from '@/lib/ai';
import { loadProfile } from '@/lib/store';
import type { UserProfile } from '@/lib/nutrition';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  failed?: boolean;
};

const QUICK_PROMPTS = [
  'Best electrolytes for fasting?',
  'When should I break my fast?',
  'Pre-workout on OMAD?',
  'How much protein do I need?',
  'Why do I crash mid-workout?',
];

const GREETING: Message = {
  id: 'greeting',
  sender: 'ai',
  text: "👋 I'm your OMAD nutrition coach. Ask me about meal timing, electrolytes, or how to fuel a hard session on one meal a day.",
};

function TypingIndicator({ color }: { color: string }) {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const interval = setInterval(() => setDots((p) => (p.length >= 3 ? '.' : p + '.')), 400);
    return () => clearInterval(interval);
  }, []);
  return <Text style={[styles.bubbleText, { color }]}>Thinking{dots}</Text>;
}

export default function ChatScreen() {
  const [mounted, setMounted] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[mounted && colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    setMounted(true);
    loadProfile().then(setProfile);
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 60);
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const historyBefore: ChatTurn[] = messages
      .filter((m) => m.id !== 'greeting' && !m.failed)
      .map((m) => ({ role: m.sender, content: m.text }));

    setMessages((prev) => [...prev, { id: `u${Date.now()}`, sender: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const reply = await askCoach(trimmed, historyBefore, profile);
      setMessages((prev) => [...prev, { id: `a${Date.now()}`, sender: 'ai', text: reply }]);
    } catch (err: any) {
      // Previously this swallowed the error and printed a canned tip, so a broken
      // API looked like a working coach giving irrelevant answers.
      setMessages((prev) => [
        ...prev,
        {
          id: `e${Date.now()}`,
          sender: 'ai',
          text: `⚠️ ${err?.message || 'Could not reach the coach.'} Check your connection and try again.`,
          failed: true,
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  if (!mounted) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={[styles.backTxt, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>AI Nutrition Coach</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m) => {
            const isAi = m.sender === 'ai';
            return (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  isAi
                    ? {
                        backgroundColor: m.failed ? 'rgba(239,68,68,0.12)' : colors.card,
                        alignSelf: 'flex-start',
                      }
                    : { backgroundColor: colors.primary, alignSelf: 'flex-end' },
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    { color: isAi ? (m.failed ? colors.danger : colors.text) : '#FFFFFF' },
                  ]}
                >
                  {m.text}
                </Text>
              </View>
            );
          })}
          {loading && (
            <View style={[styles.bubble, { backgroundColor: colors.card, alignSelf: 'flex-start' }]}>
              <TypingIndicator color={colors.textSecondary} />
            </View>
          )}
        </ScrollView>

        {/* Suggestions sit above the input so they stay reachable one-handed. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPrompts}
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_PROMPTS.map((prompt) => (
            <Pressable
              key={prompt}
              style={[styles.quickPromptBtn, { backgroundColor: colors.backgroundElement }]}
              onPress={() => handleSend(prompt)}
              disabled={loading}
              accessibilityRole="button"
            >
              <Text style={[styles.quickPromptTxt, { color: colors.primary }]}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.backgroundElement }]}>
          <TextInput
            placeholder="Ask the coach…"
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSend(input)}
            editable={!loading}
            multiline
            maxLength={1000}
            style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
            accessibilityLabel="Message to coach"
          />
          <Pressable
            disabled={!input.trim() || loading}
            onPress={() => handleSend(input)}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed || !input.trim() || loading ? 0.5 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.sendTxt}>Send</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
        General nutrition guidance, not medical advice.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { minWidth: 64, paddingVertical: 4 },
  backTxt: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  feed: { padding: 16, paddingBottom: 8, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%' },
  quickPrompts: { paddingHorizontal: 16, paddingVertical: 10 },
  quickPromptBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  quickPromptTxt: { fontSize: 13, fontWeight: '600' },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 10 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    marginRight: 8,
  },
  sendBtn: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minWidth: 72,
    alignItems: 'center',
  },
  sendTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disclaimer: { fontSize: 11, textAlign: 'center', paddingBottom: 6, paddingHorizontal: 16 },
});
