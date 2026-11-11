import { Queue, Worker } from 'bullmq';
import { query } from '../db/pool.js';
import { config } from '../config.js';
import { today } from '../lib/dates.js';
import { MAX_READINGS_PER_DAY } from '../lib/slots.js';

const QUEUE = 'sweety-reminders';

/** Patients who have logged fewer than 4 readings on `date`. */
export async function findUsersWithMissingReadings(date = today()) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, COUNT(r.id)::int AS logged
     FROM users u
     LEFT JOIN readings r ON r.user_id = u.id AND r.reading_date = $1
     WHERE u.role = 'patient'
     GROUP BY u.id
     HAVING COUNT(r.id) < $2
     ORDER BY u.id`,
    [date, MAX_READINGS_PER_DAY],
  );
  return rows;
}

export async function runReminderJob(log = console.log) {
  const date = today();
  const users = await findUsersWithMissingReadings(date);
  for (const u of users) {
    log(`[reminder] ${date} -> ${u.name} <${u.email}> has ${u.logged}/${MAX_READINGS_PER_DAY} readings today`);
  }
  return users.length;
}

/** Starts the BullMQ scheduler + worker. Returns null when Redis is not configured. */
export async function startReminderJobs() {
  if (!config.redisUrl) {
    console.log('[reminders] REDIS_URL not set - daily reminder job disabled.');
    return null;
  }
  const connection = { url: config.redisUrl, maxRetriesPerRequest: null };
  const queue = new Queue(QUEUE, { connection });
  await queue.upsertJobScheduler('daily-reminder', { pattern: config.reminderCron, tz: config.timezone }, { name: 'daily-reminder' });
  const worker = new Worker(QUEUE, async () => ({ reminded: await runReminderJob() }), { connection });
  worker.on('failed', (job, err) => console.error('[reminders] job failed:', err.message));
  console.log(`[reminders] scheduled "${config.reminderCron}" (${config.timezone})`);
  return { queue, worker, close: async () => { await worker.close(); await queue.close(); } };
}
