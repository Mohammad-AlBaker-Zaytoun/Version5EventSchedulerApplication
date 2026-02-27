import type { MetadataRoute } from 'next';

const DEFAULT_APP_URL = 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL;
  const url = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;

  return [
    {
      url,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${url}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];
}
