// Part C: edit page tabs, the strength meter opening the right tab, and the
// old offerings/media pages landing on their tab.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TAB,
  EDIT_TABS,
  SCROLL_ORDER,
  TAB_SECTIONS,
  initialTab,
  isEditTab,
  tabForAnchor,
  tabsWithChanges,
} from '@/lib/listings/editTabs'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('tab sections', () => {
  it('puts every card in exactly one tab, and nothing else', () => {
    const inTabs = EDIT_TABS.flatMap((t) => TAB_SECTIONS[t.id])
    expect(new Set(inTabs).size).toBe(inTabs.length)
    expect([...inTabs].sort()).toEqual([...SCROLL_ORDER].sort())
  })

  it('starts on Basics', () => {
    expect(DEFAULT_TAB).toBe('basics')
    expect(EDIT_TABS[0]?.id).toBe('basics')
  })
})

describe('tabForAnchor', () => {
  it('maps a card to its tab, with or without the #', () => {
    expect(tabForAnchor('hours')).toBe('contact')
    expect(tabForAnchor('#photos')).toBe('media')
    expect(tabForAnchor('main-button')).toBe('contact')
    expect(tabForAnchor('faq')).toBe('more')
    expect(tabForAnchor('services')).toBe('services')
  })

  it('returns null for anything else', () => {
    expect(tabForAnchor('')).toBeNull()
    expect(tabForAnchor('nope')).toBeNull()
  })
})

describe('initialTab', () => {
  it('reads ?tab=', () => {
    expect(initialTab('media')).toBe('media')
    expect(initialTab(['more', 'media'])).toBe('more')
  })

  it('falls back to Basics for a missing or unknown tab', () => {
    expect(initialTab(undefined)).toBe('basics')
    expect(initialTab('where')).toBe('basics')
  })

  it('lets a card link win over ?tab=', () => {
    expect(initialTab('basics', '#hours')).toBe('contact')
    expect(initialTab('basics', '#nope')).toBe('basics')
  })

  it('isEditTab only accepts real tabs', () => {
    expect(isEditTab('contact')).toBe(true)
    expect(isEditTab('constructor')).toBe(false)
  })
})

describe('tabsWithChanges', () => {
  it('marks the tabs holding unsaved cards', () => {
    expect([...tabsWithChanges(['about', 'hours', 'social'])].sort()).toEqual(['basics', 'contact', 'more'])
    expect(tabsWithChanges([]).size).toBe(0)
    expect(tabsWithChanges(['unknown']).size).toBe(0)
  })
})

describe('wiring', () => {
  it('the edit page reads ?tab= and passes it on', () => {
    const src = read('app/dashboard/pages/[entityId]/edit/page.tsx')
    expect(src).toContain('searchParams')
    expect(src).toMatch(/initialTab=\{initialTab\(tab\)\}/)
  })

  it('the strength meter and a failed save open the tab first', () => {
    const meter = read('components/listings/finish/StrengthMeter.tsx')
    expect(meter).toMatch(/show\?\.\(anchor\.slice\(1\)\)/)
    const save = read('components/listings/finish/ProfileSave.tsx')
    expect(save).toMatch(/reveal\?\.\(f\.anchorId\)/)
    const view = read('components/listings/PageFinishView.tsx')
    expect(view).toMatch(/<ProfileSaveProvider[^>]*reveal=\{reveal\}/)
    expect(view).toMatch(/<StrengthMeter[^>]*showSection=\{reveal\}/)
  })

  it('keeps every panel mounted, so edits in a closed tab survive', () => {
    const view = read('components/listings/PageFinishView.tsx')
    expect(view).toMatch(/role="tabpanel"/)
    expect(view).toMatch(/hidden=\{t\.id !== tab\}/)
  })

  it('the old offerings and media pages open their tab', () => {
    expect(read('app/dashboard/pages/[entityId]/offerings/page.tsx')).toContain('/edit?tab=services#services')
    expect(read('app/dashboard/pages/[entityId]/media/page.tsx')).toContain('/edit?tab=media#photos')
  })
})
