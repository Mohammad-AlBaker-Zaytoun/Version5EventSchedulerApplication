import type { AnalyticsOverview, ApiUserContext, EventRecord } from '@/lib/types';
import { format, parseISO } from 'date-fns';

import { getAdminDb } from '@/lib/firebase/admin';
import { listVisibleEvents } from '@/lib/services/events';
import { listInvitationsForUser } from '@/lib/services/invitations';
import { hasOverlap, isUpcomingEvent } from '@/lib/events/utils';

const ACTIVITY_COLLECTION = 'eventActivityLogs';

export async function getAnalyticsOverview(user: ApiUserContext): Promise<AnalyticsOverview> {
  const [eventsResponse, invitations, recentActivitySnapshot] = await Promise.all([
    listVisibleEvents(user, {
      page: 1,
      limit: 100,
      scope: 'all',
      status: undefined,
    }),
    listInvitationsForUser(user),
    getAdminDb().collection(ACTIVITY_COLLECTION).get(),
  ]);

  const visibleEvents = eventsResponse.items;
  const upcomingEvents = visibleEvents.filter((event) => isUpcomingEvent(event));
  const ownedEvents = visibleEvents.filter((event) => event.isOrganizer);
  const invitedEvents = visibleEvents.filter((event) => !event.isOrganizer);

  const responseDistribution = [
    { status: 'pending' as const, count: invitations.filter((invitation) => invitation.rsvpStatus === 'invited').length },
    { status: 'attending' as const, count: invitations.filter((invitation) => invitation.rsvpStatus === 'attending').length },
    { status: 'maybe' as const, count: invitations.filter((invitation) => invitation.rsvpStatus === 'maybe').length },
    { status: 'declined' as const, count: invitations.filter((invitation) => invitation.rsvpStatus === 'declined').length },
  ];

  const scheduleDensityMap = new Map<string, number>();
  for (const event of upcomingEvents.slice(0, 12)) {
    const label = format(parseISO(event.startsAt), 'MMM d');
    scheduleDensityMap.set(label, (scheduleDensityMap.get(label) ?? 0) + 1);
  }

  let conflictCount = 0;
  const highRiskEvents: Array<
    Pick<EventRecord, 'id' | 'title' | 'startsAt' | 'location'> & { riskLabel: string }
  > = [];

  const sortedUpcoming = [...upcomingEvents].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  );

  for (let index = 0; index < sortedUpcoming.length; index += 1) {
    const current = sortedUpcoming[index];
    const overlaps = sortedUpcoming.filter(
      (candidate) => candidate.id !== current.id && hasOverlap(current, candidate),
    );

    if (overlaps.length > 0) {
      conflictCount += overlaps.length;
      if (highRiskEvents.length < 4) {
        highRiskEvents.push({
          id: current.id,
          title: current.title,
          startsAt: current.startsAt,
          location: current.location,
          riskLabel: overlaps.length > 1 ? 'Multi-overlap' : 'Single overlap',
        });
      }
    }
  }

  const recentActivity = recentActivitySnapshot.docs
    .map((doc) => doc.data() as AnalyticsOverview['recentActivity'][number])
    .filter((activity) => activity.actorUid === user.uid || visibleEvents.some((event) => event.id === activity.eventId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);

  return {
    upcomingCount: upcomingEvents.length,
    ownedCount: ownedEvents.length,
    invitedCount: invitedEvents.length,
    conflictCount,
    responseDistribution,
    scheduleDensity: [...scheduleDensityMap.entries()].map(([label, count]) => ({ label, count })),
    highRiskEvents,
    recentActivity,
  };
}
