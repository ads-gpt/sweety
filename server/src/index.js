import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { startReminderJobs } from './jobs/reminders.js';

if (config.env === 'production' && config.jwtSecret === 'dev-only-secret-change-me') {
  console.error('Refusing to start: set JWT_SECRET in production.');
  process.exit(1);
}

await migrate(); // idempotent; keeps first-run setup to a single command
createApp().listen(config.port, () => console.log(`Sweety API listening on http://localhost:${config.port}`));
startReminderJobs().catch((err) => console.error('[reminders] failed to start:', err.message));
