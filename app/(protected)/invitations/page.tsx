import type { Metadata } from 'next';

import { InvitationsClient } from '@/components/invitations/invitations-client';

export const metadata: Metadata = {
  title: 'Invitations',
  description: 'Review event invitations and response state.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function InvitationsPage() {
  return <InvitationsClient />;
}
