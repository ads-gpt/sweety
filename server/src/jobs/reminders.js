import { Queue, Worker } from 'bullmq';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { MAX_READINGS_PER_DAY } from '../lib/slots.js';
import { trySendMail } from '../lib/mailer.js';
import { reminderEmail } from '../lib/emails.js';
import { sendPush } from '../lib/push.js';

const QUEUE = 'sweety-reminders';
// A reminder is only sent within this many minutes after the user's chosen time
// (so a server that was down all evening doesn't nag at midnight).
const WINDOW_MINUTES = 180;

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Patients whose reminder time has arrived in THEIR timezone, who have logged fewer than
 * 4 readings on THEIR local date and haven't been reminded yet today.
 */
export async function findDueReminders(now = new Date()) {
  const { rows } = await query(
    `WITH local AS (
       SELECT u.id, u.name, u.email, u.timezone, u.reminder_time, u.reminder_email, u.reminder_push,
              u.last_reminded_date,
              ($1::timestamptz AT TIME ZONE u.timezone)::date AS local_date,
              to_char($1::timestamptz AT TIME ZONE u.timezone, 'HH24:MI') AS local_time
       FROM users u WHERE u.role = 'patient' AND u.reminder_enabled
     )
     SELECT l.*, (SELECT COUNT(*)::int FROM readings r WHERE r.user_id = l.id AND r.reading_date = l.local_date) AS logged
     FROM local l
     WHERE l.last_reminded_date IS DISTINCT FROM l.local_date
     ORDER BY l.id`,
    [now.toISOString()],
  );
  return rows.filter((r) => {
    const since = toMinutes(r.local_time) - toMinutes(r.reminder_time);
    return since >= 0 && since < WINDOW_MINUTES && r.logged < MAX_READINGS_PER_DAY;
  });
}

/** Find due users, notify them on the channels they chose, and mark them reminded for the day. */
export async function runReminderJob({ now = new Date(), mail = trySendMail, push = sendPush, log = console.log } = {}) {
  const due = await findDueReminders(now);
  const results = [];
  for (const u of due) {
    const left = MAX_READINGS_PER_DAY - u.logged;
    const text = `You've logged ${u.logged} of ${MAX_READINGS_PER_DAY} readings today. Take a minute to add the other ${left}.`;
    const channels = [];
    if (u.reminder_email) {
      await mail({ to: u.email, ...reminderEmail({ name: u.name, logged: u.logged, total: MAX_READINGS_PER_DAY, url: config.appUrl }) });
      channels.push('email');
    }
    if (u.reminder_push && (await push(u.id, { title: 'Time to log your glucose', body: text, url: '/' })) > 0) channels.push('push');
    await query('UPDATE users SET last_reminded_date = $1 WHERE id = $2', [u.local_date, u.id]);
    log(`[reminder] ${u.local_date} ${u.name} <${u.email}> ${u.logged}/${MAX_READINGS_PER_DAY} -> ${channels.join('+') || 'no channel enabled'}`);
    results.push({ userId: u.id, logged: u.logged, channels });
  }
  return results;
}

/**
 * Runs the reminder check every few minutes. With Redis it is a BullMQ repeatable job
 * (safe across several API instances); without Redis a plain in-process timer is used.
 */
export async function startReminderJobs() {
  if (!config.redisUrl) {
    const timer = setInterval(() => runReminderJob().catch((e) => console.error('[reminders]', e.message)), config.reminderIntervalMs);
    timer.unref();
    console.log(`[reminders] running in-process every ${Math.round(config.reminderIntervalMs / 60000)} min (set REDIS_URL to use BullMQ).`);
    return { close: async () => clearInterval(timer) };
  }
  const connection = { url: config.redisUrl, maxRetriesPerRequest: null };
  const queue = new Queue(QUEUE, { connection });
  await queue.upsertJobScheduler('reminder-check', { pattern: config.reminderCron }, { name: 'reminder-check' });
  const worker = new Worker(QUEUE, async () => ({ reminded: (await runReminderJob()).length }), { connection });
  worker.on('failed', (_job, err) => console.error('[reminders] job failed:', err.message));
  console.log(`[reminders] BullMQ schedule "${config.reminderCron}"`);
  return { queue, worker, close: async () => { await worker.close(); await queue.close(); } };
}
