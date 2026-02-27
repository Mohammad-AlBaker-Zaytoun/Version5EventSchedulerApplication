'use client';

import { CalendarRange, Inbox, LayoutDashboard, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

type NavRoute = '/events' | '/invitations' | '/dashboard';

const links: Array<{
  href: NavRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { href: '/events', label: 'Events', icon: CalendarRange },
  { href: '/invitations', label: 'Invitations', icon: Inbox },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, signOutUser } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await signOutUser();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[var(--surface-bg)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,119,6,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,118,110,0.16),transparent_34%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pt-4 pb-8 sm:px-6">
        <header className="sticky top-3 z-30 rounded-[1.75rem] border border-[var(--border-subtle)] bg-[var(--surface-card)]/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <Link href="/events" className="text-sm font-semibold tracking-wide text-[var(--text-primary)] sm:text-base">
              Version 5 Event Scheduler
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--text-secondary)] sm:inline-flex">
                {profile?.displayName ?? 'Guest'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSignOut()}
                loading={isSigningOut}
                loadingText="Signing out..."
              >
                <LogOut className="mr-1 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {links.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex min-h-9 transform-gpu items-center gap-2 rounded-full px-3 text-sm transition-[transform,box-shadow,background-color,color] duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)] [&_svg]:text-current motion-safe:hover:-translate-y-0.5',
                    isActive
                      ? 'bg-[var(--brand-primary)] font-semibold !text-white shadow-[0_10px_24px_-16px_rgba(15,118,110,0.88)] [&_svg]:!text-white'
                      : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-strong)] hover:shadow-[0_12px_24px_-20px_rgba(20,26,50,0.45)]',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className={cn(isActive ? '!text-white' : 'text-[var(--text-secondary)]')}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mt-5 flex-1">{children}</main>
      </div>
    </div>
  );
}
