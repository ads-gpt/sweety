import { todayISO } from './dates.js';

export const SLOTS = [
  { value: 'morning', label: 'Morning (fasting)', short: 'Morning' },
  { value: 'after_breakfast', label: 'After breakfast', short: 'Breakfast' },
  { value: 'after_lunch', label: 'After lunch', short: 'Lunch' },
  { value: 'after_dinner', label: 'After dinner', short: 'Dinner' },
];

export const slotLabel = (v) => SLOTS.find((s) => s.value === v)?.label ?? v;

export const MIN_VALUE = 40;
export const MAX_VALUE = 600;
export const MAX_PER_DAY = 4;

// Commonly used reference range (mg/dl). Informational only - see README assumptions.
export const TARGET = { low: 70, high: 180 };

export function glucoseStatus(value) {
  if (value < TARGET.low) return { key: 'low', label: 'Low', color: 'var(--low)' };
  if (value > TARGET.high) return { key: 'high', label: 'High', color: 'var(--high)' };
  return { key: 'ok', label: 'In range', color: 'var(--success)' };
}

/**
 * Client-side mirror of the server rules, so users get instant feedback.
 * The server remains the source of truth (and returns the same messages).
 * `existing` = readings already saved for the chosen date (excluding the one being edited).
 */
export function validateReading({ date, slot, value }, existing = []) {
  const errors = {};
  if (!date) errors.date = 'Please choose a date.';
  else if (date > todayISO()) errors.date = 'Date cannot be in the future.';

  if (!slot) errors.slot = 'Please choose a time slot.';

  const raw = String(value ?? '').trim();
  if (raw === '') errors.value = 'Please enter a glucose value.';
  else {
    const n = Number(raw);
    if (Number.isNaN(n)) errors.value = 'Please enter a glucose value.';
    else if (!Number.isInteger(n)) errors.value = `Value must be a whole number between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`;
    else if (n < MIN_VALUE || n > MAX_VALUE) errors.value = `Value must be between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`;
  }

  if (!errors.date && !errors.slot) {
    if (existing.length >= MAX_PER_DAY) errors.date = 'You can add only 4 readings per day.';
    else if (existing.some((r) => r.slot === slot)) {
      const label = slotLabel(slot);
      errors.slot = `You already have ${/^[AEIOU]/.test(label) ? 'an' : 'a'} ${label} reading for this date.`;
    }
  }
  return errors;
}
