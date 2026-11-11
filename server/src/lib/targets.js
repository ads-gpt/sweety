import { SLOT_KEYS } from './slots.js';

// Common general guidance: fasting 70-130, after meals up to 180 mg/dl. Users can change both.
export const DEFAULT_TARGETS = { fastingLow: 70, fastingHigh: 130, postLow: 70, postHigh: 180 };

export const targetsOf = (u) => ({
  fastingLow: u.fasting_low ?? DEFAULT_TARGETS.fastingLow,
  fastingHigh: u.fasting_high ?? DEFAULT_TARGETS.fastingHigh,
  postLow: u.post_low ?? DEFAULT_TARGETS.postLow,
  postHigh: u.post_high ?? DEFAULT_TARGETS.postHigh,
});

/** Morning (fasting) readings use the fasting range; everything else uses the after-meal range. */
export const rangeFor = (slot, t) =>
  slot === 'morning' ? { low: t.fastingLow, high: t.fastingHigh } : { low: t.postLow, high: t.postHigh };

export function statusOf(value, slot, t) {
  const { low, high } = rangeFor(slot, t);
  return value < low ? 'low' : value > high ? 'high' : 'ok';
}

const pct = (n, total) => Math.round((n / total) * 1000) / 10;

/** Share of readings below / within / above the user's target range for that slot. */
export function timeInRange(readings, t) {
  if (!readings.length) return null;
  const c = { low: 0, ok: 0, high: 0 };
  for (const r of readings) c[statusOf(r.value, r.slot, t)]++;
  return {
    inRange: pct(c.ok, readings.length),
    low: pct(c.low, readings.length),
    high: pct(c.high, readings.length),
    counts: c,
  };
}

export const MIN_READINGS_FOR_A1C = 10;

/** Estimated A1c from average glucose: eA1c = (avg mg/dl + 46.7) / 28.7 (ADAG formula). */
export function estimatedA1c(average, count) {
  if (count < MIN_READINGS_FOR_A1C) return null;
  return Math.round(((average + 46.7) / 28.7) * 10) / 10;
}

export const isSlot = (s) => SLOT_KEYS.includes(s);
