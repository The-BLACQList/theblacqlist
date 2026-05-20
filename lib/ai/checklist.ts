// Rule-based page optimization checklist.
// Zero external calls — pure function over listing data fetched server-side.
// Used by /dashboard/pages/[entityId]/ai-suggestions to compute a page score.

export type ChecklistCategory = "required" | "recommended" | "seo" | "engagement"

export interface ChecklistItem {
  id: string
  label: string
  hint: string
  category: ChecklistCategory
  weight: number
  passed: boolean
}

export interface ChecklistResult {
  items: ChecklistItem[]
  score: number
  maxScore: number
  grade: "strong" | "good" | "needs-work"
}

interface ListingFields {
  tagline: string | null
  meta_title: string | null
  meta_description: string | null
}

interface DetailsFields {
  description: string | null
  phone: string | null
  website_url: string | null
  social_instagram: string | null
  social_facebook: string | null
  social_tiktok: string | null
  social_youtube: string | null
  social_twitter: string | null
  social_linkedin: string | null
  cta_type: string | null
}

export function computePageChecklist(
  listing: ListingFields,
  details: DetailsFields | null,
  mediaCount: number,
  serviceCount: number,
  hoursCount: number,
): ChecklistResult {
  const hasSocialLink = !!(
    details?.social_instagram ||
    details?.social_facebook ||
    details?.social_tiktok ||
    details?.social_youtube ||
    details?.social_twitter ||
    details?.social_linkedin
  )

  const descriptionLength = details?.description?.trim().length ?? 0

  const items: ChecklistItem[] = [
    {
      id:       "tagline",
      label:    "Tagline added",
      hint:     "Add a short tagline under your business name — it's the first thing visitors read.",
      category: "required",
      weight:   8,
      passed:   !!listing.tagline?.trim(),
    },
    {
      id:       "description",
      label:    "Business description (100+ characters)",
      hint:     "Write at least a short paragraph describing your business, what you offer, and what makes you unique.",
      category: "required",
      weight:   12,
      passed:   descriptionLength >= 100,
    },
    {
      id:       "logo",
      label:    "Logo or profile image uploaded",
      hint:     "Upload a logo or a clear photo of your business — pages with images get 3× more clicks.",
      category: "required",
      weight:   10,
      passed:   mediaCount >= 1,
    },
    {
      id:       "cover",
      label:    "Cover image uploaded",
      hint:     "Add a cover photo to make your page stand out in search results and collections.",
      category: "recommended",
      weight:   8,
      passed:   mediaCount >= 2,
    },
    {
      id:       "gallery",
      label:    "Gallery image added",
      hint:     "Add at least one more image — photos of your space, products, or work build trust.",
      category: "recommended",
      weight:   6,
      passed:   mediaCount >= 3,
    },
    {
      id:       "cta",
      label:    "CTA (call to action) configured",
      hint:     "Set a primary CTA so visitors know exactly how to reach or book you.",
      category: "recommended",
      weight:   10,
      passed:   !!details?.cta_type,
    },
    {
      id:       "contact",
      label:    "Phone number or website URL present",
      hint:     "Add a phone number or website so customers can contact you directly.",
      category: "recommended",
      weight:   8,
      passed:   !!(details?.phone || details?.website_url),
    },
    {
      id:       "hours",
      label:    "Business hours set",
      hint:     "Add your hours so customers know when you're open — a top reason people leave without contacting.",
      category: "recommended",
      weight:   8,
      passed:   hoursCount > 0,
    },
    {
      id:       "social",
      label:    "At least one social link added",
      hint:     "Connect your Instagram, Facebook, or other social accounts to help customers follow you.",
      category: "engagement",
      weight:   6,
      passed:   hasSocialLink,
    },
    {
      id:       "service",
      label:    "At least one service or offering listed",
      hint:     "Add your services or offerings so visitors see exactly what you provide.",
      category: "engagement",
      weight:   8,
      passed:   serviceCount > 0,
    },
    {
      id:       "meta_title",
      label:    "SEO title set",
      hint:     "Set a meta title to improve how your page appears in Google search results.",
      category: "seo",
      weight:   8,
      passed:   !!listing.meta_title?.trim(),
    },
    {
      id:       "meta_description",
      label:    "SEO description set",
      hint:     "Set a meta description — it's the preview text that shows up under your page title in search results.",
      category: "seo",
      weight:   8,
      passed:   !!listing.meta_description?.trim(),
    },
  ]

  const maxScore = items.reduce((sum, item) => sum + item.weight, 0)
  const score    = items.filter((i) => i.passed).reduce((sum, i) => sum + i.weight, 0)

  const grade: ChecklistResult["grade"] =
    score >= 80 ? "strong" : score >= 50 ? "good" : "needs-work"

  return { items, score, maxScore, grade }
}

export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  required:   "Required",
  recommended: "Recommended",
  seo:        "SEO",
  engagement: "Engagement",
}

export const CATEGORY_ORDER: ChecklistCategory[] = [
  "required",
  "recommended",
  "seo",
  "engagement",
]
