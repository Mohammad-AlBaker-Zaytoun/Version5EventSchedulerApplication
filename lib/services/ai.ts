import { addHours } from 'date-fns';
import { GoogleGenAI } from '@google/genai';

import { getServerEnv } from '@/lib/env';
import { schedulingAssistantOutputSchema } from '@/lib/schemas/ai';
import type { ApiUserContext, SchedulingAssistantInsight } from '@/lib/types';
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
