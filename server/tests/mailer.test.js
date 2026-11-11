import { describe, it, expect, vi } from 'vitest';
import { config } from '../src/config.js';
import { isMailConfigured, sendViaMailgun } from '../src/lib/mailer.js';
import { verifyEmail, resetPasswordEmail, doctorCommentEmail, reminderEmail, escapeHtml } from '../src/lib/emails.js';

const cfg = {
  mailgunApiKey: 'key-123',
  mailgunBaseUrl: 'https://api.mailgun.net',
  fromEmail: 'sweety@mx.adarsh.run',
  senderName: 'Sweety',
};

describe('Mailgun transport', () => {
  it('sends from sweety@mx.adarsh.run by default', () => {
    expect(config.fromEmail).toBe('sweety@mx.adarsh.run');
    expect(config.senderName).toBe('Sweety');
  });

  it('posts a form to /v3/<domain>/messages with basic auth, using the From domain', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await sendViaMailgun({ to: 'a@example.com', subject: 'Hi', text: 'plain', html: '<b>rich</b>' }, cfg, fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.mailgun.net/v3/mx.adarsh.run/messages');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('api:key-123').toString('base64')}`);
    const form = init.body;
    expect(form.get('from')).toBe('Sweety <sweety@mx.adarsh.run>');
    expect(form.get('to')).toBe('a@example.com');
    expect(form.get('subject')).toBe('Hi');
    expect(form.get('text')).toBe('plain');
    expect(form.get('html')).toBe('<b>rich</b>');
  });

  it('honours a custom (e.g. EU) base URL and omits html when not given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await sendViaMailgun({ to: 'a@example.com', subject: 'Hi', text: 't' }, { ...cfg, mailgunBaseUrl: 'https://api.eu.mailgun.net' }, fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.eu.mailgun.net/v3/mx.adarsh.run/messages');
    expect(fetchImpl.mock.calls[0][1].body.has('html')).toBe(false);
  });

  it('throws when Mailgun rejects the request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(sendViaMailgun({ to: 'a@example.com', subject: 's', text: 't' }, cfg, fetchImpl)).rejects.toThrow('HTTP 401');
  });

  it('is only "configured" when an API key and From address are present', () => {
    expect(isMailConfigured(cfg)).toBe(true);
    expect(isMailConfigured({ ...cfg, mailgunApiKey: '' })).toBe(false);
    expect(isMailConfigured({ ...cfg, fromEmail: '' })).toBe(false);
  });
});

describe('email templates', () => {
  it('include the link in both the text and HTML parts', () => {
    const url = 'https://sweety.example/verify-email?token=abc123';
    const m = verifyEmail({ name: 'Eve', url });
    expect(m.subject).toBe('Verify your Sweety email');
    expect(m.text).toContain(url);
    expect(m.html).toContain(`href="${url}"`);
    expect(resetPasswordEmail({ name: 'Eve', url }).html).toContain(`href="${url}"`);
  });

  it('escape user-controlled values so they cannot inject HTML', () => {
    expect(escapeHtml('<script>alert(1)</script> & "q"')).toBe('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;');
    const m = doctorCommentEmail({ name: '<b>Eve</b>', doctorName: 'Dr <i>X</i>', date: '2026-01-10', body: '<img src=x onerror=alert(1)>', url: 'https://sweety.example' });
    expect(m.html).not.toContain('<img');
    expect(m.html).not.toContain('<b>Eve</b>');
    expect(m.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(m.text).toContain('<img src=x onerror=alert(1)>'); // plain text stays literal
  });

  it('reminder email reports progress', () => {
    const m = reminderEmail({ name: 'Eve', logged: 2, total: 4, url: 'https://sweety.example' });
    expect(m.text).toContain('2 of 4');
    expect(m.html).toContain('2 of 4');
  });
});
