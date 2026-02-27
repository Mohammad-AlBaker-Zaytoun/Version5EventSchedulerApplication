import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { getAnalyticsOverview } from '@/lib/services/analytics';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const overview = await getAnalyticsOverview(user);
    return NextResponse.json(overview);
  } catch (error) {
    return handleApiError(error);
  }
}
