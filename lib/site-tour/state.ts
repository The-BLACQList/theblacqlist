// What the tour remembers (ticket 280). Nothing here may throw: Safari's
// private mode throws on access, and the tour mounts in the root layout.
//
// localStorage (this device): where the first visit landed, when the tour was
// first offered, and how it ended. sessionStorage (this tab): where a running
// tour is, so a reload resumes it. The account keeps only the earliest date,
// in user_metadata.site_tour_seen_at.

import type { SiteTourPath } from '@/lib/site-tour/steps'

export const SITE_TOUR_KEY = 'blq-site-tour-v1'
export const SITE_TOUR_RUN_KEY = 'blq-site-tour-run-v1'
export const SITE_TOUR_SEEN_METADATA = 'site_tour_seen_at'
/** Tells Take the Tour links the date changed. */
export const SITE_TOUR_MEMORY_EVENT = 'blq:site-tour:memory'
export const RETAKE_DAYS = 30
const DAY_MS = 86_400_000

export interface SiteTourMemory {
  firstPath?: string
  seenAt?: string
  endedAt?: string
  completedAt?: string
}

export type SiteTourStart = 'home' | 'for_business' | 'prompt' | 'menu' | 'footer'

export interface SiteTourRun {
  path: SiteTourPath
  /** The step's name, not its place: places move when a part is switched on. */
  key: string
  start: SiteTourStart
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function local(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function session(): Store | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

/** null = storage can't be read at all, which is not the same as a first visit. */
export function readMemory(store: Store | null = local()): SiteTourMemory | null {
  if (!store) return null
  try {
    const raw = store.getItem(SITE_TOUR_KEY)
    if (raw === null) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      firstPath: typeof parsed.firstPath === 'string' ? parsed.firstPath : undefined,
      seenAt: isDate(parsed.seenAt) ? parsed.seenAt : undefined,
      endedAt: isDate(parsed.endedAt) ? parsed.endedAt : undefined,
      completedAt: isDate(parsed.completedAt) ? parsed.completedAt : undefined,
    }
  } catch {
    return null
  }
}

export function writeMemory(patch: SiteTourMemory, store: Store | null = local()): boolean {
  if (!store) return false
  try {
    const now = readMemory(store) ?? {}
    store.setItem(SITE_TOUR_KEY, JSON.stringify({ ...now, ...patch }))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SITE_TOUR_MEMORY_EVENT))
    return true
  } catch {
    return false
  }
}

export function readRun(store: Store | null = session()): SiteTourRun | null {
  if (!store) return null
  try {
    const parsed = JSON.parse(store.getItem(SITE_TOUR_RUN_KEY) ?? 'null') as Partial<SiteTourRun> | null
    if (!parsed) return null
    if (parsed.path !== 'shopper' && parsed.path !== 'owner') return null
    if (typeof parsed.key !== 'string') return null
    return { path: parsed.path, key: parsed.key, start: parsed.start ?? 'home' }
  } catch {
    return null
  }
}

export function writeRun(run: SiteTourRun | null, store: Store | null = session()): void {
  try {
    if (run) store?.setItem(SITE_TOUR_RUN_KEY, JSON.stringify(run))
    else store?.removeItem(SITE_TOUR_RUN_KEY)
  } catch {
    // Without it, a reload ends the tour. Nothing else changes.
  }
}

export function earliest(a?: string | null, b?: string | null): string | null {
  if (!isDate(a)) return isDate(b) ? b : null
  if (!isDate(b)) return a
  return Date.parse(a) <= Date.parse(b) ? a : b
}

/** Take the Tour stays for 30 days after the first visit, then goes. */
export function canRetake(seenAt: string | null | undefined, now: number): boolean {
  if (!isDate(seenAt)) return false
  return now - Date.parse(seenAt) < RETAKE_DAYS * DAY_MS
}

export type SiteTourOpening = 'welcome' | 'prompt' | 'none'

/**
 * What a page view gets. The welcome opens on its own only when the first page
 * this visitor ever saw is the home page or For Business; anywhere else gets
 * the small prompt, once (DR-013).
 */
export function decideOpening(input: {
  memory: SiteTourMemory | null
  accountSeenAt: string | null
  pathname: string
}): SiteTourOpening {
  const { memory, accountSeenAt, pathname } = input
  // Storage off: the answer couldn't be remembered, so it would open every time.
  if (!memory) return 'none'
  if (memory.seenAt || memory.endedAt || memory.completedAt || accountSeenAt) return 'none'
  const first = memory.firstPath ?? pathname
  if (!startFor(first)) return 'prompt'
  return startFor(pathname) ? 'welcome' : 'prompt'
}

export function startFor(pathname: string): 'home' | 'for_business' | null {
  if (pathname === '/') return 'home'
  if (pathname === '/for-business') return 'for_business'
  return null
}
