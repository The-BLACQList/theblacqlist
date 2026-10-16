/**
 * The draft cards' bookkeeping (ticket 128), kept apart from the component so
 * it can be tested without a browser. Client-safe: types only from the
 * onboarding module, no zod, no server code.
 */

import type { CategoryDraft, DraftFocus, OnboardingDrafts } from './onboarding'

export type TextField = 'tagline' | 'about' | 'searchTitle' | 'searchDescription'
export type CardField = 'category' | TextField

export const TEXT_FIELDS: readonly TextField[] = ['tagline', 'about', 'searchTitle', 'searchDescription']

export const CARD_TITLES: Record<CardField, string> = {
  category: 'Category',
  tagline: 'Tagline',
  about: 'About',
  searchTitle: 'Search title',
  searchDescription: 'Search description',
}

/** The save path's form field for each card (updateListingContentAction). */
export const SAVE_FIELD: Record<TextField, 'tagline' | 'description' | 'meta_title' | 'meta_description'> = {
  tagline: 'tagline',
  about: 'description',
  searchTitle: 'meta_title',
  searchDescription: 'meta_description',
}

/** The save path's limits, so an edited card never fails on length there. */
export const SAVE_LIMIT: Record<Exclude<TextField, 'about'>, number> = {
  tagline: 140,
  searchTitle: 60,
  searchDescription: 160,
}

/** What the cards hold: the drafts as the owner has edited them. */
export interface CardValues {
  category: CategoryDraft | null
  tagline: string
  about: string
  searchTitle: string
  searchDescription: string
}

export function cardValuesFrom(drafts: OnboardingDrafts): CardValues {
  return { ...drafts }
}

/**
 * A fresh answer for one card replaces that card only, so edits on the other
 * cards survive "Try again". A fresh answer for all replaces everything.
 */
export function mergeDrafts(current: CardValues, next: OnboardingDrafts, focus: DraftFocus): CardValues {
  if (focus === 'all') return cardValuesFrom(next)
  return { ...current, [focus]: next[focus] }
}

/** Use this on the category card would change nothing. */
export function categoryUnchanged(category: CategoryDraft | null, currentCategoryId: string | null): boolean {
  return category?.kind === 'existing' && category.categoryId === currentCategoryId
}
