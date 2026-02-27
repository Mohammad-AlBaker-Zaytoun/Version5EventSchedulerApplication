import { forbidden, notFound } from '@/lib/api/errors';
import { getAdminDb } from '@/lib/firebase/admin';
import type {
  ApiUserContext,
  EventActivityLog,
  EventDetailResponse,
  EventInvitation,
  EventListResponse,
  EventRecord,
  RsvpStatus,
} from '@/lib/types';
import {
  createEventSearchBlob,
  isUpcomingEvent,
  makeInvitationCounts,
  normalizeEmail,
  nowIso,
  sortEventsByStart,
} from '@/lib/events/utils';

const EVENTS_COLLECTION = 'events';
const INVITATIONS_COLLECTION = 'eventInvitations';
const ACTIVITY_COLLECTION = 'eventActivityLogs';

type EventFilters = {
  q?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  scope?: 'owned' | 'invited' | 'all';
  status?: 'upcoming' | 'attending' | 'maybe' | 'declined';
  page: number;
  limit: number;
};

async function listOwnedEvents(user: ApiUserContext): Promise<EventRecord[]> {
  const snapshot = await getAdminDb()
    .collection(EVENTS_COLLECTION)
    .where('organizerUid', '==', user.uid)
    .get();

  return snapshot.docs.map((doc) => doc.data() as EventRecord);
}

async function listUserInvitations(user: ApiUserContext): Promise<EventInvitation[]> {
  const byUidSnapshot = await getAdminDb()
    .collection(INVITATIONS_COLLECTION)
    .where('inviteeUid', '==', user.uid)
    .get();

  const byEmailSnapshot = await getAdminDb()
    .collection(INVITATIONS_COLLECTION)
    .where('normalizedInviteeEmail', '==', normalizeEmail(user.email))
    .get();

  const map = new Map<string, EventInvitation>();
  for (const doc of [...byUidSnapshot.docs, ...byEmailSnapshot.docs]) {
    map.set(doc.id, doc.data() as EventInvitation);
  }

  return [...map.values()];
}

async function getEventsByIds(ids: string[]): Promise<EventRecord[]> {
  if (ids.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(ids)];
  const snapshots = await Promise.all(
    uniqueIds.map((id) => getAdminDb().collection(EVENTS_COLLECTION).doc(id).get()),
  );

  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => snapshot.data() as EventRecord);
}

function eventMatchesFilters(
  event: EventRecord,
  viewerRsvpStatus: RsvpStatus | undefined,
  filters: EventFilters,
): boolean {
  const query = filters.q?.trim().toLowerCase();
  if (query && !event.searchBlob.includes(query)) {
    return false;
  }

  if (filters.location && !event.location.toLowerCase().includes(filters.location.toLowerCase())) {
    return false;
  }

  if (filters.startDate && event.startsAt < filters.startDate) {
    return false;
  }

  if (filters.endDate && event.startsAt > `${filters.endDate}T23:59:59.999Z`) {
    return false;
  }

  if (filters.status === 'upcoming' && !isUpcomingEvent(event)) {
    return false;
  }

  if (
    filters.status &&
    filters.status !== 'upcoming' &&
    viewerRsvpStatus !== filters.status
  ) {
    return false;
  }

  return true;
}

export async function listVisibleEvents(
  user: ApiUserContext,
  filters: EventFilters,
): Promise<EventListResponse> {
  const [ownedEvents, invitations] = await Promise.all([
    listOwnedEvents(user),
    listUserInvitations(user),
  ]);

  const invitationByEventId = new Map<string, EventInvitation>(
    invitations.map((invitation) => [invitation.eventId, invitation]),
  );

  const invitedEvents = await getEventsByIds(invitations.map((invitation) => invitation.eventId));
  const deduped = new Map<string, EventRecord>();

  if (filters.scope !== 'invited') {
    for (const event of ownedEvents) {
      deduped.set(event.id, event);
    }
  }

  if (filters.scope !== 'owned') {
    for (const event of invitedEvents) {
      deduped.set(event.id, event);
    }
  }

  const all = sortEventsByStart([...deduped.values()]);
  const filtered = all
    .map((event) => {
      const invitation = invitationByEventId.get(event.id);

      return {
        ...event,
        viewerRsvpStatus: invitation?.rsvpStatus,
        isOrganizer: event.organizerUid === user.uid,
      };
    })
    .filter((event) => eventMatchesFilters(event, event.viewerRsvpStatus, filters));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const startIndex = (filters.page - 1) * filters.limit;

  return {
    items: filtered.slice(startIndex, startIndex + filters.limit),
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages,
  };
}

export async function createEvent(
  user: ApiUserContext,
  input: Pick<
    EventRecord,
    'title' | 'description' | 'location' | 'startsAt' | 'endsAt' | 'timezone' | 'aiSummary' | 'aiAgendaBullets'
  >,
): Promise<EventRecord> {
  const now = nowIso();
  const docRef = getAdminDb().collection(EVENTS_COLLECTION).doc();

  const event: EventRecord = {
    id: docRef.id,
    title: input.title,
    description: input.description,
    location: input.location,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    organizerUid: user.uid,
    organizerName: user.displayName,
    searchBlob: createEventSearchBlob(input),
    aiSummary: input.aiSummary,
    aiAgendaBullets: input.aiAgendaBullets,
    invitationCounts: makeInvitationCounts(),
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(event);
  await writeEventActivity(user, event.id, 'created', {
    title: event.title,
    startsAt: event.startsAt,
  });

  return event;
}

export async function updateEvent(
  user: ApiUserContext,
  eventId: string,
  input: Pick<
    EventRecord,
    'title' | 'description' | 'location' | 'startsAt' | 'endsAt' | 'timezone' | 'aiSummary' | 'aiAgendaBullets'
  >,
): Promise<EventRecord> {
  const existing = await getEventById(eventId);
  ensureOrganizer(user, existing);

  const updated: EventRecord = {
    ...existing,
    ...input,
    searchBlob: createEventSearchBlob(input),
    updatedAt: nowIso(),
  };

  await getAdminDb().collection(EVENTS_COLLECTION).doc(eventId).set(updated, { merge: true });
  await writeEventActivity(user, eventId, 'updated', {
    title: updated.title,
    startsAt: updated.startsAt,
  });

  return updated;
}

export async function deleteEvent(user: ApiUserContext, eventId: string): Promise<void> {
  const existing = await getEventById(eventId);
  ensureOrganizer(user, existing);

  const invitations = await getAdminDb()
    .collection(INVITATIONS_COLLECTION)
    .where('eventId', '==', eventId)
    .get();
  const activity = await getAdminDb().collection(ACTIVITY_COLLECTION).where('eventId', '==', eventId).get();

  const batch = getAdminDb().batch();
  batch.delete(getAdminDb().collection(EVENTS_COLLECTION).doc(eventId));

  for (const doc of invitations.docs) {
    batch.delete(doc.ref);
  }

  for (const doc of activity.docs) {
    batch.delete(doc.ref);
  }

  await batch.commit();
}

export async function getEventById(eventId: string): Promise<EventRecord> {
  const snapshot = await getAdminDb().collection(EVENTS_COLLECTION).doc(eventId).get();
  if (!snapshot.exists) {
    notFound('Event not found');
  }

  return snapshot.data() as EventRecord;
}

export async function getEventDetail(
  user: ApiUserContext,
  eventId: string,
): Promise<EventDetailResponse> {
  const event = await getEventById(eventId);
  const isOrganizer = event.organizerUid === user.uid;

  const allInvitationsSnapshot = await getAdminDb()
    .collection(INVITATIONS_COLLECTION)
    .where('eventId', '==', eventId)
    .get();
  const allInvitations = allInvitationsSnapshot.docs.map((doc) => doc.data() as EventInvitation);
  const viewerInvitation =
    allInvitations.find((invitation) => invitation.inviteeUid === user.uid) ??
    allInvitations.find((invitation) => invitation.normalizedInviteeEmail === normalizeEmail(user.email)) ??
    null;

  if (!isOrganizer && !viewerInvitation) {
    forbidden('You do not have access to this event.');
  }

  const activitySnapshot = await getAdminDb()
    .collection(ACTIVITY_COLLECTION)
    .where('eventId', '==', eventId)
    .get();
  const activity = activitySnapshot.docs
    .map((doc) => doc.data() as EventActivityLog)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 12);

  return {
    event,
    isOrganizer,
    viewerInvitation,
    invitations: isOrganizer ? allInvitations : [],
    activity,
  };
}

export function ensureOrganizer(user: ApiUserContext, event: EventRecord): void {
  if (event.organizerUid !== user.uid) {
    forbidden('Only the event organizer can perform this action.');
  }
}

export async function writeEventActivity(
  user: ApiUserContext,
  eventId: string,
  action: EventActivityLog['action'],
  metadata: Record<string, unknown>,
): Promise<void> {
  const docRef = getAdminDb().collection(ACTIVITY_COLLECTION).doc();

  await docRef.set({
    id: docRef.id,
    eventId,
    actorUid: user.uid,
    actorName: user.displayName,
    action,
    metadata,
    createdAt: nowIso(),
  } satisfies EventActivityLog);
}
