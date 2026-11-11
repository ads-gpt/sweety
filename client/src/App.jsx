import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import AuthPage from '@/pages/AuthPage';
import Dashboard from '@/pages/Dashboard';
import ReadingsPage from '@/pages/ReadingsPage';
import ReportsPage from '@/pages/ReportsPage';
import CareTeamPage from '@/pages/CareTeamPage';
import { DoctorPatients, DoctorPatientReport } from '@/pages/DoctorPages';
import { Spinner } from '@/components/ui/primitives';

function Routing() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-dvh place-items-center"><Spinner className="size-8 text-primary" /></div>;
  if (!user) return <AuthPage />;

  const isDoctor = user.role === 'doctor';
  return (
    <Routes>
      <Route element={<AppShell />}>
        {isDoctor ? (
          <>
            <Route index element={<DoctorPatients />} />
            <Route path="patients/:id" element={<DoctorPatientReport />} />
          </>
        ) : (
          <>
            <Route index element={<Dashboard />} />
            <Route path="readings" element={<ReadingsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="care-team" element={<CareTeamPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routing />
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  );
}
