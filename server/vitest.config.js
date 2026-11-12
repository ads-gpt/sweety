import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.js'],
    include: ['tests/**/*.test.js'],
    fileParallelism: false, // integration tests share one database
    testTimeout: 20000,
    hookTimeout: 120000,
    // Hermetic: never pick up real mail credentials or an outbox folder from a developer's .env.
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-secret', MAILGUN_API_KEY: '', MAILGUN_SENDER_NAME: '', FROM_EMAIL: '', MAIL_OUTBOX_DIR: '', MAX_FAILED_LOGINS: '', LOCK_MINUTES: '' },
  },
});
