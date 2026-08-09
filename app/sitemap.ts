import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  // Fetch all published listing slugs + city slugs
  const { data: listings } = await supabase
    .from('listings')
    .select('slug, entity_type, updated_at, cities!listings_city_id_fkey(slug)')
    .eq('status', 'published')
    .is('deleted_at', null)

  // Fetch all active cities
  const { data: cities } = await supabase
    .from('cities')
    .select('slug, updated_at')
    .eq('is_active', true)

  // Fetch all active collections
  const { data: collections } = await supabase
    .from('collections')
    .select('slug, updated_at')
    .eq('is_active', true)

  const now = new Date().toISOString()

  // Static public routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/discover`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/search`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/collections`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/blacqlight`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/flow-map`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    {
      url: `${BASE_URL}/for-business`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    {
      url: `${BASE_URL}/how-ranking-works`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // City landing pages
  const cityRoutes: MetadataRoute.Sitemap = (cities ?? []).map((city) => ({
    url: `${BASE_URL}/discover/${city.slug}`,
    lastModified: city.updated_at ?? now,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }))

  // Entity pages (all types)
  const listingRoutes: MetadataRoute.Sitemap = (listings ?? []).map((l) => ({
    url: `${BASE_URL}${buildEntityUrl(l.entity_type, (l.cities as { slug: string } | null)?.slug, l.slug)}`,
    lastModified: l.updated_at ?? now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // Collection pages
  const collectionRoutes: MetadataRoute.Sitemap = (collections ?? []).map((c) => ({
    url: `${BASE_URL}/collections/${c.slug}`,
    lastModified: c.updated_at ?? now,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...cityRoutes, ...listingRoutes, ...collectionRoutes]
}
