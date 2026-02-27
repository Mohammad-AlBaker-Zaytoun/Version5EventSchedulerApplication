import { expect, it } from 'vitest';

import { applyRsvpDelta, buildInvitationId, normalizeEmail } from '@/lib/events/utils';

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
