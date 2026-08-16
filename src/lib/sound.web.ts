/**
 * Web Audio API Zen Chime for fasting completion and celebrations.
 */

export function playZenChime(): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Harmonic bell frequencies for a warm, soothing meditation gong (528 Hz miracle tone + natural overtone spectrum)
    const freqs = [528, 1056, 1584, 2112];
    const gains = [0.22, 0.11, 0.05, 0.02];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(gains[i], now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2 + i * 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 3.0);
    });
  } catch {
    // Audio autoplay policy fallback
  }
}
