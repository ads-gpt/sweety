import { useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui/primitives';
import { PageHeader } from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { browserTimezone, canonicalTimezone } from '@/lib/dates';
import { DEFAULT_TARGETS, MIN_VALUE, MAX_VALUE } from '@/lib/glucose';
import { pushSupported, enablePush, disablePush, currentSubscription } from '@/lib/push';
import { canInstall, isInstalled, isIos, onInstallChange, promptInstall } from '@/lib/pwa';
import { cn } from '@/lib/utils';

const selectClass = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:border-foreground focus-visible:outline-none';

function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cn('flex cursor-pointer items-start justify-between gap-4 py-3', disabled && 'cursor-not-allowed opacity-50')}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full bg-border transition-colors peer-checked:bg-foreground after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-background after:shadow after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  );
}

function Section({ title, description, children, footer }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
      <CardContent>{children}{footer && <div className="mt-5 flex items-center gap-3">{footer}</div>}</CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const isPatient = user.role === 'patient';

  return (
    <>
      <PageHeader title="Settings" subtitle="Your timezone, target ranges, reminders and account." />
      <div className="space-y-8">
        <ProfileSection user={user} setUser={setUser} />
        {isPatient && <TargetsSection user={user} setUser={setUser} />}
        {isPatient && <RemindersSection user={user} setUser={setUser} />}
        <InstallSection />
        <PasswordSection />
      </div>
    </>
  );
}

function ProfileSection({ user, setUser }) {
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return [...new Set(['UTC', ...all.map(canonicalTimezone), user.timezone, browserTimezone()])].sort();
  }, [user.timezone]);
  const device = browserTimezone();
  const dirty = name.trim() !== user.name || timezone !== user.timezone;

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter your name.');
    setBusy(true);
    try {
      const r = await api.updateSettings({ name: name.trim(), timezone });
      setUser(r.user);
      setError('');
      toast.success('Profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate aria-label="Profile">
      <Section
        title="Profile"
        description="Dates, reports and reminders follow your timezone, so 'today' always means your today."
        footer={<Button type="submit" disabled={busy || !dirty}>{busy && <Loader2 className="animate-spin" />}Save profile</Button>}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="settings-name" label="Name" error={error && !error.toLowerCase().includes('timezone') ? error : undefined}>
            <Input id="settings-name" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} />
          </Field>
          <div className="space-y-2">
            <p className="text-[13px] font-medium leading-none">Email</p>
            <p className="flex h-10 items-center gap-2 text-sm">
              {user.email}
              {user.emailVerified
                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" />Verified</span>
                : <span className="text-xs font-medium text-muted-foreground">Not verified</span>}
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="settings-timezone" className="text-[13px] font-medium leading-none">Timezone</label>
            <select id="settings-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectClass}>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </select>
            {timezone !== device && (
              <button type="button" onClick={() => setTimezone(device)} className="cursor-pointer text-xs font-medium underline underline-offset-4">Use this device's timezone ({device.replace(/_/g, ' ')})</button>
            )}
            {error && error.toLowerCase().includes('timezone') && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
          </div>
        </div>
      </Section>
    </form>
  );
}

function TargetsSection({ user, setUser }) {
  const s = user.settings;
  const [vals, setVals] = useState({ fastingLow: String(s.fastingLow), fastingHigh: String(s.fastingHigh), postLow: String(s.postLow), postHigh: String(s.postHigh) });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setVals((v) => ({ ...v, [k]: e.target.value })); setError(''); };
  const dirty = Object.keys(vals).some((k) => Number(vals[k]) !== s[k]);

  async function save(e) {
    e.preventDefault();
    const n = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)]));
    if (Object.values(n).some((x) => !Number.isInteger(x) || x < MIN_VALUE || x > MAX_VALUE)) return setError(`Targets must be whole numbers between ${MIN_VALUE} and ${MAX_VALUE}.`);
    if (n.fastingLow >= n.fastingHigh) return setError('Fasting low must be below fasting high.');
    if (n.postLow >= n.postHigh) return setError('After-meal low must be below after-meal high.');
    setBusy(true);
    try {
      const r = await api.updateSettings(n);
      setUser(r.user);
      toast.success('Target ranges saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const reset = () => setVals(Object.fromEntries(Object.entries(DEFAULT_TARGETS).map(([k, v]) => [k, String(v)])));
  const num = (id, label, key) => (
    <Field id={id} label={label}>
      <Input id={id} inputMode="numeric" value={vals[key]} onChange={set(key)} />
    </Field>
  );

  return (
    <form onSubmit={save} noValidate aria-label="Target ranges">
      <Section
        title="Target ranges"
        description="Used for the In range / High / Low labels, time in range and chart. Ask your doctor what's right for you."
        footer={<>
          <Button type="submit" disabled={busy || !dirty}>{busy && <Loader2 className="animate-spin" />}Save targets</Button>
          <Button type="button" variant="ghost" onClick={reset}>Reset to defaults</Button>
          {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
        </>}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <fieldset className="space-y-4"><legend className="eyebrow mb-3">Fasting (morning)</legend>
            <div className="grid grid-cols-2 gap-4">{num('t-fl', 'Low', 'fastingLow')}{num('t-fh', 'High', 'fastingHigh')}</div>
          </fieldset>
          <fieldset className="space-y-4"><legend className="eyebrow mb-3">After meals</legend>
            <div className="grid grid-cols-2 gap-4">{num('t-pl', 'Low', 'postLow')}{num('t-ph', 'High', 'postHigh')}</div>
          </fieldset>
        </div>
      </Section>
    </form>
  );
}

function RemindersSection({ user, setUser }) {
  const s = user.settings;
  const [pushOn, setPushOn] = useState(false);
  const [pushServer, setPushServer] = useState(null);
  const [time, setTime] = useState(s.reminderTime);
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    api.pushKey().then((r) => setPushServer(r.enabled)).catch(() => setPushServer(false));
    currentSubscription().then((sub) => setPushOn(Boolean(sub))).catch(() => {});
  }, []);

  async function save(patch, okMessage) {
    setBusy(true);
    try {
      const r = await api.updateSettings(patch);
      setUser(r.user);
      if (okMessage) toast.success(okMessage);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePush(on) {
    setBusy(true);
    try {
      if (on) {
        await enablePush();
        setPushOn(true);
        const r = await api.updateSettings({ reminderPush: true });
        setUser(r.user);
        toast.success('Push reminders are on for this device');
      } else {
        await disablePush();
        setPushOn(false);
        const r = await api.updateSettings({ reminderPush: false });
        setUser(r.user);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Reminders" description={`A gentle nudge once a day, at your chosen time (${user.timezone.replace(/_/g, ' ')}), only if you haven't logged all four readings yet.`}>
      <div className="divide-y">
        <Toggle checked={s.reminderEnabled} disabled={busy} onChange={(v) => save({ reminderEnabled: v })} label="Daily reminder" />
        <div className={cn('flex items-center justify-between gap-4 py-3', !s.reminderEnabled && 'opacity-50')}>
          <label htmlFor="reminder-time" className="text-sm font-medium">Reminder time</label>
          <input
            id="reminder-time" type="time" value={time} disabled={!s.reminderEnabled || busy}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => time && time !== s.reminderTime && save({ reminderTime: time }, 'Reminder time saved')}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-sm focus-visible:border-foreground focus-visible:outline-none"
          />
        </div>
        <Toggle checked={s.reminderEmail} disabled={!s.reminderEnabled || busy} onChange={(v) => save({ reminderEmail: v })} label="By email" description={user.email} />
        <Toggle
          checked={s.reminderPush && pushOn} disabled={!s.reminderEnabled || busy || !supported || pushServer === false}
          onChange={togglePush} label="Push notification on this device"
          description={!supported ? 'This browser does not support push notifications.' : pushServer === false ? 'Not configured on this server.' : 'Works even when Sweety is closed (install the app for the best results).'}
        />
      </div>
    </Section>
  );
}

function InstallSection() {
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  const installed = isInstalled();

  return (
    <Section title="Install the app" description="Add Sweety to your home screen or desktop. It opens full screen and works offline for pages you've already seen.">
      {installed ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" />Sweety is installed on this device.</p>
      ) : canInstall() ? (
        <Button onClick={() => promptInstall()}><Download />Install Sweety</Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {isIos()
            ? 'On iPhone or iPad: tap the Share button, then "Add to Home Screen".'
            : 'Use your browser\'s menu - "Install Sweety" or "Add to Home screen" - to install it.'}
        </p>
      )}
    </Section>
  );
}

function PasswordSection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors({}); };

  async function save(e) {
    e.preventDefault();
    if (!form.currentPassword) return setErrors({ currentPassword: 'Please enter your current password.' });
    if (form.newPassword.length < 8) return setErrors({ newPassword: 'Password must be at least 8 characters.' });
    setBusy(true);
    try {
      await api.changePassword(form);
      setForm({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      setErrors({ [err.field === 'currentPassword' ? 'currentPassword' : 'newPassword']: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate aria-label="Change password">
      <Section title="Password" footer={<Button type="submit" variant="outline" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Change password</Button>}>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="pw-current" label="Current password" error={errors.currentPassword}>
            <Input id="pw-current" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} invalid={!!errors.currentPassword} />
          </Field>
          <Field id="pw-new" label="New password" error={errors.newPassword}>
            <Input id="pw-new" type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} invalid={!!errors.newPassword} />
          </Field>
        </div>
      </Section>
    </form>
  );
}
