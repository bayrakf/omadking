/**
 * What the app works out from everything else, read-only.
 *
 * Nothing here is editable on purpose: these are outputs. Someone who wants a
 * different number changes the input that produced it, which is one screen
 * back — and saying where each figure comes from is the difference between a
 * calculator and an oracle.
 */

import { View } from 'react-native';
import { Screen, Card, Txt, Eyebrow, Enter, Divider, PageHeader, useTheme } from '@/components/ui';
import { useProfileEditor } from '@/components/profile-fields';
import { Space } from '@/constants/theme';
import { dailyTargets, bmr } from '@/lib/nutrition';
import { useT } from '@/components/lang';

export default function TargetsScreen() {
  const t = useT();
  const c = useTheme();
  const { profile, mounted } = useProfileEditor();

  if (!mounted) return null;

  const targets = dailyTargets(profile, null);
  const resting = bmr(profile);

  const rows = [
    ['Resting metabolism', `${resting} kcal`],
    ['Rest-day maintenance', `${targets.maintenance_kcal} kcal`],
    ['Rest-day target', `${targets.kcal} kcal`],
    ['Daily protein', `${targets.protein_g} g`],
  ] as const;

  return (
    <Screen tabBar={false}>
      <Enter index={0}>
        <PageHeader tone="plan" eyebrow={t('you.title')} title={t('you.targets')} sub={t('you.targetsSub')} />
      </Enter>

      <Enter index={1}>
        <Card>
          <Eyebrow style={{ marginBottom: Space.sm }}>{t('targets.numbers')}</Eyebrow>
          {rows.map(([label, value], i) => (
            <View key={label}>
              {i > 0 && <Divider />}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.base }}>
                <Txt variant="body" color={c.textDim}>{label}</Txt>
                <Txt variant="data" color={c.text}>{value}</Txt>
              </View>
            </View>
          ))}
          <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.md }}>
            Mifflin-St Jeor. Training days add the session’s estimated burn on top.
          </Txt>
        </Card>
      </Enter>
    </Screen>
  );
}
