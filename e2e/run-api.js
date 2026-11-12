// Starts the API for the e2e run (Playwright launches web servers before any global setup, so the
// database preparation lives here): create the test database if needed, empty the mail outbox,
// load the demo data, then boot the real server in this process.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { DATABASE_URL, OUTBOX_DIR } from './playwright.config.js';

const serverDir = path.resolve(import.meta.dirname, '..', 'server');

const admin = new URL(DATABASE_URL);
const dbName = admin.pathname.slice(1);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
if (!exists.rowCount) await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
await client.end();

fs.rmSync(OUTBOX_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTBOX_DIR, { recursive: true });

const seed = spawnSync('node', ['src/db/seed.js'], { cwd: serverDir, env: { ...process.env, DATABASE_URL }, encoding: 'utf8' });
if (seed.status !== 0) {
  console.error(`seeding the e2e database failed:\n${seed.stdout}\n${seed.stderr}`);
  process.exit(1);
}

// All configuration comes from the environment Playwright passes in (this folder has no .env).
await import(pathToFileURL(path.join(serverDir, 'src', 'index.js')).href);
