// =============================================================================
// lib/features/opening-soon.ts: which paths the opening-soon covers own
// =============================================================================
// Marketplace, Jobs and The Collective are covered until they open (ticket
// 122). proxy.ts asks matchSoonFeature() on every request, so these tests pin
// what it claims and, just as much, what it must leave alone: the vendor
// waitlist page, the admin receipt image route, and lookalike paths.
// =============================================================================

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

import {
  SOON_FEATURES,
  SOON_FEATURE_KEYS,
  isSoonFeature,
  matchSoonFeature,
} from '@/lib/features/opening-soon'

describe('matchSoonFeature', () => {
  it.each([
    ['/marketplace', 'marketplace'],
    ['/marketplace/products', 'marketplace'],
    ['/marketplace/services/some-service', 'marketplace'],
    ['/vendors', 'marketplace'],
    ['/vendors/some-vendor', 'marketplace'],
    ['/jobs', 'jobs'],
    ['/add-job', 'jobs'],
    ['/atlanta-ga/job', 'jobs'],
    ['/atlanta-ga/job/line-cook', 'jobs'],
    ['/flow-map', 'collective'],
    ['/flow-map/methodology', 'collective'],
    ['/account/receipts', 'collective'],
    ['/account/receipts/new', 'collective'],
    ['/account/receipts/abc/edit', 'collective'],
    ['/account/spending', 'collective'],
    ['/account/community-spend', 'collective'],
  ])('covers the page %s as %s', (path, feature) => {
    expect(matchSoonFeature(path)).toEqual({ feature, kind: 'page' })
  })

  it.each([
    ['/api/flow-map/summary', 'collective'],
    ['/api/flow-map/export', 'collective'],
    ['/api/community-spend', 'collective'],
  ])('blocks the API %s as %s', (path, feature) => {
    expect(matchSoonFeature(path)).toEqual({ feature, kind: 'api' })
  })

  it.each([
    '/',
    '/discover',
    '/for-vendors',
    '/for-business',
    '/jobsite',
    '/marketplaces',
    '/flow-mapper',
    '/account',
    '/account/saved',
    '/account/reviews',
    '/admin/receipts',
    '/api/receipts/abc/signed-url',
    '/api/marketplace/cta-click',
    '/atlanta-ga/restaurant/twisted-soul-cookhouse',
    '/atlanta-ga/jobs-board',
    '/soon/collective',
  ])('leaves %s alone', (path) => {
    expect(matchSoonFeature(path)).toBeNull()
  })
})

describe('SOON_FEATURES', () => {
  it('recognizes only its own keys', () => {
    for (const key of SOON_FEATURE_KEYS) expect(isSoonFeature(key)).toBe(true)
    expect(isSoonFeature('toString')).toBe(false)
    expect(isSoonFeature('events')).toBe(false)
  })

  it('sends each feature home to a path it covers', () => {
    for (const key of SOON_FEATURE_KEYS) {
      expect(matchSoonFeature(SOON_FEATURES[key].home)).toEqual({ feature: key, kind: 'page' })
    }
  })

  // An unknown source is quietly recorded as a plain coming-soon signup, which
  // would hide how many people are waiting on each feature.
  it('keeps every waitlist source in the subscribe allowlist', () => {
    const action = readFileSync(
      resolve(__dirname, '../lib/actions/subscribers/subscribeLaunch.ts'),
      'utf8'
    )
    for (const key of SOON_FEATURE_KEYS) {
      expect(action).toContain(`'${SOON_FEATURES[key].source}'`)
    }
  })

  // A renamed route would leave its cover pointing at nothing.
  it('only covers routes that exist', () => {
    const app = resolve(__dirname, '../app')
    // Route groups like (public) and (index) don't appear in the URL.
    const groups = ['', ...readdirSync(app).filter((d) => d.startsWith('('))]
    for (const key of SOON_FEATURE_KEYS) {
      for (const path of [...SOON_FEATURES[key].pages, ...SOON_FEATURES[key].apis]) {
        const found = groups.some((g) => existsSync(join(app, g, path)))
        expect(found, `${path} has no route under app/`).toBe(true)
      }
    }
  })
})
