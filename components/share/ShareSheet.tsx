'use client'

// =============================================================================
// ShareSheet: one sheet for every share on the site.
// =============================================================================
// A business profile ("Look what I found") and, later, a support post ("I
// supported") both open this with their own caption, link and images.
//
// - Instagram, TikTok and Snapchat take an image, not a link. On a phone the
//   image goes into the system share sheet and the caption is copied so it can
//   be pasted. Where a browser can't share files (most desktops), the image
//   downloads and the sheet says how to post it.
// - Facebook, X, Threads, WhatsApp, email and text open the platform's own
//   compose screen with the caption and link filled in.
// - "More" is the phone's own share sheet, for every other app.
//
// Images are fetched into Files as soon as the sheet opens, because iOS only
// opens its share sheet straight from a tap and an image fetch inside the tap
// handler takes too long.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { Download, Link as LinkIcon, Mail, MessageSquare, Share } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { track } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import { copyToClipboard } from '@/lib/clipboard'
import {
  intentUrl,
  withUtm,
  type IntentPlatform,
  type ShareCampaign,
  type SharePlatform,
} from '@/lib/share/links'
import {
  blobToFile,
  canNativeShare,
  downloadFile,
  shareFileName,
  shareImageFile,
  shareLink,
} from '@/lib/share/nativeShare'
import { cn } from '@/lib/utils'

import {
  FacebookIcon,
  InstagramIcon,
  SnapchatIcon,
  ThreadsIcon,
  TikTokIcon,
  WhatsAppIcon,
  XIcon,
} from './PlatformIcons'

export type ShareImageFormat = 'story' | 'feed'

export interface ShareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sheet heading, e.g. "Share Mama's Kitchen". */
  title: string
  description?: string
  /** Post text without the link. Never an amount, never the sharer's name. */
  caption: string
  /** The page being shared, absolute and without UTM tags. */
  url: string
  campaign: ShareCampaign
  /** Used for the saved file's name and the email subject. */
  businessName: string
  /** Each format as a URL to fetch, or an image already drawn in the browser. */
  images: Record<ShareImageFormat, string | Blob>
  analytics: {
    /** Missing for a receipt that isn't matched to a business. */
    entityId?: string
    entityType: 'listing'
    source: 'entity_page' | 'support_post'
  }
}

type ImageState =
  | { status: 'loading' }
  | { status: 'ready'; files: Record<ShareImageFormat, File> }
  | { status: 'failed' }

/** Image platforms, and the format each one posts. */
const IMAGE_TARGETS = {
  instagram_story: { format: 'story', app: 'Instagram', where: 'start a Story' },
  instagram_feed: { format: 'feed', app: 'Instagram', where: 'start a new post' },
  tiktok: { format: 'story', app: 'TikTok', where: 'tap + and choose Upload' },
  snapchat: { format: 'story', app: 'Snapchat', where: 'open Memories' },
} as const satisfies Record<string, { format: ShareImageFormat; app: string; where: string }>

type ImagePlatform = keyof typeof IMAGE_TARGETS

async function toFile(source: string | Blob, name: string): Promise<File> {
  if (typeof source !== 'string') return blobToFile(source, name)
  const res = await fetch(source)
  if (!res.ok) throw new Error(`Image ${res.status}`)
  return blobToFile(await res.blob(), name)
}

export function ShareSheet({ open, onOpenChange, ...props }: ShareSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // A bottom sheet on phones, a centered card from sm up.
          'top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl',
          'sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          'max-h-[92dvh] overflow-y-auto'
        )}
      >
        {/* Mounts on every open, so each open starts clean and fetches fresh. */}
        <ShareSheetBody {...props} />
      </DialogContent>
    </Dialog>
  )
}

function ShareSheetBody({
  title,
  description,
  caption,
  url,
  campaign,
  businessName,
  images,
  analytics,
}: Omit<ShareSheetProps, 'open' | 'onOpenChange'>) {
  const [format, setFormat] = useState<ShareImageFormat>('story')
  const [image, setImage] = useState<ImageState>({ status: 'loading' })
  const [status, setStatus] = useState('')
  // Only ever rendered in the browser (the dialog is closed on the server).
  const [hasNativeShare] = useState(canNativeShare)

  const storySrc = images.story
  const feedSrc = images.feed

  // Fetch both formats up front, so a tap can share straight away.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      toFile(storySrc, shareFileName(businessName, 'story')),
      toFile(feedSrc, shareFileName(businessName, 'post')),
    ])
      .then(([story, feed]) => {
        if (!cancelled) setImage({ status: 'ready', files: { story, feed } })
      })
      .catch(() => {
        if (!cancelled) setImage({ status: 'failed' })
      })
    return () => {
      cancelled = true
    }
  }, [storySrc, feedSrc, businessName])

  // Preview from the fetched file when there is one; until then, the URL.
  const previewSrc = useMemo(() => {
    if (image.status === 'ready') return URL.createObjectURL(image.files[format])
    const src = format === 'story' ? storySrc : feedSrc
    return typeof src === 'string' ? src : URL.createObjectURL(src)
  }, [image, format, storySrc, feedSrc])

  useEffect(() => {
    if (!previewSrc.startsWith('blob:')) return
    return () => URL.revokeObjectURL(previewSrc)
  }, [previewSrc])

  function record(method: SharePlatform) {
    // One event per pick, so the dashboard's share count is one per share.
    track({
      event_name: ANALYTICS_EVENTS.SHARE_INITIATED,
      entity_type: analytics.entityId ? analytics.entityType : undefined,
      entity_id: analytics.entityId,
      properties: { source: analytics.source, method },
    })
  }

  async function shareToImageApp(platform: ImagePlatform) {
    record(platform)
    const target = IMAGE_TARGETS[platform]
    const link = withUtm(url, platform, campaign)
    const postText = `${caption} ${link}`

    if (image.status !== 'ready') {
      const copied = await copyToClipboard(postText)
      setStatus(
        image.status === 'loading'
          ? 'The image is still loading. Try again in a second.'
          : copied === 'copied'
            ? `Couldn't load the image. The caption and link are copied, so you can paste them into ${target.app}.`
            : `Couldn't load the image. Try again in a moment.`
      )
      return
    }

    const file = image.files[target.format]
    // Copy without awaiting first: the share sheet has to open inside the tap.
    const copying = copyToClipboard(postText)
    const outcome = await shareImageFile(file, postText)
    const copied = (await copying) === 'copied'

    if (outcome === 'shared') {
      setStatus(copied ? 'Shared. The caption is copied too, so you can paste it in.' : 'Shared.')
    } else if (outcome === 'cancelled') {
      setStatus('')
    } else {
      downloadFile(file)
      setStatus(
        `Image saved. Open ${target.app}, ${target.where} and pick it from your photos.` +
          (copied ? ' The caption is copied, so paste it in.' : '')
      )
    }
  }

  function shareToIntent(platform: IntentPlatform) {
    record(platform)
    const href = intentUrl(platform, {
      text: caption,
      url: withUtm(url, platform, campaign),
      subject: `${businessName} on The BLACQList`,
    })
    if (platform === 'email' || platform === 'sms') {
      // A mail or text app, not a page: no new tab.
      window.location.href = href
    } else {
      window.open(href, '_blank', 'noopener,noreferrer')
    }
  }

  async function shareMore() {
    record('native_share')
    const outcome = await shareLink({
      title: `${businessName} | The BLACQList`,
      text: caption,
      url: withUtm(url, 'native_share', campaign),
    })
    if (outcome === 'failed' || outcome === 'unsupported')
      setStatus("Couldn't open your phone's share options.")
  }

  async function copyLink() {
    record('copy_link')
    const result = await copyToClipboard(withUtm(url, 'copy_link', campaign))
    setStatus(
      result === 'copied' ? 'Link copied.' : "Couldn't copy. Press and hold the link to copy it."
    )
  }

  function saveImage() {
    record('download')
    if (image.status !== 'ready') {
      setStatus(
        image.status === 'loading' ? 'The image is still loading.' : "Couldn't load the image."
      )
      return
    }
    downloadFile(image.files[format])
    setStatus('Image saved.')
  }

  return (
    <>
      <div className="px-5 pt-5 pb-2 pr-14">
        <DialogTitle className="text-lg">{title}</DialogTitle>
        <DialogDescription>
          {description ?? 'Post it to your story or feed, or send it to someone.'}
        </DialogDescription>
      </div>

      <div className="mx-5 mt-2 flex flex-col items-center gap-3 rounded-xl bg-ground px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob: or API image, not an optimisable asset */}
        <img
          src={previewSrc}
          alt={`${format === 'story' ? 'Story' : 'Post'} image for ${businessName}`}
          className={cn(
            'rounded-lg object-cover shadow-lg',
            format === 'story' ? 'h-64 aspect-[9/16]' : 'h-56 aspect-[4/5]',
            image.status === 'loading' && 'animate-pulse'
          )}
        />
        <div
          className="inline-flex rounded-full bg-white/10 p-1"
          role="group"
          aria-label="Image size"
        >
          {(['story', 'feed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
              className={cn(
                'rounded-full px-4 py-1.5 font-body text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                format === f ? 'bg-gold text-ground' : 'text-ink-soft hover:text-white'
              )}
            >
              {f === 'story' ? 'Story' : 'Post'}
            </button>
          ))}
        </div>
      </div>

      <section aria-labelledby="share-post-heading" className="px-5 pt-5">
        <h3
          id="share-post-heading"
          className="font-body text-xs font-semibold uppercase tracking-wider text-charcoal-soft"
        >
          Post it
        </h3>
        <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4">
          <Target
            label="Instagram Story"
            onClick={() => shareToImageApp('instagram_story')}
            icon={<InstagramIcon />}
          />
          <Target
            label="Instagram Post"
            onClick={() => shareToImageApp('instagram_feed')}
            icon={<InstagramIcon />}
          />
          <Target label="TikTok" onClick={() => shareToImageApp('tiktok')} icon={<TikTokIcon />} />
          <Target
            label="Snapchat"
            onClick={() => shareToImageApp('snapchat')}
            icon={<SnapchatIcon />}
          />
          <Target
            label="Facebook"
            onClick={() => shareToIntent('facebook')}
            icon={<FacebookIcon />}
          />
          <Target label="X" onClick={() => shareToIntent('x')} icon={<XIcon />} />
          <Target label="Threads" onClick={() => shareToIntent('threads')} icon={<ThreadsIcon />} />
        </div>
      </section>

      <section aria-labelledby="share-send-heading" className="px-5 pt-5 pb-5">
        <h3
          id="share-send-heading"
          className="font-body text-xs font-semibold uppercase tracking-wider text-charcoal-soft"
        >
          Send it
        </h3>
        <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4">
          <Target
            label="Messages"
            onClick={() => shareToIntent('sms')}
            icon={<MessageSquare className="size-5" aria-hidden="true" />}
          />
          <Target
            label="WhatsApp"
            onClick={() => shareToIntent('whatsapp')}
            icon={<WhatsAppIcon />}
          />
          <Target
            label="Email"
            onClick={() => shareToIntent('email')}
            icon={<Mail className="size-5" aria-hidden="true" />}
          />
          {hasNativeShare && (
            <Target
              label="More"
              onClick={shareMore}
              icon={<Share className="size-5" aria-hidden="true" />}
            />
          )}
          <Target
            label="Copy link"
            onClick={copyLink}
            icon={<LinkIcon className="size-5" aria-hidden="true" />}
          />
          <Target
            label="Save image"
            onClick={saveImage}
            icon={<Download className="size-5" aria-hidden="true" />}
          />
        </div>

        <p className="mt-4 min-h-5 font-body text-sm text-charcoal" aria-live="polite">
          {status}
        </p>
      </section>
    </>
  )
}

function Target({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-lg py-1 font-body text-xs text-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-neutral-100 text-brand-black transition-colors group-hover:bg-gold group-hover:text-ground">
        {icon}
      </span>
      <span className="text-center leading-tight">{label}</span>
    </button>
  )
}
