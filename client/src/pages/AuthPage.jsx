import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Logo, ThemeToggle } from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/** Smoothly expands/collapses its content (height + fade) so switching modes doesn't jump. */
function Collapse({ show, children }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
          className="-m-1 overflow-hidden p-1"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Static sketch of a typical day: four readings against the 70-180 band. */
function DaySketch() {
  const y = (v) => 170 - (v - 60) * 0.6;
  const pts = [
    { x: 44, v: 98, label: 'Fasting' },
    { x: 158, v: 158, label: 'Breakfast' },
    { x: 272, v: 146, label: 'Lunch' },
    { x: 386, v: 128, label: 'Dinner' },
  ];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${y(p.v)}`).join(' ');
  return (
    <figure aria-hidden>
      <svg viewBox="0 0 430 200" className="w-full max-w-md text-foreground">
        <rect x="0" y={y(180)} width="430" height={y(70) - y(180)} fill="var(--success)" opacity="0.1" />
        <line x1="0" x2="430" y1={y(180)} y2={y(180)} stroke="var(--success)" strokeOpacity=".5" strokeDasharray="2 4" />
        <line x1="0" x2="430" y1={y(70)} y2={y(70)} stroke="var(--success)" strokeOpacity=".5" strokeDasharray="2 4" />
        <text x="2" y={y(180) - 5} fontSize="10" fill="var(--muted-foreground)">180</text>
        <text x="2" y={y(70) + 12} fontSize="10" fill="var(--muted-foreground)">70</text>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
        {pts.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={y(p.v)} r="3.5" fill="currentColor" />
            <text x={p.x} y={y(p.v) - 12} textAnchor="middle" fontSize="13" fontFamily="var(--font-display)" fill="currentColor">{p.v}</text>
            <text x={p.x} y="194" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{p.label}</text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 text-xs text-muted-foreground">A typical day, in mg/dl. Four readings are all it takes.</figcaption>
    </figure>
  );
}

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'patient', licenseNumber: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); setFormError(''); };

  function validate() {
    const e = {};
    if (mode === 'signup' && !form.name.trim()) e.name = 'Please enter your name.';
    if (mode === 'signup' && form.role === 'doctor' && !form.licenseNumber.trim()) e.licenseNumber = 'Please enter your medical registration number.';
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
      if (err.field && ['name', 'email', 'password', 'licenseNumber'].includes(err.field)) setErrors({ [err.field]: err.message });
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const fillDemo = (role) => setForm((f) => ({ ...f, email: role === 'doctor' ? 'doctor@sweety.app' : 'demo@sweety.app', password: 'Password123!' }));

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Pinned to the viewport height so it never stretches (and re-centres) when the form on the right grows. */}
      <div className="sticky top-0 hidden h-dvh flex-col gap-16 self-start overflow-hidden border-r bg-paper-2 px-16 py-14 lg:flex">
        <Logo />
        <div className="my-auto max-w-lg py-4">
          <h2 className="text-[clamp(2.75rem,4vw,3.75rem)] leading-[1.04]">A quiet place to keep track of your sugar.</h2>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-muted-foreground">Log up to four readings a day. Sweety turns them into plain daily and monthly summaries you can show your doctor.</p>
          <div className="mt-14 hidden [@media(min-height:800px)]:block"><DaySketch /></div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-5 lg:justify-end"><Logo className="lg:hidden" /><ThemeToggle /></div>
        <div className="flex flex-1 items-start justify-center px-6 pb-12 pt-[clamp(1rem,9vh,5.5rem)]">
          <div className="w-full max-w-sm">
            <div className="min-h-[5.25rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                <h1 className="text-[2.5rem] leading-[1.05]">{mode === 'login' ? 'Welcome back' : 'Create an account'}</h1>
                <p className="mt-3 text-muted-foreground">{mode === 'login' ? 'Sign in to see your readings.' : 'It takes less than a minute.'}</p>
              </motion.div>
            </AnimatePresence>
            </div>

            <Tabs value={mode} onValueChange={(m) => { setMode(m); setErrors({}); setFormError(''); }} className="mt-8">
              <TabsList className="w-full">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={submit} noValidate className="mt-7" aria-label={mode === 'login' ? 'Sign in' : 'Sign up'}>
              <Collapse show={mode === 'signup'}>
                <div className="space-y-5 pb-5">
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
                    {[['patient', 'Patient'], ['doctor', 'Doctor']].map(([value, label]) => (
                      <button
                        key={value} type="button" role="radio" aria-checked={form.role === value}
                        onClick={() => setForm((f) => ({ ...f, role: value }))}
                        className={cn('cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors', form.role === value ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Field id="name" label="Full name" error={errors.name}>
                    <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} invalid={!!errors.name} placeholder="Jane Doe" />
                  </Field>
                  <Collapse show={form.role === 'doctor'}>
                    <Field id="license" label="Medical registration number" error={errors.licenseNumber} hint="We verify this before patients can share readings with you.">
                      <Input id="license" value={form.licenseNumber} onChange={set('licenseNumber')} invalid={!!errors.licenseNumber} placeholder="e.g. KMC-12345" />
                    </Field>
                  </Collapse>
                </div>
              </Collapse>
              <div className="pb-5">
                <Field id="email" label="Email" error={errors.email}>
                  <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!errors.email} placeholder="you@example.com" />
                </Field>
              </div>
              <div className="pb-5">
                <Field id="password" label="Password" error={errors.password}>
                  <Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} invalid={!!errors.password} />
                </Field>
                <Collapse show={mode === 'signup' && !errors.password}>
                  <p className="pt-2 text-xs text-muted-foreground">At least 8 characters.</p>
                </Collapse>
                <Collapse show={mode === 'login'}>
                  <p className="pt-2 text-right text-xs"><Link to="/forgot-password" className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">Forgot password?</Link></p>
                </Collapse>
              </div>

              {formError && <p role="alert" className="mb-5 rounded-md border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive">{formError}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}{mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </form>

            <Collapse show={mode === 'login'}>
              <p className="pt-8 text-center text-xs text-muted-foreground">
                Demo accounts:{' '}
                <button type="button" className="cursor-pointer font-semibold text-foreground underline underline-offset-4" onClick={() => fillDemo('patient')}>patient</button>{' · '}
                <button type="button" className="cursor-pointer font-semibold text-foreground underline underline-offset-4" onClick={() => fillDemo('doctor')}>doctor</button>
              </p>
            </Collapse>
          </div>
        </div>
      </div>
    </div>
  );
}
