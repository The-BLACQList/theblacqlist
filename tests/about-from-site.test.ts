// Part C feedback: the About written from the owner's website. What the writer
// is given, how a thin page is handled, and that paragraphs survive to the page.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPromptVars, fillTemplate, type GenerateContext } from '@/lib/ai/provider'
import { PROMPT_TEMPLATES } from '@/lib/ai/prompts'
import { ownerRejectionMessage, validateOutput } from '@/lib/ai/sanitize'
import { storyParagraphs } from '@/components/entity-page/EntityStorySection'
import { withAboutDraft, type ImportRow } from '@/lib/import/ownerImport'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const CTX: GenerateContext = {
  listingName: 'Cakes & Treats of Atlanta',
  categoryName: 'Bakery',
  cityName: 'Atlanta',
  tagline: null,
  description: null,
  pageViews30d: 0,
  ctaClicks30d: 0,
  saves30d: 0,
  shares30d: 0,
  pageViews7d: 0,
  parentCategoryName: 'Food & Dining',
  serviceNames: ['Custom cakes', 'Cupcakes', 'Call 404-555-0100'],
  attributeLabels: ['Black-owned', 'Pickup'],
  siteText: 'Black owned bakery making custom cakes & treats. Email us at owner@example.com or call (404) 555-0199.',
}

describe('prompt vars for About', () => {
  const vars = buildPromptVars(CTX)

  it('give the writer services, features and the site text', () => {
    expect(vars.parent_category).toContain('Food & Dining')
    expect(vars.services_block).toMatch(/Custom cakes, Cupcakes/)
    expect(vars.attributes_block).toMatch(/Black-owned, Pickup/)
    expect(vars.site_text_block).toMatch(/Black owned bakery/)
  })

  it('never pass on an email or phone number', () => {
    const all = Object.values(vars).join('\n')
    expect(all).not.toContain('owner@example.com')
    expect(all).not.toMatch(/555-0199|555-0100/)
  })

  it('leave the blocks out when there is nothing to say', () => {
    const bare = buildPromptVars({ ...CTX, parentCategoryName: null, serviceNames: [], attributeLabels: [], siteText: null })
    expect(bare.services_block).toBe('')
    expect(bare.attributes_block).toBe('')
    expect(bare.site_text_block).toBe('')
  })

  it('the About prompt asks for paragraphs and never to refuse', () => {
    const prompt = fillTemplate(PROMPT_TEMPLATES.LISTING_DESCRIPTION, vars)
    expect(prompt).toMatch(/paragraph/i)
    expect(prompt).toMatch(/blank line/i)
    expect(prompt).toMatch(/never refuse/i)
    expect(prompt).not.toMatch(/\{\{/)
  })
})

describe('a refusal', () => {
  it('is caught with a curly apostrophe too', () => {
    expect(validateOutput('I can’t write this without more detail.', 2000)).toEqual({ ok: false, reason: 'refusal' })
    expect(validateOutput('I’m sorry, there is not enough here.', 2000)).toEqual({ ok: false, reason: 'refusal' })
  })

  it('tells the owner what to add, not that checks failed', () => {
    expect(ownerRejectionMessage('refusal')).toMatch(/isn't enough on your page/)
    const action = read('lib/ai/requestSuggestion.ts')
    expect(action).toMatch(/result\.reason === 'refusal' \|\| result\.reason === 'empty'/)
    expect(action).toContain("ownerRejectionMessage('refusal')")
  })
})

describe('paragraphs', () => {
  it('split at blank lines, however the browser wrote them', () => {
    expect(storyParagraphs('One.\r\n\r\nTwo.\n \nThree.')).toEqual(['One.', 'Two.', 'Three.'])
    expect(storyParagraphs('  Just one.  ')).toEqual(['Just one.'])
  })

  it('are saved with plain line breaks', () => {
    expect(read('lib/actions/dashboard/updateListingContent.ts')).toMatch(/replace\(\/\\r\\n\?\/g, '\\n'\)/)
  })
})

describe('withAboutDraft', () => {
  const row = (key: string): ImportRow => ({
    key,
    label: key,
    found: key,
    current: null,
    card: 'basics',
    pairs: [[key, key]],
    defaultChecked: true,
    locked: null,
    note: null,
  })

  it('replaces the site’s About with the draft', () => {
    const rows = withAboutDraft([row('name'), row('about'), row('phone')], 'Para one.\r\n\r\nPara two.', { description: null }, null)
    expect(rows.map((r) => r.key)).toEqual(['name', 'about', 'phone'])
    expect(rows[1]?.pairs).toEqual([['description', 'Para one.\n\nPara two.']])
    expect(rows[1]?.current).toBeNull()
  })

  it('adds an About row after the name when the site had none', () => {
    const rows = withAboutDraft([row('name'), row('phone')], 'Hello.', { description: 'Old about' }, null)
    expect(rows.map((r) => r.key)).toEqual(['name', 'about', 'phone'])
    expect(rows[1]?.current).toBe('Old about')
  })

  it('fits the plan’s limit and says so', () => {
    const rows = withAboutDraft([], 'First sentence here. Second sentence that runs much longer.', { description: null }, 30)
    expect(rows[0]?.found).toBe('First sentence here.')
    expect(rows[0]?.note).toMatch(/30 characters/)
  })
})
