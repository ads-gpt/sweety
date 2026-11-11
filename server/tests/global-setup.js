// Integration tests need a real PostgreSQL. Use TEST_DATABASE_URL if provided
// (e.g. the docker-compose db); otherwise spin up a throwaway embedded instance.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export default async function setup() {
  // Throwaway VAPID keys so web-push is enabled in tests without committing any secret.
  const webpush = await import('web-push');
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;

  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    return;
  }
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweety-test-pg-'));
  const port = 54329;
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('sweety_test');
  process.env.DATABASE_URL = `postgres://test:test@localhost:${port}/sweety_test`;

  return async () => {
    await pg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  };
}
