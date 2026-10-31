/**
 * The site assistant, Cue: the small pure pieces the chat (ticket 169) shares
 * with the rest of the site. The rate limits, the visitor budget count, the
 * category shape, the words in a business name, and the nearest cities.
 *
 * The chat itself lives in lib/ai/cue/ and app/api/cue/route.ts. Ticket 169
 * replaced the old one-call search plan (tickets 147 and 148) with a model
 * that searches with tools and answers in its own words.
 *
 * No server imports here, so tests and client code use it directly. Nothing
 * here logs.
 */

import { distanceMiles, type LatLng } from '../map/distance'
import { normalizeWords } from './guide'

export * from './assistant-limits'

// ─── Limits ──────────────────────────────────────────────────────────────────

/** Messages one visitor may send Cue a minute, per IP. */
export const ASSISTANT_PER_MINUTE = 8
/** Messages one visitor may send Cue a day, per IP. */
export const ASSISTANT_PER_DAY = 40

// ─── Categories ──────────────────────────────────────────────────────────────

/** A live category as Cue sees it. */
export interface AssistantCategory {
  id: string
  slug: string
  name: string
  parentId: string | null
}

// ─── Business names ──────────────────────────────────────────────────────────

const NAME_WORD_SKIP = new Set(['and', 'for', 'the', 'of', 'a', 'an', 'or', 'with', 'in'])

/** The words in a business name worth matching on, lowercased. */
export function nameWords(name: string): string[] {
  return normalizeWords(name)
    .split(' ')
    .filter((w) => w.length >= 2 && !NAME_WORD_SKIP.has(w))
}

// ─── Nearest cities ──────────────────────────────────────────────────────────

export interface PointCity {
  slug: string
  name: string
  isActive: boolean
  lat: number | null
  lng: number | null
}

/** Our live cities with a point, nearest first. `exclude` holds slugs to skip. */
export function nearestCities<T extends PointCity>(
  point: LatLng,
  cities: readonly T[],
  limit: number,
  exclude: readonly string[] = []
): T[] {
  return cities
    .filter(
      (c) =>
        c.isActive &&
        !exclude.includes(c.slug) &&
        c.lat != null &&
        c.lng != null &&
        Number.isFinite(c.lat) &&
        Number.isFinite(c.lng)
    )
    .map((c) => ({
      c,
      miles: distanceMiles(point, { lat: c.lat as number, lng: c.lng as number }),
    }))
    .sort((a, b) => a.miles - b.miles || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((r) => r.c)
}

// ─── Budget ──────────────────────────────────────────────────────────────────

/**
 * The guide and Cue share one visitor share of the monthly budget.
 * `guideUsed + assistantUsed` is checked with withinGuideBudget.
 */
export function visitorCallsUsed(guideUsed: number, assistantUsed: number): number {
  return Math.max(0, guideUsed) + Math.max(0, assistantUsed)
}
