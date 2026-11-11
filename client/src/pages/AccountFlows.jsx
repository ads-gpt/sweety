import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Logo, ThemeToggle } from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

/** Centered single-card layout shared by forgot / reset / verify pages. */
function Shell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex items-center justify-between p-5"><Logo /><ThemeToggle /></div>
      <div className="flex flex-1 items-start justify-center px-6 pb-12 pt-[clamp(1rem,9vh,5.5rem)]">
        <div className="w-full max-w-sm">
          <h1 className="text-[2.5rem] leading-[1.05]">{title}</h1>
          {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address.');
    setBusy(true);
    try { await api.forgotPassword(email.trim()); setSent(true); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <Shell title="Check your email" subtitle={`If an account exists for ${email.trim()}, we've sent a link to reset your password. It works for one hour.`}>
        <Button asChild variant="outline" className="w-full"><Link to="/">Back to sign in</Link></Button>
      </Shell>
    );
  }
  return (
    <Shell title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={submit} noValidate className="space-y-5" aria-label="Forgot password">
        <Field id="forgot-email" label="Email" error={error}>
          <Input id="forgot-email" type="email" autoComplete="email" value={email} invalid={!!error} placeholder="you@example.com" onChange={(e) => { setEmail(e.target.value); setError(''); }} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Send reset link</Button>
        <p className="text-center text-sm"><Link to="/" className="font-medium underline underline-offset-4">Back to sign in</Link></p>
      </form>
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    try { await api.resetPassword(token, password); setDone(true); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (!token) return <Shell title="Link not valid" subtitle="This reset link is missing its token. Request a new one."><Button asChild className="w-full"><Link to="/forgot-password">Request a new link</Link></Button></Shell>;
  if (done) {
    return (
      <Shell title="Password updated" subtitle="You can now sign in with your new password.">
        <Button className="w-full" size="lg" onClick={() => navigate('/', { replace: true })}>Continue to sign in</Button>
      </Shell>
    );
  }
  return (
    <Shell title="Choose a new password" subtitle="Use at least 8 characters.">
      <form onSubmit={submit} noValidate className="space-y-5" aria-label="Reset password">
        <Field id="new-password" label="New password" error={error}>
          <Input id="new-password" type="password" autoComplete="new-password" value={password} invalid={!!error} onChange={(e) => { setPassword(e.target.value); setError(''); }} />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Update password</Button>
      </form>
    </Shell>
  );
}

// The link's token is single-use, and React may run an effect twice (StrictMode / remounts),
// so share one in-flight request per token instead of spending the token twice.
const verifyRequests = new Map();
const verifyOnce = (token) => {
  if (!verifyRequests.has(token)) verifyRequests.set(token, api.verifyEmail(token));
  return verifyRequests.get(token);
};

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { user, refresh } = useAuth();
  const [state, setState] = useState(token ? 'working' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing its token.');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyOnce(token)
      .then(async () => { if (!cancelled) { setState('ok'); if (user) await refresh().catch(() => {}); } })
      .catch((err) => { if (!cancelled) { setState('error'); setMessage(err.message); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Shell title={state === 'ok' ? 'Email verified' : state === 'error' ? 'Link not valid' : 'Verifying…'}>
      {state === 'working' && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      {state === 'ok' && (
        <div className="space-y-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" />Thanks - your email address is confirmed.</p>
          <Button asChild size="lg" className="w-full"><Link to="/">Open Sweety</Link></Button>
        </div>
      )}
      {state === 'error' && (
        <div className="space-y-5">
          <p className="flex items-center gap-2 text-sm text-destructive"><XCircle className="size-4" />{message}</p>
          <Button asChild size="lg" variant="outline" className="w-full"><Link to="/">Go to Sweety</Link></Button>
        </div>
      )}
    </Shell>
  );
}
