// Docker-free dev database: downloads real PostgreSQL binaries via `embedded-postgres`
// and serves them on localhost:5432 with the credentials in .env.example.
import EmbeddedPostgres from 'embedded-postgres';

const port = Number(process.env.PGPORT) || 5432;
const pg = new EmbeddedPostgres({
  databaseDir: new URL('../.embedded-pg', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  user: 'sweety',
  password: 'sweety',
  port,
  persistent: true,
});

const fs = await import('node:fs');
const dir = new URL('../.embedded-pg', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const fresh = !fs.existsSync(`${dir}/PG_VERSION`);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('sweety');
console.log(`PostgreSQL ready: postgres://sweety:sweety@localhost:${port}/sweety  (Ctrl+C to stop)`);

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
