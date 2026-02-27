import type { Metadata } from 'next';

import { EventDetailClient } from '@/components/events/event-detail-client';

export const metadata: Metadata = {
  title: 'Event Detail',
  description: 'Review event details, manage invitations, and update RSVP state.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventDetailClient eventId={id} />;
}
