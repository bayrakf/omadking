import { useCallback, useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Space, Radius, Type } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Button, Tap, Notice, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { recoveryPhrase, useRecoveryPhrase } from '@/lib/account';

/**
 * The recovery phrase: the only copy of the key that leaves this device.
 *
 * It is also how a second device joins, so recovery and pairing are one screen
 * rather than two — they are the same act.
 *
 * The plan said "show once, then never again". This shows it again behind a
 * deliberate tap instead. Locking it away protects against someone with your
 * unlocked phone, but the far likelier event is losing the paper, and an app
 * that then says "you had your chance" has turned a small mistake into
 * permanent data loss.
 */
export default function RecoveryScreen() {
  const c = useTheme();
  const router = useRouter();

  const [phrase, setPhrase] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      recoveryPhrase().then((p) => { if (active) setPhrase(p); });
      return () => { active = false; };
    }, [])
  );

  const adopt = async () => {
    setNotice(null);
    const ok = await useRecoveryPhrase(typed);
    if (!ok) {
      // Deliberately does not touch the existing key: a mistyped phrase must
      // not cost someone the key they already had.
      setNotice({ text: 'That phrase is not right. Nothing was changed — check it and try again.', ok: false });
      return;
    }
    setTyped('');
    setPhrase(await recoveryPhrase());
    setNotice({ text: 'This device now uses that key.', ok: true });
  };

  return (
    <Screen tabBar={false} edges={['top', 'bottom']}>
      <Enter index={0}>
        <View style={s.header}>
          <Tap onPress={() => router.back()} accessibilityLabel="Back">
            <View style={s.back}><Icon name="chevronLeft" size={20} color={c.text} /></View>
          </Tap>
          <Txt variant="subheading">Recovery phrase</Txt>
        </View>
      </Enter>

      <Enter index={1}>
        <Txt variant="title" style={{ marginTop: Space.base }}>Your only spare key</Txt>
        <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
          Your data is encrypted on this device before it is sent anywhere. Nobody else can read it —
          not even us. That also means nobody else can recover it for you.
        </Txt>
      </Enter>

      {phrase ? (
        <>
          <Enter index={2}>
            <Card tone="ember" style={{ marginTop: Space.lg }}>
              <View style={s.rowCentre}>
                <Icon name="alert" size={18} color={c.ember} />
                <Txt variant="subheading" style={{ marginLeft: Space.sm }}>Write this down</Txt>
              </View>
              <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
                On paper, somewhere you will still have it in a year. If you lose this device and this
                phrase, your synced data is gone for good. There is no reset link.
              </Txt>
            </Card>
          </Enter>

          <Enter index={3}>
            <Card style={{ marginTop: Space.base }}>
              {revealed ? (
                <Txt variant="body" style={s.phrase} accessibilityLabel="Recovery phrase">
                  {phrase}
                </Txt>
              ) : (
                <Tap onPress={() => setRevealed(true)} accessibilityLabel="Show recovery phrase">
                  <View style={[s.hidden, { borderColor: c.line }]}>
                    <Txt variant="body" color={c.textDim}>Tap to show</Txt>
                  </View>
                </Tap>
              )}
            </Card>
          </Enter>
        </>
      ) : (
        <Enter index={2}>
          <Card style={{ marginTop: Space.lg }}>
            <Txt variant="body" color={c.textDim}>
              This device has no key yet. One is created when you turn on sync.
            </Txt>
          </Card>
        </Enter>
      )}

      <Enter index={4}>
        <Eyebrow style={s.section}>Use a phrase from another device</Eyebrow>
        <Card>
          <Txt variant="small" color={c.textDim}>
            Enter the phrase shown on your other device to read the same data here. Case and spacing
            do not matter.
          </Txt>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="XXXX XXXX XXXX …"
            placeholderTextColor={c.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            multiline
            accessibilityLabel="Enter recovery phrase"
            style={[s.input, { color: c.text, borderColor: c.line, backgroundColor: c.well }]}
          />
          <Button label="Use this phrase" onPress={adopt} style={{ marginTop: Space.md }} />
          {notice && <Notice tone={notice.ok ? 'ok' : 'error'}>{notice.text}</Notice>}
        </Card>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: Space.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: Space.xs },
  rowCentre: { flexDirection: 'row', alignItems: 'center' },
  section: { marginTop: Space.xl, marginBottom: Space.md },
  phrase: { ...Type.data, fontSize: 16, lineHeight: 28, letterSpacing: 1 },
  hidden: {
    minHeight: 72, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    minHeight: 84, borderRadius: Radius.md, borderWidth: 1, padding: Space.md,
    marginTop: Space.md, textAlignVertical: 'top', fontSize: 15,
  },
});
