import { query, pool } from '../db/pool.js';
import { SLOTS, MAX_READINGS_PER_DAY } from '../lib/slots.js';
import { conflict, notFound } from '../lib/errors.js';
import { invalidateReports } from '../lib/cache.js';

const COLS = 'id, user_id, reading_date AS date, slot, value, notes, tags, created_at, updated_at';
const SLOT_ORDER = `CASE slot WHEN 'morning' THEN 1 WHEN 'after_breakfast' THEN 2 WHEN 'after_lunch' THEN 3 ELSE 4 END`;
const present = (row) => ({ ...row, slotLabel: SLOTS[row.slot] });

const slotConflict = (slot) =>
  conflict(`You already have ${/^[AEIOU]/.test(SLOTS[slot]) ? 'an' : 'a'} ${SLOTS[slot]} reading for this date.`, {
    field: 'slot',
    code: 'DUPLICATE_SLOT',
  });

const dayFull = () =>
  conflict('You can add only 4 readings per day.', { field: 'date', code: 'DAY_FULL' });

/** Run fn inside a transaction holding a per-user-per-day advisory lock (race-free daily cap). */
async function withDayLock(userId, date, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [userId, date]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function listReadings(userId, { page = 1, limit = 20, from, to, date, tag, q } = {}) {
  const where = ['user_id = $1'];
  const params = [userId];
  if (date) { params.push(date); where.push(`reading_date = $${params.length}`); }
  if (from) { params.push(from); where.push(`reading_date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`reading_date <= $${params.length}`); }
  if (tag) { params.push(tag); where.push(`$${params.length} = ANY(tags)`); }
  if (q) {
    // Escape LIKE wildcards so a search for "50%" matches literally.
    params.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`notes ILIKE $${params.length}`);
  }
  const clause = where.join(' AND ');

  const total = Number((await query(`SELECT COUNT(*) FROM readings WHERE ${clause}`, params)).rows[0].count);
  params.push(limit, (page - 1) * limit);
  const { rows } = await query(
    `SELECT ${COLS} FROM readings WHERE ${clause}
     ORDER BY reading_date DESC, ${SLOT_ORDER}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    data: rows.map(present),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getReading(userId, id) {
  const { rows } = await query(`SELECT ${COLS} FROM readings WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!rows[0]) throw notFound('Reading not found.');
  return present(rows[0]);
}

export async function createReading(userId, { date, slot, value, notes, tags = [] }) {
  const created = await withDayLock(userId, date, async (db) => {
    const { rows: existing } = await db.query(
      'SELECT slot FROM readings WHERE user_id = $1 AND reading_date = $2',
      [userId, date],
    );
    if (existing.length >= MAX_READINGS_PER_DAY) throw dayFull();
    if (existing.some((r) => r.slot === slot)) throw slotConflict(slot);
    const { rows } = await db.query(
      `INSERT INTO readings (user_id, reading_date, slot, value, notes, tags) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLS}`,
      [userId, date, slot, value, notes ?? null, tags],
    );
    return rows[0];
  });
  await invalidateReports(userId);
  return present(created);
}

export async function updateReading(userId, id, { date, slot, value, notes, tags = [] }) {
  const current = await getReading(userId, id);
  const updated = await withDayLock(userId, date, async (db) => {
    const { rows: clash } = await db.query(
      'SELECT id FROM readings WHERE user_id = $1 AND reading_date = $2 AND slot = $3 AND id <> $4',
      [userId, date, slot, id],
    );
    if (clash.length) throw slotConflict(slot);
    // Moving a reading onto a different day must respect that day's cap.
    if (date !== current.date) {
      const { rows: n } = await db.query(
        'SELECT COUNT(*)::int AS c FROM readings WHERE user_id = $1 AND reading_date = $2',
        [userId, date],
      );
      if (n[0].c >= MAX_READINGS_PER_DAY) throw dayFull();
    }
    const { rows } = await db.query(
      `UPDATE readings SET reading_date=$1, slot=$2, value=$3, notes=$4, tags=$5, updated_at=now()
       WHERE id=$6 AND user_id=$7 RETURNING ${COLS}`,
      [date, slot, value, notes ?? null, tags, id, userId],
    );
    return rows[0];
  });
  await invalidateReports(userId);
  return present(updated);
}

export async function deleteReading(userId, id) {
  const { rowCount } = await query('DELETE FROM readings WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!rowCount) throw notFound('Reading not found.');
  await invalidateReports(userId);
}

export async function readingsBetween(userId, from, to) {
  const { rows } = await query(
    `SELECT ${COLS} FROM readings WHERE user_id = $1 AND reading_date BETWEEN $2 AND $3
     ORDER BY reading_date, ${SLOT_ORDER}`,
    [userId, from, to],
  );
  return rows.map(present);
}
