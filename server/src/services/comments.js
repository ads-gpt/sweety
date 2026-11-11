import { query } from '../db/pool.js';
import { notFound } from '../lib/errors.js';
import { invalidateReports } from '../lib/cache.js';

const present = (r) => ({
  id: r.id,
  date: r.comment_date,
  body: r.body,
  createdAt: r.created_at,
  doctor: { id: r.doctor_id, name: r.doctor_name },
});

const SELECT = `SELECT c.id, c.doctor_id, c.comment_date, c.body, c.created_at, u.name AS doctor_name
                FROM doctor_comments c JOIN users u ON u.id = c.doctor_id`;

export async function addComment(doctorId, patientId, { date, body }) {
  const { rows } = await query(
    'INSERT INTO doctor_comments (doctor_id, patient_id, comment_date, body) VALUES ($1,$2,$3,$4) RETURNING id',
    [doctorId, patientId, date, body],
  );
  await invalidateReports(patientId);
  return (await query(`${SELECT} WHERE c.id = $1`, [rows[0].id])).rows.map(present)[0];
}

export async function deleteComment(doctorId, commentId) {
  const { rows } = await query('DELETE FROM doctor_comments WHERE id = $1 AND doctor_id = $2 RETURNING patient_id', [commentId, doctorId]);
  if (!rows[0]) throw notFound('Comment not found.');
  await invalidateReports(rows[0].patient_id);
}

export async function commentsBetween(patientId, from, to) {
  const { rows } = await query(
    `${SELECT} WHERE c.patient_id = $1 AND c.comment_date BETWEEN $2 AND $3 ORDER BY c.comment_date DESC, c.created_at DESC`,
    [patientId, from, to],
  );
  return rows.map(present);
}

export async function recentComments(patientId, { doctorId, limit = 20 } = {}) {
  const params = [patientId, limit];
  let extra = '';
  if (doctorId) { params.push(doctorId); extra = ' AND c.doctor_id = $3'; }
  const { rows } = await query(
    `${SELECT} WHERE c.patient_id = $1${extra} ORDER BY c.comment_date DESC, c.created_at DESC LIMIT $2`,
    params,
  );
  return rows.map(present);
}
