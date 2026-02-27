import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';

import '@/app/globals.css';
import { AuthProvider } from '@/components/providers/auth-provider';

const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Version 5 Event Scheduler Application',
    template: '%s | Version 5 Event Scheduler Application',
  },
  description:
    'Invite-only event scheduler with Google SSO, Firebase, RSVP tracking, and AI-assisted scheduling insight.',
  openGraph: {
    title: 'Version 5 Event Scheduler Application',
    description:
      'Next.js event scheduler with Firebase auth, invitation workflows, RSVP tracking, and AI scheduling suggestions.',
    url: appUrl,
    siteName: 'Version 5 Event Scheduler Application',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Version 5 Event Scheduler Application',
    description:
      'Mobile-first event scheduling platform with invitation management and AI conflict insight.',
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
