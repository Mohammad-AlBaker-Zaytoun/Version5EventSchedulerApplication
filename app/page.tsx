import { redirect } from 'next/navigation';

import { getSessionUser } from '@/lib/auth/api-auth';

export default async function HomePage() {
  const user = await getSessionUser();
  redirect(user ? '/events' : '/login');
}
