/**
 * Which language the app speaks — and, with it, the coach and the recipes.
 *
 * Following the device is its own option rather than an implied default,
 * because the two are genuinely different states: somebody who travels with a
 * German phone and wants English recipes has to be able to say so, and
 * somebody who has said nothing should keep changing with their phone.
 */

import { View, StyleSheet } from 'react-native';
import { Screen, Card, Txt, Enter, Chip, PageHeader, useTheme } from '@/components/ui';
import { useLang } from '@/components/lang';
import { LANGS } from '@/lib/i18n';
import { Space } from '@/constants/theme';

export default function LanguageScreen() {
  const c = useTheme();
  const { chosen, setLang, t } = useLang();

  return (
    <Screen tabBar={false}>
      <Enter index={0}>
        <PageHeader tone="accent" back={true} eyebrow={t('you.title')} title={t('lang.title')} sub={t('lang.sub')} />
      </Enter>

      <Enter index={1}>
        <Card>
          <View style={s.wrap}>
            <View style={s.cell}>
              <Chip
                label={t('lang.device')}
                selected={chosen === null}
                onPress={() => void setLang(null)}
              />
            </View>
            {LANGS.map((l) => (
              <View key={l.id} style={s.cell}>
                <Chip
                  label={l.endonym}
                  selected={chosen === l.id}
                  onPress={() => void setLang(l.id)}
                />
              </View>
            ))}
          </View>

          <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>
            {chosen === null ? t('lang.deviceNote') : t('lang.recipeNote')}
          </Txt>
        </Card>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  // Margins, never `gap` — see the README. The negative trailing margin on the
  // row cancels the last cell's.
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -Space.sm, marginBottom: -Space.sm },
  cell: { marginRight: Space.sm, marginBottom: Space.sm },
});
