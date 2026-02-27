'use client';

import { CalendarDays, MapPin, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { EventListResponse } from '@/lib/types';

export function EventCard({ event }: { event: EventListResponse['items'][number] }) {
  return (
    <Link href={`/events/${event.id}`} className="block">
      <Card className="h-full">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{event.title}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{event.description}</p>
            </div>
            <Badge variant={event.isOrganizer ? 'default' : 'secondary'}>
              {event.isOrganizer ? 'Organizer' : event.viewerRsvpStatus ?? 'Invited'}
            </Badge>
          </div>
          <div className="space-y-2 text-sm text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              <span>{new Date(event.startsAt).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{event.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              <span>{event.organizerName}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
