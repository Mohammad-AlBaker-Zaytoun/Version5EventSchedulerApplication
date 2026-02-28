'use client';

import { CalendarClock, MapPin, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EventRecommendationInsight } from '@/lib/types';

const ACTION_LABELS: Record<EventRecommendationInsight['recommendedAction'], string> = {
  respond: 'Respond next',
  attend: 'Attend next',
  prepare: 'Prepare next',
  host: 'Host focus',
  review: 'Review next',
};

function RecommendationSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="h-24 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-28 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
          <div className="h-28 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EventRecommendationPanel({
  recommendation,
  loading,
  error,
  onRefresh,
}: {
  recommendation: EventRecommendationInsight | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
}) {
  if (loading && !recommendation) {
    return <RecommendationSkeleton />;
  }

  if (!recommendation) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>AI next-event recommendation</CardTitle>
            <CardDescription>
              Ask Gemini to suggest which event should get your attention next.
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
            Generate recommendation
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-secondary)]">
            {error ?? 'No recommendation is available yet.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="rounded-[1.5rem] bg-[linear-gradient(145deg,rgba(51,102,214,0.12),rgba(255,255,255,0.96),rgba(15,118,110,0.12))] p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
                AI next-event recommendation
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {recommendation.headline}
                </h3>
                <p className="max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
                  {recommendation.reason}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{ACTION_LABELS[recommendation.recommendedAction]}</Badge>
              <Badge variant={recommendation.source === 'gemini' ? 'default' : 'outline'}>
                {recommendation.source === 'gemini' ? 'Gemini' : 'Fallback'}
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
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-white/82 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Why this event
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                {recommendation.whyNow}
              </p>
            </section>

            <section className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-white/82 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Recommended event
              </p>
              {recommendation.eventId ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">
                      {recommendation.eventTitle}
                    </p>
                    {recommendation.startsAt ? (
                      <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <CalendarClock className="h-4 w-4" />
                        <span>{new Date(recommendation.startsAt).toLocaleString()}</span>
                      </div>
                    ) : null}
                    {recommendation.location ? (
                      <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <MapPin className="h-4 w-4" />
                        <span>{recommendation.location}</span>
                      </div>
                    ) : null}
                  </div>
                  <Button asChild>
                    <Link href={`/events/${recommendation.eventId}`}>View event</Link>
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  No single event stands out yet.
                </p>
              )}
            </section>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </Card>
  );
}
