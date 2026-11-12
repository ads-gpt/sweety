import 'dotenv/config';

const env = process.env;
const isProd = env.NODE_ENV === 'production';
const bool = (v, fallback) => (v === undefined || v === '' ? fallback : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL || 'postgres://sweety:sweety@localhost:5432/sweety',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Public URL used in links inside emails (defaults to the first client origin).
  appUrl: env.APP_URL || (env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0],
  // Fallback only: each user has their own timezone (users.timezone).
  defaultTimezone: 'UTC',

  // Session cookie (httpOnly, so page scripts - and therefore XSS - cannot read the login token).
  cookieName: 'sweety_session',
  cookieSecure: bool(env.COOKIE_SECURE, isProd), // send only over HTTPS; on by default in production
  cookieMaxAgeMs: 7 * 24 * 3600 * 1000,

  // Brute-force protection: lock an account after N wrong passwords, for M minutes.
  maxFailedLogins: Number(env.MAX_FAILED_LOGINS) || 5,
  lockMinutes: Number(env.LOCK_MINUTES) || 15,
  authRateLimit: Number(env.AUTH_RATE_LIMIT) || 100, // requests per 15 min per IP on /api/auth

  logLevel: env.LOG_LEVEL || (env.NODE_ENV === 'test' ? 'silent' : 'info'),

  redisUrl: env.REDIS_URL || '',
  reportCacheTtl: Number(env.REPORT_CACHE_TTL) || 300,
  // How often the reminder job looks for users whose reminder time has arrived.
  reminderCron: env.REMINDER_CRON || '*/10 * * * *',
  reminderIntervalMs: Number(env.REMINDER_INTERVAL_MS) || 10 * 60 * 1000,

  // Email via the Mailgun HTTP API (same setup as the Vaakya project). The sending domain is taken
  // from FROM_EMAIL, so it must be an active sending domain on the Mailgun account.
  // Without MAILGUN_API_KEY, emails are printed to the server console instead of sent.
  mailgunApiKey: env.MAILGUN_API_KEY || '',
  mailgunBaseUrl: (env.MAILGUN_BASE_URL || 'https://api.mailgun.net').replace(/\/+$/, ''),
  fromEmail: env.FROM_EMAIL || 'sweety@mx.adarsh.run',
  senderName: env.MAILGUN_SENDER_NAME || 'Sweety',
  // Development/E2E only: write emails as JSON lines into this folder (never honoured in production).
  mailOutboxDir: isProd ? '' : env.MAIL_OUTBOX_DIR || '',

  // Web push (generate with `npm --prefix server run vapid`). Push is disabled when unset.
  vapidPublicKey: env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: env.VAPID_PRIVATE_KEY || '',
  vapidSubject: env.VAPID_SUBJECT || 'mailto:admin@sweety.local',
};
