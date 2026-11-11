import 'dotenv/config';

const env = process.env;

export const config = {
  env: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL || 'postgres://sweety:sweety@localhost:5432/sweety',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Public URL used in links inside emails (defaults to the first client origin).
  appUrl: env.APP_URL || (env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0],
  // Fallback only: each user has their own timezone (users.timezone).
  defaultTimezone: 'UTC',
  redisUrl: env.REDIS_URL || '',
  reportCacheTtl: Number(env.REPORT_CACHE_TTL) || 300,
  // How often the reminder job looks for users whose reminder time has arrived.
  reminderCron: env.REMINDER_CRON || '*/10 * * * *',
  reminderIntervalMs: Number(env.REMINDER_INTERVAL_MS) || 10 * 60 * 1000,
  // Email. Without SMTP_URL, emails are printed to the server console instead of sent.
  smtpUrl: env.SMTP_URL || '',
  mailFrom: env.MAIL_FROM || 'Sweety <no-reply@sweety.local>',
  // Web push (generate with `npm --prefix server run vapid`). Push is disabled when unset.
  vapidPublicKey: env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: env.VAPID_PRIVATE_KEY || '',
  vapidSubject: env.VAPID_SUBJECT || 'mailto:admin@sweety.local',
};
