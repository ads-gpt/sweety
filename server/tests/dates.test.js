import { describe, it, expect } from 'vitest';
import { reportRange, isValidDate, isFuture, today } from '../src/lib/dates.js';
import { summarize } from '../src/lib/stats.js';

describe('reportRange (selected date 2026-10-15)', () => {
  it('daily is just the selected date', () => {
    expect(reportRange('daily', '2026-10-15')).toEqual({ from: '2026-10-15', to: '2026-10-15' });
  });
  it('month-to-date is 1st of month to the selected date', () => {
    expect(reportRange('month-to-date', '2026-10-15')).toEqual({ from: '2026-10-01', to: '2026-10-15' });
  });
  it('monthly is the whole previous month', () => {
    expect(reportRange('monthly', '2026-10-15')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
  it('monthly handles January -> previous December', () => {
    expect(reportRange('monthly', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('monthly handles leap-year February', () => {
    expect(reportRange('monthly', '2028-03-05')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(reportRange('monthly', '2027-03-05')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
  });
});

describe('date helpers', () => {
  it('rejects impossible dates', () => {
    expect(isValidDate('2026-02-31')).toBe(false);
    expect(isValidDate('15-10-2026')).toBe(false);
    expect(isValidDate('2026-10-15')).toBe(true);
  });
  it('detects future dates relative to a reference day', () => {
    expect(isFuture('2026-10-16', '2026-10-15')).toBe(true);
    expect(isFuture('2026-10-15', '2026-10-15')).toBe(false);
  });
  it('today() respects the timezone', () => {
    const instant = new Date('2026-10-15T20:00:00Z'); // already 16 Oct in Kolkata
    expect(today('UTC', instant)).toBe('2026-10-15');
    expect(today('Asia/Kolkata', instant)).toBe('2026-10-16');
  });
});

describe('summarize', () => {
  it('returns null when there are no readings', () => {
    expect(summarize([])).toBeNull();
  });
  it('computes highest, lowest, count and average rounded to 1 decimal', () => {
    expect(summarize([100, 120, 141])).toEqual({ count: 3, highest: 141, lowest: 100, average: 120.3 });
  });
});
