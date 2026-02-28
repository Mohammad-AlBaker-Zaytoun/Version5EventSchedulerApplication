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

export const dashboardBusinessInsightSchema = z.object({
  headline: z.string().min(8).max(140),
  summary: z.string().min(20).max(900),
  health: z.enum(['strong', 'steady', 'watch']),
  strengths: z.array(z.string().min(3).max(220)).min(1).max(4),
  risks: z.array(z.string().min(3).max(220)).min(1).max(4),
  recommendations: z.array(z.string().min(3).max(220)).min(2).max(4),
});

export const eventRecommendationInsightSchema = z.object({
  headline: z.string().min(8).max(140),
  reason: z.string().min(20).max(500),
  whyNow: z.string().min(12).max(320),
  recommendedAction: z.enum(['respond', 'attend', 'prepare', 'host', 'review']),
  eventId: z.string().trim().optional(),
  eventTitle: z.string().trim().max(160).optional(),
  startsAt: z.string().datetime().optional(),
  location: z.string().trim().max(160).optional(),
});
