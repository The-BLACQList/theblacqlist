import type { SocialLinks } from '@/types'

// Social values are stored as bare handles OR full URLs. A bare handle dropped
// straight into href becomes a broken RELATIVE link (e.g. /blackcoffeeatl), so
// normalize to an absolute profile URL per platform.
const SOCIAL_BASE: Record<string, string> = {
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  linkedin: 'https://www.linkedin.com/in/',
  tiktok: 'https://tiktok.com/@',
  youtube: 'https://youtube.com/@',
  twitter: 'https://x.com/',
}

export function normalizeSocialUrl(platform: string, raw: string): string {
  const v = raw.trim()
  if (/^https?:\/\//i.test(v)) return v // already an absolute URL
  if (v.includes('/') && v.includes('.')) return `https://${v}` // looks like a domain path
  const handle = v.replace(/^@+/, '')
  return (SOCIAL_BASE[platform] ?? 'https://') + handle
}

/** The platforms a listing can link, in the order pages show them. */
export const SOCIAL_PLATFORMS: { key: keyof SocialLinks; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'twitter', label: 'X / Twitter' },
]
