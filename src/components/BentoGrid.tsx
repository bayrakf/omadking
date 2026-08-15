import type { ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Space, Radius } from '@/constants/theme';
import { Txt, useTheme, Eyebrow } from './ui';
import { Icon, type IconName } from './icons';

interface BentoTileProps {
  title: string;
  value: string;
  unit?: string;
  subtitle?: string;
  badge?: string;
  icon: IconName;
  color: string;
  wash: string;
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
  color,
  wash,
  onPress,
  actionLabel,
  children,
}: BentoTileProps) {
  const c = useTheme();

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
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[s.iconBox, { backgroundColor: wash }]}>
            <Icon name={icon} size={15} color={color} />
          </View>
          <Eyebrow color={c.textDim} style={{ marginLeft: 6 }}>{title}</Eyebrow>
        </View>
        {badge && (
          <View style={[s.badge, { backgroundColor: wash, borderColor: color }]}>
            <Txt variant="data" color={color} style={{ fontSize: 10, fontWeight: '700' }}>
              {badge}
            </Txt>
          </View>
        )}
      </View>

      <View style={s.valueRow}>
        <Txt variant="heading" style={{ fontSize: 24, fontWeight: '800', color: c.text }}>
          {value}
        </Txt>
        {unit && (
          <Txt variant="data" color={c.textFaint} style={{ marginLeft: 4, fontSize: 14 }}>
            {unit}
          </Txt>
        )}
      </View>

      {subtitle && (
        <Txt variant="small" color={c.textDim} style={{ fontSize: 12, marginTop: 2 }}>
          {subtitle}
        </Txt>
      )}

      {children && <View style={{ marginTop: Space.sm }}>{children}</View>}

      {actionLabel && (
        <View style={s.actionRow}>
          <Txt variant="data" color={color} style={{ fontSize: 11, fontWeight: '700' }}>
            {actionLabel}
          </Txt>
          <Icon name="chevronRight" size={12} color={color} />
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
    marginHorizontal: -Space.xs,
    marginBottom: Space.base,
  },
  tileWrapper: {
    width: '50%',
    paddingHorizontal: Space.xs,
    marginBottom: Space.sm,
  },
  tile: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    minHeight: 140,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
  },
  auraGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.6,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.xs,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Space.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.sm,
  },
});
