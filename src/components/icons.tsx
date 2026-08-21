/**
 * Line icons on a 24px grid, 1.6 stroke, round caps.
 *
 * These replace the emoji the app used for tab bars, buttons and card headers.
 * Emoji render as a different typeface on every platform, carry colour the
 * palette does not control, and are the fastest way to make an interface look
 * assembled from defaults.
 */

import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'plate'
  | 'chart'
  | 'basket'
  | 'user'
  | 'flame'
  | 'drop'
  | 'clock'
  | 'chevronRight'
  | 'chevronLeft'
  | 'check'
  | 'plus'
  | 'close'
  | 'coach'
  | 'salt'
  | 'dumbbell'
  | 'moon'
  | 'edit'
  | 'share'
  | 'crown'
  | 'alert'
  | 'bell'
  | 'shield'
  | 'sync'
  | 'footprints';

const PATHS: Record<IconName, string[]> = {
  home: ['M4 10.5 12 4l8 6.5', 'M6 9.5V20h12V9.5'],
  plate: ['M7 3v5a2.6 2.6 0 0 0 5.2 0V3', 'M9.6 8.6V21', 'M16.6 3c1.9 0 2.7 2.1 2.7 4.7s-.9 4.6-2.7 4.6', 'M16.6 12.3V21'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  basket: ['M4 8h16l-1.6 11H5.6L4 8Z', 'M9 8V5a3 3 0 0 1 6 0v3'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4.5 20c0-3.6 3.4-5.5 7.5-5.5s7.5 1.9 7.5 5.5'],
  flame: ['M12 21c3.6 0 6-2.4 6-5.6 0-4-3.2-5.9-4.2-9.4-2 1.2-2.6 3-2.6 4.6-1-.5-1.4-1.6-1.4-2.8C8.2 9.2 6 11.4 6 15.4 6 18.6 8.4 21 12 21Z'],
  drop: ['M12 3.5c3 3.8 5.5 6.6 5.5 9.8A5.5 5.5 0 0 1 6.5 13.3C6.5 10.1 9 7.3 12 3.5Z'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5.3l3.4 2'],
  chevronRight: ['M9.5 5.5 16 12l-6.5 6.5'],
  chevronLeft: ['M14.5 5.5 8 12l6.5 6.5'],
  check: ['M4.5 12.5 9.5 17.5 19.5 6.5'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  coach: ['M12 3.2 13.9 9l5.9 1.9-5.9 1.9L12 18.7 10.1 12.8 4.2 10.9 10.1 9 12 3.2Z', 'M18.5 16.5 19.3 19l2.5.8-2.5.8-.8 2.5'],
  salt: ['M8.4 21h7.2l.9-10H7.5l.9 10Z', 'M9.8 11V8.6a2.2 2.2 0 0 1 4.4 0V11', 'M11 5.6h.01', 'M13.3 4.2h.01'],
  dumbbell: ['M3 10v4', 'M21 10v4', 'M6.5 7v10', 'M17.5 7v10', 'M6.5 12h11'],
  moon: ['M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z'],
  edit: ['M4 20h4L19 9l-4-4L4 16v4Z', 'M14.5 5.5 18.5 9.5'],
  share: ['M12 15V4', 'M8.5 7.5 12 4l3.5 3.5', 'M5 13v6.5h14V13'],
  crown: ['M4 17.5 5.5 7l4.3 4L12 5.5 14.2 11l4.3-4L20 17.5H4Z'],
  alert: ['M12 8v5', 'M12 16.5h.01', 'M12 3.5 21 20H3l9-16.5Z'],
  bell: ['M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'],
  shield: ['M12 3.5 4 7v6c0 5.2 3.4 9.4 8 10.5 4.6-1.1 8-5.3 8-10.5V7l-8-3.5Z'],
  // Two arcs chasing each other: the blob goes up, the merge comes back.
  sync: ['M20.5 12a8.5 8.5 0 0 1-14.6 6', 'M3.5 12a8.5 8.5 0 0 1 14.6-6',
    'M18.1 2.5v3.5h-3.5', 'M5.9 21.5V18h3.5'],
  footprints: [
    'M7.5 4.5c1.8 0 2.8 1.6 2.8 3.8 0 1.7-.5 2.6-.5 4 0 1 .8 1.7.8 3 0 1.6-1.3 2.7-3.1 2.7s-3.1-1.1-3.1-2.7c0-1.3.8-2 .8-3 0-1.4-.5-2.3-.5-4 0-2.2 1-3.8 2.8-3.8Z',
    'M16.5 10.5c1.8 0 2.8 1.6 2.8 3.8 0 1.7-.5 2.6-.5 4 0 1 .8 1.7.8 3 0 1.6-1.3 2.7-3.1 2.7s-3.1-1.1-3.1-2.7c0-1.3.8-2 .8-3 0-1.4-.5-2.3-.5-4 0-2.2 1-3.8 2.8-3.8Z',
    'M5.2 20.5h4.6',
    'M14.2 21h4.6',
  ],
};

/** Icons that read better filled than stroked. */
const FILLED: Partial<Record<IconName, boolean>> = { flame: true, drop: true, moon: true, crown: true };

type Props = {
  name: IconName;
  size?: number;
  color: string;
  /** Override the default stroke/fill choice. */
  filled?: boolean;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color, filled, strokeWidth = 1.6 }: Props) {
  const isFilled = filled ?? FILLED[name] ?? false;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {PATHS[name].map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={isFilled && i === 0 ? color : 'none'}
          opacity={isFilled && i === 0 ? 0.92 : 1}
        />
      ))}
    </Svg>
  );
}

/**
 * The eating window as a filled sliver on a ring — used at small sizes where
 * the full DayDial would be illegible.
 */
export function WindowGlyph({ size = 20, track, fill }: { size?: number; track: string; fill: string }) {
  const r = 9;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={r} stroke={track} strokeWidth={2.4} />
      <Path d={`M12 ${12 - r} A ${r} ${r} 0 0 1 ${12 + r * 0.87} ${12 - r * 0.5}`} stroke={fill} strokeWidth={2.4} strokeLinecap="round" />
      <Rect x={11.4} y={4} width={1.2} height={3} rx={0.6} fill={fill} />
    </Svg>
  );
}
