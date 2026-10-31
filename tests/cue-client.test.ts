import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { encodeCueEvent, type CueEvent } from '@/lib/ai/cue/stream'
import { streamCue } from '@/lib/assistant/ask'
import { inlineParts, parseCueText, plainCueText } from '@/components/assistant/CueText'

// Ticket 169: the browser side of Cue. How the reply text is read, and how
// streamCue turns the event stream into a finished reply.

describe('parseCueText', () => {
  it('splits paragraphs on blank lines and joins wrapped lines', () => {
    expect(parseCueText('Here are two.\nBoth in Atlanta.\n\nWant more?')).toEqual([
      { type: 'p', text: 'Here are two. Both in Atlanta.' },
      { type: 'p', text: 'Want more?' },
    ])
  })

  it('reads bullet and numbered lists', () => {
    expect(parseCueText('Try these:\n- A DJ\n- A cake\n\n1. Book\n2. Confirm')).toEqual([
      { type: 'p', text: 'Try these:' },
      { type: 'ul', items: ['A DJ', 'A cake'] },
      { type: 'ol', items: ['Book', 'Confirm'] },
    ])
  })

  it('reads nothing as HTML', () => {
    expect(parseCueText('<b>hi</b>')).toEqual([{ type: 'p', text: '<b>hi</b>' }])
  })
})

describe('inlineParts', () => {
  it('bolds closed pairs', () => {
    expect(inlineParts('Two **law firms** here')).toEqual([
      { bold: false, text: 'Two ' },
      { bold: true, text: 'law firms' },
      { bold: false, text: ' here' },
    ])
  })

  it('leaves an unclosed pair plain while it streams', () => {
    expect(inlineParts('Two **law fi')).toEqual([
      { bold: false, text: 'Two ' },
      { bold: false, text: 'law fi' },
    ])
  })
})

describe('plainCueText', () => {
  it('flattens blocks and drops the marks', () => {
    expect(plainCueText('Found **2**:\n- A\n- B')).toBe('Found 2: A B')
  })
})

// ─── streamCue ───────────────────────────────────────────────────────────────

const card = {
  id: 'c1',
  name: 'Peach State Law',
  href: '/atlanta/business/peach-state-law',
  categoryName: 'Legal services',
  cityLabel: 'Atlanta, GA',
  rating: null,
  reviewCount: 0,
  imageSrc: null,
}

/** A response whose body arrives in the given raw chunks. */
function streamed(chunks: string[]): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(enc.encode(chunk))
      c.close()
    },
  })
  return new Response(body, { status: 200 })
}

function lines(events: CueEvent[]): string {
  return events.map(encodeCueEvent).join('')
}

/** One text event, then the body stays open until the request is aborted. */
function hangsAfter(events: CueEvent[], signal: AbortSignal): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode(lines(events)))
      signal.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError')))
    },
  })
  return new Response(body, { status: 200 })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('window', { location: { pathname: '/', search: '' } })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('streamCue', () => {
  it('reads events split across chunks and returns the checked text', async () => {
    const raw = lines([
      { type: 'status', text: 'Searching Atlanta for lawyers' },
      { type: 'text', text: 'Here is ' },
      { type: 'text', text: 'one.' },
      { type: 'cards', cards: [card] },
      { type: 'actions', actions: [] },
      { type: 'done', text: 'Here is one law firm.' },
    ])
    fetchMock.mockResolvedValue(streamed([raw.slice(0, 17), raw.slice(17, 90), raw.slice(90)]))
    const progress: string[] = []

    const reply = await streamCue('lawyer in atlanta', { turns: [], onProgress: (p) => progress.push(p.text) })

    expect(reply).toEqual({ kind: 'reply', text: 'Here is one law firm.', cards: [card], actions: [], near: false })
    expect(progress).toEqual(['Searching Atlanta for lawyers', 'Here is ', 'Here is one.'])
  })

  it('sends the page and an empty history, never a position it was not given', async () => {
    fetchMock.mockResolvedValue(streamed([lines([{ type: 'done', text: 'ok' }])]))
    await streamCue('lawyer in atlanta', { turns: [] })
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>
    expect(body).toEqual({ message: 'lawyer in atlanta', history: [], cards: [], page: '/', near: null })
  })

  it('passes a server fallback through', async () => {
    fetchMock.mockResolvedValue(
      streamed([lines([{ type: 'fallback', href: '/search?q=lawyer', reason: 'limited' }])])
    )
    expect(await streamCue('lawyer', { turns: [] })).toEqual({
      kind: 'fallback',
      href: '/search?q=lawyer',
      reason: 'limited',
    })
  })

  it('falls back to plain search on a bad status', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }))
    expect(await streamCue('lawyer', { turns: [] })).toMatchObject({ kind: 'fallback', reason: 'error' })
  })

  it('falls back when the stream ends without done', async () => {
    fetchMock.mockResolvedValue(streamed([lines([{ type: 'text', text: 'Here is' }])]))
    expect(await streamCue('lawyer', { turns: [] })).toMatchObject({ kind: 'fallback', reason: 'error' })
  })

  it('falls back on a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    expect(await streamCue('lawyer', { turns: [] })).toMatchObject({ kind: 'fallback', reason: 'error' })
  })

  it('ignores cards that fail the shape check', async () => {
    fetchMock.mockResolvedValue(
      streamed([
        lines([
          { type: 'cards', cards: [{ ...card, href: 'https://evil.example' }] },
          { type: 'done', text: 'ok' },
        ]),
      ])
    )
    expect(await streamCue('lawyer', { turns: [] })).toMatchObject({ kind: 'reply', cards: [] })
  })

  it('keeps the words so far when stopped', async () => {
    const stop = new AbortController()
    fetchMock.mockImplementation(async () => hangsAfter([{ type: 'text', text: 'Here are two' }], stop.signal))

    const reply = await streamCue('lawyer', {
      turns: [],
      signal: stop.signal,
      onProgress: (p) => {
        if (p.type === 'text') stop.abort()
      },
    })

    expect(reply).toEqual({ kind: 'reply', text: 'Here are two', cards: [], actions: [], near: false, stopped: true })
  })

  it('returns null when stopped before any words', async () => {
    const stop = new AbortController()
    fetchMock.mockImplementation(async () => hangsAfter([{ type: 'status', text: 'Searching' }], stop.signal))

    const reply = await streamCue('lawyer', {
      turns: [],
      signal: stop.signal,
      onProgress: () => stop.abort(),
    })

    expect(reply).toBeNull()
  })
})
