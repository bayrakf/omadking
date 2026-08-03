import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
};

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: "👋 Hi! I'm your OMAD Sports Nutrition Coach. Ask me anything about meal timing, electrolytes, or workout fueling!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    const query = input.trim();
    setInput('');
    setLoading(true);

    try {
      // Call Supabase Edge function for coaching chat or local fallback
      const { data, error } = await supabase.functions.invoke('generate_meal_plan', {
        body: { chat_prompt: query },
      });

      let aiText = "Drink plenty of water and add 500mg sodium during fasting. For evening workouts, eat your OMAD meal within 90 minutes post-workout for optimal recovery.";
      if (data && data.response) {
        aiText = data.response;
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'ai', text: aiText },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'ai', text: "Keep electrolytes high (sodium, potassium, magnesium) during fasting. Eat your high-protein OMAD meal after your evening workout." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backTxt, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>AI Nutrition Coach 🤖</Text>
      </View>

      {/* Messages Feed */}
      <ScrollView contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
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
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
      </ScrollView>

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.backgroundElement }]}>
        <TextInput
          placeholder="Ask AI Coach..."
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          style={[styles.input, { color: colors.text, backgroundColor: colors.backgroundElement }]}
        />
        <Pressable
          disabled={!input.trim() || loading}
          onPress={handleSend}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: colors.primary, opacity: pressed || !input.trim() ? 0.6 : 1 },
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
  feed: { padding: 16, gap: 12 },
  bubble: { maxWidth: '80%', padding: 14, borderRadius: 16 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  inputBar: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, alignItems: 'center' },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  sendTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
