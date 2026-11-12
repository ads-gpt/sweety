import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';
import { startReminderJobs } from './jobs/reminders.js';

if (config.isProd && config.jwtSecret === 'dev-only-secret-change-me') {
  logger.fatal('Refusing to start: set JWT_SECRET in production.');
  process.exit(1);
}

await migrate(); // idempotent; keeps first-run setup to a single command
const server = createApp().listen(config.port, () => logger.info(`Sweety API listening on http://localhost:${config.port}`));
const jobs = await startReminderJobs().catch((err) => { logger.error({ err: err.message }, 'reminders failed to start'); return null; });

// Finish in-flight requests and close the database cleanly on deploy / Ctrl+C.
const shutdown = (signal) => {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await jobs?.close().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
