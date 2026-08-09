/**
 * Getting your record out, and getting rid of it.
 *
 * Three doors that sound alike and are not: Export writes a file the app can
 * read back, the summary writes text a person can read, and Delete removes
 * everything. Reset is a fourth and keeps the logs. Putting them on one page
 * with their differences stated is safer than scattering them — someone who
 * confuses Reset with Delete loses months of history.
 */

import { useState } from 'react';
import { View, Platform, Alert, Share, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card, Txt, Eyebrow, Enter, Button, Tap, Divider, Notice, PageHeader, useTheme } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Space } from '@/constants/theme';
import { exportBackup, importBackup } from '@/lib/backup';
import { saveBackup, pickBackup } from '@/lib/backup-file';
import { healthSummary } from '@/lib/review';
import { currentUserId } from '@/lib/account';
import { deleteAccount } from '@/lib/sync';
import { resync } from '@/lib/notify';
import {
  loadProfileOrDefault, loadWeightLog, loadFastLog, loadIntakeLog,
  resetOnboarding, eraseEverything,
} from '@/lib/store';

export default function DataScreen() {
  const c = useTheme();
  const router = useRouter();
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const doExport = async () => {
    setNotice(null);
    const res = await saveBackup(await exportBackup());
    if (!res.ok && res.message) setNotice({ text: res.message, ok: false });
  };

  const doImport = async () => {
    setNotice(null);
    const text = await pickBackup();
    if (text == null) return;
    const res = await importBackup(text);
    if (res.ok) {
      await resync();
      setNotice({ text: 'Backup restored.', ok: true });
    } else {
      setNotice({ text: res.message, ok: false });
    }
  };

  /**
   * The same numbers as plain text, for the appointment where they are worth
   * most and reach least. A record, not a report — everything in it is read out
   * of the logs, and review.ts holds the rule that nothing interprets.
   */
  const doSummary = async () => {
    setNotice(null);
    const [profile, weights, fasts, intake] = await Promise.all([
      loadProfileOrDefault(), loadWeightLog(), loadFastLog(), loadIntakeLog(),
    ]);
    const text = healthSummary({
      windowStart: profile.omad_window_start,
      windowHours: profile.omad_window_hours,
      weights, intakeLog: intake, fastLog: fasts,
    });
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        setNotice({ text: 'Copied. Paste it wherever you need it.', ok: true });
      } catch {
        setNotice({ text: 'Could not reach the clipboard.', ok: false });
      }
    } else {
      await Share.share({ message: text });
    }
  };

  const reset = () => {
    const run = async () => { await resetOnboarding(); router.replace('/onboarding'); };
    const msg = 'This clears your profile and restarts setup. Your weight log and plans stay.';
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); return; }
    Alert.alert('Reset profile', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: run },
    ]);
  };

  /** Deletion, not reset. Everything, including the logs a reset leaves alone. */
  const eraseAll = () => {
    const run = async () => {
      // The account goes first. `eraseEverything` enumerates KEYS, and neither
      // the encryption key nor the Supabase session lives there — so erasing
      // alone left a device that could still open the server copy, and the next
      // "Sync now" unioned all of it back over the empty state.
      if (await currentUserId()) {
        if (!(await deleteAccount())) {
          setNotice({
            text: 'Could not reach the server, so nothing was deleted. Your data is untouched — try again online.',
            ok: false,
          });
          return;
        }
      }
      await eraseEverything();
      router.replace('/onboarding');
    };
    const msg =
      'This deletes everything on this device: profile, weight log, fast log, plans, shopping list '
      + 'and chat history — and, if you have one, your account and the encrypted copy on the server. '
      + 'It cannot be undone. Export first if you want a copy.';
    if (Platform.OS === 'web') { if (window.confirm(msg)) run(); return; }
    Alert.alert('Delete all data', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: run },
    ]);
  };

  return (
    <Screen tabBar={false}>
      <Enter index={0}>
        <PageHeader eyebrow="You" title="Your data" sub="It lives on this device. Take it with you or remove it." />
      </Enter>

      <Enter index={1}>
        <Card>
          <Eyebrow style={{ marginBottom: Space.sm }}>Keep a copy</Eyebrow>
          <Txt variant="small" color={c.textDim}>
            Everything lives on this device. An account is optional and only ever holds an encrypted
            copy, so a backup file is still the only copy you can read yourself.
          </Txt>
          <View style={s.dataRow}>
            <Button label="Export" variant="secondary" icon="share" onPress={doExport} style={s.dataBtn} />
            <Button label="Restore" variant="ghost" onPress={doImport} style={s.dataBtn} />
          </View>
          {/* Free, and not as a concession: the readable form of your own
              record is data portability, and charging for it would be absurd.
              Separate from Export because that file is for the app to read
              back and this text is for a person. */}
          <Button
            label="Summary for an appointment"
            variant="ghost"
            onPress={doSummary}
            style={{ marginTop: Space.sm }}
          />
          {notice && <Notice tone={notice.ok ? 'ok' : 'error'}>{notice.text}</Notice>}
        </Card>
      </Enter>

      <Enter index={2}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.sm }}>Start over</Eyebrow>
          <Button label="Reset profile" variant="ghost" onPress={reset} />
          <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
            Clears your profile and restarts setup. Your weight log and plans stay.
          </Txt>
          <Divider style={{ marginVertical: Space.base }} />
          {/* Separate from Reset on purpose: that one keeps the logs, this one
              does not, and confusing the two costs someone their history. */}
          <Tap onPress={eraseAll} accessibilityLabel="Delete all data">
            <View style={s.row}>
              <Txt variant="body" color={c.negative}>Delete all data</Txt>
              <Icon name="chevronRight" size={16} color={c.negative} />
            </View>
          </Tap>
        </Card>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.base },
  dataRow: { flexDirection: 'row', marginTop: Space.base, marginRight: -Space.sm },
  dataBtn: { flex: 1, marginRight: Space.sm },
});
