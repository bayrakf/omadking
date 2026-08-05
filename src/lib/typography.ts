/**
 * Type that follows the system font setting, within limits.
 *
 * Every size in `Type` is a fixed number, so someone who enlarges the system
 * font — not unusual for an app read in a kitchen or a gym — got exactly the
 * same small text.
 *
 * The clamp is the whole point. Past about 1.3 the clock face and the macro
 * row stop fitting, and a layout that breaks is worse than one that grows less
 * than asked for. The floor matters too: a system scale below 1 would shrink
 * text that is already at its minimum readable size.
 *
 * Note for whoever reads this next: on react-native-web `fontScale` is pinned
 * to 1, so this has no effect in the browser. It is a native-only improvement,
 * which is also why its guard is here rather than in the e2e suite.
 */

export const MAX_FONT_SCALE = 1.3;

/** Brings any reported system scale into the range the layout survives. */
export function clampFontScale(raw: unknown): number {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return 1;
  return Math.min(MAX_FONT_SCALE, Math.max(1, n));
}

export type ScalableText = { fontSize?: number; lineHeight?: number };

/**
 * Grows a type style by the scale. Line height moves with the size — scaling
 * one without the other makes large text collide with itself.
 * Returns null when nothing would change, so the caller can skip the override.
 */
export function scaleType(base: ScalableText, scale: number): ScalableText | null {
  const s = clampFontScale(scale);
  if (s === 1) return null;

  const size = typeof base?.fontSize === 'number' ? base.fontSize : 15;
  const out: ScalableText = { fontSize: Math.round(size * s * 10) / 10 };
  if (typeof base?.lineHeight === 'number') {
    out.lineHeight = Math.round(base.lineHeight * s * 10) / 10;
  }
  return out;
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  // The clamp, at both ends.
  assert(clampFontScale(1) === 1, 'the default scale passes through');
  assert(clampFontScale(1.2) === 1.2, 'a modest enlargement is honoured');
  assert(clampFontScale(1.3) === 1.3, 'the cap itself is allowed');
  assert(clampFontScale(3) === MAX_FONT_SCALE, 'an extreme setting is capped, not obeyed');
  assert(clampFontScale(0.8) === 1, 'shrinking below the design size is refused');
  assert(clampFontScale(0) === 1, 'zero does not erase the text');
  assert(clampFontScale(-2) === 1, 'a negative scale cannot flip anything');
  assert(clampFontScale(NaN) === 1, 'NaN falls back to the design size');
  assert(clampFontScale(undefined) === 1, 'a missing setting falls back');
  assert(clampFontScale('1.2' as any) === 1.2, 'a numeric string still works');

  // Scaling keeps size and leading in step.
  const scaled = scaleType({ fontSize: 20, lineHeight: 26 }, 1.3);
  assert(scaled !== null, 'a real scale produces an override');
  assert(scaled!.fontSize === 26, `size grows, got: ${scaled!.fontSize}`);
  assert(scaled!.lineHeight === 33.8, `leading grows with it, got: ${scaled!.lineHeight}`);
  // The ratio is what stops large text colliding with itself.
  assert(
    Math.abs(scaled!.lineHeight! / scaled!.fontSize! - 26 / 20) < 0.001,
    'the leading ratio is preserved exactly'
  );

  const noLeading = scaleType({ fontSize: 11 }, 1.3);
  assert(noLeading!.fontSize === 14.3, `a style without leading still scales, got: ${noLeading!.fontSize}`);
  assert(noLeading!.lineHeight === undefined, 'and gains none it did not have');

  assert(scaleType({ fontSize: 20 }, 1) === null, 'no change means no override object');
  assert(scaleType({ fontSize: 20 }, 0.5) === null, 'a refused scale also means no override');
  assert(scaleType({} as any, 1.3)!.fontSize === 19.5, 'a style with no size falls back to the body size');

  // Nothing may grow past the cap, whatever is asked for. A null means no
  // growth at all, which also satisfies the ceiling.
  for (const asked of [1.5, 2, 10, Infinity, 1e9]) {
    const out = scaleType({ fontSize: 20 }, asked);
    assert(
      out === null || out.fontSize! <= 20 * MAX_FONT_SCALE,
      `${asked} stays within the cap, got: ${JSON.stringify(out)}`
    );
  }
  // Infinity is not a font preference — it falls back rather than capping.
  assert(scaleType({ fontSize: 20 }, Infinity) === null, 'a non-finite scale means no change');
  assert(scaleType({ fontSize: 20 }, 2)!.fontSize === 26, 'but a real oversize setting still caps at 1.3');

  return 'typography.ts: all checks passed';
}
