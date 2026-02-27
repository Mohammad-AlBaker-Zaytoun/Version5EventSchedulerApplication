import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth } from '@/lib/firebase/admin';
import { parseJsonBody } from '@/lib/api/request';
import { handleApiError } from '@/lib/api/errors';
import { upsertUserProfile } from '@/lib/services/users';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await parseJsonBody<{ idToken?: string }>(request);
    if (!body.idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    const decoded = await getAdminAuth().verifyIdToken(body.idToken, true);

    const profile = await upsertUserProfile({
      uid: decoded.uid,
      email: decoded.email ?? '',
      displayName: decoded.name ?? 'Attendee',
      photoURL: decoded.picture,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return handleApiError(error);
  }
}
