// Features that are built but not open to the public yet (founder, 2026-10-05).
//
// Each one sits behind a flag in lib/env.ts. While the flag is off, proxy.ts
// rewrites the feature's pages to /soon/<feature> and answers its public data
// APIs with 403 FEATURE_NOT_OPEN, and the write actions refuse on their own.
// The links to it stay in the nav with a "Soon" pill.
//
// Opening one is an env change plus a redeploy: set FEATURE_<NAME>_OPEN=true.
//
// Pure data and path matching, so proxy.ts (edge-safe) and the tests can both
// import it.

import type { FeatureFlag } from '@/lib/env'

export type SoonFeature = 'marketplace' | 'jobs' | 'collective'

export interface SoonFeatureConfig {
  flag: FeatureFlag
  /** What the cover calls it. */
  name: string
  /** Where the feature lives once it opens. /soon/<feature> sends people here when it is open. */
  home: string
  /** Page paths covered. Each matches itself and anything beneath it. */
  pages: string[]
  /** Public data APIs that answer 403 while covered. */
  apis: string[]
  /** `launch_subscribers.source` for the cover's waitlist. Must be in subscribeLaunch's allowlist. */
  source: string
  /** One plain line under the heading. */
  blurb: string
  /** What it will do, shown as a short list. */
  points: string[]
}

export const SOON_FEATURES: Record<SoonFeature, SoonFeatureConfig> = {
  marketplace: {
    flag: 'marketplaceOpen',
    name: 'The Marketplace',
    home: '/marketplace',
    // /for-vendors is left open on purpose. It already says selling isn't open
    // and carries its own vendor waitlist.
    pages: ['/marketplace', '/vendors'],
    apis: [],
    source: 'soon-marketplace',
    blurb: 'Shop products and book services from Black-owned businesses, all in one place.',
    points: [
      'Browse products and services from businesses on the list',
      'See each vendor’s storefront',
      'Buy or book straight from the business',
    ],
  },
  jobs: {
    flag: 'jobsOpen',
    name: 'Jobs',
    home: '/jobs',
    pages: ['/jobs', '/add-job'],
    apis: [],
    source: 'soon-jobs',
    blurb: 'Find work with Black-owned businesses, and help them find you.',
    points: [
      'Openings posted by businesses on the list',
      'Filter by city and kind of work',
      'Apply straight with the business',
    ],
  },
  collective: {
    flag: 'collectiveOpen',
    name: 'The Collective',
    home: '/flow-map',
    pages: [
      '/flow-map',
      '/account/receipts',
      '/account/spending',
      '/account/community-spend',
    ],
    apis: ['/api/flow-map', '/api/community-spend'],
    source: 'soon-collective',
    blurb: 'See where the community’s money goes, and add your own receipts to the count.',
    points: [
      'Track what you spend with businesses on the list',
      'See your own total and the businesses you support',
      'Watch the community’s spending grow, city by city',
    ],
  },
}

export const SOON_FEATURE_KEYS = Object.keys(SOON_FEATURES) as SoonFeature[]

export function isSoonFeature(value: string): value is SoonFeature {
  return Object.hasOwn(SOON_FEATURES, value)
}

// Exact match or a real path segment beneath it, so /jobs covers /jobs/x but
// not a sibling like /jobsite. Same rule proxy.ts uses for the coming-soon gate.
function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

// A job listing's own page is /{city}/job/{slug}, so the jobs cover also has to
// catch the second segment. Nothing else uses `job` there.
const JOB_ENTITY_PATH = /^\/[^/]+\/job(\/|$)/

export interface CoveredMatch {
  feature: SoonFeature
  kind: 'page' | 'api'
}

/**
 * Which feature, if any, owns this path. Says nothing about whether it is open;
 * the caller checks the flag.
 */
export function matchSoonFeature(pathname: string): CoveredMatch | null {
  for (const feature of SOON_FEATURE_KEYS) {
    const config = SOON_FEATURES[feature]
    if (config.apis.some((p) => matches(pathname, p))) return { feature, kind: 'api' }
    if (config.pages.some((p) => matches(pathname, p))) return { feature, kind: 'page' }
  }
  if (JOB_ENTITY_PATH.test(pathname)) return { feature: 'jobs', kind: 'page' }
  return null
}
