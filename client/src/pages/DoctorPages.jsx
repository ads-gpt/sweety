import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Field, Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/AppShell';
import { EmptyState, ReportExplorer } from '@/components/ReportView';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatDate, todayISO } from '@/lib/dates';

export function DoctorPatients() {
  const { user } = useAuth();
  const pending = user.doctorStatus !== 'verified';
  const { data, loading, error } = useAsync(() => (pending ? Promise.resolve({ data: [] }) : api.patients()), [pending]);

  return (
    <>
      <PageHeader title="My patients" subtitle="Patients who have shared their glucose readings with you." />
      {pending ? (
        <EmptyState
          title={user.doctorStatus === 'rejected' ? 'Registration not approved' : 'Waiting for verification'}
          text={user.doctorStatus === 'rejected'
            ? 'We could not verify your registration number, so patients cannot share readings with you.'
            : `Your registration ${user.licenseNumber ?? ''} is being checked. Once it is approved, patients can add you under Care team and their readings will appear here.`}
        />
      ) : error ? (
        <p role="alert" className="text-sm font-medium text-destructive">{error.message}</p>
      ) : loading && !data ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : data.data.length === 0 ? (
        <EmptyState title="No patients yet" text="Ask your patients to add your email under Care team in their Sweety account." />
      ) : (
        <Card>
          <ul className="divide-y" aria-label="Patients">
            {data.data.map((p) => (
              <li key={p.id}>
                <Link to={`/patients/${p.id}`} className="flex items-center gap-4 px-6 py-5 transition-colors hover:bg-secondary/60">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg">{p.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{p.email}</p>
                  </div>
                  <div className="hidden text-right text-sm sm:block">
                    <p className="font-medium">{p.readingsLast30Days} readings / 30 days</p>
                    <p className="text-muted-foreground">{p.lastReadingDate ? `Last: ${formatDate(p.lastReadingDate)}` : 'No readings yet'}</p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function CommentComposer({ patientId, onAdded }) {
  const [date, setDate] = useState(todayISO());
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return setError('Please write a comment.');
    setBusy(true);
    try {
      await api.addComment(patientId, { date, body: body.trim() });
      setBody('');
      setError('');
      toast.success('Comment sent to your patient');
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Add a comment" className="space-y-4 rounded-lg border bg-card p-6 print:hidden">
      <div>
        <h3 className="text-xl">Leave a note for your patient</h3>
        <p className="mt-1 text-sm text-muted-foreground">They'll see it on their dashboard and in the report for that day, and get an email.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <Field id="comment-date" label="About the day">
          <input id="comment-date" type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:border-foreground focus-visible:outline-none" />
        </Field>
        <Field id="comment-body" label="Comment" error={error}>
          <textarea
            id="comment-body" rows={3} maxLength={1000} value={body} onChange={(e) => { setBody(e.target.value); setError(''); }}
            aria-invalid={error ? true : undefined}
            className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
            placeholder="e.g. Evening readings look better this week. Keep it up."
          />
        </Field>
      </div>
      <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Send comment</Button></div>
    </form>
  );
}

export function DoctorPatientReport() {
  const { id } = useParams();
  const patientId = Number(id);
  const { data } = useAsync(() => api.patients(), []);
  const patient = data?.data.find((p) => String(p.id) === id);
  const [version, setVersion] = useState(0);

  async function removeComment(c) {
    try { await api.deleteComment(c.id); toast.success('Comment deleted'); setVersion((v) => v + 1); } catch (e) { toast.error(e.message); }
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 print:hidden"><Link to="/"><ArrowLeft />All patients</Link></Button>
      <div className="print:hidden"><PageHeader title={patient?.name ?? 'Patient'} subtitle={patient?.email ?? 'Reports shared with you'} /></div>
      <ReportExplorer
        patientId={patientId} patientName={patient?.name} reloadKey={version}
        onDeleteComment={removeComment}
        extra={<CommentComposer patientId={patientId} onAdded={() => setVersion((v) => v + 1)} />}
      />
    </>
  );
}
