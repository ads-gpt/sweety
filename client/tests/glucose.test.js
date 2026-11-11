import { describe, it, expect } from 'vitest';
import { validateReading, glucoseStatus } from '@/lib/glucose';
import { formatRange } from '@/lib/dates';

describe('validateReading', () => {
  const ok = { date: '2020-01-01', slot: 'morning', value: '100' };
  it('accepts a valid reading', () => expect(validateReading(ok)).toEqual({}));
  it('accepts the boundaries', () => {
    expect(validateReading({ ...ok, value: '40' })).toEqual({});
    expect(validateReading({ ...ok, value: '600' })).toEqual({});
  });
  it('rejects decimals and non-numbers', () => {
    expect(validateReading({ ...ok, value: '99.5' }).value).toMatch(/whole number/);
    expect(validateReading({ ...ok, value: 'abc' }).value).toBe('Please enter a glucose value.');
  });
});

describe('glucoseStatus', () => {
  it('classifies low / in range / high', () => {
    expect(glucoseStatus(60).key).toBe('low');
    expect(glucoseStatus(120).key).toBe('ok');
    expect(glucoseStatus(250).key).toBe('high');
  });
});

describe('formatRange', () => {
  it('formats the example ranges', () => {
    expect(formatRange('2026-10-15', '2026-10-15')).toBe('15 Oct 2026');
    expect(formatRange('2026-10-01', '2026-10-15')).toBe('1 Oct – 15 Oct 2026');
    expect(formatRange('2026-09-01', '2026-09-30')).toBe('1 Sept – 30 Sept 2026');
  });
});
