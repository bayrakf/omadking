import React, { useState } from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Space, Radius } from '@/constants/theme';
import { Txt, Eyebrow, Button, Tap, useTheme } from './ui';
import { Icon } from './icons';

/**
 * What a crash looks like.
 *
 * expo-router's own boundary keeps the screen from going white, but it reads
 * like a stack trace with a retry button — fine for the person who wrote the
 * app, useless for the person using it.
 *
 * The technical message is kept, because "something went wrong" with nothing
 * behind it makes a bug report impossible. It just isn't the first thing on
 * the screen, and it is never sent anywhere: this renders locally and reports
 * to nobody.
 */
export default function ErrorScreen({ error, retry }: { error: Error; retry: () => void }) {
  const c = useTheme();
  const [showDetail, setShowDetail] = useState(false);

  // A message can carry whatever the throwing code put in it, so it is shown
  // only on request and never logged, sent, or persisted.
  const detail = [error?.name, error?.message].filter(Boolean).join(': ') || 'No detail available.';

  const goHome = () => {
    if (Platform.OS === 'web') window.location.assign('/');
    else retry();
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.badge, { backgroundColor: c.emberWash }]}>
          <Icon name="alert" size={22} color={c.ember} />
        </View>

        <Eyebrow style={{ marginTop: Space.lg }}>Something broke</Eyebrow>
        <Txt variant="title" style={{ marginTop: Space.sm, textAlign: 'center' }}>
          That screen stopped working
        </Txt>
        <Txt variant="body" color={c.textDim} style={s.body}>
          Your profile, plans and logs are stored on this device and are not affected. Reloading
          usually clears it.
        </Txt>

        <View style={s.actions}>
          <Button label="Reload" onPress={retry} />
          <Button label="Back to the start" variant="ghost" onPress={goHome} style={{ marginTop: Space.sm }} />
        </View>

        <Tap onPress={() => setShowDetail((v) => !v)} accessibilityLabel="Technical detail">
          <View style={s.detailToggle}>
            <Txt variant="small" color={c.textFaint}>
              {showDetail ? 'Hide technical detail' : 'Show technical detail'}
            </Txt>
            <View style={{ transform: [{ rotate: showDetail ? '-90deg' : '90deg' }], marginLeft: 4 }}>
              <Icon name="chevronRight" size={14} color={c.textFaint} />
            </View>
          </View>
        </Tap>

        {showDetail && (
          <View style={[s.detail, { backgroundColor: c.well, borderColor: c.line }]}>
            <Txt variant="small" color={c.textDim}>{detail}</Txt>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Space.xl, paddingVertical: Space.xxl,
  },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: Space.md, textAlign: 'center', maxWidth: 320, lineHeight: 22 },
  actions: { alignSelf: 'stretch', marginTop: Space.xl, maxWidth: 340, width: '100%' },
  detailToggle: { flexDirection: 'row', alignItems: 'center', marginTop: Space.xl },
  detail: {
    marginTop: Space.md, padding: Space.base, borderRadius: Radius.md, borderWidth: 1,
    alignSelf: 'stretch', maxWidth: 340,
  },
});
