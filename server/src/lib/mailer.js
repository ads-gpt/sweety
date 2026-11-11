import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transport = null;
/** In tests, outgoing mail is captured here instead of being sent. */
export const outbox = [];

export async function sendMail({ to, subject, text }) {
  if (config.env === 'test') {
    outbox.push({ to, subject, text });
    return;
  }
  if (!config.smtpUrl) {
    // Dev fallback: show the email (and any link in it) in the server console.
    console.log(`\n[mail] To: ${to}\n[mail] Subject: ${subject}\n${text}\n`);
    return;
  }
  transport ??= nodemailer.createTransport(config.smtpUrl);
  await transport.sendMail({ from: config.mailFrom, to, subject, text });
}

/** Fire-and-forget wrapper: a mail failure must never break the request that triggered it. */
export const trySendMail = (mail) => sendMail(mail).catch((err) => console.error('[mail] failed:', err.message));
