'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authFetch } from '@/lib/auth/client';
import type { EventInvitation } from '@/lib/types';

export function InvitationsClient() {
  const [invitations, setInvitations] = useState<EventInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const response = await authFetch('/api/invitations');
        const payload = (await response.json()) as { items?: EventInvitation[]; error?: string };
        if (!response.ok || !payload.items) {
          throw new Error(payload.error ?? 'Unable to load invitations.');
        }

        setInvitations(payload.items);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Unable to load invitations.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitation inbox</CardTitle>
        <CardDescription>Track every event invite linked to your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
            ))}
          </div>
        ) : (
          invitations.map((invitation) => (
            <div key={invitation.id} className="rounded-2xl border border-[var(--border-subtle)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{invitation.eventTitle}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(invitation.eventStartsAt).toLocaleString()} · {invitation.timezone}
                  </p>
                </div>
                <Badge variant={invitation.rsvpStatus === 'declined' ? 'destructive' : invitation.rsvpStatus === 'attending' ? 'default' : 'secondary'}>
                  {invitation.rsvpStatus}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
