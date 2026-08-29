import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native';
import { Space, Radius, Font } from '@/constants/theme';
import { Txt, Eyebrow } from './ui';
import { Icon } from './icons';
import { useLang } from './lang';
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
  kcal = 1850,
  protein = 135,
}: ShareableFastCardModalProps) {
  const { lang } = useLang();

  const hours = Math.floor(hoursFasted);
  const mins = Math.round((hoursFasted - hours) * 60);
  const fastText = `${hours}h ${mins > 0 ? `${mins}m` : ''}`;

  const onShare = async () => {
    haptic('success');
    const msg =
      lang === 'de'
        ? `🔥 ${fastText} Fasten gemeistert! ${streakDays} Tage Streak mit @OMADKing.`
        : `🔥 Mastered a ${fastText} fast! ${streakDays} day streak with @OMADKing.`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'OMADKing Fasting Streak',
          text: msg,
          url: window.location.origin,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await Share.share({
        message: msg,
        title: 'OMADKing Fasting Streak',
      });
    } catch {
      // ignore
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.backdrop}>
        <View style={[s.modalCard, { backgroundColor: '#0A0D14', borderColor: 'rgba(255, 255, 255, 0.12)' }]}>
          {/* Header */}
          <View style={s.topRow}>
            <View style={s.brandBadge}>
              <Icon name="crown" size={13} color="#F59E0B" />
              <Eyebrow color="#F59E0B" style={{ marginLeft: 4, fontSize: 10, fontWeight: '900' }}>
                OMADKING
              </Eyebrow>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Icon name="close" size={15} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Share Poster Frame (Story Format) */}
          <View style={s.posterFrame}>
            {/* Background Glow */}
            <View style={s.glowSpot} />

            {/* Achievement Crown */}
            <View style={s.badgeContainer}>
              <View style={[s.streakCircle, { backgroundColor: 'rgba(255, 107, 74, 0.15)', borderColor: '#FF6B4A' }]}>
                <Icon name="flame" size={28} color="#FF6B4A" />
              </View>
              <View style={s.streakPill}>
                <Txt variant="eyebrow" color="#FF6B4A" style={{ fontSize: 11, fontWeight: '900' }}>
                  {streakDays} {lang === 'de' ? 'TAGE STREAK' : 'DAY STREAK'}
                </Txt>
              </View>
            </View>

            {/* Fasting Stat Hero */}
            <View style={s.statHeroBox}>
              <Eyebrow color="#38BDF8" style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                {lang === 'de' ? 'FASTEN GEMEISTERT' : 'FAST COMPLETED'}
              </Eyebrow>
              <Text style={s.fastFigure}>{fastText}</Text>
              <Txt variant="small" color="#94A3B8" style={{ fontSize: 12, marginTop: 2 }}>
                {lang === 'de' ? '100% Autophagie & Fettstoffwechsel aktiv' : '100% Autophagy & Fat Burn active'}
              </Txt>
            </View>

            {/* Plate & Macros Card */}
            <View style={[s.plateCard, { backgroundColor: '#131923', borderColor: 'rgba(255, 255, 255, 0.08)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon name="plate" size={14} color="#10B981" />
                <Eyebrow color="#10B981" style={{ marginLeft: 4, fontSize: 9.5, fontWeight: '800' }}>
                  OMAD TELLER
                </Eyebrow>
              </View>
              <Txt variant="heading" color="#F8FAFC" numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', marginTop: 3 }}>
                {dishTitle}
              </Txt>
              <View style={s.macrosRow}>
                <Txt variant="data" color="#F59E0B" style={{ fontSize: 12, fontWeight: '800' }}>
                  {kcal} kcal
                </Txt>
                <Text style={s.dotSep}>·</Text>
                <Txt variant="data" color="#10B981" style={{ fontSize: 12, fontWeight: '800' }}>
                  {protein}g Protein
                </Txt>
              </View>
            </View>

            <View style={s.footerBranding}>
              <Txt variant="eyebrow" color="#64748B" style={{ fontSize: 9, letterSpacing: 1.2 }}>
                POWERED BY OMADKING.APP
              </Txt>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity
              onPress={onShare}
              activeOpacity={0.8}
              style={[s.primaryShareBtn, { backgroundColor: '#38BDF8' }]}
            >
              <Icon name="coach" size={15} color="#080C14" />
              <Txt variant="subheading" color="#080C14" style={{ marginLeft: 6, fontWeight: '800', fontSize: 14 }}>
                {lang === 'de' ? 'Story & Erfolg teilen' : 'Share Fasting Story'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Space.base,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Space.base,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterFrame: {
    backgroundColor: '#0F141E',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: Space.lg,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glowSpot: {
    position: 'absolute',
    top: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: Space.md,
  },
  streakCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  streakPill: {
    backgroundColor: 'rgba(255, 107, 74, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  statHeroBox: {
    alignItems: 'center',
    marginBottom: Space.md,
  },
  fastFigure: {
    fontFamily: Font.display,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  plateCard: {
    width: '100%',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Space.md,
    marginBottom: Space.md,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dotSep: {
    color: '#64748B',
    marginHorizontal: 6,
  },
  footerBranding: {
    marginTop: Space.xs,
  },
  btnRow: {
    marginTop: Space.md,
  },
  primaryShareBtn: {
    height: 48,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
});
