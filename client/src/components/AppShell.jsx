import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, ListChecks, BarChart3, Users, LogOut, Moon, Sun, Droplets, HeartHandshake, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function Logo({ className }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-white shadow-md shadow-primary/30"><Droplets className="size-5" /></span>
      <span className="font-display text-xl font-extrabold tracking-tight">Sweety</span>
    </div>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('sweety-theme', dark ? 'dark' : 'light'); } catch { /* ignore */ }
  }, [dark]);
  return (
    <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

const PATIENT_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/readings', label: 'Readings', icon: ListChecks },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/care-team', label: 'Care team', icon: HeartHandshake },
];
const DOCTOR_NAV = [{ to: '/', label: 'My patients', icon: Users, end: true }];

export function AppShell() {
  const { user, logout } = useAuth();
  const nav = user.role === 'doctor' ? DOCTOR_NAV : PATIENT_NAV;

  return (
    <div className="min-h-dvh bg-mesh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-card/70 p-5 backdrop-blur-xl lg:flex">
        <Logo className="mb-8 px-1" />
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => cn('flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', isActive && 'bg-secondary text-secondary-foreground shadow-xs')}
            >
              <Icon className="size-[18px]" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-brand text-sm font-bold text-white">{user.name[0]?.toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="flex items-center gap-1 text-xs capitalize text-muted-foreground">{user.role === 'doctor' && <Stethoscope className="size-3" />}{user.role}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={logout}><LogOut />Sign out</Button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b glass px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out"><LogOut /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:max-w-none lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-5xl"><Outlet /></div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border glass p-1.5 shadow-xl lg:hidden" aria-label="Main mobile">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium text-muted-foreground', isActive && 'bg-secondary text-secondary-foreground')}
          >
            <Icon className="size-5" />{label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
