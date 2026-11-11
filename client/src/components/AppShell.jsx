import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, ListChecks, BarChart3, Users, Moon, Sun, HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function Logo({ className }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg viewBox="0 0 24 24" className="size-[22px]" aria-hidden>
        <path d="M12 2.5c3.2 4 6 7 6 11a6 6 0 0 1-12 0c0-4 2.8-7 6-11z" fill="currentColor" />
      </svg>
      <span className="font-display text-[22px] font-semibold italic leading-none tracking-tight">Sweety</span>
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
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-paper-2 px-5 py-6 lg:flex">
        <Logo className="mb-10" />
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Main">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => cn('-ml-2 flex items-center gap-3 border-l-2 border-transparent py-2 pl-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground', isActive && 'border-foreground text-foreground')}
            >
              <Icon className="size-4" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t pt-4">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="mb-3 text-xs capitalize text-muted-foreground">{user.role}</p>
          <div className="flex items-center justify-between">
            <button onClick={logout} className="cursor-pointer text-[13px] font-medium underline underline-offset-4 hover:opacity-70">Sign out</button>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={logout} className="cursor-pointer px-2 text-[13px] font-medium underline underline-offset-4">Sign out</button>
        </div>
      </header>

      <main className="px-4 pb-24 pt-8 sm:px-8 lg:ml-60 lg:px-12 lg:pb-16 lg:pt-12">
        <div className="mx-auto max-w-4xl"><Outlet /></div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Main mobile">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-1 border-t-2 border-transparent py-2.5 text-[11px] font-medium text-muted-foreground', isActive && 'border-foreground text-foreground')}
          >
            <Icon className="size-[18px]" />{label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, eyebrow, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-4xl leading-tight sm:text-[2.75rem]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
