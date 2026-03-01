import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { generateDashboardBusinessInsight } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    const insight = await generateDashboardBusinessInsight(user);
    return NextResponse.json(
      { insight, generatedAt: new Date().toISOString() },
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
