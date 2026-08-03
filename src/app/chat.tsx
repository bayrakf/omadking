import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
};

const OMAD_TIPS = [
  "Sodium, potassium, and magnesium are crucial during your fasting window. Try adding a pinch of Himalayan pink salt to your water.",
  "It's best to break your fast with lean protein and easy-to-digest carbs to avoid gastrointestinal distress.",
  "Working out in a fasted state can boost fat oxidation. Just ensure you hydrate well and maybe have some black coffee pre-workout.",
  "Aim for at least 1g of protein per pound of your target body weight to preserve muscle mass on OMAD.",
  "Consistency is key! Try to keep your eating window around the same time every day for circadian rhythm alignment."
];

const QUICK_PROMPTS = [
  'Best electrolytes for fasting?',
  'When to break my fast?',
  'Pre-workout on OMAD?',
  'How much protein?'
];

const TypingIndicator = ({ color }: { color: string }) => {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);
  return <Text style={[styles.bubbleText, { color }]}>Typing{dots}</Text>;
};

export default function ChatScreen() {
  const [mounted, setMounted] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[mounted && colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [tipIndex, setTipIndex] = useState(0);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: "👋 Hi! I'm your OMAD Sports Nutrition Coach. Ask me anything about meal timing, electrolytes, or workout fueling!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    // Mock API call delay
    setTimeout(() => {
      const aiText = OMAD_TIPS[tipIndex % OMAD_TIPS.length];
      setTipIndex(prev => prev + 1);
      
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'ai', text: aiText },
      ]);
      setLoading(false);
      scrollToBottom();
    }, 1500);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>AI Nutrition Coach</Text>
      </View>

      {/* Quick Prompts */}
      <View style={styles.quickPromptsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPrompts}>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <Pressable
              key={idx}
              style={[styles.quickPromptBtn, { backgroundColor: colors.backgroundElement }]}
              onPress={() => handleSend(prompt)}
            >
              <Text style={[styles.quickPromptTxt, { color: colors.primary }]}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Messages Feed */}
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.feed} 
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => {
          const isAi = m.sender === 'ai';
          return (
            <View
              key={m.id}
              style={[
                styles.bubble,
                isAi
                  ? { backgroundColor: colors.card, alignSelf: 'flex-start' }
                  : { backgroundColor: colors.primary, alignSelf: 'flex-end' },
              ]}
            >
              <Text style={[styles.bubbleText, { color: isAi ? colors.text : '#FFFFFF' }]}>
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

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.backgroundElement }]}>
        <TextInput
          placeholder="Ask AI Coach..."
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend(input)}
          style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
        />
        <Pressable
          disabled={!input.trim() || loading}
          onPress={() => handleSend(input)}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: colors.primary, opacity: pressed || !input.trim() || loading ? 0.6 : 1 },
          ]}
        >
          <Text style={styles.sendTxt}>Send</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingRight: 12 },
  backTxt: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 40 },
  quickPromptsContainer: {
    paddingVertical: 12,
  },
  quickPrompts: {
    paddingHorizontal: 16,
    rowGap: 8, columnGap: 8,
  },
  quickPromptBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  quickPromptTxt: {
    fontSize: 14,
    fontWeight: '500',
  },
  feed: { padding: 16, rowGap: 12, columnGap: 12 },
  bubble: { maxWidth: '80%', padding: 14, borderRadius: 16 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  inputBar: { flexDirection: 'row', padding: 12, rowGap: 8, columnGap: 8, borderTopWidth: 1, alignItems: 'center' },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  sendTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
