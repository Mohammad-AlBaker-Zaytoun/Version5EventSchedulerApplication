import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { parseJsonBody } from '@/lib/api/request';
import { schedulingAssistantInputSchema } from '@/lib/schemas/ai';
import { generateSchedulingAssistantInsight } from '@/lib/services/ai';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const body = await parseJsonBody<unknown>(request);
    const parsed = schedulingAssistantInputSchema.parse(body);
    const insight = await generateSchedulingAssistantInsight(user, parsed);
    return NextResponse.json({ insight });
  } catch (error) {
    return handleApiError(error);
  }
}
