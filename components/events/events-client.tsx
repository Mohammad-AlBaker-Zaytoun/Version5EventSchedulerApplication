'use client';

import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EventCard } from '@/components/events/event-card';
import { EventForm, type EventFormValues } from '@/components/events/event-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { authFetch } from '@/lib/auth/client';
import type { EventListResponse } from '@/lib/types';

type Filters = {
  q: string;
  location: string;
  startDate: string;
  endDate: string;
  status: '' | 'upcoming' | 'attending' | 'maybe' | 'declined';
  scope: 'all' | 'owned' | 'invited';
};

const defaultFilters: Filters = {
  q: '',
  location: '',
  startDate: '',
  endDate: '',
  status: '',
  scope: 'all',
};

function toApiPayload(values: EventFormValues) {
  return {
    ...values,
    startsAt: new Date(values.startsAt).toISOString(),
    endsAt: new Date(values.endsAt).toISOString(),
  };
}

export function EventsClient() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [response, setResponse] = useState<EventListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.location) params.set('location', filters.location);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.status) params.set('status', filters.status);
    if (filters.scope) params.set('scope', filters.scope);
    return params.toString();
  }, [filters]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authFetch(`/api/events${queryString ? `?${queryString}` : ''}`);
      const payload = (await response.json()) as EventListResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load events.');
      }

      setResponse(payload);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load events.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function createEvent(values: EventFormValues) {
    const response = await authFetch('/api/events', {
      method: 'POST',
      body: JSON.stringify(toApiPayload(values)),
    });

    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? 'Unable to create the event.');
    }

    setCreating(false);
    await loadEvents();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Event schedule</CardTitle>
          <CardDescription>
            Create invite-only events, track responses, and keep your visible schedule organized.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Input
              value={filters.q}
              onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Search by title"
            />
            <Input
              value={filters.location}
              onChange={(event) =>
                setFilters((current) => ({ ...current, location: event.target.value }))
              }
              placeholder="Filter by location"
            />
            <Input
              type="date"
              value={filters.startDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, startDate: event.target.value }))
              }
            />
            <Input
              type="date"
              value={filters.endDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, endDate: event.target.value }))
              }
            />
            <select
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-sm text-[var(--text-primary)]"
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as Filters['status'],
                }))
              }
            >
              <option value="">All statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="attending">Attending</option>
              <option value="maybe">Maybe</option>
              <option value="declined">Declined</option>
            </select>
            <select
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-sm text-[var(--text-primary)]"
              value={filters.scope}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  scope: event.target.value as Filters['scope'],
                }))
              }
            >
              <option value="all">All visible events</option>
              <option value="owned">Only my events</option>
              <option value="invited">Only invitations</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button variant={creating ? 'outline' : 'default'} onClick={() => setCreating((current) => !current)}>
              {creating ? 'Hide form' : 'Create event'}
            </Button>
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Search className="h-4 w-4" />
              <span>{response?.total ?? 0} visible events</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {creating ? (
        <Card>
          <CardHeader>
            <CardTitle>Create a new event</CardTitle>
          </CardHeader>
          <CardContent>
            <EventForm submitLabel="Create event" onSubmit={createEvent} onCancel={() => setCreating(false)} />
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="h-48 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {response?.items.map((event) => <EventCard key={event.id} event={event} />)}
        </div>
      )}
    </div>
  );
}
