import { addHours } from 'date-fns';
import { GoogleGenAI } from '@google/genai';

import { getServerEnv } from '@/lib/env';
import {
  dashboardBusinessInsightSchema,
  eventRecommendationInsightSchema,
  schedulingAssistantOutputSchema,
} from '@/lib/schemas/ai';
import type {
  AnalyticsOverview,
  ApiUserContext,
  DashboardBusinessInsight,
  EventRecommendationInsight,
  SchedulingAssistantInsight,
} from '@/lib/types';
import { getAnalyticsOverview } from '@/lib/services/analytics';
import { listVisibleEvents } from '@/lib/services/events';
import { hasOverlap, isUpcomingEvent } from '@/lib/events/utils';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (aiClient) {
    return aiClient;
  }

  aiClient = new GoogleGenAI({ apiKey: getServerEnv().GEMINI_API_KEY });
  return aiClient;
}

type SchedulingInput = {
  title: string;
  description?: string;
  location: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  inviteeEmails: string[];
  eventId?: string;
};

function buildFallbackInsight(
  input: SchedulingInput,
  conflictCount: number,
  riskyInvitees: Array<{ email: string; reason: string }>,
): SchedulingAssistantInsight {
  const startsAtDate = new Date(input.startsAt);
  const durationMs = new Date(input.endsAt).getTime() - startsAtDate.getTime();
  const suggestedStart = addHours(startsAtDate, 2);
  const suggestedEnd = new Date(suggestedStart.getTime() + durationMs);

  return {
    summary:
      conflictCount === 0
        ? `This draft looks feasible. No direct conflicts were detected against the organizer's visible event schedule, so the current time window is a reasonable starting point.`
        : `This draft overlaps with ${conflictCount} existing event slot${conflictCount === 1 ? '' : 's'}. Consider shifting the time window or reducing invitee overlap before sending invitations.`,
    conflictLevel: conflictCount >= 4 ? 'high' : conflictCount >= 2 ? 'medium' : 'low',
    conflictCount,
    riskyInvitees,
    suggestedTimeWindows: [
      {
        startsAt: suggestedStart.toISOString(),
        endsAt: suggestedEnd.toISOString(),
        reason: 'A later buffer may reduce same-day overlap and attendance fatigue.',
      },
    ],
    suggestedSummary: `${input.title} at ${input.location}. A focused event aligned to ${input.timezone}.`,
    agendaBullets: [
      'Arrival and context-setting',
      'Core event discussion',
      'Action items and next steps',
    ],
  };
}

function buildPrompt(
  input: SchedulingInput,
  fallback: SchedulingAssistantInsight,
  relatedEvents: Array<{ title: string; startsAt: string; endsAt: string; organizerName: string }>,
): string {
  return `You are an event scheduling assistant.
Return strict JSON with keys:
summary, conflictLevel, conflictCount, riskyInvitees, suggestedTimeWindows, suggestedSummary, agendaBullets.

Constraints:
- summary max 700 chars
- conflictLevel one of low, medium, high
- conflictCount must be an integer
- riskyInvitees is an array of { email, reason }
- suggestedTimeWindows is an array of { startsAt, endsAt, reason } in ISO format
- agendaBullets should be short, practical bullets

Draft event:
title=${input.title}
location=${input.location}
startsAt=${input.startsAt}
endsAt=${input.endsAt}
timezone=${input.timezone}
description=${input.description ?? 'N/A'}
inviteeEmails=${input.inviteeEmails.join(', ') || 'N/A'}

Relevant existing events:
${relatedEvents.map((event) => `- ${event.title} | ${event.startsAt} -> ${event.endsAt} | organizer=${event.organizerName}`).join('\n') || 'none'}

If unsure, stay close to this fallback analysis:
${JSON.stringify(fallback)}
`;
}

export async function generateSchedulingAssistantInsight(
  user: ApiUserContext,
  input: SchedulingInput,
): Promise<SchedulingAssistantInsight> {
  const relatedEventsResponse = await listVisibleEvents(user, {
    page: 1,
    limit: 100,
    scope: 'all',
  });

  const relatedEvents = relatedEventsResponse.items.filter(
    (event) => event.id !== input.eventId && hasOverlap(input, event),
  );

  const riskyInvitees = input.inviteeEmails.slice(0, 5).map((email) => ({
    email,
    reason:
      relatedEvents.length > 0
        ? 'This event slot already overlaps with visible schedule activity.'
        : 'Attendance risk is low, but confirmation is still pending.',
  }));

  const fallback = buildFallbackInsight(input, relatedEvents.length, riskyInvitees);

  try {
    const response = await getAiClient().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: buildPrompt(
        input,
        fallback,
        relatedEvents.map((event) => ({
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          organizerName: event.organizerName,
        })),
      ),
      config: {
        temperature: 0.2,
        topP: 0.8,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return fallback;
    }

    const parsed = JSON.parse(text) as unknown;
    const validated = schedulingAssistantOutputSchema.safeParse(parsed);
    return validated.success ? validated.data : fallback;
  } catch {
    return fallback;
  }
}

function getResponseCount(
  overview: AnalyticsOverview,
  status: AnalyticsOverview['responseDistribution'][number]['status'],
) {
  return overview.responseDistribution.find((item) => item.status === status)?.count ?? 0;
}

function buildDashboardFallback(overview: AnalyticsOverview): DashboardBusinessInsight {
  const pendingCount = getResponseCount(overview, 'pending');
  const attendingCount = getResponseCount(overview, 'attending');
  const maybeCount = getResponseCount(overview, 'maybe');
  const declinedCount = getResponseCount(overview, 'declined');
  const totalResponses = overview.responseDistribution.reduce((sum, item) => sum + item.count, 0);
  const attendanceRate = totalResponses > 0 ? attendingCount / totalResponses : 0;
  const pendingRate = totalResponses > 0 ? pendingCount / totalResponses : 0;
  const declineRate = totalResponses > 0 ? declinedCount / totalResponses : 0;
  const overlapPressure = overview.conflictCount / Math.max(overview.upcomingCount * 2, 1);
  const busiestDay = [...overview.scheduleDensity].sort((left, right) => right.count - left.count)[0];

  let score = 0;
  if (attendanceRate >= 0.45) {
    score += 2;
  } else if (attendanceRate >= 0.28) {
    score += 1;
  }

  if (pendingRate <= 0.35) {
    score += 1;
  } else if (pendingRate > 0.55) {
    score -= 1;
  }

  if (overlapPressure <= 0.16) {
    score += 1;
  } else if (overlapPressure > 0.35) {
    score -= 2;
  } else if (overlapPressure > 0.22) {
    score -= 1;
  }

  if (declineRate > 0.28) {
    score -= 1;
  }

  if (overview.upcomingCount >= 4) {
    score += 1;
  }

  const health: DashboardBusinessInsight['health'] =
    score >= 3 ? 'strong' : score >= 1 ? 'steady' : 'watch';

  const headline =
    health === 'strong'
      ? 'Event program health looks strong'
      : health === 'steady'
        ? 'Event program is steady but needs tuning'
        : 'Event program needs closer operational attention';

  const strengths = [
    overview.upcomingCount > 0
      ? `${overview.upcomingCount} upcoming event${overview.upcomingCount === 1 ? '' : 's'} keep the near-term pipeline active.`
      : 'The workspace is quiet enough to reset priorities before the next event cycle.',
    attendanceRate >= 0.3
      ? `${Math.round(attendanceRate * 100)}% of visible responses are confirmed attending, which is a solid engagement baseline.`
      : 'There is still room to convert interest, but the current response mix gives enough signal to prioritize follow-up.',
  ];

  if (busiestDay) {
    strengths.push(`${busiestDay.label} is the busiest visible day with ${busiestDay.count} scheduled event${busiestDay.count === 1 ? '' : 's'}.`);
  }

  const risks = [
    overlapPressure > 0.22
      ? `Overlap pressure is elevated at ${Math.round(overlapPressure * 100)}%, which can reduce attendance quality.`
      : 'Overlap pressure is currently contained, but it still needs monitoring as the schedule fills up.',
    pendingRate > 0.35
      ? `${pendingCount} invitation${pendingCount === 1 ? '' : 's'} are still pending, which slows planning confidence.`
      : 'Pending replies are under control, but conversion speed will still affect confidence in headcount.',
  ];

  if (declineRate > 0.2) {
    risks.push(`${declinedCount} decline${declinedCount === 1 ? '' : 's'} suggest that some sessions may need sharper timing or audience targeting.`);
  }

  const recommendations = [
    pendingCount > 0
      ? 'Follow up on pending invitations first so the attendance forecast becomes more reliable.'
      : 'Keep response momentum high by confirming attendees early and locking agendas sooner.',
    overview.conflictCount > 0
      ? 'Reduce overlap by staggering high-risk sessions or consolidating adjacent meetings.'
      : 'Protect the current low-overlap window by spacing new events away from busy slots.',
    maybeCount > attendingCount
      ? 'Clarify value, agenda, and expected outcomes for maybes to improve conversion into confirmed attendance.'
      : 'Use confirmed attendance data to prioritize the events with the strongest traction.',
  ];

  return {
    headline,
    summary: `${headline}. There are ${overview.upcomingCount} upcoming visible events, ${attendingCount} confirmed responses, ${pendingCount} pending replies, and ${overview.conflictCount} overlap signal${overview.conflictCount === 1 ? '' : 's'} in the current pipeline.`,
    health,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    source: 'fallback',
  };
}

function buildDashboardPrompt(
  overview: AnalyticsOverview,
  fallback: DashboardBusinessInsight,
): string {
  const responseLines = overview.responseDistribution
    .map((item) => `- ${item.status}: ${item.count}`)
    .join('\n');
  const densityLines = overview.scheduleDensity
    .map((item) => `- ${item.label}: ${item.count}`)
    .join('\n');
  const riskLines = overview.highRiskEvents
    .map((item) => `- ${item.title} | ${item.startsAt} | ${item.location} | ${item.riskLabel}`)
    .join('\n');

  return `You are an operations analyst for an event scheduling business.
Return strict JSON with keys:
headline, summary, health, strengths, risks, recommendations.

Constraints:
- headline max 140 chars
- summary max 900 chars
- health one of strong, steady, watch
- strengths: 1 to 4 concise bullets
- risks: 1 to 4 concise bullets
- recommendations: 2 to 4 practical actions
- no markdown

Analytics snapshot:
upcomingCount=${overview.upcomingCount}
ownedCount=${overview.ownedCount}
invitedCount=${overview.invitedCount}
conflictCount=${overview.conflictCount}

Response distribution:
${responseLines || '- none'}

Schedule density:
${densityLines || '- none'}

High risk events:
${riskLines || '- none'}

Use an executive but practical tone. Focus on operational health, event demand, attendance confidence, and scheduling discipline.

If you are uncertain, stay close to this fallback:
${JSON.stringify({
    headline: fallback.headline,
    summary: fallback.summary,
    health: fallback.health,
    strengths: fallback.strengths,
    risks: fallback.risks,
    recommendations: fallback.recommendations,
  })}`;
}

export async function generateDashboardBusinessInsight(
  user: ApiUserContext,
): Promise<DashboardBusinessInsight> {
  const overview = await getAnalyticsOverview(user);
  const fallback = buildDashboardFallback(overview);

  try {
    const response = await getAiClient().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: buildDashboardPrompt(overview, fallback),
      config: {
        temperature: 0.3,
        topP: 0.8,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return fallback;
    }

    const parsed = JSON.parse(text) as unknown;
    const validated = dashboardBusinessInsightSchema.safeParse(parsed);

    if (!validated.success) {
      return fallback;
    }

    return {
      ...validated.data,
      source: 'gemini',
    };
  } catch {
    return fallback;
  }
}

type VisibleEventItem = Awaited<ReturnType<typeof listVisibleEvents>>['items'][number];

type RecommendationCandidate = {
  event: VisibleEventItem;
  score: number;
  action: EventRecommendationInsight['recommendedAction'];
  reasons: string[];
  whyNow: string;
  overlapCount: number;
  pendingCount: number;
};

function incrementCounter(counter: Map<string, number>, key?: string, amount = 1) {
  if (!key) {
    return;
  }

  counter.set(key, (counter.get(key) ?? 0) + amount);
}

function getTopSignals(counter: Map<string, number>) {
  return [...counter.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
}

function buildEventRecommendationFallback(visibleEvents: VisibleEventItem[]): EventRecommendationInsight {
  const now = Date.now();
  const upcomingEvents = visibleEvents.filter((event) => isUpcomingEvent(event));

  if (upcomingEvents.length === 0) {
    return {
      headline: 'No upcoming event stands out yet',
      reason:
        'There are no upcoming visible events to recommend right now, so the best next step is to create a new session or wait for more invitations.',
      whyNow: 'The recommendation engine only prioritizes upcoming events that the signed-in user can actually access.',
      recommendedAction: 'review',
      source: 'fallback',
    };
  }

  const positiveLocations = new Map<string, number>();
  const positiveOrganizers = new Map<string, number>();
  const negativeLocations = new Map<string, number>();
  const negativeOrganizers = new Map<string, number>();

  for (const event of visibleEvents) {
    if (event.viewerRsvpStatus === 'attending' || event.viewerRsvpStatus === 'maybe') {
      incrementCounter(positiveLocations, event.location.toLowerCase());
      incrementCounter(positiveOrganizers, event.organizerName.toLowerCase());
    }

    if (event.viewerRsvpStatus === 'declined') {
      incrementCounter(negativeLocations, event.location.toLowerCase());
      incrementCounter(negativeOrganizers, event.organizerName.toLowerCase());
    }
  }

  const overlapMap = new Map<string, number>();
  for (const event of upcomingEvents) {
    overlapMap.set(
      event.id,
      upcomingEvents.filter((candidate) => candidate.id !== event.id && hasOverlap(event, candidate))
        .length,
    );
  }

  const candidates: RecommendationCandidate[] = upcomingEvents
    .filter((event) => event.viewerRsvpStatus !== 'declined')
    .map((event) => {
      const overlapCount = overlapMap.get(event.id) ?? 0;
      const pendingCount = event.invitationCounts.invited;
      const maybeCount = event.invitationCounts.maybe;
      const hoursUntilStart = Math.max(0, (new Date(event.startsAt).getTime() - now) / 3_600_000);
      const soonBonus = hoursUntilStart <= 24 ? 16 : hoursUntilStart <= 72 ? 10 : hoursUntilStart <= 168 ? 5 : 1;
      const locationPositive = positiveLocations.get(event.location.toLowerCase()) ?? 0;
      const organizerPositive = positiveOrganizers.get(event.organizerName.toLowerCase()) ?? 0;
      const locationNegative = negativeLocations.get(event.location.toLowerCase()) ?? 0;
      const organizerNegative = negativeOrganizers.get(event.organizerName.toLowerCase()) ?? 0;

      let score = soonBonus + locationPositive * 6 + organizerPositive * 5 - locationNegative * 4 - organizerNegative * 4;
      let action: EventRecommendationInsight['recommendedAction'] = 'review';
      const reasons: string[] = [];
      let whyNow = 'This event is in the near-term window, so it is worth reviewing soon.';

      if (event.isOrganizer) {
        action = overlapCount > 0 || pendingCount > 0 ? 'host' : 'prepare';
        score += 26 + pendingCount * 7 + maybeCount * 3 + overlapCount * 6;
        reasons.push('You are the organizer, so your decisions directly affect attendance quality.');

        if (pendingCount > 0) {
          reasons.push(`${pendingCount} invitation${pendingCount === 1 ? '' : 's'} are still waiting for a reply.`);
          whyNow = 'Unanswered invitations are still affecting attendance confidence for this hosted event.';
        } else if (overlapCount > 0) {
          reasons.push(`It overlaps with ${overlapCount} other visible upcoming event${overlapCount === 1 ? '' : 's'}.`);
          whyNow = 'The overlap risk should be managed before the event gets closer.';
        } else {
          whyNow = 'This hosted event is approaching soon and is the most important one to prepare well.';
        }
      } else {
        if (event.viewerRsvpStatus === 'invited') {
          action = 'respond';
          score += 38 + Math.max(0, 4 - overlapCount) * 2;
          reasons.push('You have not responded to this invitation yet.');
          whyNow = 'A pending RSVP is still open, so this is the cleanest next decision to make.';
        } else if (event.viewerRsvpStatus === 'maybe') {
          action = 'review';
          score += 28 + Math.max(0, 3 - overlapCount) * 2;
          reasons.push('You marked this as maybe, so it is a good candidate for a final decision.');
          whyNow = 'A tentative RSVP has more value when it is clarified before the event gets closer.';
        } else {
          action = 'prepare';
          score += 22;
          reasons.push('You are already attending, so this is the next event to prepare for.');
          whyNow = 'It is one of your closest confirmed commitments in the visible schedule.';
        }

        if (locationPositive > 0) {
          reasons.push(`You have responded positively to similar events in ${event.location}.`);
        }

        if (organizerPositive > 0) {
          reasons.push(`You usually engage well with invitations from ${event.organizerName}.`);
        }

        if (overlapCount > 0) {
          reasons.push(`It currently overlaps with ${overlapCount} other visible event${overlapCount === 1 ? '' : 's'}.`);
        }
      }

      return {
        event,
        score,
        action,
        reasons,
        whyNow,
        overlapCount,
        pendingCount,
      };
    })
    .sort((left, right) => right.score - left.score);

  const winner = candidates[0];

  if (!winner) {
    return {
      headline: 'No clear event recommendation is available',
      reason:
        'The current visible event set does not produce a strong candidate yet, so the best step is to review your schedule manually.',
      whyNow: 'There is not enough upcoming signal to confidently prioritize one event over the others.',
      recommendedAction: 'review',
      source: 'fallback',
    };
  }

  const actionLabels: Record<EventRecommendationInsight['recommendedAction'], string> = {
    respond: 'Respond to this invitation',
    attend: 'Attend this event',
    prepare: 'Prepare for this event',
    host: 'Focus on hosting this event',
    review: 'Review this event',
  };

  return {
    headline: actionLabels[winner.action],
    reason: winner.reasons.slice(0, 3).join(' '),
    whyNow: winner.whyNow,
    recommendedAction: winner.action,
    eventId: winner.event.id,
    eventTitle: winner.event.title,
    startsAt: winner.event.startsAt,
    location: winner.event.location,
    source: 'fallback',
  };
}

function buildEventRecommendationPrompt(
  user: ApiUserContext,
  visibleEvents: VisibleEventItem[],
  fallback: EventRecommendationInsight,
) {
  const respondedEvents = visibleEvents.filter(
    (event) => event.viewerRsvpStatus && event.viewerRsvpStatus !== 'invited',
  );
  const positiveLocations = new Map<string, number>();
  const positiveOrganizers = new Map<string, number>();

  for (const event of respondedEvents) {
    if (event.viewerRsvpStatus === 'attending' || event.viewerRsvpStatus === 'maybe') {
      incrementCounter(positiveLocations, event.location, 1);
      incrementCounter(positiveOrganizers, event.organizerName, 1);
    }
  }

  const candidateLines = visibleEvents
    .filter((event) => isUpcomingEvent(event) && event.viewerRsvpStatus !== 'declined')
    .map((event) => {
      const overlaps = visibleEvents.filter(
        (candidate) =>
          candidate.id !== event.id && isUpcomingEvent(candidate) && hasOverlap(event, candidate),
      ).length;

      return `- id=${event.id} | title=${event.title} | startsAt=${event.startsAt} | location=${event.location} | organizer=${event.organizerName} | isOrganizer=${event.isOrganizer} | viewerRsvpStatus=${event.viewerRsvpStatus ?? 'none'} | invited=${event.invitationCounts.invited} | attending=${event.invitationCounts.attending} | maybe=${event.invitationCounts.maybe} | overlaps=${overlaps}`;
    })
    .join('\n');

  return `You are an event recommendation assistant for the signed-in user.
Choose one visible upcoming event to recommend next and explain why.
Return strict JSON with keys:
headline, reason, whyNow, recommendedAction, eventId, eventTitle, startsAt, location.

Constraints:
- recommendedAction one of respond, attend, prepare, host, review
- reason max 500 chars
- whyNow max 320 chars
- pick only from the provided candidate ids
- do not recommend declined events
- no markdown

Signed-in user:
name=${user.displayName}
email=${user.email}

Positive response signals:
locations=${getTopSignals(positiveLocations).map((item) => `${item.name} (${item.count})`).join(', ') || 'none'}
organizers=${getTopSignals(positiveOrganizers).map((item) => `${item.name} (${item.count})`).join(', ') || 'none'}

Candidate events:
${candidateLines || '- none'}

If unsure, stay close to this fallback:
${JSON.stringify({
    headline: fallback.headline,
    reason: fallback.reason,
    whyNow: fallback.whyNow,
    recommendedAction: fallback.recommendedAction,
    eventId: fallback.eventId,
    eventTitle: fallback.eventTitle,
    startsAt: fallback.startsAt,
    location: fallback.location,
  })}`;
}

export async function generateEventRecommendationInsight(
  user: ApiUserContext,
): Promise<EventRecommendationInsight> {
  const response = await listVisibleEvents(user, {
    page: 1,
    limit: 100,
    scope: 'all',
  });

  const visibleEvents = response.items;
  const fallback = buildEventRecommendationFallback(visibleEvents);

  if (!fallback.eventId) {
    return fallback;
  }

  try {
    const aiResponse = await getAiClient().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: buildEventRecommendationPrompt(user, visibleEvents, fallback),
      config: {
        temperature: 0.35,
        topP: 0.85,
        responseMimeType: 'application/json',
      },
    });

    const text = aiResponse.text?.trim();
    if (!text) {
      return fallback;
    }

    const parsed = JSON.parse(text) as unknown;
    const validated = eventRecommendationInsightSchema.safeParse(parsed);

    if (!validated.success) {
      return fallback;
    }

    const matchedEvent = visibleEvents.find((event) => event.id === validated.data.eventId);
    if (!matchedEvent) {
      return fallback;
    }

    return {
      ...validated.data,
      eventTitle: matchedEvent.title,
      startsAt: matchedEvent.startsAt,
      location: matchedEvent.location,
      source: 'gemini',
    };
  } catch {
    return fallback;
  }
}
