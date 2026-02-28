import { addHours } from 'date-fns';
import { GoogleGenAI } from '@google/genai';

import { getServerEnv } from '@/lib/env';
import {
  dashboardBusinessInsightSchema,
  schedulingAssistantOutputSchema,
} from '@/lib/schemas/ai';
import type {
  AnalyticsOverview,
  ApiUserContext,
  DashboardBusinessInsight,
  SchedulingAssistantInsight,
} from '@/lib/types';
import { getAnalyticsOverview } from '@/lib/services/analytics';
import { listVisibleEvents } from '@/lib/services/events';
import { hasOverlap } from '@/lib/events/utils';

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
