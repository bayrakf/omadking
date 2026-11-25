/**
 * Shareable Fasting Milestone Card modal.
 *
 * Uses `useTheme()` polarity tokens so the share poster card reads crisply in
 * both Obsidian Carbon (dark) and Alabaster Paper (light), without emojis.
 */

import { Modal, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from './icons';
import { useLang } from './lang';
import { Eyebrow, Txt, useTheme } from './ui';
import { Font, Radius, Shadow, Space } from '@/constants/theme';
import { haptic } from '@/lib/haptic';

interface ShareableFastCardModalProps {
  visible: boolean;
  onClose: () => void;
  hoursFasted: number;
  streakDays: number;
  dishTitle?: string;
  kcal?: number;
  protein?: number;
}

export function ShareableFastCardModal({
  visible,
  onClose,
  hoursFasted,
  streakDays,
  dishTitle = 'OMAD Power Plate',
  kcal = 2200,
  protein = 150,
}: ShareableFastCardModalProps) {
  const c = useTheme();
  const { lang } = useLang();

  const hours = Math.floor(hoursFasted);
  const mins = Math.round((hoursFasted - hours) * 60);
  const fastText = `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();

  const onShare = async () => {
    haptic('success');
    const msg =
      lang === 'de'
        ? `${fastText} Fasten gemeistert! ${streakDays} Tage Streak mit OMADCoach. Heutiger Teller: ${dishTitle} (${kcal} kcal, ${protein}g Protein).`
        : `Mastered a ${fastText} fast! ${streakDays} day streak with OMADCoach. Today's plate: ${dishTitle} (${kcal} kcal, ${protein}g Protein).`;

    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(msg);
      } catch {
        // Clipboard permission unavailable
      }
      onClose();
      return;
    }

    try {
      await Share.share({ message: msg });
    } catch {
      // User dismissed native share sheet
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View
          style={[
            s.modalCard,
            { backgroundColor: c.heroFill, borderColor: c.lineStrong },
            Shadow.lifted,
          ]}
        >
          {/* Header */}
          <View style={s.topRow}>
            <View style={[s.brandBadge, { backgroundColor: c.goldWash, borderColor: c.line }]}>
              <Icon name="crown" size={13} color={c.gold} />
              <Eyebrow color={c.gold} style={{ marginLeft: 5, fontSize: 10, fontWeight: '800' }}>
                OMADCOACH
              </Eyebrow>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[s.closeBtn, { backgroundColor: c.surfaceElevated, borderColor: c.line }]}
              accessibilityLabel="Close"
            >
              <Icon name="close" size={15} color={c.textDim} />
            </TouchableOpacity>
          </View>

          {/* Poster */}
          <View style={[s.posterFrame, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={s.badgeContainer}>
              <View style={[s.streakCircle, { backgroundColor: c.emberWash, borderColor: c.ember }]}>
                <Icon name="flame" size={28} color={c.ember} />
              </View>
              <View style={[s.streakPill, { backgroundColor: c.emberWash, borderColor: c.line }]}>
                <Txt variant="eyebrow" color={c.ember} style={{ fontSize: 11, fontWeight: '800' }}>
                  {streakDays} {lang === 'de' ? 'TAGE STREAK' : 'DAY STREAK'}
                </Txt>
              </View>
            </View>

            <View style={s.statHeroBox}>
              <Eyebrow color={c.accent} style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                {lang === 'de' ? 'FASTEN GEMEISTERT' : 'FAST COMPLETED'}
              </Eyebrow>
              <Text style={[s.fastFigure, { color: c.text }]}>{fastText}</Text>
              <Txt variant="small" color={c.textDim} style={{ fontSize: 12, marginTop: 2 }}>
                {lang === 'de' ? 'Stoffwechsel & Fasten-Rhythmus aktiv' : 'Metabolic fasting rhythm active'}
              </Txt>
            </View>

            <View style={[s.plateCard, { backgroundColor: c.well, borderColor: c.line }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="plate" size={14} color={c.plan} />
                <Eyebrow color={c.plan} style={{ marginLeft: 5, fontSize: 9.5, fontWeight: '800' }}>
                  {lang === 'de' ? 'OMAD TELLER' : 'OMAD PLATE'}
                </Eyebrow>
              </View>
              <Txt variant="heading" color={c.text} numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', marginTop: 4 }}>
                {dishTitle}
              </Txt>
              <View style={s.macrosRow}>
                <Txt variant="data" color={c.gold} style={{ fontSize: 12, fontWeight: '800' }}>
                  {kcal} kcal
                </Txt>
                <Text style={[s.dotSep, { color: c.textFaint }]}>·</Text>
                <Txt variant="data" color={c.plan} style={{ fontSize: 12, fontWeight: '800' }}>
                  {protein}g Protein
                </Txt>
              </View>
            </View>

            <View style={s.footerBranding}>
              <Txt variant="eyebrow" color={c.textFaint} style={{ fontSize: 9, letterSpacing: 1.2 }}>
                OMADKING.VERCEL.APP
              </Txt>
            </View>
          </View>

          <View style={s.btnRow}>
            <TouchableOpacity
              onPress={onShare}
              activeOpacity={0.85}
              style={[s.primaryShareBtn, { backgroundColor: c.accent }]}
            >
              <Icon name="share" size={15} color={c.onAccent} />
              <Txt variant="subheading" color={c.onAccent} style={{ marginLeft: 6, fontWeight: '800', fontSize: 14 }}>
                {lang === 'de' ? 'Erfolg teilen' : 'Share milestone'}
              </Txt>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Space.base,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.md,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFrame: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.lg,
    alignItems: 'center',
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: Space.base,
  },
  streakCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakPill: {
    marginTop: Space.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statHeroBox: {
    alignItems: 'center',
    marginBottom: Space.base,
  },
  fastFigure: {
    fontFamily: Font.display,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginTop: 4,
  },
  plateCard: {
    width: '100%',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Space.md,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dotSep: {
    marginHorizontal: 6,
    fontSize: 13,
  },
  footerBranding: {
    marginTop: Space.md,
  },
  btnRow: {
    marginTop: Space.base,
  },
  primaryShareBtn: {
    height: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
