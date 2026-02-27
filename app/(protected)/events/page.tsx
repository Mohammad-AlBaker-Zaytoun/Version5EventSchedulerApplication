import type { Metadata } from 'next';

import { EventsClient } from '@/components/events/events-client';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Create and manage invite-only events with RSVP tracking and AI scheduling support.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EventsPage() {
  return <EventsClient />;
}
