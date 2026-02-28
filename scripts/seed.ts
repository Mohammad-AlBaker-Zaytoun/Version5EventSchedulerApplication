import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import { createEventSearchBlob, makeInvitationCounts, nowIso, normalizeEmail } from '@/lib/events/utils';
import type { EventActivityLog, EventInvitation, EventRecord, UserProfile } from '@/lib/types';

type CliArgs = {
  force: boolean;
  dryRun: boolean;
  accessEmail?: string;
};

const SAFE_PROJECT_TOKENS = ['test', 'dev', 'staging', 'sandbox', 'demo'];
const COLLECTIONS = ['eventActivityLogs', 'eventInvitations', 'events', 'users'] as const;

function parseArgs(argv: string[]): CliArgs {
  return {
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
    accessEmail: argv.find((arg) => arg.startsWith('--access-email='))?.split('=')[1],
  };
}

async function deleteCollection(name: (typeof COLLECTIONS)[number], dryRun: boolean): Promise<number> {
  let deleted = 0;

  while (true) {
    const snapshot = await getAdminDb().collection(name).limit(400).get();
    if (snapshot.empty) {
      return deleted;
    }

    deleted += snapshot.size;
    if (dryRun) {
      break;
    }

    const batch = getAdminDb().batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  return deleted;
}

async function getAccessUserProfile(email: string): Promise<UserProfile> {
  const authUser = await getAdminAuth().getUserByEmail(email);
  return {
    uid: authUser.uid,
    email,
    normalizedEmail: normalizeEmail(email),
    displayName: authUser.displayName ?? 'Event Scheduler User',
    photoURL: authUser.photoURL ?? undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: nowIso(),
  };
}

function buildSeedUsers(): UserProfile[] {
  const now = nowIso();
  return [
    {
      uid: 'seed-user-001',
      email: 'organizer@example.com',
      normalizedEmail: 'organizer@example.com',
      displayName: 'Taylor Organizer',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    },
    {
      uid: 'seed-user-002',
      email: 'attendee-one@example.com',
      normalizedEmail: 'attendee-one@example.com',
      displayName: 'Jordan Attendee',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    },
    {
      uid: 'seed-user-003',
      email: 'attendee-two@example.com',
      normalizedEmail: 'attendee-two@example.com',
      displayName: 'Sam RSVP',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    },
  ];
}

function mergeAccessUser(users: UserProfile[], accessProfile?: UserProfile): UserProfile[] {
  if (!accessProfile) {
    return users;
  }

  const next = [...users];
  const existingIndex = next.findIndex(
    (user) =>
      user.uid === accessProfile.uid || user.normalizedEmail === accessProfile.normalizedEmail,
  );

  if (existingIndex >= 0) {
    next[existingIndex] = accessProfile;
    return next;
  }

  next.push(accessProfile);
  return next;
}

function buildSeedEvents(users: UserProfile[], accessProfile?: UserProfile): EventRecord[] {
  const primaryOrganizer = accessProfile ?? users[0];
  const fallbackOrganizer = users.find((user) => user.uid !== primaryOrganizer.uid) ?? primaryOrganizer;
  const now = Date.now();
  const base = Array.from({ length: 8 }).map((_, index) => {
    const startsAt = new Date(now + (index + 1) * 86400000 + (index % 3) * 7200000);
    const endsAt = new Date(startsAt.getTime() + 5400000);
    const title = index % 2 === 0 ? `Design Sync ${index + 1}` : `Launch Planning ${index + 1}`;
    const description = `Structured planning session for ${title.toLowerCase()} with invited collaborators.`;
    const organizer = accessProfile && index % 2 === 1 ? fallbackOrganizer : primaryOrganizer;
    const location = index % 2 === 0 ? 'Lisbon Studio' : 'Remote Boardroom';

    return {
      id: `seed-event-${String(index + 1).padStart(3, '0')}`,
      title,
      description,
      location,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timezone: 'UTC',
      organizerUid: organizer.uid,
      organizerName: organizer.displayName,
      searchBlob: createEventSearchBlob({ title, description, location, timezone: 'UTC' }),
      aiSummary: `AI-ready briefing for ${title.toLowerCase()}.`,
      aiAgendaBullets: ['Opening context', 'Core discussion', 'Commitments'],
      invitationCounts: makeInvitationCounts(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } satisfies EventRecord;
  });

  return base;
}

function buildSeedInvitations(
  events: EventRecord[],
  users: UserProfile[],
  accessProfile?: UserProfile,
): EventInvitation[] {
  const now = nowIso();

  return events.flatMap((event, index) => {
    const candidateInvitees = users.filter((user) => user.uid !== event.organizerUid);
    const accessInvitee =
      accessProfile && accessProfile.uid !== event.organizerUid ? accessProfile : undefined;
    const alternateInvitees = candidateInvitees.filter(
      (user) => !accessInvitee || user.uid !== accessInvitee.uid,
    );

    const primaryStatuses =
      index % 3 === 0
        ? ['attending', 'maybe']
        : index % 3 === 1
          ? ['invited', 'declined']
          : ['attending', 'invited'];

    const invitees: Array<{
      user: UserProfile;
      status: EventInvitation['rsvpStatus'];
    }> = [];

    if (accessInvitee) {
      invitees.push({
        user: accessInvitee,
        status:
          (index % 3 === 0
            ? 'attending'
            : index % 3 === 1
              ? 'maybe'
              : 'invited') as EventInvitation['rsvpStatus'],
      });
    }

    if (alternateInvitees[0]) {
      invitees.push({
        user: alternateInvitees[0],
        status: primaryStatuses[0] as EventInvitation['rsvpStatus'],
      });
    }

    if (alternateInvitees[1]) {
      invitees.push({
        user: alternateInvitees[1],
        status: primaryStatuses[1] as EventInvitation['rsvpStatus'],
      });
    }

    return invitees.map(({ user, status }, inviteIndex) => ({
      id: `${event.id}-invite-${inviteIndex + 1}`,
      eventId: event.id,
      eventTitle: event.title,
      eventStartsAt: event.startsAt,
      eventEndsAt: event.endsAt,
      timezone: event.timezone,
      inviteeUid: user.uid,
      inviteeEmail: user.email,
      normalizedInviteeEmail: user.normalizedEmail,
      inviteeName: user.displayName,
      organizerUid: event.organizerUid,
      organizerName: event.organizerName,
      rsvpStatus: status as EventInvitation['rsvpStatus'],
      linkedAt: now,
      respondedAt: status === 'invited' ? undefined : now,
      createdAt: now,
      updatedAt: now,
    } satisfies EventInvitation));
  });
}

function buildSeedActivity(events: EventRecord[]): EventActivityLog[] {
  return events.map((event, index) => ({
    id: `seed-activity-${String(index + 1).padStart(3, '0')}`,
    eventId: event.id,
    actorUid: event.organizerUid,
    actorName: event.organizerName,
    action: 'created',
    metadata: {
      title: event.title,
    },
    createdAt: nowIso(),
  } satisfies EventActivityLog));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = process.env.FIREBASE_PROJECT_ID ?? '';

  if (!args.force && !SAFE_PROJECT_TOKENS.some((token) => projectId.toLowerCase().includes(token))) {
    throw new Error(`Refusing to seed FIREBASE_PROJECT_ID="${projectId}" without --force.`);
  }

  const deletedCounts: Record<string, number> = {};
  for (const collection of COLLECTIONS) {
    deletedCounts[collection] = await deleteCollection(collection, args.dryRun);
  }

  const accessProfile = args.accessEmail ? await getAccessUserProfile(args.accessEmail) : undefined;
  const users = mergeAccessUser(buildSeedUsers(), accessProfile);
  const events = buildSeedEvents(users, accessProfile);
  const invitations = buildSeedInvitations(events, users, accessProfile);
  const activity = buildSeedActivity(events);

  const countsByEvent = new Map<string, EventRecord['invitationCounts']>();
  for (const invitation of invitations) {
    const current = countsByEvent.get(invitation.eventId) ?? makeInvitationCounts();
    current[invitation.rsvpStatus] += 1;
    countsByEvent.set(invitation.eventId, current);
  }

  for (const event of events) {
    event.invitationCounts = countsByEvent.get(event.id) ?? makeInvitationCounts();
  }

  if (!args.dryRun) {
    const batch = getAdminDb().batch();
    for (const user of users) {
      batch.set(getAdminDb().collection('users').doc(user.uid), user);
    }
    for (const event of events) {
      batch.set(getAdminDb().collection('events').doc(event.id), event);
    }
    for (const invitation of invitations) {
      batch.set(getAdminDb().collection('eventInvitations').doc(invitation.id), invitation);
    }
    for (const entry of activity) {
      batch.set(getAdminDb().collection('eventActivityLogs').doc(entry.id), entry);
    }
    await batch.commit();
  }

  const accessUid = accessProfile?.uid;

  console.log(JSON.stringify({
    projectId,
    dryRun: args.dryRun,
    deletedCounts,
    inserted: {
      users: users.length,
      events: events.length,
      invitations: invitations.length,
      activity: activity.length,
    },
    accessUid,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
