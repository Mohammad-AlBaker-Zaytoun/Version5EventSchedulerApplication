import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { generateEventRecommendationInsight } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const recommendation = await generateEventRecommendationInsight(user);
    return NextResponse.json(
      { recommendation, generatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
