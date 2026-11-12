import * as webpush from 'web-push';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { logger } from './logger.js';

export const pushEnabled = Boolean(config.vapidPublicKey && config.vapidPrivateKey);
if (pushEnabled) webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);

/** Send a notification to every device a user subscribed. Returns how many were delivered. */
export async function sendPush(userId, payload) {
  if (!pushEnabled) return 0;
  const { rows } = await query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
  let delivered = 0;
  for (const s of rows) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
      delivered++;
    } catch (err) {
      // 404/410 = the browser unsubscribed; drop the dead subscription.
      if (err.statusCode === 404 || err.statusCode === 410) await query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
      else logger.error({ status: err.statusCode, err: err.message }, 'push failed');
    }
  }
  return delivered;
}
