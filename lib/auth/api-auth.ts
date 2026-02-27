import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

import { unauthorized } from '@/lib/api/errors';
import { getAdminAuth } from '@/lib/firebase/admin';
import type { ApiUserContext } from '@/lib/types';
import { getUserProfile, upsertUserProfile } from '@/lib/services/users';

const SESSION_COOKIE_NAME = 'v5es_session';

async function getDecodedTokenFromSessionCookie(): Promise<{
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
} | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };
  } catch {
    return null;
  }
}

async function getDecodedTokenFromAuthorizationHeader(
  request: NextRequest,
): Promise<{ uid: string; email?: string; name?: string; picture?: string } | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length);

  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };
  } catch {
    return null;
  }
}

export async function requireApiUser(request: NextRequest): Promise<ApiUserContext> {
  const decoded =
    (await getDecodedTokenFromAuthorizationHeader(request)) ??
    (await getDecodedTokenFromSessionCookie());

  if (!decoded) {
    unauthorized();
  }

  const uid = decoded.uid;
  const email = decoded.email ?? '';
  const displayName = decoded.name ?? 'Attendee';

  let profile = await getUserProfile(uid);
  if (!profile) {
    profile = await upsertUserProfile({
      uid,
      email,
      displayName,
      photoURL: decoded.picture,
    });
  }

  return {
    uid,
    email: profile.email,
    normalizedEmail: profile.normalizedEmail,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
  };
}

export async function getSessionUser(): Promise<ApiUserContext | null> {
  const decoded = await getDecodedTokenFromSessionCookie();
  if (!decoded) {
    return null;
  }

  const profile = await getUserProfile(decoded.uid);
  if (!profile) {
    return null;
  }

  return {
    uid: profile.uid,
    email: profile.email,
    normalizedEmail: profile.normalizedEmail,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
  };
}

export { SESSION_COOKIE_NAME };
