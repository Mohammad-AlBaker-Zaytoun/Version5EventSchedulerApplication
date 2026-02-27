import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { parseJsonBody } from '@/lib/api/request';
import { eventInputSchema } from '@/lib/schemas/event';
import { deleteEvent, getEventDetail, updateEvent } from '@/lib/services/events';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const detail = await getEventDetail(user, id);
    return NextResponse.json(detail);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    const body = await parseJsonBody<unknown>(request);
    const parsed = eventInputSchema.parse(body);
    const event = await updateEvent(user, id, parsed);
    return NextResponse.json({ event });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const { id } = await context.params;
    await deleteEvent(user, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
