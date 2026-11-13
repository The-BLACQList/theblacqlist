import type { EntityPageData } from '@/types'
import { creativeEntity } from './creative'
import { professionalEntity } from './professional'
import { storefrontEntity } from './storefront'

/**
 * The three "Test Business 123" sample pages (ticket 184): one per template,
 * every Premium feature filled. Rendered by app/example/[variant] on Preview
 * and read by the staging seed (ticket 187) so the two never drift.
 *
 * `now` is injected so dates — events, coupon ends, job deadlines, review
 * ages — are always relative to the visit, and so tests can pin them.
 */
export const EXAMPLE_VARIANTS = ['storefront', 'professional', 'creative'] as const

export type ExampleVariant = (typeof EXAMPLE_VARIANTS)[number]

export const EXAMPLE_VARIANT_LABEL: Record<ExampleVariant, string> = {
  storefront: 'Storefront',
  professional: 'Professional',
  creative: 'Creative',
}

export function isExampleVariant(value: string): value is ExampleVariant {
  return (EXAMPLE_VARIANTS as readonly string[]).includes(value)
}

export function buildExampleEntity(variant: ExampleVariant, now: Date): EntityPageData {
  switch (variant) {
    case 'storefront':
      return storefrontEntity(now)
    case 'professional':
      return professionalEntity(now)
    case 'creative':
      return creativeEntity(now)
  }
}

export { EXAMPLE_NAME } from './shared'
