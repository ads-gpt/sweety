import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from './logger.js';

/** In tests, outgoing mail is captured here instead of being sent. */
export const outbox = [];

export const isMailConfigured = (cfg = config) => Boolean(cfg.mailgunApiKey && cfg.fromEmail && cfg.fromEmail.includes('@'));

/**
 * Send one email through the Mailgun HTTP API (POST {base}/v3/{domain}/messages, basic auth "api:KEY").
 * `fetchImpl` is injectable so the request shape can be tested without the network.
 */
export async function sendViaMailgun({ to, subject, text, html }, cfg = config, fetchImpl = fetch) {
  const domain = cfg.fromEmail.split('@')[1];
  const form = new URLSearchParams();
  form.set('from', `${cfg.senderName} <${cfg.fromEmail}>`);
  form.set('to', to);
  form.set('subject', subject);
  form.set('text', text);
  if (html) form.set('html', html);

  const res = await fetchImpl(`${cfg.mailgunBaseUrl}/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${cfg.mailgunApiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!res.ok) throw new Error(`Mailgun responded with HTTP ${res.status}`);
}

export async function sendMail(mail) {
  if (config.env === 'test') {
    outbox.push(mail);
    return;
  }
  if (config.mailOutboxDir) {
    // Development / end-to-end tests: a JSON line per email that scripts can read back.
    fs.mkdirSync(config.mailOutboxDir, { recursive: true });
    fs.appendFileSync(path.join(config.mailOutboxDir, 'outbox.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...mail }) + '\n');
    return;
  }
  if (!isMailConfigured()) {
    // Dev fallback: show the email (and any link in it) in the server console.
    logger.info({ to: mail.to, subject: mail.subject }, `email not sent (no MAILGUN_API_KEY)\n${mail.text}`);
    return;
  }
  await sendViaMailgun(mail);
}

/** Fire-and-forget wrapper: a mail failure must never break the request that triggered it. */
export const trySendMail = (mail) => sendMail(mail).catch((err) => logger.error({ err: err.message, to: mail.to }, 'email failed'));
