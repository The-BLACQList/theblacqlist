import { ImageResponse } from 'next/og'

import { getEntityPageFromDB } from '@/lib/listings/entityPage'
import { resolveCoverImage } from '@/lib/listings/coverImage'
import { loadCardFonts, loadCoverDataUrl, loadMarkDataUrl } from '@/lib/share/cardAssets'
import { CARD_SIZES, ListingCard, parseCardFormat } from '@/lib/share/listingCard'

/**
 * GET /api/share-card/listing/[slug]?format=og|story|feed
 *
 * The branded "Look what I found on The BLACQList" image for a business. It's
 * the page's Open Graph image (format=og), and the image the share sheet hands
 * to Instagram, TikTok and Snapchat (story, feed).
 *
 * Public data only: the same published-listing read the page itself uses, so a
 * draft, removed or closed listing is a 404 here too.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const format = parseCardFormat(new URL(request.url).searchParams.get('format'))

  const entity = await getEntityPageFromDB(slug)
  if (!entity) return new Response('Not found', { status: 404 })

  const cover = resolveCoverImage(entity.cover_image_path, entity.entity_type, entity.id)
  const [fonts, markDataUrl, coverDataUrl] = await Promise.all([
    loadCardFonts(),
    loadMarkDataUrl(),
    loadCoverDataUrl(cover.src),
  ])

  const cityLabel = entity.city ? `${entity.city.name}, ${entity.city.state_abbr}` : null

  try {
    return new ImageResponse(
      <ListingCard
        format={format}
        data={{
          name: entity.name,
          categoryName: entity.category.name,
          cityLabel,
          coverDataUrl,
          markDataUrl,
        }}
      />,
      {
        ...CARD_SIZES[format],
        fonts,
        headers: {
          // A day at the edge, a week stale-while-revalidate. A renamed
          // business shows its new name within a day.
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    )
  } catch {
    return new Response('Could not render share card', { status: 500 })
  }
}
