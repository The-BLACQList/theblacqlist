// Shared fakes for Cue's tests (ticket 169). No database, no model.

import { vi } from 'vitest'

import type { AssistantCategory } from '@/lib/ai/assistant'
import { newTurnState, type CueToolContext, type CueToolDeps } from '@/lib/ai/cue/tools'
import { NO_PAGE } from '@/lib/assistant/page'
import type { AssistCity } from '@/lib/search/assist'
import type { DiscoveryEntity } from '@/types'

export const CATEGORIES: AssistantCategory[] = [
  { id: 'c-pro', slug: 'professional-services', name: 'Professional Services', parentId: null },
  { id: 'c-law', slug: 'law-legal-services', name: 'Law & Legal Services', parentId: 'c-pro' },
  { id: 'c-events', slug: 'events-entertainment', name: 'Events & Entertainment', parentId: null },
  { id: 'c-plan', slug: 'event-planning', name: 'Event Planning', parentId: 'c-events' },
  { id: 'c-food', slug: 'food-drink', name: 'Food & Drink', parentId: null },
  { id: 'c-bake', slug: 'bakeries-pastry-shops', name: 'Bakeries & Pastry Shops', parentId: 'c-food' },
]

export const CITIES: AssistCity[] = [
  { id: 'atl', name: 'Atlanta', slug: 'atlanta', isActive: true, lat: 33.749, lng: -84.388, stateCode: 'GA' },
  { id: 'hou', name: 'Houston', slug: 'houston', isActive: true, lat: 29.76, lng: -95.37, stateCode: 'TX' },
  { id: 'sav', name: 'Savannah', slug: 'savannah', isActive: false, lat: 32.08, lng: -81.09, stateCode: 'GA' },
]

export const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export function entity(n: number, over: Partial<DiscoveryEntity> = {}): DiscoveryEntity {
  return {
    id: ID(n),
    name: `Business ${n}`,
    slug: `business-${n}`,
    entity_type: 'business',
    tagline: '',
    description: 'A full-service law firm in Midtown.',
    category: { name: 'Professional Services', slug: 'professional-services' },
    city: { name: 'Atlanta', slug: 'atlanta', state_abbr: 'GA' },
    location_type: 'physical',
    trust_tier: 'listed',
    tier: 'free',
    ownership_label: 'black_owned',
    is_featured: false,
    is_sponsored: false,
    logo_path: null,
    cover_image_path: null,
    avg_rating: null,
    review_count: 0,
    save_count: 0,
    ...over,
  } as DiscoveryEntity
}

export function deps(over: Partial<CueToolDeps> = {}): CueToolDeps {
  return {
    search: vi.fn(async () => []),
    loadByIds: vi.fn(async () => []),
    loadDetails: vi.fn(async () => null),
    locate: vi.fn(async () => null),
    ...over,
  }
}

export function ctx(over: Partial<CueToolContext> = {}): CueToolContext {
  return {
    categories: CATEGORIES,
    cities: CITIES,
    near: null,
    page: NO_PAGE,
    priorIds: new Set(),
    state: newTurnState(),
    deps: deps(),
    ...over,
  }
}

export const cat = (slug: string) => CATEGORIES.find((c) => c.slug === slug)!
