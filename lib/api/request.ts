import { NextRequest } from 'next/server';

import { badRequest } from '@/lib/api/errors';

export async function parseJsonBody<T>(request: NextRequest): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return badRequest('Invalid JSON payload');
  }
}
