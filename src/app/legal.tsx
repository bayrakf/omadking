import { View, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Space } from '@/constants/theme';
import { Screen, Card, Txt, Eyebrow, Enter, Tap, Divider, useTheme } from '@/components/ui';
import { Icon } from '@/components/icons';
import { OPERATOR, DATA_FLOWS, recipients, missingOperatorFields, isDraft } from '@/lib/legal';

/**
 * Imprint and privacy policy, one route with two views.
 *
 * The privacy section is rendered from `src/lib/legal.ts` rather than written
 * as prose. Prose drifts from the code and nobody notices; a list that the
 * code owns cannot quietly start lying about where data goes.
 *
 * The draft banner is deliberately impossible to miss. A legal page with
 * "TODO" where the operator's name belongs is worse than no page, and the one
 * way that ships is if nobody sees it.
 */
export default function LegalScreen() {
  const c = useTheme();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const showPrivacy = tab !== 'imprint';

  const missing = missingOperatorFields();
  const value = (v: string) => (v === 'TODO' || !v.trim() ? '—' : v);

  return (
    <Screen tabBar={false} edges={['top', 'bottom']}>
      <Enter index={0}>
        <View style={s.header}>
          <Tap onPress={() => router.back()} accessibilityLabel="Back">
            <View style={s.back}><Icon name="chevronLeft" size={20} color={c.text} /></View>
          </Tap>
          <Txt variant="subheading">{showPrivacy ? 'Datenschutz' : 'Impressum'}</Txt>
        </View>
      </Enter>

      {isDraft() && (
        <Enter index={1}>
          <Card tone="ember" style={{ marginTop: Space.md }}>
            <View style={s.rowCentre}>
              <Icon name="alert" size={18} color={c.ember} />
              <Txt variant="subheading" style={{ marginLeft: Space.sm }}>Entwurf</Txt>
            </View>
            <Txt variant="body" color={c.textDim} style={{ marginTop: Space.md }}>
              Diese Seite ist ein Entwurf und noch nicht rechtlich geprüft. Es fehlen {missing.length}{' '}
              Pflichtangaben. Vor der Veröffentlichung müssen die Angaben ergänzt und der Text von
              einer Juristin oder einem Juristen geprüft werden.
            </Txt>
          </Card>
        </Enter>
      )}

      <Enter index={2}>
        <View style={s.tabs}>
          {([['Datenschutz', true], ['Impressum', false]] as const).map(([label, isPrivacy]) => (
            <Tap
              key={label}
              onPress={() => router.setParams({ tab: isPrivacy ? 'privacy' : 'imprint' })}
              accessibilityRole="radio"
              accessibilityState={{ checked: showPrivacy === isPrivacy }}
              accessibilityLabel={label}
            >
              <View
                style={[
                  s.tab,
                  {
                    borderColor: showPrivacy === isPrivacy ? c.accent : c.line,
                    backgroundColor: showPrivacy === isPrivacy ? c.accent : 'transparent',
                  },
                ]}
              >
                <Txt variant="small" color={showPrivacy === isPrivacy ? c.onAccent : c.textDim}>
                  {label}
                </Txt>
              </View>
            </Tap>
          ))}
        </View>
      </Enter>

      {showPrivacy ? (
        <>
          <Enter index={3}>
            <Txt variant="body" color={c.textDim} style={{ marginTop: Space.lg }}>
              Ohne Konto bleibt fast alles auf deinem Gerät. Was es verlässt, steht hier vollständig —
              einschließlich der Dinge, die von selbst entstehen.
            </Txt>
          </Enter>

          <Enter index={4}>
            <Eyebrow style={s.section}>Was womit passiert</Eyebrow>
            {DATA_FLOWS.map((f, i) => (
              <Card key={f.id} style={{ marginBottom: Space.sm }}>
                <Txt variant="bodyMedium">{f.what}</Txt>
                <View style={s.metaRow}>
                  <Eyebrow>Wohin</Eyebrow>
                  <Txt variant="small" color={i === 0 ? c.positive : c.text} style={s.metaValue}>
                    {f.where}
                  </Txt>
                </View>
                <Txt variant="small" color={c.textDim} style={{ marginTop: Space.sm }}>{f.why}</Txt>
                <Txt variant="small" color={c.textFaint} style={{ marginTop: 4 }}>{f.howLong}</Txt>
              </Card>
            ))}
          </Enter>

          <Enter index={5}>
            <Eyebrow style={s.section}>Empfänger</Eyebrow>
            <Card>
              <Txt variant="body" color={c.textDim}>
                {recipients().join(', ')}. Google verarbeitet in den USA; für diese Übermittlung ist
                eine gesonderte Rechtsgrundlage erforderlich.
              </Txt>
            </Card>
          </Enter>

          <Enter index={6}>
            <Eyebrow style={s.section}>Deine Rechte</Eyebrow>
            <Card>
              <Txt variant="body" color={c.textDim}>
                Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch.
                Deine Daten liegen in der App selbst — unter „Meine Daten" kannst du sie jederzeit
                exportieren und vollständig löschen, ohne jemanden zu fragen.
              </Txt>
              <Divider style={{ marginVertical: Space.base }} />
              <Txt variant="small" color={c.textDim}>
                Für Anfragen: {value(OPERATOR.email)}
              </Txt>
              <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
                Beschwerderecht bei der österreichischen Datenschutzbehörde, Barichgasse 40–42,
                1030 Wien.
              </Txt>
            </Card>
          </Enter>
        </>
      ) : (
        <Enter index={3}>
          <Card style={{ marginTop: Space.lg }}>
            {([
              ['Verantwortlich', value(OPERATOR.name)],
              ['Anschrift', `${value(OPERATOR.street)}, ${value(OPERATOR.city)}`],
              ['Land', OPERATOR.country],
              ['E-Mail', value(OPERATOR.email)],
              ['Firmenbuch', value(OPERATOR.companyRegister)],
              ['Behörde', value(OPERATOR.authority)],
            ] as const).map(([label, v], i) => (
              <View key={label}>
                {i > 0 && <Divider />}
                <View style={s.imprintRow}>
                  <Txt variant="body" color={c.textDim}>{label}</Txt>
                  <Txt variant="bodyMedium" style={s.imprintValue}>{v}</Txt>
                </View>
              </View>
            ))}
          </Card>
          <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.base }}>
            Angaben gemäß §5 E-Commerce-Gesetz und §25 Mediengesetz.
          </Txt>
        </Enter>
      )}

      <Enter index={7}>
        <Txt variant="small" color={c.textFaint} style={s.footer}>
          OMADCoach gibt allgemeine Ernährungs- und Trainingshinweise und ist keine medizinische
          Beratung.
        </Txt>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: Space.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: Space.xs },
  rowCentre: { flexDirection: 'row', alignItems: 'center' },
  tabs: { flexDirection: 'row', marginTop: Space.lg, marginRight: -Space.sm },
  tab: {
    minHeight: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: Space.base,
    paddingVertical: 6, alignItems: 'center', justifyContent: 'center', marginRight: Space.sm,
  },
  section: { marginTop: Space.xl, marginBottom: Space.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: Space.md },
  metaValue: { marginLeft: Space.sm, flex: 1 },
  imprintRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingVertical: Space.md,
  },
  imprintValue: { flex: 1, textAlign: 'right', marginLeft: Space.base },
  footer: { marginTop: Space.xl, textAlign: 'center', lineHeight: 18 },
});
