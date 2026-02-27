import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { listInvitationsForUser } from '@/lib/services/invitations';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const items = await listInvitationsForUser(user);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}
