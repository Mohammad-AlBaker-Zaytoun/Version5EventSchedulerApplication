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

async function ensureAccessUser(email: string, dryRun: boolean): Promise<string> {
  const authUser = await getAdminAuth().getUserByEmail(email);
  const profile: UserProfile = {
    uid: authUser.uid,
    email,
    normalizedEmail: normalizeEmail(email),
    displayName: authUser.displayName ?? 'Event Scheduler User',
    photoURL: authUser.photoURL ?? undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: nowIso(),
  };

  if (!dryRun) {
    await getAdminDb().collection('users').doc(profile.uid).set(profile, { merge: true });
  }

  return profile.uid;
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

function buildSeedEvents(users: UserProfile[]): EventRecord[] {
  const organizer = users[0];
  const now = Date.now();
  const base = Array.from({ length: 8 }).map((_, index) => {
    const startsAt = new Date(now + (index + 1) * 86400000 + (index % 3) * 7200000);
    const endsAt = new Date(startsAt.getTime() + 5400000);
    const title = index % 2 === 0 ? `Design Sync ${index + 1}` : `Launch Planning ${index + 1}`;
    const description = `Structured planning session for ${title.toLowerCase()} with invited collaborators.`;

    return {
      id: `seed-event-${String(index + 1).padStart(3, '0')}`,
      title,
      description,
      location: index % 2 === 0 ? 'Lisbon Studio' : 'Remote Boardroom',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timezone: 'UTC',
      organizerUid: organizer.uid,
      organizerName: organizer.displayName,
      searchBlob: createEventSearchBlob({ title, description, location: index % 2 === 0 ? 'Lisbon Studio' : 'Remote Boardroom', timezone: 'UTC' }),
      aiSummary: `AI-ready briefing for ${title.toLowerCase()}.`,
      aiAgendaBullets: ['Opening context', 'Core discussion', 'Commitments'],
      invitationCounts: makeInvitationCounts(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } satisfies EventRecord;
  });

  return base;
}

function buildSeedInvitations(events: EventRecord[], users: UserProfile[]): EventInvitation[] {
  const now = nowIso();
  const userOne = users[1];
  const userTwo = users[2];

  return events.flatMap((event, index) => {
    const statuses = index % 3 === 0 ? ['attending', 'maybe'] : index % 3 === 1 ? ['invited', 'declined'] : ['attending', 'invited'];
    const invitees = [
      { user: userOne, status: statuses[0] },
      { user: userTwo, status: statuses[1] },
    ];

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

function buildSeedActivity(events: EventRecord[], users: UserProfile[]): EventActivityLog[] {
  const organizer = users[0];
  return events.map((event, index) => ({
    id: `seed-activity-${String(index + 1).padStart(3, '0')}`,
    eventId: event.id,
    actorUid: organizer.uid,
    actorName: organizer.displayName,
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

  const users = buildSeedUsers();
  const events = buildSeedEvents(users);
  const invitations = buildSeedInvitations(events, users);
  const activity = buildSeedActivity(events, users);

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

  let accessUid: string | undefined;
  if (args.accessEmail) {
    accessUid = await ensureAccessUser(args.accessEmail, args.dryRun);
  }

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