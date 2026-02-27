import { format, isAfter, isBefore, isEqual, parseISO } from 'date-fns';

import type { EventInvitationCounts, EventRecord, RsvpStatus } from '@/lib/types';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createEventSearchBlob(input: {
  title: string;
  description?: string;
  location?: string;
  timezone?: string;
}): string {
  return [input.title, input.description, input.location, input.timezone]
    .map((value) => value?.trim().toLowerCase() ?? '')
    .filter(Boolean)
    .join(' ');
}

export function makeInvitationCounts(): EventInvitationCounts {
  return {
    invited: 0,
    attending: 0,
    maybe: 0,
    declined: 0,
  };
}

export function buildInvitationId(eventId: string, email: string): string {
  const safeEmail = normalizeEmail(email).replace(/[^a-z0-9]+/g, '-');
  return `${eventId}-${safeEmail}`;
}

export function applyRsvpDelta(
  counts: EventInvitationCounts,
  fromStatus: RsvpStatus | null,
  toStatus: RsvpStatus,
): EventInvitationCounts {
  const next = { ...counts };

  if (fromStatus) {
    next[fromStatus] = Math.max(0, next[fromStatus] - 1);
  }

  next[toStatus] += 1;
  return next;
}

export function isUpcomingEvent(event: Pick<EventRecord, 'startsAt'>): boolean {
  return isAfter(parseISO(event.startsAt), new Date());
}

export function formatEventDayLabel(iso: string): string {
  return format(parseISO(iso), 'EEE d');
}

export function hasOverlap(
  target: { startsAt: string; endsAt: string },
  candidate: { startsAt: string; endsAt: string },
): boolean {
  const targetStart = parseISO(target.startsAt);
  const targetEnd = parseISO(target.endsAt);
  const candidateStart = parseISO(candidate.startsAt);
  const candidateEnd = parseISO(candidate.endsAt);

  return (
    (isBefore(targetStart, candidateEnd) || isEqual(targetStart, candidateEnd)) &&
    (isAfter(targetEnd, candidateStart) || isEqual(targetEnd, candidateStart))
  );
}

export function sortEventsByStart<T extends Pick<EventRecord, 'startsAt'>>(events: T[]): T[] {
  return [...events].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}
