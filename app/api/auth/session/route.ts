import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth } from '@/lib/firebase/admin';
import { handleApiError } from '@/lib/api/errors';
import { parseJsonBody } from '@/lib/api/request';
import { SESSION_COOKIE_NAME } from '@/lib/auth/api-auth';

const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await parseJsonBody<{ idToken?: string }>(request);
    if (!body.idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(body.idToken, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRES_IN_MS / 1000,
      path: '/',
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
