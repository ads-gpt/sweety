import 'dotenv/config';

const env = process.env;

export const config = {
  env: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL || 'postgres://sweety:sweety@localhost:5432/sweety',
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  // IANA timezone used to decide what "today" means when rejecting future dates.
  timezone: env.APP_TIMEZONE || 'UTC',
  redisUrl: env.REDIS_URL || '',
  reportCacheTtl: Number(env.REPORT_CACHE_TTL) || 300,
  reminderCron: env.REMINDER_CRON || '0 20 * * *',
};
