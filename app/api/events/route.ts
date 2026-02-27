import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { parseJsonBody } from '@/lib/api/request';
import { eventInputSchema, eventQuerySchema } from '@/lib/schemas/event';
import { createEvent, listVisibleEvents } from '@/lib/services/events';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const parsed = eventQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const result = await listVisibleEvents(user, parsed);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<unknown>(request);
    const parsed = eventInputSchema.parse(body);
    const event = await createEvent(user, parsed);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
