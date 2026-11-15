import { resolveMediaPath, resolveRemoteImage } from '@/lib/listings/coverImage'
import { sectionAllowed } from '@/lib/entity-page/sections'
import type { ResolvedImage } from '@/types'

/**
 * The logo the live page shows beside the name (ticket 185), or null.
 *
 * Only a claimed page shows one: the registry gates `logo` on
 * `requiresClaimed`, the same rule the map pins use
 * (app/api/map/listings/route.ts). A logo on an unclaimed listing came from a
 * seed or an import, not from the business. A page an owner added becomes
 * claimed when it is approved (ticket 158).
 *
 * A stored path resolves to the public bucket. An older full address is kept
 * and marked unoptimized when next/image may not fetch its host.
 */
export function entityLogo(row: {
  logo_path: string | null | undefined
  trust_tier: string
  name: string
}): ResolvedImage | null {
  const path = row.logo_path?.trim()
  if (!path) return null
  if (!sectionAllowed('logo', null, undefined, { claimed: row.trust_tier !== 'unclaimed' })) {
    return null
  }
  const alt = `${row.name} logo`
  if (/^https?:\/\//i.test(path)) {
    const remote = resolveRemoteImage(path)
    if (!remote) return null
    return remote.unoptimized
      ? { src: remote.src, alt, unoptimized: true }
      : { src: remote.src, alt }
  }
  const src = resolveMediaPath(path)
  return src ? { src, alt } : null
}
