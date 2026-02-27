import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { parseJsonBody } from '@/lib/api/request';
import { rsvpInputSchema } from '@/lib/schemas/event';
import { updateInvitationRsvp } from '@/lib/services/invitations';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<unknown>(request);
    const parsed = rsvpInputSchema.parse(body);
    const invitation = await updateInvitationRsvp(user, id, parsed.rsvpStatus);
    return NextResponse.json({ invitation });
  } catch (error) {
    return handleApiError(error);
  }
}
