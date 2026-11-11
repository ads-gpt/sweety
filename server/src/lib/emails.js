// Email templates: plain-text + branded HTML (paper / ink, same look as the app).
// Every dynamic value that goes into HTML is escaped.
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

function shell({ preheader, heading, bodyHtml }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f2ea;">
    <span style="display:none;font-size:1px;color:#f5f2ea;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ea;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#fbfaf5;border-radius:10px;border:1px solid #ddd8c9;">
            <tr>
              <td style="padding:28px 32px 0 32px;font-family:${SERIF};font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#1c1b17;">Sweety</td>
            </tr>
            <tr>
              <td style="padding:22px 32px 4px 32px;">
                <h1 style="margin:0;font-family:${SERIF};font-weight:400;font-size:26px;line-height:1.2;letter-spacing:-0.3px;color:#1c1b17;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 32px 30px 32px;font-family:${SANS};font-size:15px;line-height:1.65;color:#3d3b33;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 26px 32px;border-top:1px solid #ddd8c9;font-family:${SANS};font-size:12px;line-height:1.6;color:#6e6a5d;">
                You're receiving this because you have a Sweety account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const p = (html, last = false) => `<p style="margin:0 0 ${last ? 0 : 16}px 0;">${html}</p>`;
const button = (url, label) =>
  `<p style="margin:0 0 20px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background-color:#1c1b17;color:#f5f2ea;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:6px;">${escapeHtml(label)}</a></p>`;
const quote = (text) =>
  `<p style="margin:0 0 20px 0;padding:12px 16px;background-color:#ece8dc;border-left:3px solid #1c1b17;border-radius:4px;">${escapeHtml(text)}</p>`;

export function verifyEmail({ name, url }) {
  return {
    subject: 'Verify your Sweety email',
    text: `Hi ${name},\n\nConfirm your email address to finish setting up Sweety:\n${url}\n\nThis link works for 24 hours. If you didn't create an account, you can ignore this email.`,
    html: shell({
      preheader: 'Confirm your email address to finish setting up Sweety.',
      heading: 'Confirm your email',
      bodyHtml: p(`Hi ${escapeHtml(name)},`) + p('Confirm your email address to finish setting up your Sweety account. The link works for 24 hours.') + button(url, 'Verify email') + p("If you didn't create an account, you can safely ignore this message.", true),
    }),
  };
}

export function resetPasswordEmail({ name, url }) {
  return {
    subject: 'Reset your Sweety password',
    text: `Hi ${name},\n\nUse this link to choose a new password:\n${url}\n\nThe link works for 1 hour. If you didn't ask for this, you can ignore this email.`,
    html: shell({
      preheader: 'Choose a new password for your Sweety account.',
      heading: 'Reset your password',
      bodyHtml: p(`Hi ${escapeHtml(name)},`) + p('We received a request to reset your Sweety password. The link works for 1 hour.') + button(url, 'Choose a new password') + p("If you didn't ask for this, you can safely ignore this message.", true),
    }),
  };
}

export function doctorCommentEmail({ name, doctorName, date, body, url }) {
  return {
    subject: `${doctorName} left a comment on your readings`,
    text: `Hi ${name},\n\n${doctorName} commented on ${date}:\n\n"${body}"\n\nOpen Sweety to see it: ${url}`,
    html: shell({
      preheader: `${doctorName} left a note about ${date}.`,
      heading: 'A note from your doctor',
      bodyHtml: p(`Hi ${escapeHtml(name)},`) + p(`<strong>${escapeHtml(doctorName)}</strong> commented on your readings for ${escapeHtml(date)}:`) + quote(body) + button(url, 'Open Sweety'),
    }),
  };
}

export function reminderEmail({ name, logged, total, url }) {
  const left = total - logged;
  const line = `You've logged ${logged} of ${total} readings today. Take a minute to add the other ${left}.`;
  return {
    subject: 'Time to log your glucose',
    text: `Hi ${name},\n\n${line}\n\nOpen Sweety: ${url}`,
    html: shell({
      preheader: line,
      heading: 'Time to log your glucose',
      bodyHtml: p(`Hi ${escapeHtml(name)},`) + p(escapeHtml(line)) + button(url, 'Add a reading') + p('You can change or turn off this reminder in Settings.', true),
    }),
  };
}

export function doctorStatusEmail({ name, license, verified }) {
  return {
    subject: verified ? 'Your Sweety doctor account is verified' : 'Your Sweety doctor registration was not approved',
    text: verified
      ? `Hi ${name},\n\nYour registration (${license}) has been verified. Patients can now share their readings with you.`
      : `Hi ${name},\n\nWe could not verify your registration (${license}).`,
    html: shell({
      preheader: verified ? 'Patients can now share their readings with you.' : 'We could not verify your registration.',
      heading: verified ? 'You are verified' : 'Registration not approved',
      bodyHtml: p(`Hi ${escapeHtml(name)},`) + p(verified
        ? `Your registration <strong>${escapeHtml(license)}</strong> has been verified. Patients can now share their readings with you.`
        : `We could not verify your registration <strong>${escapeHtml(license)}</strong>.`, true),
    }),
  };
}
