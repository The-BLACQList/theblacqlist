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
  // An uploaded video (ticket 130) plays in the browser's own player. A link
  // plays in the YouTube or Vimeo embed. The page has one or the other.
  const fileSrc = entity.details.video_file_url
  const src = fileSrc ? null : toEmbedSrc(entity.details.video_embed_url)
  if (!fileSrc && !src) return null

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
            {fileSrc ? (
              // #t=0.1 makes Safari draw the first frame instead of a black box.
              <video
                src={`${fileSrc}#t=0.1`}
                controls
                playsInline
                preload="metadata"
                className="absolute inset-0 size-full"
                aria-label={`${entity.name} video`}
              />
            ) : (
              <iframe
                src={src ?? undefined}
                title={`${entity.name} video`}
                className="absolute inset-0 size-full"
                loading="lazy"
                allow="encrypted-media; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
