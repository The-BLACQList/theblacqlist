// =============================================================================
// Extra buttons by plan (owner-experience round 2, part B, 2026-11-13).
// =============================================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  EXTRA_BUTTON_TYPES,
  CTA_OPTIONS,
  extraButtonHref,
  moveButton,
  parseExtraButton,
  resolvePageButtons,
  shownExtraButtons,
  toExtraButtons,
  type ExtraButton,
} from '@/lib/listings/pageButtons'
import { hiddenContent } from '@/lib/listings/hiddenContent'
import { VALID_CTA_TYPES } from '@/lib/constants/listing'
import { extraButtonLimit } from '@/lib/stripe/features'
import { hiddenLine } from '@/lib/stripe/downgrade'
import { checkButtonAdd } from '@/lib/stripe/planChecks'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

function btn(id: string, position: number, overrides: Partial<ExtraButton> = {}): ExtraButton {
  return { id, type: 'book', value: `https://example.com/${id}`, label_override: null, position, ...overrides }
}

describe('extraButtonLimit', () => {
  it('is 0 / 1 / 2 / 3 by plan, and Free for anything unknown', () => {
    expect(extraButtonLimit('free')).toBe(0)
    expect(extraButtonLimit('starter')).toBe(1)
    expect(extraButtonLimit('growth')).toBe(2)
    expect(extraButtonLimit('premium')).toBe(3)
    expect(extraButtonLimit(null)).toBe(0)
    expect(extraButtonLimit('lapsed')).toBe(0)
  })
})

describe('checkButtonAdd', () => {
  it('lets each plan add up to its limit', () => {
    expect(checkButtonAdd('starter', 0)).toBeNull()
    expect(checkButtonAdd('growth', 1)).toBeNull()
    expect(checkButtonAdd('premium', 2)).toBeNull()
  })

  it('sends Free to Starter', () => {
    expect(checkButtonAdd('free', 0)).toBe('Extra buttons are part of Starter. Upgrade to add one to your page.')
  })

  it('offers Growth to a full Starter page only while Growth is for sale', () => {
    expect(checkButtonAdd('starter', 1, true)).toBe(
      'Your plan includes 1 extra button. Remove one, or upgrade to Growth for more.'
    )
    expect(checkButtonAdd('starter', 1, false)).toBe('Your plan includes 1 extra button. Remove one to add another.')
  })

  it('tells full Growth and Premium pages how to make room', () => {
    expect(checkButtonAdd('growth', 2, true)).toBe('Your plan includes up to 2 extra buttons. Remove one to add another.')
    expect(checkButtonAdd('premium', 3)).toBe('Your plan includes up to 3 extra buttons. Remove one to add another.')
    expect(checkButtonAdd('premium', 5)).not.toBeNull()
  })
})

describe('parseExtraButton', () => {
  it('never takes Message us: the inbox has its own button', () => {
    expect(parseExtraButton('message', null, null)).toMatchObject({ ok: false })
    expect(EXTRA_BUTTON_TYPES).not.toContain('message')
  })

  it('rejects unknown types', () => {
    expect(parseExtraButton('fax', 'https://x.com', '')).toEqual({ ok: false, error: 'Choose what the button does.' })
  })

  it('takes no value for Call us', () => {
    expect(parseExtraButton('call', 'https://ignored.example', ' Ring us ')).toEqual({
      ok: true,
      value: { type: 'call', value: null, label_override: 'Ring us' },
    })
  })

  it('needs an email address for Email us', () => {
    expect(parseExtraButton('email', '', '')).toMatchObject({ ok: false })
    expect(parseExtraButton('email', 'not-an-email', '')).toMatchObject({ ok: false })
    expect(parseExtraButton('email', ' hi@shop.com ', '')).toEqual({
      ok: true,
      value: { type: 'email', value: 'hi@shop.com', label_override: null },
    })
  })

  it('needs an https link for everything else', () => {
    expect(parseExtraButton('book', '', '')).toMatchObject({ ok: false })
    expect(parseExtraButton('book', 'http://example.com', '')).toMatchObject({ ok: false })
    expect(parseExtraButton('book', 'javascript:alert(1)', '')).toMatchObject({ ok: false })
    expect(parseExtraButton('book', 'https://example.com/book', '')).toMatchObject({ ok: true })
  })

  it('caps the label at 50 characters', () => {
    expect(parseExtraButton('book', 'https://example.com', 'x'.repeat(51))).toMatchObject({ ok: false })
    expect(parseExtraButton('book', 'https://example.com', 'x'.repeat(50))).toMatchObject({ ok: true })
  })
})

describe('shownExtraButtons', () => {
  const three = [btn('c', 2), btn('a', 0), btn('b', 1)]

  it('shows each plan its limit, first ones by position', () => {
    expect(shownExtraButtons(three, 'premium').shown.map((b) => b.id)).toEqual(['a', 'b', 'c'])
    expect(shownExtraButtons(three, 'growth').shown.map((b) => b.id)).toEqual(['a', 'b'])
    expect(shownExtraButtons(three, 'starter').shown.map((b) => b.id)).toEqual(['a'])
    expect(shownExtraButtons(three, 'free').shown).toEqual([])
  })

  it('keeps the rest, hidden, after a downgrade (nothing is deleted)', () => {
    expect(shownExtraButtons(three, 'starter').hidden.map((b) => b.id)).toEqual(['b', 'c'])
    expect(shownExtraButtons(three, null).hidden).toHaveLength(3)
  })

  it('breaks position ties by the order they were read (created_at)', () => {
    expect(shownExtraButtons([btn('x', 0), btn('y', 0)], 'starter').shown.map((b) => b.id)).toEqual(['x'])
  })
})

describe('extraButtonHref / resolvePageButtons', () => {
  it('calls the page phone, emails the address, opens https links', () => {
    expect(extraButtonHref({ type: 'call', value: null }, '(313) 555-0100')).toBe('tel:3135550100')
    expect(extraButtonHref({ type: 'call', value: null }, null)).toBeNull()
    expect(extraButtonHref({ type: 'email', value: 'hi@shop.com' }, null)).toBe('mailto:hi@shop.com')
    expect(extraButtonHref({ type: 'shop', value: 'https://shop.example' }, null)).toBe('https://shop.example')
    expect(extraButtonHref({ type: 'shop', value: 'javascript:alert(1)' }, null)).toBeNull()
  })

  it('renders only shown buttons with somewhere to go, with labels', () => {
    const buttons = [
      btn('call', 0, { type: 'call', value: null }),
      btn('shop', 1, { type: 'shop', value: 'https://shop.example', label_override: 'Our store' }),
      btn('book', 2),
    ]
    expect(resolvePageButtons(buttons, 'growth', null)).toEqual([
      { id: 'shop', href: 'https://shop.example', label: 'Our store' },
    ])
    expect(resolvePageButtons(buttons, 'premium', '3135550100').map((b) => b.label)).toEqual([
      'Call Now',
      'Our store',
      'Book Now',
    ])
    expect(resolvePageButtons(buttons, 'free', '3135550100')).toEqual([])
  })

  it('drops rows with a type this code does not know', () => {
    expect(
      toExtraButtons([
        { id: '1', type: 'book', value: 'https://x.com', label_override: null, position: 0 },
        { id: '2', type: 'message', value: null, label_override: null, position: 1 },
        { id: '3', type: 'fax', value: 'x', label_override: null, position: 2 },
      ]).map((b) => b.id)
    ).toEqual(['1'])
    expect(toExtraButtons(null)).toEqual([])
  })
})

describe('moveButton', () => {
  const buttons = [btn('a', 0), btn('b', 1), btn('c', 2)]

  it('swaps with the neighbour and returns the new order', () => {
    expect(moveButton(buttons, 'b', 'up')).toEqual(['b', 'a', 'c'])
    expect(moveButton(buttons, 'b', 'down')).toEqual(['a', 'c', 'b'])
  })

  it('is null at the ends or for an unknown id', () => {
    expect(moveButton(buttons, 'a', 'up')).toBeNull()
    expect(moveButton(buttons, 'c', 'down')).toBeNull()
    expect(moveButton(buttons, 'zzz', 'up')).toBeNull()
  })
})

describe('hidden buttons in the editor', () => {
  const base = {
    tier: 'starter',
    peakTier: 'growth',
    description: null,
    media: [],
    videos: [],
    faqs: [],
    attributeGroups: [],
    selectedValueIds: [],
  }

  it('tags and counts buttons over the plan limit', () => {
    const out = hiddenContent({ ...base, buttons: [btn('a', 0), btn('b', 1), btn('c', 2)] })
    expect(out.counts).toContainEqual({ kind: 'buttons', hidden: 2, limit: 1 })
    expect([...out.hiddenIds]).toEqual(['b', 'c'])
  })

  it('caps by the current plan even when the page never paid more', () => {
    const out = hiddenContent({ ...base, tier: 'free', peakTier: null, buttons: [btn('a', 0)] })
    expect(out.counts).toEqual([{ kind: 'buttons', hidden: 1, limit: 0 }])
  })

  it('says it plainly', () => {
    expect(hiddenLine({ kind: 'buttons', hidden: 2, limit: 1 })).toBe(
      '2 extra buttons are hidden on your page. Your plan shows up to 1 extra button.'
    )
    expect(hiddenLine({ kind: 'buttons', hidden: 1, limit: 0 })).toBe(
      "1 extra button is hidden on your page. Your plan doesn't include extra buttons."
    )
  })
})

describe('migration 20261115000000_listing_buttons (contract)', () => {
  const sql = read('supabase/migrations/20261115000000_listing_buttons.sql')

  it('allows exactly the extra button types', () => {
    const check = /listing_buttons_type_check\s+CHECK \(type IN \(([^)]*)\)\)/.exec(sql)?.[1] ?? ''
    const types = [...check.matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect(types.sort()).toEqual([...EXTRA_BUTTON_TYPES].sort())
    expect(types).not.toContain('message')
  })

  it('keeps every main-button type except message, and the pickers offer all of them', () => {
    expect([...EXTRA_BUTTON_TYPES, 'message'].sort()).toEqual([...VALID_CTA_TYPES].sort())
    expect(CTA_OPTIONS.map((o) => o.value).sort()).toEqual([...VALID_CTA_TYPES].sort())
  })

  it('stores no value for call, and caps value and label length', () => {
    expect(sql).toMatch(/type = 'call' AND value IS NULL/)
    expect(sql).toMatch(/char_length\(value\) BETWEEN 1 AND 2048/)
    expect(sql).toMatch(/char_length\(label_override\) BETWEEN 1 AND 50/)
  })

  it('cascades with the listing and indexes the display order', () => {
    expect(sql).toMatch(/REFERENCES public\.listings\(id\) ON DELETE CASCADE/)
    expect(sql).toMatch(/ON public\.listing_buttons \(listing_id, position\)/)
  })

  it('has RLS: public read on published pages, owner writes', () => {
    expect(sql).toMatch(/ALTER TABLE public\.listing_buttons ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/"listing_buttons: anon read published"[\s\S]*?status = 'published' AND deleted_at IS NULL/)
    for (const op of ['INSERT', 'UPDATE', 'DELETE']) {
      expect(sql).toMatch(new RegExp(`FOR ${op} TO authenticated[\\s\\S]*?owner_user_id = auth\\.uid\\(\\)`))
    }
    expect(sql).not.toMatch(/TO anon[\s\S]{0,40}FOR (INSERT|UPDATE|DELETE)/)
  })
})

describe('wiring (contract)', () => {
  it('the add action checks the plan limit on the owner’s own listing', () => {
    const src = read('lib/actions/dashboard/updateButtons.ts')
    expect(src).toMatch(/checkButtonAdd\(listing\.tier, existing\.length/)
    expect(src).toMatch(/\.eq\('owner_user_id', owner\.user\.id\)/)
  })

  it('the public read caps extras by plan and leaves jobs and events with one button', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toMatch(/resolvePageButtons\(toExtraButtons\(buttonData\), raw\.tier/)
    expect(src).toMatch(/raw\.entity_type === 'job' \|\| raw\.entity_type === 'event'/)
  })

  it('the hero and the quick bar render them', () => {
    expect(read('components/entity-page/templates/TemplateHero.tsx')).toMatch(/entity\.buttons \?\? \[\]/)
    expect(read('components/entity-page/EntityQuickActionBar.tsx')).toMatch(/entity\.buttons \?\? \[\]/)
  })
})
