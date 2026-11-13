import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { buildEntityUrl } from '@/lib/listings/url'
import { trackServerEvent } from '@/lib/analytics/server'
import { SERVER_ONLY_EVENTS } from '@/lib/analytics/constants'

// GET /api/happening-now/[postId]?from=page|strip (owner-experience round 2,
// part F). Counts a click on a Happening now post, then sends the visitor on:
//   from=page  → the post's button link (https, checked when it was saved)
//   from=strip → the business page (the strip card is a link to the page)
// A post that isn't live, or a page that isn't published, goes to the home
// page. The read runs as the visitor, so RLS shows live posts only; the filters
// below also keep an owner's own drafts out.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PostRow {
  id: string
  listing_id: string
  button_url: string | null
  listings: {
    slug: string
    entity_type: string
    status: string
    cities: { slug: string } | null
  } | null
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
): Promise<NextResponse> {
  if (!isFeatureEnabled('happeningNow')) return new NextResponse(null, { status: 404 })
  const { postId } = await params
  const home = NextResponse.redirect(new URL('/', req.url), 302)
  if (!UUID_RE.test(postId)) return home
  const from = req.nextUrl.searchParams.get('from') === 'strip' ? 'strip' : 'page'

  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('listing_posts')
    .select(
      'id, listing_id, button_url, listings!inner(slug, entity_type, status, cities!listings_city_id_fkey(slug))'
    )
    .eq('id', postId)
    .eq('status', 'active')
    .lte('starts_at', now)
    .gt('ends_at', now)
    .eq('listings.status', 'published')
    .is('listings.deleted_at', null)
    .maybeSingle()
  const post = data as unknown as PostRow | null
  if (!post?.listings) return home

  const citySlug = post.listings.cities?.slug
  const pageUrl = citySlug
    ? buildEntityUrl(post.listings.entity_type, citySlug, post.listings.slug)
    : '/'
  const target =
    from === 'page' && post.button_url?.startsWith('https://') ? post.button_url : pageUrl

  const {
    data: { user },
  } = await supabase.auth.getUser()
  trackServerEvent({
    event_name: SERVER_ONLY_EVENTS.POST_CLICK,
    entity_id: post.listing_id,
    entity_type: 'listing',
    user_id: user?.id ?? null,
    properties: { post_id: post.id, surface: from },
  })

  const res = NextResponse.redirect(new URL(target, req.url), 302)
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}
