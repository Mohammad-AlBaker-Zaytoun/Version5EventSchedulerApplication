import type { Metadata } from 'next';

import { LoginCard } from '@/components/auth/login-card';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in with Google SSO to access the event scheduler application.',
  alternates: {
    canonical: '/login',
  },
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(217,119,6,0.18),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(15,118,110,0.16),transparent_35%)]" />
      <div className="relative w-full max-w-md">
        <h1 className="mb-4 text-center font-[family-name:var(--font-display)] text-3xl text-[var(--text-primary)]">
          Plan the right event, faster
        </h1>
        <LoginCard />
      </div>
    </main>
  );
}
