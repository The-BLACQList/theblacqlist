// =============================================================================
// Cue's reply checks (ticket 169)
// =============================================================================
// The streaming hold-back for links and phone numbers, the finished-reply
// clean-up, and the swap for an unreturned business name or an ownership label.
// =============================================================================

import { describe, expect, it } from 'vitest'

import {
  checkReply,
  cleanReply,
  hasIdentityLabel,
  lastFullSentence,
  namesUnreturned,
  redactReply,
  SWAP_NO_CARDS,
  SWAP_SAME_TERMS,
  SWAP_WITH_CARDS,
  TextGuard,
} from '@/lib/ai/cue/guard'

function streamed(deltas: string[]): { pieces: string[]; text: string } {
  const pieces: string[] = []
  const guard = new TextGuard((t) => pieces.push(t))
  for (const d of deltas) guard.push(d)
  guard.end()
  return { pieces, text: pieces.join('') }
}

describe('TextGuard', () => {
  it('passes whole words through as they arrive', () => {
    const { pieces, text } = streamed(['Here are ', 'three pla', 'ces in Atlanta.'])
    expect(text).toBe('Here are three places in Atlanta.')
    expect(pieces[0]).toBe('Here are ')
  })

  it('never shows part of a phone number split across deltas', () => {
    const { pieces, text } = streamed(['Call them at 404-55', '5-1234 today.'])
    for (const p of pieces) expect(p).not.toMatch(/\d/)
    expect(text).not.toMatch(/\d/)
    expect(text).toContain('today.')
  })

  it('keeps a link label and drops the link, even split mid-link', () => {
    const { pieces, text } = streamed(['Try [Peach Bakery](htt', 'ps://example.com/x) for cake.'])
    for (const p of pieces) expect(p).not.toContain('http')
    expect(text).toBe('Try Peach Bakery for cake.')
  })

  it('drops bare URLs and emails', () => {
    const { text } = streamed(['See www.example.com or mail hi@example.com for more.'])
    expect(text).not.toMatch(/example/)
  })

  it('lets a long held tail through so the stream never stalls', () => {
    const { text } = streamed(['['.concat('a'.repeat(400))])
    expect(text.length).toBeGreaterThan(300)
  })

  it('leaves years and prices alone', () => {
    expect(redactReply('Open since 2019, cakes from $45.')).toBe('Open since 2019, cakes from $45.')
  })
})

describe('cleanReply', () => {
  it('drops headings and turns em dashes into commas', () => {
    expect(cleanReply('## Picks\nThree spots — all in Midtown.')).toBe('Picks\nThree spots, all in Midtown.')
  })

  it('cuts a long reply at a sentence end', () => {
    const long = `${'This is a sentence. '.repeat(80)}`
    const out = cleanReply(long, 200)
    expect(out.length).toBeLessThanOrEqual(200)
    expect(out.endsWith('.')).toBe(true)
  })
})

describe('lastFullSentence', () => {
  it('keeps text up to the last full sentence', () => {
    expect(lastFullSentence('Here are two. The second one is ope')).toBe('Here are two.')
    expect(lastFullSentence('No end yet')).toBe('')
  })
})

describe('namesUnreturned', () => {
  const names = [
    { id: 'a', name: 'Peach Law Group' },
    { id: 'b', name: 'Nourish' },
    { id: 'c', name: 'Fresh' },
    { id: 'd', name: 'Atlanta' },
  ]
  const check = (text: string, allowed: string[] = [], skip: string[] = []) =>
    namesUnreturned({ text, names, allowedIds: new Set(allowed), skipNames: skip })

  it('flags a listed business no tool returned', () => {
    expect(check('You could try Peach Law Group downtown.')).toBe(true)
  })

  it('allows a business a tool returned this turn or last', () => {
    expect(check('You could try Peach Law Group downtown.', ['a'])).toBe(false)
  })

  it('reads one-word names only mid-sentence and six letters or longer', () => {
    expect(check('Nourish your weekend with a picnic.')).toBe(false)
    expect(check('You might like Nourish for lunch.')).toBe(true)
    expect(check('You might like fresh bread. Something Fresh too.')).toBe(false)
  })

  it('skips names that are also a city or category', () => {
    expect(check('There are three in Atlanta.', [], ['Atlanta'])).toBe(false)
  })

  it('matches whole words only', () => {
    expect(check('They are nourishing and kind.')).toBe(false)
  })
})

describe('checkReply', () => {
  const names = [{ id: 'a', name: 'Peach Law Group' }]
  const base = { names, allowedIds: new Set<string>(), skipNames: [] }

  it('swaps a made-up recommendation, keeping the cards line when there are cards', () => {
    expect(checkReply({ ...base, text: 'Try Peach Law Group.', hasCards: true })).toEqual({
      text: SWAP_WITH_CARDS,
      swapped: true,
    })
    expect(checkReply({ ...base, text: 'Try Peach Law Group.', hasCards: false }).text).toBe(SWAP_NO_CARDS)
  })

  it('swaps an ownership label next to cards', () => {
    expect(hasIdentityLabel('These Black-owned spots are great.')).toBe(true)
    expect(checkReply({ ...base, text: 'These Black-owned spots are great.', hasCards: true }).swapped).toBe(true)
  })

  it('swaps an ownership label with no cards for the fixed same-terms line', () => {
    const text = "I don't sort by owner. Every business is listed on the same terms, not as Black-owned or ally."
    expect(checkReply({ ...base, text, hasCards: false })).toEqual({ text: SWAP_SAME_TERMS, swapped: true })
    expect(hasIdentityLabel(SWAP_SAME_TERMS)).toBe(false)
  })

  it('lets Cue explain the same-terms rule in its own words when it names no label', () => {
    const text = "I don't sort by owner. Every business here is listed on the same terms."
    expect(checkReply({ ...base, text, hasCards: false })).toEqual({ text, swapped: false })
  })

  it('keeps an honest reply', () => {
    const text = 'Here are three law firms in Atlanta.'
    expect(checkReply({ ...base, text, hasCards: true })).toEqual({ text, swapped: false })
  })
})
