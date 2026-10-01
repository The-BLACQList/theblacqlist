import { z } from 'zod'

// The categories a supporter can pick during onboarding. Every slug is a real
// top-level row in the `categories` table (supabase/seed.sql), so each one is a
// valid /discover?category= value. Keep this list to top-level categories only.
export const ONBOARDING_INTERESTS = [
  { slug: 'food-dining', label: 'Food & Dining' },
  { slug: 'beauty-grooming', label: 'Beauty & Grooming' },
  { slug: 'fashion-apparel', label: 'Fashion & Apparel' },
  { slug: 'wellness-health', label: 'Wellness & Health' },
  { slug: 'professional-services', label: 'Professional Services' },
  { slug: 'creative-media', label: 'Creative & Media' },
  { slug: 'events-entertainment', label: 'Events & Entertainment' },
  { slug: 'technology', label: 'Technology' },
  { slug: 'education-tutoring', label: 'Education & Tutoring' },
  { slug: 'retail-gifts', label: 'Retail & Gifts' },
] as const

export const INTERESTS_METADATA_KEY = 'interests'

const ALLOWED = new Set<string>(ONBOARDING_INTERESTS.map((i) => i.slug))
const LABELS = new Map<string, string>(ONBOARDING_INTERESTS.map((i) => [i.slug, i.label]))

const interestsSchema = z
  .array(z.string().refine((s) => ALLOWED.has(s)))
  .max(ONBOARDING_INTERESTS.length)

/** Strict: any unknown slug rejects the whole list. Used on the way in. */
export function parseInterests(raw: unknown): string[] | null {
  const parsed = interestsSchema.safeParse(raw)
  if (!parsed.success) return null
  return [...new Set(parsed.data)]
}

/** Lenient: drops unknown values. Used on the way out, where metadata is user-writable. */
export function readSavedInterests(raw: unknown, limit = 4): { slug: string; label: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { slug: string; label: string }[] = []
  for (const value of raw) {
    if (typeof value !== 'string') continue
    const label = LABELS.get(value)
    if (!label || out.some((o) => o.slug === value)) continue
    out.push({ slug: value, label })
    if (out.length >= limit) break
  }
  return out
}
