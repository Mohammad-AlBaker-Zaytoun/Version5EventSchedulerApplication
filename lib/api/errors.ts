import { NextResponse } from 'next/server';

export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function badRequest(message: string): never {
  throw new ApiError(message, 400);
}

export function unauthorized(message = 'Unauthorized'): never {
  throw new ApiError(message, 401);
}

export function forbidden(message = 'Forbidden'): never {
  throw new ApiError(message, 403);
}

export function notFound(message = 'Not found'): never {
  throw new ApiError(message, 404);
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
