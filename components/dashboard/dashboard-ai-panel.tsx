'use client';

import {
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardBusinessInsight } from '@/lib/types';

const HEALTH_STYLES: Record<
  DashboardBusinessInsight['health'],
  {
    label: string;
    badgeClassName: string;
    panelClassName: string;
  }
> = {
  strong: {
    label: 'Strong',
    badgeClassName: 'bg-emerald-600 text-white',
    panelClassName: 'bg-[linear-gradient(145deg,rgba(15,118,110,0.14),rgba(255,255,255,0.95),rgba(16,185,129,0.12))]',
  },
  steady: {
    label: 'Steady',
    badgeClassName: 'bg-amber-500 text-white',
    panelClassName: 'bg-[linear-gradient(145deg,rgba(217,119,6,0.14),rgba(255,255,255,0.95),rgba(15,118,110,0.09))]',
  },
  watch: {
    label: 'Watch',
    badgeClassName: 'bg-red-600 text-white',
    panelClassName: 'bg-[linear-gradient(145deg,rgba(220,38,38,0.13),rgba(255,255,255,0.95),rgba(217,119,6,0.12))]',
  },
};

function DashboardAiPanelSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4">
        <div className="h-24 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-36 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
          <div className="h-36 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
          <div className="h-36 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardAiPanel({
  insight,
  loading,
  error,
  onRefresh,
}: {
  insight: DashboardBusinessInsight | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
}) {
  if (loading && !insight) {
    return <DashboardAiPanelSkeleton />;
  }

  if (!insight) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>AI business feedback</CardTitle>
            <CardDescription>
              Generate a Gemini-backed readout of schedule health, risks, and next actions.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={loading}
            loadingText="Analyzing..."
            onClick={() => void onRefresh()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Generate insight
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-secondary)]">
            {error ?? 'No AI insight is available yet.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const healthStyle = HEALTH_STYLES[insight.health];

  return (
    <Card className="overflow-hidden p-0">
      <div className={cn('p-5 sm:p-6', healthStyle.panelClassName)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                AI business feedback
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {insight.headline}
                </h3>
                <p className="max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
                  {insight.summary}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={healthStyle.badgeClassName}>{healthStyle.label}</Badge>
              <Badge variant={insight.source === 'gemini' ? 'default' : 'outline'}>
                {insight.source === 'gemini' ? 'Gemini' : 'Fallback'}
              </Badge>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={loading}
                loadingText="Refreshing..."
                onClick={() => void onRefresh()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh advice
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <section className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-white/80 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">What is working</p>
              </div>
              <ul className="mt-3 space-y-2">
                {insight.strengths.map((item, index) => (
                  <li key={`${item}-${index}`} className="text-sm leading-6 text-[var(--text-secondary)]">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-white/80 p-4">
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">What to watch</p>
              </div>
              <ul className="mt-3 space-y-2">
                {insight.risks.map((item, index) => (
                  <li key={`${item}-${index}`} className="text-sm leading-6 text-[var(--text-secondary)]">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-white/80 p-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[var(--brand-primary)]" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">Recommended next steps</p>
              </div>
              <ul className="mt-3 space-y-2">
                {insight.recommendations.map((item, index) => (
                  <li key={`${item}-${index}`} className="text-sm leading-6 text-[var(--text-secondary)]">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </Card>
  );
}
