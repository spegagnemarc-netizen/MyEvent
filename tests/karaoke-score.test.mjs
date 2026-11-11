import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectPitch, frequency, summarize } from '../js/karaoke-score.mjs';

test('detects sung-range frequencies at common input rates and rejects silence', () => {
  for (const rate of [44100, 48000]) {
    for (const hz of [130.81, 261.63, 440, 659.25]) {
      const samples = Float32Array.from({ length: 2048 }, (_, i) =>
        0.16 * Math.sin(2 * Math.PI * hz * i / rate) +
        0.08 * Math.sin(4 * Math.PI * hz * i / rate));
      assert.ok(Math.abs(detectPitch(samples, rate) / hz - 1) < 0.01);
    }
    assert.equal(detectPitch(new Float32Array(2048), rate), null);
  }
});

test('scores detected pitch, accepts octaves and requires sufficient coverage', () => {
  const target = frequency(60);
  assert.deepEqual(summarize([], 4), { coverage: 0, score: null });
  assert.deepEqual(summarize([{ pitch: target, target }], 4), { coverage: 0.25, score: null });
  assert.deepEqual(summarize([{ pitch: target / 2, target }, { pitch: target, target }], 4),
    { coverage: 0.5, score: 50 });
  assert.deepEqual(summarize([{ pitch: frequency(62), target }], 1), { coverage: 1, score: 0 });
});
