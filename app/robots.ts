import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/dashboard/',
          '/account/',
          '/api/',
          '/auth/',
          '/onboarding/',
          '/sign-in/',
          '/sign-up/',
          '/verify-email/',
          '/claim/',
          // Sample pages (ticket 184). 404 on production; noindex on Preview.
          '/example/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
