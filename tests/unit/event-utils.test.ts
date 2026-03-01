import { expect, it } from 'vitest';

import {
  applyRsvpDelta,
  buildInvitationId,
  hasOverlap,
  normalizeEmail,
} from '@/lib/events/utils';

it('normalizes emails deterministically', () => {
  expect(normalizeEmail(' Person@Example.COM ')).toBe('person@example.com');
  expect(buildInvitationId('event-1', 'Person@Example.COM')).toBe('event-1-person-example-com');
});

it('updates invitation counts without going negative', () => {
  const next = applyRsvpDelta(
    { invited: 1, attending: 0, maybe: 0, declined: 0 },
    'invited',
    'attending',
  );

  expect(next).toEqual({ invited: 0, attending: 1, maybe: 0, declined: 0 });
});

it('treats back-to-back events as non-overlapping', () => {
  expect(
    hasOverlap(
      {
        startsAt: '2026-03-01T10:00:00.000Z',
        endsAt: '2026-03-01T11:00:00.000Z',
      },
      {
        startsAt: '2026-03-01T11:00:00.000Z',
        endsAt: '2026-03-01T12:00:00.000Z',
      },
    ),
  ).toBe(false);
});

it('detects true time-window intersections', () => {
  expect(
    hasOverlap(
      {
        startsAt: '2026-03-01T10:00:00.000Z',
        endsAt: '2026-03-01T11:00:00.000Z',
      },
      {
        startsAt: '2026-03-01T10:30:00.000Z',
        endsAt: '2026-03-01T11:30:00.000Z',
      },
    ),
  ).toBe(true);
});
