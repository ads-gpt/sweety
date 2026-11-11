import { z } from 'zod';
import { SLOT_KEYS, MIN_VALUE, MAX_VALUE } from './slots.js';
import { TAG_KEYS } from './tags.js';
import { isValidDate, isValidTimezone, isFuture, today, REPORT_TYPES } from './dates.js';

const RANGE_MSG = `Value must be between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`;

/** "Future" depends on the user's own timezone, so these schemas are built per request. */
export const makeDateField = (tz) =>
  z
    .string({ error: 'Please choose a date.' })
    .refine(isValidDate, 'Please enter a valid date (YYYY-MM-DD).')
    .refine((d) => !isFuture(d, today(tz)), 'Date cannot be in the future.');

const valueField = z.preprocess(
  (v) => (v === '' || v === null ? undefined : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : v),
  z
    .number({ error: 'Please enter a glucose value.' })
    .refine((n) => Number.isInteger(n), `Value must be a whole number between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.`)
    .refine((n) => !Number.isInteger(n) || (n >= MIN_VALUE && n <= MAX_VALUE), RANGE_MSG),
);

const tagsField = z
  .array(z.enum(TAG_KEYS, { error: 'Unknown tag.' }), { error: 'Tags must be a list.' })
  .max(TAG_KEYS.length, 'Too many tags.')
  .default([])
  .transform((t) => [...new Set(t)]);

export const makeReadingSchema = (tz) =>
  z.object({
    date: makeDateField(tz),
    slot: z.enum(SLOT_KEYS, { error: 'Please choose a time slot.' }),
    value: valueField,
    notes: z.string().trim().max(280, 'Notes can be at most 280 characters.').optional().nullable(),
    tags: tagsField,
  });

const timezoneField = z
  .string({ error: 'Please choose a timezone.' })
  .refine(isValidTimezone, 'Please choose a valid timezone.');

export const signupSchema = z
  .object({
    name: z.string({ error: 'Please enter your name.' }).trim().min(1, 'Please enter your name.').max(100),
    email: z.string({ error: 'Please enter your email.' }).trim().toLowerCase().email('Please enter a valid email address.'),
    password: z
      .string({ error: 'Please enter a password.' })
      .min(8, 'Password must be at least 8 characters.')
      .max(72, 'Password must be at most 72 characters.'),
    role: z.enum(['patient', 'doctor']).default('patient'),
    timezone: timezoneField.optional(),
    licenseNumber: z.string().trim().max(60).optional(),
  })
  .refine((v) => v.role !== 'doctor' || !!v.licenseNumber, {
    path: ['licenseNumber'],
    message: 'Please enter your medical registration number.',
  });

export const loginSchema = z.object({
  email: z.string({ error: 'Please enter your email.' }).trim().toLowerCase().email('Please enter a valid email address.'),
  password: z.string({ error: 'Please enter your password.' }).min(1, 'Please enter your password.'),
});

export const passwordField = z
  .string({ error: 'Please enter a password.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.');

export const forgotSchema = z.object({
  email: z.string({ error: 'Please enter your email.' }).trim().toLowerCase().email('Please enter a valid email address.'),
});
export const resetSchema = z.object({ token: z.string({ error: 'This link is invalid.' }), password: passwordField });
export const tokenSchema = z.object({ token: z.string({ error: 'This link is invalid.' }) });
export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: 'Please enter your current password.' }).min(1, 'Please enter your current password.'),
  newPassword: passwordField,
});

const target = (label) => z.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(MIN_VALUE, `${label} must be at least ${MIN_VALUE}.`).max(MAX_VALUE, `${label} must be at most ${MAX_VALUE}.`);

/** PATCH payload; every field optional. Cross-field rules (low < high) are checked after merging. */
export const settingsSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(100).optional(),
  timezone: timezoneField.optional(),
  fastingLow: target('Fasting low').optional(),
  fastingHigh: target('Fasting high').optional(),
  postLow: target('After-meal low').optional(),
  postHigh: target('After-meal high').optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Please enter a time like 20:00.').optional(),
  reminderEmail: z.boolean().optional(),
  reminderPush: z.boolean().optional(),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  date: z.string().refine(isValidDate, 'Invalid date.').optional(),
  from: z.string().refine(isValidDate, 'Invalid from date.').optional(),
  to: z.string().refine(isValidDate, 'Invalid to date.').optional(),
  tag: z.enum(TAG_KEYS, { error: 'Unknown tag.' }).optional(),
  q: z.string().trim().max(100).optional(),
});

export const makeReportQuerySchema = (tz) =>
  z.object({
    date: makeDateField(tz).optional(),
    patientId: z.coerce.number().int().positive().optional(),
  });

export const reportTypeSchema = z.enum(REPORT_TYPES);

export const emailSchema = z.object({
  email: z.string({ error: 'Please enter an email.' }).trim().toLowerCase().email('Please enter a valid email address.'),
});

export const commentSchema = z.object({
  date: z.string({ error: 'Please choose a date.' }).refine(isValidDate, 'Please enter a valid date (YYYY-MM-DD).'),
  body: z.string({ error: 'Please write a comment.' }).trim().min(1, 'Please write a comment.').max(1000, 'Comments can be at most 1000 characters.'),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
