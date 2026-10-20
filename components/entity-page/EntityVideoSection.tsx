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
  // Each video is an uploaded file (ticket 130), played in the browser's own
  // player, or a link, played in the YouTube or Vimeo embed. A link we can't
  // embed is skipped. Videos show in the owner's order (ticket 105).
  type Playable = { id: string; fileSrc: string | null; embedSrc: string | null }
  const videos = entity.details.videos.flatMap((v): Playable[] => {
    if (v.file_url) return [{ id: v.id, fileSrc: v.file_url, embedSrc: null }]
    const embedSrc = toEmbedSrc(v.embed_url)
    return embedSrc ? [{ id: v.id, fileSrc: null, embedSrc }] : []
  })
  if (videos.length === 0) return null
  const many = videos.length > 1

  return (
    <section aria-labelledby="video-heading" className="bg-cream py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="video-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
        >
          Watch
        </h2>
        <ul className={many ? 'grid gap-6 md:grid-cols-2' : 'md:max-w-3xl'}>
          {videos.map((v, i) => {
            const label = many
              ? `${entity.name} video ${i + 1} of ${videos.length}`
              : `${entity.name} video`
            return (
              <li
                key={v.id}
                className="relative w-full aspect-video overflow-hidden rounded-xl bg-deep-bg"
              >
                {v.fileSrc ? (
                  // #t=0.1 makes Safari draw the first frame instead of a black box.
                  <video
                    src={`${v.fileSrc}#t=0.1`}
                    controls
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 size-full"
                    aria-label={label}
                  />
                ) : (
                  <iframe
                    src={v.embedSrc ?? undefined}
                    title={label}
                    className="absolute inset-0 size-full"
                    loading="lazy"
                    allow="encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
