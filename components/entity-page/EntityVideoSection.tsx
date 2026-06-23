import type { EntityPageData } from '@/types'

/**
 * Converts a YouTube/Vimeo watch URL into an embeddable player src.
 * Returns null for anything that isn't a recognized YouTube/Vimeo link
 * (host-whitelisted — no arbitrary iframes).
 */
function toEmbedSrc(url: string | null): string | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v')
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean).pop()
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
  }
  return null
}

export function EntityVideoSection({ entity }: { entity: EntityPageData }) {
  const src = toEmbedSrc(entity.details.video_embed_url)
  if (!src) return null

  return (
    <section aria-labelledby="video-heading" className="bg-cream py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="video-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
        >
          Watch
        </h2>
        <div className="md:max-w-3xl">
          <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-deep-bg">
            <iframe
              src={src}
              title={`${entity.name} video`}
              className="absolute inset-0 size-full"
              loading="lazy"
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  )
}
