import { z } from 'zod';

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(2000),
    location: z.string().trim().min(2).max(160),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    timezone: z.string().trim().min(2).max(80),
    aiSummary: z.string().trim().max(400).optional(),
    aiAgendaBullets: z.array(z.string().trim().min(1).max(140)).max(6).optional(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: 'Event end time must be after the start time.',
    path: ['endsAt'],
  });

export const eventQuerySchema = z.object({
  q: z.string().trim().optional(),
  location: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  scope: z.enum(['owned', 'invited', 'all']).optional(),
  status: z.enum(['upcoming', 'attending', 'maybe', 'declined']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const invitationInputSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(30),
});

export const rsvpInputSchema = z.object({
  rsvpStatus: z.enum(['attending', 'maybe', 'declined']),
});
