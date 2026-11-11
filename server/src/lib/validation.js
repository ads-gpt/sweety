import { z } from 'zod';
import { SLOT_KEYS, MIN_VALUE, MAX_VALUE } from './slots.js';
import { isValidDate, isFuture, today, REPORT_TYPES } from './dates.js';

const RANGE_MSG = `Value must be between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`;

export const dateField = z
  .string({ error: 'Please choose a date.' })
  .refine(isValidDate, 'Please enter a valid date (YYYY-MM-DD).')
  .refine((d) => !isFuture(d, today()), 'Date cannot be in the future.');

const valueField = z.preprocess(
  (v) => (v === '' || v === null ? undefined : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : v),
  z
    .number({ error: 'Please enter a glucose value.' })
    .refine((n) => Number.isInteger(n), `Value must be a whole number between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`)
    .refine((n) => !Number.isInteger(n) || (n >= MIN_VALUE && n <= MAX_VALUE), RANGE_MSG),
);

export const readingSchema = z.object({
  date: dateField,
  slot: z.enum(SLOT_KEYS, { error: 'Please choose a time slot.' }),
  value: valueField,
  notes: z.string().trim().max(280, 'Notes can be at most 280 characters.').optional().nullable(),
});

export const signupSchema = z.object({
  name: z.string({ error: 'Please enter your name.' }).trim().min(1, 'Please enter your name.').max(100),
  email: z.string({ error: 'Please enter your email.' }).trim().toLowerCase().email('Please enter a valid email address.'),
  password: z
    .string({ error: 'Please enter a password.' })
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be at most 72 characters.'),
  role: z.enum(['patient', 'doctor']).default('patient'),
});

export const loginSchema = z.object({
  email: z.string({ error: 'Please enter your email.' }).trim().toLowerCase().email('Please enter a valid email address.'),
  password: z.string({ error: 'Please enter your password.' }).min(1, 'Please enter your password.'),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  date: z.string().refine(isValidDate, 'Invalid date.').optional(),
  from: z.string().refine(isValidDate, 'Invalid from date.').optional(),
  to: z.string().refine(isValidDate, 'Invalid to date.').optional(),
});

export const reportQuerySchema = z.object({
  date: z
    .string()
    .refine(isValidDate, 'Please enter a valid date (YYYY-MM-DD).')
    .refine((d) => !isFuture(d, today()), 'Date cannot be in the future.')
    .optional(),
  patientId: z.coerce.number().int().positive().optional(),
});

export const reportTypeSchema = z.enum(REPORT_TYPES);

export const emailSchema = z.object({
  email: z.string({ error: 'Please enter an email.' }).trim().toLowerCase().email('Please enter a valid email address.'),
});
