import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button, Card, Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/AppShell';
import { EmptyState, ReportExplorer } from '@/components/ReportView';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/dates';

export function DoctorPatients() {
  const { data, loading, error } = useAsync(() => api.patients(), []);
  return (
    <>
      <PageHeader title="My patients" subtitle="Patients who have shared their glucose readings with you." />
      {error ? (
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
                <Link to={`/patients/${p.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/60">
                  
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

export function DoctorPatientReport() {
  const { id } = useParams();
  const { data } = useAsync(() => api.patients(), []);
  const patient = data?.data.find((p) => String(p.id) === id);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2"><Link to="/"><ArrowLeft />All patients</Link></Button>
      <PageHeader title={patient?.name ?? 'Patient'} subtitle={patient?.email ?? 'Reports shared with you'} />
      <ReportExplorer patientId={Number(id)} />
    </>
  );
}
