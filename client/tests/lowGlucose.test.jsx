import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LowGlucoseAlert } from '@/components/LowGlucoseAlert';
import { ReadingDialog } from '@/components/ReadingDialog';

vi.mock('@/lib/api', () => ({
  api: { listReadings: vi.fn(), createReading: vi.fn(), updateReading: vi.fn() },
  ApiError: class extends Error {},
}));
import { api } from '@/lib/api';

const critical = {
  level: 'critical', title: 'Very low glucose', message: '48 mg/dl is very low.',
  steps: ['Have 15 g of fast-acting carbohydrate right now.', 'Recheck in 15 minutes.', 'If you feel confused, call emergency services.'],
};
const low = { level: 'low', title: 'Low glucose', message: '66 mg/dl is below your target of 70 mg/dl.', steps: ['Have 15 g of fast-acting carbohydrate.', 'Recheck in 15 minutes.'] };

describe('LowGlucoseAlert', () => {
  it('shows an urgent, numbered treatment plan for a critical low', () => {
    render(<LowGlucoseAlert alert={critical} onClose={() => {}} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Very low glucose');
    expect(dialog).toHaveTextContent('48 mg/dl is very low.');
    expect(dialog).toHaveTextContent('Act now');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(dialog).toHaveTextContent('emergency services');
  });

  it('uses calmer wording for a plain low and closes on "OK, got it"', async () => {
    const onClose = vi.fn();
    render(<LowGlucoseAlert alert={low} onClose={onClose} />);
    expect(screen.getByText('What to do')).toBeInTheDocument();
    expect(screen.queryByText('Act now')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /ok, got it/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing without an alert, and lets the user start a 15-minute recheck timer', async () => {
    const { rerender } = render(<LowGlucoseAlert alert={null} onClose={() => {}} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    rerender(<LowGlucoseAlert alert={low} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /remind me to recheck/i }));
    expect(screen.getByRole('button', { name: /timer running/i })).toBeDisabled();
  });
});

describe('saving a low reading', () => {
  beforeEach(() => {
    api.listReadings.mockResolvedValue({ data: [] });
  });

  async function saveReading(value) {
    const user = userEvent.setup();
    render(<ReadingDialog open onOpenChange={() => {}} reading={null} />);
    await user.click(screen.getByRole('combobox', { name: /time slot/i }));
    await user.click(await screen.findByRole('option', { name: /After lunch/i }));
    await user.type(screen.getByLabelText(/glucose value/i), String(value));
    await user.click(screen.getByRole('button', { name: /save reading/i }));
  }

  it('shows the alert after the reading is saved', async () => {
    api.createReading.mockResolvedValue({ reading: { id: 1, value: 48, slotLabel: 'After lunch' }, alert: critical });
    await saveReading(48);
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Very low glucose');
    expect(api.createReading).toHaveBeenCalledWith(expect.objectContaining({ value: 48, slot: 'after_lunch' }));
  });

  it('shows no alert for a normal reading', async () => {
    api.createReading.mockResolvedValue({ reading: { id: 2, value: 120, slotLabel: 'After lunch' }, alert: null });
    await saveReading(120);
    await waitFor(() => expect(api.createReading).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
