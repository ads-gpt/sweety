import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.js'],
    include: ['tests/**/*.test.js'],
    fileParallelism: false, // integration tests share one database
    testTimeout: 20000,
    hookTimeout: 120000,
    env: { NODE_ENV: 'test', JWT_SECRET: 'test-secret', APP_TIMEZONE: 'UTC' },
  },
});
