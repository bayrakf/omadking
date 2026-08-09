/**
 * The optional account, and the two things that can be deleted.
 *
 * An account here is not an identity: anonymous sign-in yields a user id and
 * nothing else. What the server holds is a blob it cannot read. That claim is
 * the reason this screen exists as its own page rather than a paragraph on a
 * settings list — it needs the room to be said properly.
 */

import { useCallback, useState } from 'react';
import { View, Platform, Alert, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Card, Txt, Eyebrow, Enter, Button, Tap, Notice, PageHeader, useTheme } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Space } from '@/constants/theme';
import { syncNow, lastSyncedAt, deleteAccount } from '@/lib/sync';

export default function SyncScreen() {
  const c = useTheme();
  const router = useRouter();
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      lastSyncedAt().then((v) => active && setSyncedAt(v));
      return () => { active = false; };
    }, [])
  );

  const runSync = async () => {
    setNotice(null);
    setSyncing(true);
    const res = await syncNow();
    setSyncing(false);
    if (res.ok) {
      setSyncedAt(res.at);
      setNotice({ text: 'Synced.', ok: true });
    } else {
      setNotice({ text: res.message, ok: false });
    }
  };

  const removeAccount = () => {
    const run = async () => {
      const ok = await deleteAccount();
      if (ok) setSyncedAt(null);
      setNotice({
        text: ok
          ? 'Account and server copy deleted. Your data stays on this device.'
          : 'Could not reach the server.',
        ok,
      });
    };
    const msg =
      'This deletes your account and the encrypted copy on the server. Your data stays on this '
      + 'device, but other devices will no longer receive it and the recovery phrase stops working.';
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); return; }
    Alert.alert('Delete account', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen tabBar={false}>
      <Enter index={0}>
        <PageHeader eyebrow="You" title="Sync" sub="Optional, anonymous, and unreadable to the server." />
      </Enter>

      <Enter index={1}>
        <Card>
          <Eyebrow style={{ marginBottom: Space.sm }}>Sync across devices</Eyebrow>
          <Txt variant="small" color={c.textDim}>
            Your data is encrypted on this device before it is sent. The server stores a blob nobody
            can read — not us either. That also means only your recovery phrase can restore it.
          </Txt>
          <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
            {syncedAt ? `Last synced ${new Date(syncedAt).toLocaleString()}` : 'Not synced yet'}
          </Txt>
          <Button
            label={syncing ? 'Syncing…' : 'Sync now'}
            onPress={runSync}
            disabled={syncing}
            style={{ marginTop: Space.md }}
          />
          {notice && <Notice tone={notice.ok ? 'ok' : 'error'}>{notice.text}</Notice>}
          <Tap onPress={() => router.push('/recovery')} accessibilityLabel="Recovery phrase">
            <View style={s.row}>
              <Txt variant="body" color={c.textDim}>Recovery phrase</Txt>
              <Icon name="chevronRight" size={16} color={c.textFaint} />
            </View>
          </Tap>
          {syncedAt && (
            <Tap onPress={removeAccount} accessibilityLabel="Delete account">
              <View style={s.row}>
                <Txt variant="small" color={c.negative}>Delete account and server copy</Txt>
              </View>
            </Tap>
          )}
        </Card>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.base },
});
