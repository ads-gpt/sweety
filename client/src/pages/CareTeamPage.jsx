import { useState } from 'react';
import { Stethoscope, UserPlus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from '@/components/ui/primitives';
import { PageHeader } from '@/components/AppShell';
import { EmptyState } from '@/components/ReportView';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';

export default function CareTeamPage() {
  const { data, loading, reload } = useAsync(() => api.doctors(), []);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your doctor\'s email.');
    setBusy(true);
    try {
      const r = await api.addDoctor(email.trim());
      toast.success(`${r.doctor.name} can now view your reports`);
      setEmail(''); setError(''); reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(d) {
    try { await api.removeDoctor(d.id); toast.success(`Stopped sharing with ${d.name}`); reload(); } catch (err) { toast.error(err.message); }
  }

  return (
    <>
      <PageHeader title="Care team" subtitle="Choose which doctors can view your readings and reports. You stay in control and can revoke access any time." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2 self-start">
          <CardHeader><CardTitle>Share with a doctor</CardTitle><CardDescription>They need a Sweety doctor account.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={add} noValidate className="space-y-4" aria-label="Share with a doctor">
              <Field id="doctor-email" label="Doctor's email" error={error}>
                <Input id="doctor-email" type="email" placeholder="doctor@clinic.com" value={email} invalid={!!error} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
              </Field>
              <Button type="submit" variant="brand" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />}Share my reports</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>People with access</CardTitle></CardHeader>
          <CardContent>
            {loading && !data ? null : data?.data.length ? (
              <ul className="divide-y">
                {data.data.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-10 place-items-center rounded-full bg-secondary text-primary"><Stethoscope className="size-5" /></span>
                    <div className="min-w-0 flex-1"><p className="font-medium">{d.name}</p><p className="truncate text-sm text-muted-foreground">{d.email}</p></div>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => remove(d)} aria-label={`Stop sharing with ${d.name}`}><Trash2 />Remove</Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Not shared with anyone" text="Your readings are private. Share them with your doctor to get feedback." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
