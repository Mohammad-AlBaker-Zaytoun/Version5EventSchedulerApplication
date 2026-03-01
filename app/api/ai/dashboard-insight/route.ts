import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { handleApiError } from '@/lib/api/errors';
import { requireApiUser } from '@/lib/auth/api-auth';
import { analyticsOverviewSchema } from '@/lib/schemas/ai';
import { generateDashboardBusinessInsight } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';

const dashboardInsightRequestSchema = z.object({
  overview: analyticsOverviewSchema.optional(),
});

async function handleDashboardInsight(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireApiUser(request);
    let overview: z.infer<typeof analyticsOverviewSchema> | undefined;

    if (request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as unknown;
      const parsed = dashboardInsightRequestSchema.safeParse(body);
      overview = parsed.success ? parsed.data.overview : undefined;
    }

    const insight = await generateDashboardBusinessInsight(user, overview);
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleDashboardInsight(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleDashboardInsight(request);
}
