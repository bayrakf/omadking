import { useState } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Screen, Card, Txt, Eyebrow, Enter, Button, useTheme, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useLang } from '@/components/lang';

export default function HealthSyncScreen() {
  const c = useTheme();
  const { t } = useLang();

  const [connected, setConnected] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('Vor 12 Minuten');

  const triggerSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSyncTime('Gerade eben');
    }, 1000);
  };

  return (
    <Screen wide>
      <Enter index={0}>
        <PageHeader
          back
          eyebrow="Fitness & Sensoren"
          title={t('health.title')}
          sub={t('health.sub')}
        />

        {/* Integration Status Card */}
        <Card style={[s.statusCard, { backgroundColor: c.surfaceElevated ?? c.surface, borderColor: c.line }]}>
          <View style={s.headRow}>
            <View style={[s.iconBox, { backgroundColor: connected ? 'rgba(16, 185, 129, 0.18)' : c.well }]}>
              <Icon name="sync" size={20} color={connected ? c.positive : c.textFaint} />
            </View>
            <View style={{ flex: 1, marginLeft: Space.md }}>
              <Txt variant="subheading" style={{ fontSize: 17, fontWeight: '700' }}>
                {connected ? 'Health Connect aktiv' : 'Nicht verbunden'}
              </Txt>
              <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                {connected ? `Zuletzt synchronisiert: ${lastSyncTime}` : 'Tippe zum Verbinden'}
              </Txt>
            </View>
            <Switch
              value={connected}
              onValueChange={setConnected}
              trackColor={{ false: c.well, true: 'rgba(16, 185, 129, 0.4)' }}
              thumbColor={connected ? c.positive : c.surface}
            />
          </View>
        </Card>
      </Enter>

      {connected && (
        <>
          {/* Synced Live Metrics */}
          <Enter index={1}>
            <Eyebrow style={{ marginBottom: Space.sm, marginTop: Space.base }}>Heute synchronisiert</Eyebrow>

            <View style={s.grid}>
              {/* Steps */}
              <View style={s.tileWrap}>
                <Card style={[s.metricTile, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <View style={[s.metricIcon, { backgroundColor: c.hydroWash }]}>
                    <Icon name="flame" size={18} color="#38BDF8" />
                  </View>
                  <Txt variant="heading" style={{ fontSize: 22, fontWeight: '800', marginTop: Space.sm }}>
                    8.420
                  </Txt>
                  <Eyebrow color="#38BDF8">{t('health.steps')}</Eyebrow>
                  <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 4 }}>
                    +320 kcal Aktiv-Verbrauch
                  </Txt>
                </Card>
              </View>

              {/* Active Burn */}
              <View style={s.tileWrap}>
                <Card style={[s.metricTile, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <View style={[s.metricIcon, { backgroundColor: c.emberWash }]}>
                    <Icon name="flame" size={18} color="#FF6B4A" />
                  </View>
                  <Txt variant="heading" style={{ fontSize: 22, fontWeight: '800', marginTop: Space.sm }}>
                    480 kcal
                  </Txt>
                  <Eyebrow color="#FF6B4A">{t('health.activeBurn')}</Eyebrow>
                  <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 4 }}>
                    Herzfrequenz-Zone 2 & Training
                  </Txt>
                </Card>
              </View>

              {/* Scale Weight */}
              <View style={s.tileWrap}>
                <Card style={[s.metricTile, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <View style={[s.metricIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                    <Icon name="chart" size={18} color="#10B981" />
                  </View>
                  <Txt variant="heading" style={{ fontSize: 22, fontWeight: '800', marginTop: Space.sm }}>
                    78,4 kg
                  </Txt>
                  <Eyebrow color="#10B981">{t('health.scale')}</Eyebrow>
                  <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 4 }}>
                    Heute 07:15 Uhr importiert
                  </Txt>
                </Card>
              </View>

              {/* Sleep & Recovery */}
              <View style={s.tileWrap}>
                <Card style={[s.metricTile, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <View style={[s.metricIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                    <Icon name="moon" size={18} color="#8B5CF6" />
                  </View>
                  <Txt variant="heading" style={{ fontSize: 22, fontWeight: '800', marginTop: Space.sm }}>
                    7h 45m
                  </Txt>
                  <Eyebrow color="#8B5CF6">{t('health.sleep')}</Eyebrow>
                  <Txt variant="small" color={c.textDim} style={{ fontSize: 11, marginTop: 4 }}>
                    92% Erholungs-Score
                  </Txt>
                </Card>
              </View>
            </View>
          </Enter>

          {/* Settings & Manual Sync */}
          <Enter index={2} style={{ marginTop: Space.base }}>
            <Card style={{ backgroundColor: c.surface, borderColor: c.line, marginBottom: Space.base }}>
              <View style={s.settingRow}>
                <View style={{ flex: 1 }}>
                  <Txt variant="subheading" style={{ fontSize: 15, fontWeight: '600' }}>
                    Automatisch im Hintergrund
                  </Txt>
                  <Txt variant="small" color={c.textDim} style={{ marginTop: 2 }}>
                    Aktualisiert Kalorien-Ziele sofort bei neuen Trainings.
                  </Txt>
                </View>
                <Switch
                  value={autoSync}
                  onValueChange={setAutoSync}
                  trackColor={{ false: c.well, true: c.accentDim }}
                  thumbColor={autoSync ? c.accent : c.surface}
                />
              </View>
            </Card>

            <Button
              label={syncing ? 'Synchronisiere Daten…' : t('health.syncNow')}
              icon="sync"
              tone="plan"
              onPress={triggerSync}
            />
          </Enter>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  statusCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Space.xs,
  },
  tileWrap: {
    width: '50%',
    paddingHorizontal: Space.xs,
    marginBottom: Space.sm,
  },
  metricTile: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
