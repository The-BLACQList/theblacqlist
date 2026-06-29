'use client'

import { useEffect } from 'react'
import { X, Phone, Mail, Globe, MapPin, ExternalLink } from 'lucide-react'
import type { FormSnapshot } from './steps/PreviewPublishStep'

// Self-contained full-page preview rendered from the unsaved form draft. It is
// intentionally NOT the live EntityPage components (those are coupled to auth,
// save/report actions, and a fully-hydrated DB row) — this mirrors their visual
// layout so a draft can be previewed safely without a saved listing.

const SOCIAL_BASE: Record<string, string> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  linkedin: 'https://www.linkedin.com/in/',
  tiktok: 'https://tiktok.com/@',
  youtube: 'https://youtube.com/@',
  twitter: 'https://x.com/',
}
function socialUrl(platform: string, raw: string): string {
  const v = raw.trim()
  if (/^https?:\/\//i.test(v)) return v
  if (v.includes('/') && v.includes('.')) return `https://${v}`
  return (SOCIAL_BASE[platform] ?? 'https://') + v.replace(/^@+/, '')
}

const CTA_LABELS: Record<string, string> = {
  book: 'Book now',
  order: 'Order online',
  call: 'Call',
  message: 'Send a message',
  visit: 'Visit us',
  'get-quote': 'Get a quote',
  shop: 'Shop now',
  subscribe: 'Subscribe',
  contact: 'Get in touch',
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const galleryUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/listing-media/${path}`

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-charcoal/10 bg-white p-5 md:p-6">
      <h2 className="font-headline text-lg text-brand-black mb-3">{title}</h2>
      {children}
    </section>
  )
}

export function FullPagePreview({
  snapshot,
  onClose,
}: {
  snapshot: FormSnapshot
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const ctaLabel = CTA_LABELS[snapshot.cta_type] ?? snapshot.cta_type ?? 'Get in touch'
  const location = snapshot.city_text
    ? `${snapshot.city_text}${snapshot.state_text ? `, ${snapshot.state_text}` : ''}`
    : snapshot.ships_nationwide
      ? 'Ships nationwide'
      : ''

  const socials = (
    [
      ['instagram', snapshot.social_instagram, 'Instagram'],
      ['facebook', snapshot.social_facebook, 'Facebook'],
      ['linkedin', snapshot.social_linkedin, 'LinkedIn'],
      ['tiktok', snapshot.social_tiktok, 'TikTok'],
      ['youtube', snapshot.social_youtube, 'YouTube'],
      ['twitter', snapshot.social_twitter, 'X / Twitter'],
    ] as [string, string, string][]
  ).filter(([, v]) => v && v.trim())

  const gallery = (snapshot.gallery_paths ?? []).filter(Boolean)
  const hasContact = !!(snapshot.phone || snapshot.email || snapshot.website_url)

  return (
    <div
      className="fixed inset-0 z-[60] bg-pale-lavender overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Full page preview"
    >
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 backdrop-blur border-b border-charcoal/10 px-4 py-3">
        <p className="font-subhead text-sm font-semibold text-brand-black">
          Preview — how your page will look
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black text-white font-subhead text-sm font-bold hover:bg-charcoal transition-colors"
        >
          <X className="size-4" aria-hidden="true" />
          Close
        </button>
      </div>

      {/* Hero */}
      <div className="relative w-full h-[240px] md:h-[360px] overflow-hidden bg-gradient-to-br from-charcoal/60 to-brand-black">
        {snapshot.coverCdnUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={snapshot.coverCdnUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.72) 100%)' }}
          aria-hidden="true"
        />
        {snapshot.logoCdnUrl && (
          <div className="absolute top-4 left-4 h-14 w-14 rounded-full overflow-hidden border-2 border-white/50 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={snapshot.logoCdnUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="max-w-[960px] mx-auto px-4 md:px-8 pb-6">
            <h1 className="font-headline text-[28px] md:text-[40px] text-white leading-tight">
              {snapshot.name || 'Your business name'}
            </h1>
            {snapshot.tagline && (
              <p className="font-body text-sm md:text-base text-white/80 line-clamp-2 max-w-xl mt-1">
                {snapshot.tagline}
              </p>
            )}
            <div className="mt-4">
              <span className="inline-flex h-11 items-center px-6 rounded-full bg-gold text-brand-black font-subhead font-bold text-sm">
                {ctaLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-[960px] mx-auto px-4 md:px-8 py-8 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {snapshot.description && (
            <Section title="About">
              <p className="font-body text-sm text-charcoal leading-relaxed whitespace-pre-line">
                {snapshot.description}
              </p>
            </Section>
          )}

          {snapshot.founder_story && (
            <Section title="Our story">
              <p className="font-body text-sm text-charcoal leading-relaxed whitespace-pre-line">
                {snapshot.founder_story}
              </p>
            </Section>
          )}

          {gallery.length > 0 && (
            <Section title="Gallery">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {gallery.map((path) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={path}
                    src={galleryUrl(path)}
                    alt=""
                    className="aspect-square w-full rounded-lg object-cover bg-charcoal/5"
                  />
                ))}
              </div>
            </Section>
          )}

          <div className="rounded-2xl border border-dashed border-charcoal/20 bg-white/50 px-5 py-4">
            <p className="font-body text-xs text-charcoal-soft">
              Reviews, related businesses, and other sections appear on your live page after you
              publish.
            </p>
          </div>
        </div>

        {/* At a glance */}
        <aside className="space-y-5">
          <Section title="At a glance">
            <div className="space-y-4">
              {snapshot.categoryName && (
                <div>
                  <p className="font-subhead text-[10px] font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Category
                  </p>
                  <span className="inline-flex items-center rounded-full border border-charcoal/20 px-2.5 py-0.5 font-subhead text-xs text-charcoal">
                    {snapshot.categoryName}
                  </span>
                </div>
              )}

              {location && (
                <div className="flex items-start gap-2">
                  <MapPin className="size-4 text-amber shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="font-body text-sm text-charcoal">{location}</span>
                </div>
              )}

              {hasContact && (
                <div className="flex flex-col gap-1.5">
                  {snapshot.phone && (
                    <span className="inline-flex items-center gap-2 font-body text-sm text-charcoal">
                      <Phone className="size-4 text-amber shrink-0" aria-hidden="true" />
                      {snapshot.phone}
                    </span>
                  )}
                  {snapshot.email && (
                    <span className="inline-flex items-center gap-2 font-body text-sm text-charcoal break-all">
                      <Mail className="size-4 text-amber shrink-0" aria-hidden="true" />
                      {snapshot.email}
                    </span>
                  )}
                  {snapshot.website_url && (
                    <span className="inline-flex items-center gap-2 font-body text-sm text-charcoal break-all">
                      <Globe className="size-4 text-amber shrink-0" aria-hidden="true" />
                      {snapshot.website_url.replace(/^https?:\/\/(www\.)?/, '')}
                    </span>
                  )}
                </div>
              )}

              {socials.length > 0 && (
                <div>
                  <p className="font-subhead text-[10px] font-semibold uppercase tracking-wider text-charcoal-soft mb-1.5">
                    Social
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {socials.map(([key, value, label]) => (
                      <a
                        key={key}
                        href={socialUrl(key, value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 font-body text-sm text-charcoal hover:text-brand-black transition-colors"
                      >
                        <ExternalLink className="size-3.5 text-amber shrink-0" aria-hidden="true" />
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  )
}
