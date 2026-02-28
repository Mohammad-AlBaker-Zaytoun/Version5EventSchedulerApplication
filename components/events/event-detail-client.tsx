'use client';

import { Calendar, Info, ListChecks, MapPin, Sparkles, Send, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EventForm, type EventFormValues } from '@/components/events/event-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/auth/client';
import type { EventDetailResponse, EventInvitation, SchedulingAssistantInsight } from '@/lib/types';

function toApiPayload(values: EventFormValues) {
  return {
    ...values,
    startsAt: new Date(values.startsAt).toISOString(),
    endsAt: new Date(values.endsAt).toISOString(),
  };
}

const TEMPLATE_AGENDA_BULLETS = ['Opening context', 'Core discussion', 'Commitments'];

function isTemplateAiBrief(summary?: string, bullets?: string[]) {
  const hasTemplateSummary = Boolean(
    summary && /^AI-ready briefing for .+\.$/i.test(summary.trim()),
  );
  const hasTemplateAgenda =
    bullets?.length === TEMPLATE_AGENDA_BULLETS.length &&
    bullets.every((bullet, index) => bullet === TEMPLATE_AGENDA_BULLETS[index]);

  return hasTemplateSummary && hasTemplateAgenda;
}

export function EventDetailClient({ eventId }: { eventId: string }) {
  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [aiRefreshLoading, setAiRefreshLoading] = useState(false);
  const [liveAiInsight, setLiveAiInsight] = useState<SchedulingAssistantInsight | null>(null);

  const inviteeEmails = useMemo(
    () => detail?.invitations.map((invitation) => invitation.inviteeEmail) ?? [],
    [detail?.invitations],
  );

  const hasTemplateBrief = useMemo(
    () => isTemplateAiBrief(detail?.event.aiSummary, detail?.event.aiAgendaBullets),
    [detail?.event.aiAgendaBullets, detail?.event.aiSummary],
  );

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/events/${eventId}`);
      const payload = (await response.json()) as EventDetailResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load this event.');
      }

      setDetail(payload);
      setLiveAiInsight(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load this event.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function updateEvent(values: EventFormValues) {
    const response = await authFetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(toApiPayload(values)),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? 'Unable to update this event.');
    }

    setEditing(false);
    await loadDetail();
  }

  async function refreshAiBrief() {
    if (!detail) {
      return;
    }

    setAiRefreshLoading(true);
    setError(null);

    try {
      const aiResponse = await authFetch('/api/ai/scheduling-assistant', {
        method: 'POST',
        body: JSON.stringify({
          title: detail.event.title,
          description: detail.event.description,
          location: detail.event.location,
          startsAt: detail.event.startsAt,
          endsAt: detail.event.endsAt,
          timezone: detail.event.timezone,
          inviteeEmails,
          eventId: detail.event.id,
        }),
      });

      const aiPayload = (await aiResponse.json()) as { insight?: SchedulingAssistantInsight; error?: string };
      if (!aiResponse.ok || !aiPayload.insight) {
        throw new Error(aiPayload.error ?? 'Unable to generate an AI brief right now.');
      }

      setLiveAiInsight(aiPayload.insight);

      if (detail.isOrganizer) {
        const saveResponse = await authFetch(`/api/events/${eventId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: detail.event.title,
            description: detail.event.description,
            location: detail.event.location,
            startsAt: detail.event.startsAt,
            endsAt: detail.event.endsAt,
            timezone: detail.event.timezone,
            aiSummary: aiPayload.insight.suggestedSummary ?? aiPayload.insight.summary,
            aiAgendaBullets: aiPayload.insight.agendaBullets ?? [],
          }),
        });

        const savePayload = (await saveResponse.json()) as { error?: string };
        if (!saveResponse.ok) {
          throw new Error(savePayload.error ?? 'Generated AI brief but failed to save it.');
        }

        await loadDetail();
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to refresh the AI brief.');
    } finally {
      setAiRefreshLoading(false);
    }
  }

  async function deleteEvent() {
    if (!window.confirm('Delete this event and all invitations?')) {
      return;
    }

    const response = await authFetch(`/api/events/${eventId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? 'Unable to delete this event.');
    }

    window.location.href = '/events';
  }

  async function sendInvites() {
    if (!inviteInput.trim()) {
      return;
    }

    setInviteLoading(true);
    setError(null);
    try {
      const emails = inviteInput
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      const response = await authFetch(`/api/events/${eventId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ emails }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to send invitations.');
      }

      setInviteInput('');
      await loadDetail();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to send invitations.');
    } finally {
      setInviteLoading(false);
    }
  }

  async function updateRsvp(invitation: EventInvitation, rsvpStatus: 'attending' | 'maybe' | 'declined') {
    setRsvpLoading(rsvpStatus);
    setError(null);
    try {
      const response = await authFetch(`/api/invitations/${invitation.id}/rsvp`, {
        method: 'PATCH',
        body: JSON.stringify({ rsvpStatus }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to update your RSVP.');
      }

      await loadDetail();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update your RSVP.');
    } finally {
      setRsvpLoading(null);
    }
  }

  if (loading) {
    return <Card><CardContent className="h-72 animate-pulse bg-[var(--surface-muted)]" /></Card>;
  }

  if (!detail) {
    return <p className="text-sm text-red-600">{error ?? 'Unable to load this event.'}</p>;
  }

  const formValues: EventFormValues = {
    title: detail.event.title,
    description: detail.event.description,
    location: detail.event.location,
    startsAt: detail.event.startsAt.slice(0, 16),
    endsAt: detail.event.endsAt.slice(0, 16),
    timezone: detail.event.timezone,
    aiSummary: detail.event.aiSummary,
    aiAgendaBullets: detail.event.aiAgendaBullets,
  };

  const displayedSummary =
    liveAiInsight?.suggestedSummary ??
    (hasTemplateBrief ? undefined : detail.event.aiSummary);
  const displayedAgendaBullets =
    liveAiInsight?.agendaBullets ??
    (hasTemplateBrief ? undefined : detail.event.aiAgendaBullets);
  const displayedInsightSummary = liveAiInsight?.summary;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{detail.event.title}</CardTitle>
              <CardDescription>{detail.event.description}</CardDescription>
            </div>
            <Badge variant={detail.isOrganizer ? 'default' : 'secondary'}>
              {detail.isOrganizer ? 'Organizer view' : detail.viewerInvitation?.rsvpStatus ?? 'Invited'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <Calendar className="h-4 w-4" />
                When
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {new Date(detail.event.startsAt).toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{detail.event.timezone}</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{detail.event.location}</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <UserRound className="h-4 w-4" />
                RSVP counts
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {`Attending ${detail.event.invitationCounts.attending} | Maybe ${detail.event.invitationCounts.maybe} | Declined ${detail.event.invitationCounts.declined}`}
              </p>
            </div>
          </div>
          {displayedSummary || displayedAgendaBullets?.length || hasTemplateBrief ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border-subtle)] bg-[linear-gradient(135deg,rgba(15,118,110,0.09),rgba(255,255,255,0.96),rgba(217,119,6,0.08))] shadow-[var(--shadow-soft)]">
              <div className="border-b border-[var(--border-subtle)] bg-white/60 px-4 py-3 backdrop-blur sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">AI event brief</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {liveAiInsight
                          ? 'Live Gemini-generated planning notes for this event.'
                          : 'Generated planning notes for this event draft.'}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={aiRefreshLoading}
                    loadingText={detail.isOrganizer ? 'Refreshing and saving...' : 'Generating...'}
                    onClick={() => void refreshAiBrief()}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {detail.isOrganizer ? 'Refresh with Gemini' : 'Generate Gemini brief'}
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
                {displayedSummary ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Summary
                    </p>
                    <div className="rounded-2xl bg-white/80 p-4">
                      <p className="text-sm leading-7 text-[var(--text-secondary)]">
                        {displayedSummary}
                      </p>
                    </div>
                    {displayedInsightSummary ? (
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-white/70 p-4">
                        <div className="flex items-start gap-2">
                          <Info className="mt-0.5 h-4 w-4 text-[var(--brand-primary)]" />
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                              Schedule insight
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                              {displayedInsightSummary}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : hasTemplateBrief ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Summary
                    </p>
                    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/70 p-4">
                      <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        This event still has template demo copy. Generate a live Gemini brief to replace it with a useful summary.
                      </p>
                    </div>
                  </div>
                ) : null}
                {displayedAgendaBullets?.length ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-[var(--brand-primary)]" />
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Suggested agenda
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4">
                      <ul className="space-y-2">
                        {displayedAgendaBullets.map((bullet, index) => (
                          <li key={`${bullet}-${index}`} className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)] text-xs font-semibold text-[var(--text-primary)]">
                              {index + 1}
                            </span>
                            <span className="text-sm leading-6 text-[var(--text-secondary)]">
                              {bullet}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {detail.isOrganizer ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{editing ? 'Edit event' : 'Event controls'}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing((current) => !current)}>
                    {editing ? 'Close editor' : 'Edit'}
                  </Button>
                  <Button variant="destructive" onClick={() => void deleteEvent()}>
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <EventForm
                  initialValues={formValues}
                  submitLabel="Update event"
                  inviteeEmails={inviteeEmails}
                  onSubmit={updateEvent}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <p className="text-sm text-[var(--text-muted)]">
                  Edit timing, description, and AI-assisted summary here whenever the schedule shifts.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invitation management</CardTitle>
              <CardDescription>Invite teammates or stakeholders by email. Pending emails link automatically after sign-in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Input
                  value={inviteInput}
                  onChange={(event) => setInviteInput(event.target.value)}
                  placeholder="alex@example.com, sam@example.com"
                />
                <Button onClick={() => void sendInvites()} loading={inviteLoading} loadingText="Sending invites...">
                  <Send className="mr-2 h-4 w-4" />
                  Send invitations
                </Button>
              </div>
              <div className="space-y-2">
                {detail.invitations.map((invitation) => (
                  <div key={invitation.id} className="rounded-xl border border-[var(--border-subtle)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{invitation.inviteeEmail}</p>
                        <p className="text-xs text-[var(--text-muted)]">{invitation.inviteeName ?? 'Pending account link'}</p>
                      </div>
                      <Badge variant={invitation.rsvpStatus === 'declined' ? 'destructive' : invitation.rsvpStatus === 'attending' ? 'default' : 'secondary'}>
                        {invitation.rsvpStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : detail.viewerInvitation ? (
        <Card>
          <CardHeader>
            <CardTitle>Your response</CardTitle>
            <CardDescription>Set your RSVP. Counts and dashboard insights update immediately.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(['attending', 'maybe', 'declined'] as const).map((status) => (
              <Button
                key={status}
                variant={detail.viewerInvitation?.rsvpStatus === status ? 'default' : 'outline'}
                loading={rsvpLoading === status}
                loadingText="Saving..."
                onClick={() => void updateRsvp(detail.viewerInvitation!, status)}
              >
                {status}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.activity.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-[var(--border-subtle)] p-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">{entry.action.replace('_', ' ')}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {`${entry.actorName} | ${new Date(entry.createdAt).toLocaleString()}`}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
