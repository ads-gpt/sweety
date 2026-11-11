import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, LineChart, Stethoscope, User } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Logo, ThemeToggle } from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEATURES = [
  { icon: LineChart, title: 'Beautiful reports', text: 'Daily, month-to-date and monthly highs, lows and averages.' },
  { icon: ShieldCheck, title: 'Private by default', text: 'Only you see your readings, unless you share with your doctor.' },
  { icon: Stethoscope, title: 'Care team ready', text: 'Give your doctor read-only access to your reports.' },
];

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'patient' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); setFormError(''); };

  function validate() {
    const e = {};
    if (mode === 'signup' && !form.name.trim()) e.name = 'Please enter your name.';
    if (!form.email.trim()) e.email = 'Please enter your email.';
    else if (!EMAIL_RE.test(form.email.trim())) e.email = 'Please enter a valid email address.';
    if (!form.password) e.password = 'Please enter your password.';
    else if (mode === 'signup' && form.password.length < 8) e.password = 'Password must be at least 8 characters.';
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      if (mode === 'login') await login({ email: form.email, password: form.password });
      else await signup(form);
    } catch (err) {
      if (err.field && ['name', 'email', 'password'].includes(err.field)) setErrors({ [err.field]: err.message });
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const fillDemo = (role) => setForm((f) => ({ ...f, email: role === 'doctor' ? 'doctor@sweety.app' : 'demo@sweety.app', password: 'Password123!' }));

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-[28rem] rounded-full bg-fuchsia-300/20 blur-3xl" />
        <Logo className="relative [&_span:last-child]:text-white [&_span:first-child]:bg-white/20" />
        <div className="relative max-w-md">
          <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="font-display text-5xl font-extrabold leading-[1.05]">
            Keep your sugar<br />sweetly in check.
          </motion.h2>
          <p className="mt-4 text-lg text-white/80">Log up to four readings a day and see clear, calm reports of how you're doing.</p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <motion.li key={title} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 backdrop-blur"><Icon className="size-5" /></span>
                <div><p className="font-semibold">{title}</p><p className="text-sm text-white/75">{text}</p></div>
              </motion.li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">Sweety is a tracking aid, not medical advice.</p>
      </div>

      {/* Form panel */}
      <div className="bg-mesh flex flex-col">
        <div className="flex items-center justify-between p-5 lg:justify-end"><Logo className="lg:hidden" /><ThemeToggle /></div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
            <h1 className="font-display text-3xl font-extrabold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="mt-1.5 text-muted-foreground">{mode === 'login' ? 'Sign in to see your readings.' : 'It takes less than a minute.'}</p>

            <Tabs value={mode} onValueChange={(m) => { setMode(m); setErrors({}); setFormError(''); }} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={submit} noValidate className="mt-6 space-y-4" aria-label={mode === 'login' ? 'Sign in' : 'Sign up'}>
              {mode === 'signup' && (
                <>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
                    {[['patient', 'Patient', User], ['doctor', 'Doctor', Stethoscope]].map(([value, label, Icon]) => (
                      <button
                        key={value} type="button" role="radio" aria-checked={form.role === value}
                        onClick={() => setForm((f) => ({ ...f, role: value }))}
                        className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition', form.role === value ? 'border-primary bg-secondary text-secondary-foreground ring-2 ring-primary/20' : 'bg-card text-muted-foreground hover:bg-muted')}
                      >
                        <Icon className="size-4" />{label}
                      </button>
                    ))}
                  </div>
                  <Field id="name" label="Full name" error={errors.name}>
                    <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} invalid={!!errors.name} placeholder="Jane Doe" />
                  </Field>
                </>
              )}
              <Field id="email" label="Email" error={errors.email}>
                <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!errors.email} placeholder="you@example.com" />
              </Field>
              <Field id="password" label="Password" error={errors.password} hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
                <Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} invalid={!!errors.password} placeholder="••••••••" />
              </Field>

              {formError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{formError}</p>}

              <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}{mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            {mode === 'login' && (
              <div className="mt-6 rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                Try the demo:{' '}
                <button type="button" className="cursor-pointer font-semibold text-primary hover:underline" onClick={() => fillDemo('patient')}>patient</button>{' · '}
                <button type="button" className="cursor-pointer font-semibold text-primary hover:underline" onClick={() => fillDemo('doctor')}>doctor</button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
