export const phrases = [
  { words: 'Dans le soir clair', notes: [60, 62, 64, 67] },
  { words: 'Je suis ta voix', notes: [67, 64, 62, 60] },
  { words: 'On chante encore', notes: [62, 64, 65, 69] },
  { words: 'Sous le ciel bleu', notes: [67, 65, 62, 60] },
];
export const frequency = note => 440 * 2 ** ((note - 69) / 12);

export function detectPitch(samples, rate) {
  const energy = samples.reduce((sum, value) => sum + value ** 2, 0);
  if (energy / samples.length < 0.000025) return null;
  const step = Math.max(1, Math.floor(rate / 12000));
  const min = Math.floor(rate / step / 850);
  const max = Math.ceil(rate / step / 90);
  const window = Math.floor(samples.length / step) - max;
  if (window < max) return null;
  const errors = new Float64Array(max + 1);
  let cumulative = 0;
  for (let lag = 1; lag <= max; lag++) {
    let difference = 0;
    for (let i = 0; i < window; i++) {
      difference += (samples[i * step] - samples[(i + lag) * step]) ** 2;
    }
    cumulative += difference;
    errors[lag] = cumulative ? difference * lag / cumulative : 1;
    const peak = lag - 1;
    if (peak >= min && errors[peak] < 0.18 && errors[peak] <= errors[peak - 1] && errors[peak] < errors[lag]) {
      const offset = (errors[peak - 1] - errors[lag]) /
        (2 * (errors[peak - 1] - 2 * errors[peak] + errors[lag]));
      return rate / step / (peak + offset);
    }
  }
  return null;
}

export function summarize(frames, total) {
  const coverage = frames.length / total;
  if (coverage < 0.4) return { coverage, score: null };
  const points = frames.reduce((sum, { pitch, target }) => {
    const semitones = 12 * Math.log2(pitch / target);
    const error = Math.abs(semitones - 12 * Math.round(semitones / 12));
    return sum + Math.max(0, 1 - error / 1.5);
  }, 0);
  return { coverage, score: Math.round(100 * points / total) };
}
