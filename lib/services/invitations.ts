import { getAdminDb } from '@/lib/firebase/admin';
import { badRequest, forbidden, notFound } from '@/lib/api/errors';
import type {
  ApiUserContext,
  EventInvitation,
  EventInvitationCounts,
  EventRecord,
  RsvpStatus,
} from '@/lib/types';
import {
  applyRsvpDelta,
  buildInvitationId,
  normalizeEmail,
  nowIso,
} from '@/lib/events/utils';
import { ensureOrganizer, getEventById, writeEventActivity } from '@/lib/services/events';
import { getAdminAuth } from '@/lib/firebase/admin';

const EVENTS_COLLECTION = 'events';
const INVITATIONS_COLLECTION = 'eventInvitations';

function buildInvitationRecord(
  event: EventRecord,
  user: ApiUserContext,
  email: string,
  linkedUser?: { uid: string; name?: string },
): EventInvitation {
  const now = nowIso();
  const normalizedInviteeEmail = normalizeEmail(email);

  return {
    id: buildInvitationId(event.id, normalizedInviteeEmail),
    eventId: event.id,
    eventTitle: event.title,
    eventStartsAt: event.startsAt,
    eventEndsAt: event.endsAt,
    timezone: event.timezone,
    inviteeUid: linkedUser?.uid,
    inviteeEmail: email,
    normalizedInviteeEmail,
    inviteeName: linkedUser?.name,
    organizerUid: user.uid,
    organizerName: user.displayName,
    rsvpStatus: 'invited',
    linkedAt: linkedUser?.uid ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

async function maybeResolveAuthUser(email: string): Promise<{ uid: string; name?: string } | null> {
  try {
    const authUser = await getAdminAuth().getUserByEmail(email);
    return {
      uid: authUser.uid,
      name: authUser.displayName ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function createInvitations(
  user: ApiUserContext,
  eventId: string,
  emails: string[],
): Promise<EventInvitation[]> {
  const event = await getEventById(eventId);
  ensureOrganizer(user, event);

  const cleanedEmails = [...new Set(emails.map((email) => normalizeEmail(email)).filter(Boolean))];
  if (cleanedEmails.length === 0) {
    badRequest('At least one valid email is required.');
  }

  const existingSnapshot = await getAdminDb()
    .collection(INVITATIONS_COLLECTION)
    .where('eventId', '==', eventId)
    .get();
  const existingEmails = new Set(
    existingSnapshot.docs.map(
      (doc) => (doc.data() as EventInvitation).normalizedInviteeEmail,
    ),
  );

  const batch = getAdminDb().batch();
  const created: EventInvitation[] = [];
  let nextCounts: EventInvitationCounts = { ...event.invitationCounts };

  for (const email of cleanedEmails) {
    if (existingEmails.has(email)) {
      continue;
    }

    const linkedUser = await maybeResolveAuthUser(email);
    const invitation = buildInvitationRecord(event, user, email, linkedUser ?? undefined);
    const docRef = getAdminDb().collection(INVITATIONS_COLLECTION).doc(invitation.id);
    batch.set(docRef, invitation);
    created.push(invitation);
    nextCounts = applyRsvpDelta(nextCounts, null, 'invited');
  }

  if (created.length === 0) {
    return [];
  }

  batch.set(
    getAdminDb().collection(EVENTS_COLLECTION).doc(eventId),
    {
      invitationCounts: nextCounts,
      updatedAt: nowIso(),
    },
    { merge: true },
  );

  await batch.commit();
  await writeEventActivity(user, eventId, 'invited', {
    emails: created.map((invitation) => invitation.inviteeEmail),
    count: created.length,
  });

  return created;
}

export async function listInvitationsForUser(
  user: ApiUserContext,
): Promise<EventInvitation[]> {
  const snapshot = await getAdminDb()
    .collection(INVITATIONS_COLLECTION)
    .where('inviteeUid', '==', user.uid)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as EventInvitation)
    .sort((left, right) => left.eventStartsAt.localeCompare(right.eventStartsAt));
}

export async function updateInvitationRsvp(
  user: ApiUserContext,
  invitationId: string,
  rsvpStatus: Exclude<RsvpStatus, 'invited'>,
): Promise<EventInvitation> {
  const invitationRef = getAdminDb().collection(INVITATIONS_COLLECTION).doc(invitationId);
  const now = nowIso();

  let updatedInvitation: EventInvitation | null = null;

  await getAdminDb().runTransaction(async (transaction) => {
    const invitationSnapshot = await transaction.get(invitationRef);
    if (!invitationSnapshot.exists) {
      notFound('Invitation not found.');
    }

    const invitation = invitationSnapshot.data() as EventInvitation;
    if (invitation.inviteeUid !== user.uid) {
      forbidden('You can only update your own invitation.');
    }

    const eventRef = getAdminDb().collection(EVENTS_COLLECTION).doc(invitation.eventId);
    const eventSnapshot = await transaction.get(eventRef);
    if (!eventSnapshot.exists) {
      notFound('Event not found.');
    }

    const event = eventSnapshot.data() as EventRecord;
    const nextCounts = applyRsvpDelta(event.invitationCounts, invitation.rsvpStatus, rsvpStatus);

    updatedInvitation = {
      ...invitation,
      rsvpStatus,
      inviteeName: user.displayName,
      respondedAt: now,
      updatedAt: now,
    };

    transaction.set(invitationRef, updatedInvitation, { merge: true });
    transaction.set(
      eventRef,
      {
        invitationCounts: nextCounts,
        updatedAt: now,
      },
      { merge: true },
    );
  });

  if (!updatedInvitation) {
    notFound('Invitation not found.');
  }

  const finalInvitation = updatedInvitation as EventInvitation;

  await writeEventActivity(user, finalInvitation.eventId, 'rsvp_updated', {
    rsvpStatus,
  });

  return finalInvitation;
}
