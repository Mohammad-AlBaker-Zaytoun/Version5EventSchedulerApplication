'use client';

import {
  Activity,
  CalendarDays,
  Clock3,
  Sparkles,
  TriangleAlert,
  UserCheck,
  Users2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/lib/auth/client';
import { clamp, cn } from '@/lib/utils';
import type { AnalyticsOverview } from '@/lib/types';

const RESPONSE_META = {
  pending: {
    label: 'Pending',
    color: '#3366d6',
    note: 'Awaiting reply',
  },
  attending: {
    label: 'Attending',
    color: '#0f766e',
    note: 'Confirmed guests',
  },
  maybe: {
    label: 'Maybe',
    color: '#d97706',
    note: 'Needs follow-up',
  },
  declined: {
    label: 'Declined',
    color: '#dc2626',
    note: 'Opted out',
  },
} as const;

type ResponseStatus = keyof typeof RESPONSE_META;

type ResponseDatum = AnalyticsOverview['responseDistribution'][number] & {
  label: string;
  color: string;
  note: string;
};

function formatActionLabel(action: string) {
  return action
    .split('_')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(' ');
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden p-0">
        <CardContent className="h-48 animate-pulse bg-[var(--surface-muted)]" />
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="h-28 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <Card>
          <CardContent className="h-96 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
        </Card>
        <Card>
          <CardContent className="h-96 animate-pulse rounded-[1.25rem] bg-[var(--surface-muted)]" />
        </Card>
      </div>
    </div>
  );
}

export function DashboardClient() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [activeStatus, setActiveStatus] = useState<ResponseStatus>('attending');
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError(null);
      setAnimateIn(false);

      try {
        const response = await authFetch('/api/analytics/overview');
        const payload = (await response.json()) as AnalyticsOverview & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to load dashboard analytics.');
        }

        if (!cancelled) {
          setOverview(payload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : 'Unable to load dashboard analytics.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!overview) {
      return;
    }

    const frame = window.requestAnimationFrame(() => setAnimateIn(true));
    return () => window.cancelAnimationFrame(frame);
  }, [overview]);

  const responseData = useMemo<ResponseDatum[]>(
    () =>
      (overview?.responseDistribution ?? []).map((item) => ({
        ...item,
        label: RESPONSE_META[item.status as ResponseStatus].label,
        color: RESPONSE_META[item.status as ResponseStatus].color,
        note: RESPONSE_META[item.status as ResponseStatus].note,
      })),
    [overview?.responseDistribution],
  );

  const totalResponses = responseData.reduce((sum, item) => sum + item.count, 0);
  const activeResponse =
    responseData.find((item) => item.status === activeStatus) ?? responseData[0] ?? null;

  const scheduleDensity = overview?.scheduleDensity ?? [];
  const activeDay = scheduleDensity[activeDayIndex] ?? scheduleDensity[scheduleDensity.length - 1] ?? null;
  const maxDensity = Math.max(...scheduleDensity.map((item) => item.count), 1);
  const overlapPressure = overview
    ? clamp(Math.round((overview.conflictCount / Math.max(overview.upcomingCount * 2, 1)) * 100), 0, 100)
    : 0;

  useEffect(() => {
    if (responseData.length > 0) {
      setActiveStatus((responseData.find((item) => item.count > 0)?.status ?? responseData[0].status) as ResponseStatus);
    }
  }, [responseData]);

  useEffect(() => {
    if (scheduleDensity.length > 0) {
      setActiveDayIndex(scheduleDensity.length - 1);
    }
  }, [scheduleDensity.length]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!overview) {
    return <p className="text-sm text-red-600">{error ?? 'Unable to load analytics.'}</p>;
  }

  const donutSize = 220;
  const donutStroke = 24;
  const donutRadius = (donutSize - donutStroke) / 2;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let offsetCursor = 0;

  return (
    <div className="space-y-5">
      <Card
        className={cn(
          'overflow-hidden p-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
          animateIn ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        )}
      >
        <div className="relative overflow-hidden rounded-[1.5rem] bg-[linear-gradient(145deg,rgba(15,118,110,0.16),rgba(255,255,255,0.96),rgba(217,119,6,0.14))] p-5 sm:p-6">
          <div className="absolute inset-y-0 right-0 w-40 bg-[radial-gradient(circle_at_center,rgba(15,118,110,0.18),transparent_72%)]" />
          <div className="relative space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              Event command center
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold text-[var(--text-primary)] sm:text-[2.15rem]">
                See response flow, schedule intensity, and overlap risk in one view.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
                The dashboard is stacked for mobile first, then expands into richer chart layouts on larger screens.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Upcoming', value: overview.upcomingCount, icon: CalendarDays, tone: 'rgba(51,102,214,0.12)', iconColor: '#3366d6' },
          { label: 'Owned', value: overview.ownedCount, icon: UserCheck, tone: 'rgba(15,118,110,0.12)', iconColor: '#0f766e' },
          { label: 'Invited', value: overview.invitedCount, icon: Users2, tone: 'rgba(217,119,6,0.12)', iconColor: '#d97706' },
          { label: 'Conflicts', value: overview.conflictCount, icon: TriangleAlert, tone: 'rgba(220,38,38,0.12)', iconColor: '#dc2626' },
        ].map((item, index) => (
          <Card
            key={item.label}
            className={cn(
              'transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
              animateIn ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
            )}
            style={{ transitionDelay: `${index * 70}ms` }}
          >
            <CardContent className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: item.tone, color: item.iconColor }}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Response composition</CardTitle>
            <CardDescription>Tap or hover a segment to inspect the RSVP mix.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-center">
            <div className="relative mx-auto flex w-full max-w-[18rem] items-center justify-center">
              <svg viewBox={`0 0 ${donutSize} ${donutSize}`} className="h-[15rem] w-[15rem]" role="img" aria-label="Response distribution chart">
                <circle
                  cx={donutSize / 2}
                  cy={donutSize / 2}
                  r={donutRadius}
                  fill="none"
                  stroke="rgba(15,118,110,0.12)"
                  strokeWidth={donutStroke}
                />
                {responseData.map((item) => {
                  const fraction = totalResponses > 0 ? item.count / totalResponses : 0;
                  const dashLength = donutCircumference * fraction;
                  const dashOffset = donutCircumference * (1 - offsetCursor);
                  offsetCursor += fraction;

                  return (
                    <circle
                      key={item.status}
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={donutRadius}
                      fill="none"
                      stroke={item.color}
                      strokeWidth={activeResponse?.status === item.status ? donutStroke + 4 : donutStroke}
                      strokeLinecap="round"
                      strokeDasharray={`${dashLength} ${donutCircumference - dashLength}`}
                      strokeDashoffset={animateIn ? dashOffset : donutCircumference}
                      transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
                      style={{
                        opacity: activeResponse && activeResponse.status !== item.status ? 0.36 : 1,
                        transition: 'stroke-dashoffset 1000ms cubic-bezier(0.22,1,0.36,1), opacity 320ms ease, stroke-width 320ms ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={() => setActiveStatus(item.status as ResponseStatus)}
                      onFocus={() => setActiveStatus(item.status as ResponseStatus)}
                      onClick={() => setActiveStatus(item.status as ResponseStatus)}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  {activeResponse?.label ?? 'Responses'}
                </p>
                <p className="mt-2 text-5xl font-semibold text-[var(--text-primary)]">
                  {activeResponse?.count ?? 0}
                </p>
                <p className="mt-2 max-w-[10rem] text-sm text-[var(--text-secondary)]">
                  {activeResponse && totalResponses > 0 ? `${Math.round((activeResponse.count / totalResponses) * 100)}% of visible replies` : 'No response data yet'}
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {responseData.map((item) => (
                <button
                  key={item.status}
                  type="button"
                  onMouseEnter={() => setActiveStatus(item.status as ResponseStatus)}
                  onFocus={() => setActiveStatus(item.status as ResponseStatus)}
                  onClick={() => setActiveStatus(item.status as ResponseStatus)}
                  className={cn(
                    'rounded-[1.25rem] border p-4 text-left transition-[transform,box-shadow,border-color,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_18px_28px_-24px_rgba(15,118,110,0.35)]',
                    activeResponse?.status === item.status ? 'border-transparent bg-white shadow-[0_18px_28px_-24px_rgba(15,118,110,0.24)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.note}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{item.count}</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/80">
                    <div
                      className="h-2 rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        width: animateIn && totalResponses > 0 ? `${(item.count / totalResponses) * 100}%` : '0%',
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conflict pressure</CardTitle>
            <CardDescription>Overlap intensity across the visible upcoming schedule.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="mx-auto flex h-56 w-56 items-center justify-center">
              <div className="relative flex h-52 w-52 items-center justify-center rounded-full bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.12),rgba(255,255,255,0.94)_68%)]">
                <div
                  className="absolute inset-4 rounded-full border-[12px] border-[#dc2626]/12"
                  aria-hidden
                />
                <div
                  className="absolute inset-4 rounded-full border-[12px] border-transparent"
                  style={{
                    background: `conic-gradient(#dc2626 ${animateIn ? overlapPressure : 0}%, rgba(220,38,38,0.08) 0)`,
                    mask: 'radial-gradient(farthest-side, transparent calc(100% - 12px), #000 0)',
                    WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 12px), #000 0)',
                    transition: 'background 900ms cubic-bezier(0.22,1,0.36,1)',
                  }}
                />
                <div className="relative text-center">
                  <TriangleAlert className="mx-auto h-6 w-6 text-[#dc2626]" />
                  <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Overlap load</p>
                  <p className="mt-2 text-4xl font-semibold text-[var(--text-primary)]">{overlapPressure}%</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] bg-[rgba(220,38,38,0.08)] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Conflicts</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{overview.conflictCount}</p>
              </div>
              <div className="rounded-[1.25rem] bg-[rgba(15,118,110,0.08)] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Risk events</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-primary)]">{overview.highRiskEvents.length}</p>
              </div>
            </div>
            <div className="space-y-3">
              {overview.highRiskEvents.length > 0 ? (
                overview.highRiskEvents.map((event) => (
                  <div key={event.id} className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{event.title}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{event.location} / {formatDate(event.startsAt)}</p>
                      </div>
                      <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">{event.riskLabel}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">No high-risk overlaps detected in the current upcoming window.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Schedule rhythm</CardTitle>
            <CardDescription>Tap a bar to focus a specific upcoming day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scheduleDensity.length > 0 ? (
              <>
                {activeDay ? (
                  <div className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(15,118,110,0.08),rgba(255,255,255,0.92))] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Focused day</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{activeDay.label}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{activeDay.count} visible event{activeDay.count === 1 ? '' : 's'}</p>
                  </div>
                ) : null}
                <div className="flex min-h-64 items-end gap-3 rounded-[1.5rem] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(15,118,110,0.08),rgba(255,255,255,0.94))] p-4">
                  {scheduleDensity.map((item, index) => (
                    <button
                      key={item.label}
                      type="button"
                      onMouseEnter={() => setActiveDayIndex(index)}
                      onFocus={() => setActiveDayIndex(index)}
                      onClick={() => setActiveDayIndex(index)}
                      className="flex flex-1 flex-col items-center gap-3"
                    >
                      <div className="flex h-44 w-full items-end justify-center">
                        <div
                          className="w-full rounded-t-[1.25rem] bg-[linear-gradient(180deg,#0f766e,#16a34a)] transition-[height,transform,opacity] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-1"
                          style={{
                            height: animateIn ? `${Math.max(22, (item.count / maxDensity) * 176)}px` : '0px',
                            opacity: activeDayIndex === index ? 1 : 0.72,
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{item.label}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.count}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">No upcoming events are available yet, so the rhythm chart has nothing to plot.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest movement across visible event records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.recentActivity.length > 0 ? (
              overview.recentActivity.map((entry, index) => (
                <div
                  key={entry.id}
                  className="relative overflow-hidden rounded-[1.25rem] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(235,243,240,0.88))] p-4 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_18px_28px_-24px_rgba(15,118,110,0.25)]"
                  style={{ transitionDelay: `${index * 60}ms` }}
                >
                  <div className="absolute left-0 top-0 h-full w-1 bg-[linear-gradient(180deg,#0f766e,#d97706)]" />
                  <div className="flex items-start gap-3 pl-3">
                    <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(15,118,110,0.1)] text-[var(--brand-primary)]">
                      {entry.action === 'rsvp_updated' ? <Clock3 className="h-4 w-4" /> : entry.action === 'invited' ? <Users2 className="h-4 w-4" /> : entry.action === 'deleted' ? <TriangleAlert className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{formatActionLabel(entry.action)}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{entry.actorName}</p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">{formatDate(entry.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">No recent activity yet. Create or update an event to start the timeline.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
