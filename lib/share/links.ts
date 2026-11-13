// =============================================================================
// Share links: one builder per platform, all pure so they can be tested
// without a browser.
// =============================================================================
// Only Facebook, X, Threads, WhatsApp, email and SMS take a link through a URL.
// Instagram, TikTok and Snapchat have no web intent for posting, so those go
// through the phone's share sheet with an image file, or a download on desktop
// (lib/share/nativeShare.ts). The link always points at the business page,
// never at anything about the person sharing.
// =============================================================================

export type SharePlatform =
  | 'instagram_story'
  | 'instagram_feed'
  | 'facebook'
  | 'x'
  | 'threads'
  | 'tiktok'
  | 'snapchat'
  | 'whatsapp'
  | 'email'
  | 'sms'
  | 'native_share'
  | 'copy_link'
  | 'download'

export type ShareCampaign = 'profile_share' | 'support_share'

/** UTM source per platform. Short and stable, because reports group by it. */
const UTM_SOURCE: Record<SharePlatform, string> = {
  instagram_story: 'instagram',
  instagram_feed: 'instagram',
  facebook: 'facebook',
  x: 'x',
  threads: 'threads',
  tiktok: 'tiktok',
  snapchat: 'snapchat',
  whatsapp: 'whatsapp',
  email: 'email',
  sms: 'sms',
  native_share: 'share_sheet',
  copy_link: 'copy_link',
  download: 'download',
}

/**
 * Add UTM tags so a visit from a shared link can be attributed. Existing query
 * parameters are kept; any existing utm_* are replaced, never doubled.
 */
export function withUtm(url: string, platform: SharePlatform, campaign: ShareCampaign): string {
  const u = new URL(url)
  u.searchParams.set('utm_source', UTM_SOURCE[platform])
  u.searchParams.set('utm_medium', 'social')
  u.searchParams.set('utm_campaign', campaign)
  return u.toString()
}

/** The page URL without its query string or hash: what gets shared. */
export function cleanShareUrl(href: string): string {
  const u = new URL(href)
  u.search = ''
  u.hash = ''
  return u.toString()
}

export interface LinkShareInput {
  /** The caption, without the link. */
  text: string
  /** Absolute URL, already UTM-tagged for the platform. */
  url: string
  /** Email subject line. */
  subject?: string
}

/** Platforms that post through a URL intent. */
export type IntentPlatform = 'facebook' | 'x' | 'threads' | 'whatsapp' | 'email' | 'sms'

export function intentUrl(
  platform: IntentPlatform,
  { text, url, subject }: LinkShareInput
): string {
  const e = encodeURIComponent
  switch (platform) {
    case 'facebook':
      // Facebook ignores prefilled text and builds the post from the page's
      // Open Graph tags, which is why the share card is also the OG image.
      return `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`
    case 'x':
      return `https://x.com/intent/post?text=${e(text)}&url=${e(url)}`
    case 'threads':
      // Threads takes one text field, so the link rides inside it.
      return `https://www.threads.net/intent/post?text=${e(`${text} ${url}`)}`
    case 'whatsapp':
      return `https://wa.me/?text=${e(`${text} ${url}`)}`
    case 'email':
      return `mailto:?subject=${e(subject ?? 'Look what I found on The BLACQList')}&body=${e(
        `${text}\n\n${url}`
      )}`
    case 'sms':
      // `?&body=` is the form both iOS and Android accept.
      return `sms:?&body=${e(`${text} ${url}`)}`
  }
}
