import { z } from 'zod';

export const schedulingAssistantInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().min(2).max(160),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().trim().min(2).max(80),
  inviteeEmails: z.array(z.string().email()).max(30).default([]),
  eventId: z.string().trim().optional(),
});

export const schedulingAssistantOutputSchema = z.object({
  summary: z.string().min(10).max(900),
  conflictLevel: z.enum(['low', 'medium', 'high']),
  conflictCount: z.number().int().min(0),
  riskyInvitees: z.array(
    z.object({
      email: z.string().email(),
      reason: z.string().min(3).max(220),
    }),
  ),
  suggestedTimeWindows: z.array(
    z.object({
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      reason: z.string().min(3).max(220),
    }),
  ),
  suggestedSummary: z.string().max(400).optional(),
  agendaBullets: z.array(z.string().min(3).max(140)).max(6).optional(),
});
