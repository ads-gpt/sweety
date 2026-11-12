import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { glucoseAlert, CRITICAL_LOW } from '../src/lib/alerts.js';
import { DEFAULT_TARGETS } from '../src/lib/targets.js';
import { api, auth, signup, reading, post } from './helpers.js';

beforeAll(async () => { await migrate(); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => { await pool.query('TRUNCATE users RESTART IDENTITY CASCADE'); });

describe('glucoseAlert', () => {
  it('is critical under 54 mg/dl with treatment steps', () => {
    expect(CRITICAL_LOW).toBe(54);
    const a = glucoseAlert(52, 'after_lunch', DEFAULT_TARGETS);
    expect(a.level).toBe('critical');
    expect(a.message).toContain('52');
    expect(a.steps.join(' ')).toMatch(/15 g/);
    expect(a.steps.join(' ')).toMatch(/emergency/);
    expect(glucoseAlert(53, 'morning', DEFAULT_TARGETS).level).toBe('critical');
  });

  it('is "low" below the user\'s own low target, with the rule of 15', () => {
    const a = glucoseAlert(65, 'after_lunch', DEFAULT_TARGETS);
    expect(a).toMatchObject({ level: 'low', title: 'Low glucose' });
    expect(a.message).toContain('70');
    expect(a.steps[1]).toMatch(/15 minutes/);
  });

  it('is null for in-range and high values, and the boundary 54 is "low" not critical', () => {
    expect(glucoseAlert(70, 'after_lunch', DEFAULT_TARGETS)).toBeNull();
    expect(glucoseAlert(300, 'after_dinner', DEFAULT_TARGETS)).toBeNull();
    expect(glucoseAlert(54, 'after_lunch', DEFAULT_TARGETS).level).toBe('low');
  });

  it('follows personal targets: a stricter low makes more readings count as low', () => {
    const strict = { ...DEFAULT_TARGETS, postLow: 90 };
    expect(glucoseAlert(85, 'after_lunch', strict).level).toBe('low');
    expect(glucoseAlert(85, 'after_lunch', DEFAULT_TARGETS)).toBeNull();
  });
});

describe('alerts in the API', () => {
  it('returns an alert when a low reading is created or edited, and none for normal values', async () => {
    const u = await signup();
    const critical = await post(u.token, reading({ slot: 'after_lunch', value: 48 }));
    expect(critical.status).toBe(201);
    expect(critical.body.alert).toMatchObject({ level: 'critical', title: 'Very low glucose' });
    expect(critical.body.reading.value).toBe(48); // the reading is still saved

    const low = await post(u.token, reading({ slot: 'after_dinner', value: 66 }));
    expect(low.body.alert.level).toBe('low');

    const normal = await post(u.token, reading({ slot: 'morning', value: 110 }));
    expect(normal.body.alert).toBeNull();

    const edited = await api().put(`/api/readings/${normal.body.reading.id}`).set(auth(u.token)).send(reading({ slot: 'morning', value: 45 }));
    expect(edited.body.alert.level).toBe('critical');
  });
});
