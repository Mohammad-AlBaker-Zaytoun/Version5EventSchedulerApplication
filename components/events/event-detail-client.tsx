'use client';

import { Calendar, MapPin, Send, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EventForm, type EventFormValues } from '@/components/events/event-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/auth/client';
import type { EventDetailResponse, EventInvitation } from '@/lib/types';

function toApiPayload(values: EventFormValues) {
  return {
    ...values,
    startsAt: new Date(values.startsAt).toISOString(),
    endsAt: new Date(values.endsAt).toISOString(),
  };
}

export function EventDetailClient({ eventId }: { eventId: string }) {
  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);

  const inviteeEmails = useMemo(
    () => detail?.invitations.map((invitation) => invitation.inviteeEmail) ?? [],
    [detail?.invitations],
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
                Attending {detail.event.invitationCounts.attending} · Maybe {detail.event.invitationCounts.maybe} · Declined {detail.event.invitationCounts.declined}
              </p>
            </div>
          </div>
          {detail.event.aiSummary ? (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">AI summary</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{detail.event.aiSummary}</p>
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
                {entry.actorName} · {new Date(entry.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
