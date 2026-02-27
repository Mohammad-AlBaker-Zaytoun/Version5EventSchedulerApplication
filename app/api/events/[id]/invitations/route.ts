import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { parseJsonBody } from '@/lib/api/request';
import { invitationInputSchema } from '@/lib/schemas/event';
import { createInvitations } from '@/lib/services/invitations';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<unknown>(request);
    const parsed = invitationInputSchema.parse(body);
    const invitations = await createInvitations(user, id, parsed.emails);
    return NextResponse.json({ invitations }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
