'use client';

import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/lib/auth/client';
import { clamp } from '@/lib/utils';
import type { AnalyticsOverview } from '@/lib/types';

export function DashboardClient() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const response = await authFetch('/api/analytics/overview');
        const payload = (await response.json()) as AnalyticsOverview & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load dashboard analytics.');
        }

        setOverview(payload);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to load dashboard analytics.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <Card><CardContent className="h-72 animate-pulse bg-[var(--surface-muted)]" /></Card>;
  }

  if (!overview) {
    return <p className="text-sm text-red-600">{error ?? 'Unable to load analytics.'}</p>;
  }

  const maxDensity = Math.max(...overview.scheduleDensity.map((item) => item.count), 1);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Upcoming', value: overview.upcomingCount },
          { label: 'Owned', value: overview.ownedCount },
          { label: 'Invited', value: overview.invitedCount },
          { label: 'Conflicts', value: overview.conflictCount },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Response distribution</CardTitle>
            <CardDescription>Quick view of how your invitation inbox is trending.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.responseDistribution.map((item) => (
              <div key={item.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
                  <span>{item.status}</span>
                  <span>{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-2 rounded-full bg-[var(--brand-primary)] transition-[width] duration-700"
                    style={{ width: `${clamp(item.count * 18, item.count ? 14 : 0, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule density</CardTitle>
            <CardDescription>Near-term visible event load by day.</CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-52 items-end gap-3">
            {overview.scheduleDensity.map((item) => (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-end justify-center rounded-t-2xl bg-[var(--brand-primary)]/85 transition-[height,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-1" style={{ height: `${Math.max(18, (item.count / maxDensity) * 160)}px` }} />
                <p className="text-xs text-[var(--text-muted)]">{item.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
