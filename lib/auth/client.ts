'use client';

import { auth } from '@/lib/firebase/client';

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const hasBody = init.body !== undefined && init.body !== null;
  const isFormData =
    typeof FormData !== 'undefined' && init.body instanceof FormData;
  const hasNativeContentType =
    isFormData ||
    (typeof URLSearchParams !== 'undefined' && init.body instanceof URLSearchParams) ||
    (typeof Blob !== 'undefined' && init.body instanceof Blob) ||
    init.body instanceof ArrayBuffer;

  if (hasBody && !hasNativeContentType && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
