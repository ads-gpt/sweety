import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingForm } from '@/components/ReadingForm';
import { ApiError } from '@/lib/api';
import { todayISO, addDays } from '@/lib/dates';

const setup = (props = {}) => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ReadingForm onSubmit={onSubmit} {...props} />);
  return { onSubmit, user };
};

async function pickSlot(user, label) {
  await user.click(screen.getByRole('combobox', { name: /time slot/i }));
  await user.click(await screen.findByRole('option', { name: new RegExp(label, 'i') }));
}

describe('ReadingForm', () => {
  it('shows "Please enter a glucose value." when the value is empty', async () => {
    const { user, onSubmit } = setup();
    await pickSlot(user, 'Morning');
    await user.click(screen.getByRole('button', { name: /save reading/i }));
    expect(await screen.findByText('Please enter a glucose value.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['39', '601'])('rejects %s mg/dl as out of range', async (value) => {
    const { user, onSubmit } = setup();
    await pickSlot(user, 'Morning');
    await user.type(screen.getByLabelText(/glucose value/i), value);
    await user.click(screen.getByRole('button', { name: /save reading/i }));
    expect(await screen.findByText('Value must be between 40 and 600 mg/dl.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a future date', async () => {
    const { user, onSubmit } = setup();
    await pickSlot(user, 'Morning');
    await user.type(screen.getByLabelText(/glucose value/i), '110');
    const date = screen.getByLabelText('Date');
    await user.clear(date);
    await user.type(date, addDays(todayISO(), 2));
    await user.click(screen.getByRole('button', { name: /save reading/i }));
    expect(await screen.findByText('Date cannot be in the future.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('warns when the slot is already used on that date', async () => {
    const existing = [{ id: 1, date: todayISO(), slot: 'after_lunch', value: 140 }];
    const { user, onSubmit } = setup({ existingForDate: (d) => existing.filter((r) => r.date === d) });
    await pickSlot(user, 'After lunch');
    await user.type(screen.getByLabelText(/glucose value/i), '150');
    await user.click(screen.getByRole('button', { name: /save reading/i }));
    expect(await screen.findByText('You already have an After lunch reading for this date.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks a fifth reading on the same day', async () => {
    const full = ['morning', 'after_breakfast', 'after_lunch', 'after_dinner'].map((slot, i) => ({ id: i, date: todayISO(), slot }));
    const { user } = setup({ existingForDate: () => full });
    await pickSlot(user, 'Morning');
    await user.type(screen.getByLabelText(/glucose value/i), '100');
    await user.click(screen.getByRole('button', { name: /save reading/i }));
    expect(await screen.findByText('You can add only 4 readings per day.')).toBeInTheDocument();
  });

  it('submits a valid reading as numbers', async () => {
    const { user, onSubmit } = setup();
    await pickSlot(user, 'After dinner');
    await user.type(screen.getByLabelText(/glucose value/i), '125');
    await user.click(screen.getByRole('button', { name: /save reading/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ date: todayISO(), slot: 'after_dinner', value: 125, notes: null, tags: [] }));
  });

  it('shows server-side errors next to the right field', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError('You already have a Morning (fasting) reading for this date.', { field: 'slot' }));
    const { user } = setup({ onSubmit });
    await pickSlot(user, 'Morning');
    await user.type(screen.getByLabelText(/glucose value/i), '100');
    await user.click(screen.getByRole('button', { name: /save reading/i }));
    expect(await screen.findByText(/You already have a Morning/)).toBeInTheDocument();
  });
});
