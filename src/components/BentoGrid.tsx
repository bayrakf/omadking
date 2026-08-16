import type { ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Txt, useTheme, Eyebrow, washOf, type PaletteHue } from './ui';
import { Icon, type IconName } from './icons';

interface BentoTileProps {
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  badge?: string;
  icon: IconName;
  /**
   * The palette slot this tile belongs to.
   *
   * Six tiles used to be handed six literal Tailwind swatches by the
   * dashboard, at full chroma and in a different temperature from the rest of
   * the app — which is precisely what made a screen of identical rounded
   * boxes read as generated rather than designed.
   */
  hue: PaletteHue;
  onPress?: () => void;
  actionLabel?: string;
  children?: ReactNode;
}

export function BentoTile({
  title,
  value,
  unit,
  subtitle,
  badge,
  icon,
  hue,
  onPress,
  actionLabel,
  children,
}: BentoTileProps) {
  const c = useTheme();
  const tint = c[hue];
  const wash = washOf(tint);

  const Content = (
    <View
      style={[
        s.tile,
        {
          backgroundColor: c.surfaceElevated ?? c.surface,
          borderColor: c.line,
        },
      ]}
    >
      {/* Aura background glow pill */}
      <View style={[s.auraGlow, { backgroundColor: wash }]} />

      <View style={s.tileHead}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 4 }}>
          <View style={[s.iconBox, { backgroundColor: wash }]}>
            <Icon name={icon} size={13} color={tint} />
          </View>
          <Eyebrow numberOfLines={1} color={c.textDim} style={{ marginLeft: 5, fontSize: 10 }}>{title}</Eyebrow>
        </View>
        {badge && (
          <View style={[s.badge, { backgroundColor: wash, borderColor: tint }]}>
            <Txt variant="data" color={tint} style={{ fontSize: 9, fontWeight: '700' }}>
              {badge}
            </Txt>
          </View>
        )}
      </View>

      <View style={s.valueRow}>
        <Txt variant="heading" style={{ fontSize: 20, fontWeight: '800', color: c.text }}>
          {value}
        </Txt>
        {unit && (
          <Txt variant="data" color={c.textFaint} style={{ marginLeft: 3, fontSize: 13 }}>
            {unit}
          </Txt>
        )}
      </View>

      {subtitle && (
        <Txt variant="small" numberOfLines={1} color={c.textDim} style={{ fontSize: 11, marginTop: 1 }}>
          {subtitle}
        </Txt>
      )}

      {children && <View style={{ marginTop: 6 }}>{children}</View>}

      {actionLabel && (
        <View style={s.actionRow}>
          <Txt variant="data" color={tint} style={{ fontSize: 10, fontWeight: '700' }}>
            {actionLabel}
          </Txt>
          <Icon name="chevronRight" size={10} color={tint} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={s.tileWrapper}>
        {Content}
      </TouchableOpacity>
    );
  }

  return <View style={s.tileWrapper}>{Content}</View>;
}

export function BentoGrid({ children }: { children: ReactNode }) {
  return <View style={s.grid}>{children}</View>;
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: Space.base,
  },
  tileWrapper: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  tile: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    minHeight: 116,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
  },
  auraGlow: {
    position: 'absolute',
    top: -15,
    right: -15,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.45,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
});
