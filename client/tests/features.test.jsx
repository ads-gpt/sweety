import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingForm } from '@/components/ReadingForm';
import { ReportBody } from '@/components/ReportView';
import { glucoseStatus, rangeFor, DEFAULT_TARGETS } from '@/lib/glucose';
import { todayISO, setTimezone } from '@/lib/dates';

afterEach(() => setTimezone(null));

describe('target-aware status', () => {
  it('uses the fasting range for the morning slot and the after-meal range otherwise', () => {
    expect(rangeFor('morning')).toEqual({ low: 70, high: 130 });
    expect(rangeFor('after_lunch')).toEqual({ low: 70, high: 180 });
    expect(glucoseStatus(150, 'morning').key).toBe('high');      // above fasting 130
    expect(glucoseStatus(150, 'after_lunch').key).toBe('ok');    // within after-meal 180
  });

  it('respects a user\'s own targets', () => {
    const strict = { ...DEFAULT_TARGETS, postHigh: 140 };
    expect(glucoseStatus(150, 'after_lunch', strict).key).toBe('high');
  });
});

describe('todayISO follows the user timezone', () => {
  it('returns the date in the given zone, not the device zone', () => {
    const instant = new Date('2026-10-15T20:00:00Z'); // 16 Oct in Kolkata, 15 Oct in UTC
    expect(todayISO(instant, 'UTC')).toBe('2026-10-15');
    expect(todayISO(instant, 'Asia/Kolkata')).toBe('2026-10-16');
    setTimezone('Asia/Kolkata');
    expect(todayISO(instant)).toBe('2026-10-16');
  });
});

describe('ReadingForm tags', () => {
  it('lets the user toggle context tags and submits them', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ReadingForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('combobox', { name: /time slot/i }));
    await user.click(await screen.findByRole('option', { name: /After dinner/i }));
    await user.type(screen.getByLabelText(/glucose value/i), '131');

    const group = screen.getByRole('group', { name: /reading tags/i });
    const exercise = within(group).getByRole('button', { name: 'Exercise' });
    await user.click(exercise);
    await user.click(within(group).getByRole('button', { name: 'Big meal' }));
    await user.click(exercise); // toggle back off
    expect(exercise).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: /save reading/i }));
    expect(onSubmit).toHaveBeenCalledWith({ date: todayISO(), slot: 'after_dinner', value: 131, notes: null, tags: ['big_meal'] });
  });

  it('shows the target range for the chosen slot', async () => {
    const user = userEvent.setup();
    render(<ReadingForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('combobox', { name: /time slot/i }));
    await user.click(await screen.findByRole('option', { name: /Morning/i }));
    expect(screen.getByText(/Your target for this slot: 70–130 mg\/dl/)).toBeInTheDocument();
  });
});

describe('ReportBody', () => {
  const base = {
    type: 'month-to-date', from: '2026-11-01', to: '2026-11-11', empty: false,
    stats: { count: 12, highest: 190, lowest: 80, average: 140.5 },
    timeInRange: { inRange: 75, low: 8.3, high: 16.7, counts: { low: 1, ok: 9, high: 2 } },
    estimatedA1c: 6.5,
    targets: DEFAULT_TARGETS,
    readings: [], comments: [],
  };

  it('shows time in range, the estimated A1c and the figures', () => {
    render(<ReportBody report={base} />);
    expect(screen.getByText('Time in range')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('6.5')).toBeInTheDocument();
    expect(screen.getByText('140.5')).toBeInTheDocument();
    expect(screen.getByText(/fasting 70–130, after meals 70–180/)).toBeInTheDocument();
  });

  it('explains when there are too few readings for an A1c estimate', () => {
    render(<ReportBody report={{ ...base, estimatedA1c: null, stats: { ...base.stats, count: 4 } }} />);
    expect(screen.getByText(/at least 10 readings/i)).toBeInTheDocument();
  });

  it('shows doctor comments, with a delete action only when allowed', async () => {
    const comments = [{ id: 7, date: '2026-11-10', body: 'Nice progress.', doctor: { id: 1, name: 'Dr Rao' } }];
    const onDelete = vi.fn();
    const { rerender } = render(<ReportBody report={{ ...base, comments }} />);
    expect(screen.getByText('Nice progress.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    rerender(<ReportBody report={{ ...base, comments }} onDeleteComment={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(comments[0]);
  });

  it('shows the friendly empty state when there are no readings', () => {
    render(<ReportBody report={{ ...base, empty: true, stats: null, timeInRange: null, estimatedA1c: null }} />);
    expect(screen.getByText('Nothing to report yet')).toBeInTheDocument();
  });
});
