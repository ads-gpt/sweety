import { useState } from 'react';
import { PageHeader } from '@/components/AppShell';
import { ReportExplorer } from '@/components/ReportView';
import { ReadingDialog } from '@/components/ReadingDialog';

export default function ReportsPage() {
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);
  return (
    <>
      <PageHeader title="Reports" subtitle="Highest, lowest and average readings for any day, the month so far, or last month." />
      <ReportExplorer key={version} onAdd={() => setAdding(true)} />
      <ReadingDialog open={adding} onOpenChange={setAdding} reading={null} onSaved={() => setVersion((v) => v + 1)} />
    </>
  );
}
