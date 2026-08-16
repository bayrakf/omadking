import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Txt, Eyebrow, useTheme } from './ui';
import { Icon } from './icons';
import { useLang } from './lang';
import { dailyBiohack } from '@/lib/biohacks';

export function DailyBioHackCard() {
  const c = useTheme();
  const { lang } = useLang();
  const [expanded, setExpanded] = useState(false);

  const hack = dailyBiohack();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setExpanded(!expanded)}
      style={[s.card, { backgroundColor: c.surface, borderColor: c.line }]}
      accessibilityRole="button"
      accessibilityLabel={`Bio-Hack des Tages: ${lang === 'de' ? hack.titleDe : hack.titleEn}`}
    >
      <View style={s.headRow}>
        <View style={s.badgeRow}>
          <View style={[s.iconBox, { backgroundColor: c.accentWash }]}>
            <Icon name={hack.icon} size={13} color={c.accent} />
          </View>
          <View style={{ marginLeft: 8, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Eyebrow color={c.accent} style={{ fontSize: 9.5, fontWeight: '800' }}>
                {lang === 'de' ? 'BIO-HACK DES TAGES' : 'DAILY BIO-HACK'}
              </Eyebrow>
              <View style={[s.studyPill, { backgroundColor: c.well }]}>
                <Txt variant="eyebrow" color={c.textFaint} style={{ fontSize: 8 }}>
                  EVIDENCE-BASED
                </Txt>
              </View>
            </View>
            <Txt variant="heading" color={c.text} style={{ fontSize: 14, fontWeight: '700', marginTop: 1 }}>
              {lang === 'de' ? hack.titleDe : hack.titleEn}
            </Txt>
          </View>
        </View>
        <View style={{ transform: [{ rotate: expanded ? '270deg' : '90deg' }] }}>
          <Icon name="chevronRight" size={13} color={c.textDim} />
        </View>
      </View>

      {/* Core Insight */}
      <Txt variant="body" color={c.textDim} style={{ fontSize: 12.5, lineHeight: 18, marginTop: Space.xs }}>
        {lang === 'de' ? hack.insightDe : hack.insightEn}
      </Txt>

      {/* Action Point & Study Citation when expanded */}
      {expanded ? (
        <View style={[s.expandedBox, { backgroundColor: c.well, borderColor: c.line }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Icon name="check" size={13} color={c.accent} />
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Txt variant="eyebrow" color={c.accent} style={{ fontSize: 9.5, fontWeight: '800' }}>
                {lang === 'de' ? 'HANDLUNGSEMPFEHLUNG' : 'ACTION RECOMMENDATION'}
              </Txt>
              <Txt variant="body" color={c.text} style={{ fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                {lang === 'de' ? hack.actionDe : hack.actionEn}
              </Txt>
            </View>
          </View>

          <View style={[s.studyFooter, { borderTopColor: c.line }]}>
            <Icon name="shield" size={11} color={c.textFaint} />
            <Txt variant="small" color={c.textFaint} style={{ fontSize: 10, marginLeft: 4, flex: 1 }}>
              {lang === 'de' ? 'Wissenschaftliche Quelle: ' : 'Scientific Source: '}
              <Txt variant="small" color={c.textDim} style={{ fontSize: 10, fontWeight: '600' }}>
                {hack.studySource}
              </Txt>
            </Txt>
          </View>
        </View>
      ) : (
        <View style={s.tapHint}>
          <Txt variant="eyebrow" color={c.accent} style={{ fontSize: 9, fontWeight: '700' }}>
            {lang === 'de' ? 'TIPPEN FÜR PRAXIS-TIPP & STUDIEN-QUELLE' : 'TAP FOR ACTION TIP & STUDY SOURCE'}
          </Txt>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.md,
    marginTop: Space.md,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Space.sm,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studyPill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: Radius.pill,
    marginLeft: 6,
  },
  expandedBox: {
    marginTop: Space.sm,
    padding: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  studyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.sm,
    paddingTop: Space.xs,
    borderTopWidth: 1,
  },
  tapHint: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
