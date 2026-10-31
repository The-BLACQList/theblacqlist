// =============================================================================
// Cue's event stream (ticket 169)
// =============================================================================
// Events go out as one JSON object per line. The reader must cope with the
// network splitting a line anywhere, and skip anything it doesn't know.
// =============================================================================

import { describe, expect, it } from 'vitest'

import { createCueParser, encodeCueEvent, type CueEvent } from '@/lib/ai/cue/stream'

const EVENTS: CueEvent[] = [
  { type: 'status', text: 'Searching Atlanta for lawyers' },
  { type: 'text', text: 'Here are ' },
  { type: 'text', text: 'two firms.\nBoth are "downtown".' },
  { type: 'actions', actions: [{ kind: 'scroll', ids: ['plans'], label: 'See the plans' }] },
  { type: 'done', text: 'Here are two firms.' },
]

describe('Cue event stream', () => {
  it('reads every event back whole, one line each', () => {
    const wire = EVENTS.map(encodeCueEvent).join('')
    expect(wire.split('\n').length - 1).toBe(EVENTS.length)
    const parser = createCueParser()
    expect([...parser.push(wire), ...parser.end()]).toEqual(EVENTS)
  })

  it('handles any split, down to one character at a time', () => {
    const wire = EVENTS.map(encodeCueEvent).join('')
    for (const size of [1, 3, 7, 50]) {
      const parser = createCueParser()
      const out: CueEvent[] = []
      for (let i = 0; i < wire.length; i += size) out.push(...parser.push(wire.slice(i, i + size)))
      out.push(...parser.end())
      expect(out).toEqual(EVENTS)
    }
  })

  it('reads a last line with no newline at the end', () => {
    const parser = createCueParser()
    expect(parser.push('{"type":"done","text":"Hi."}')).toEqual([])
    expect(parser.end()).toEqual([{ type: 'done', text: 'Hi.' }])
  })

  it('skips bad JSON and unknown event types', () => {
    const parser = createCueParser()
    const out = parser.push('not json\n{"type":"secret","x":1}\n[1,2]\n{"type":"status","text":"ok"}\n')
    expect(out).toEqual([{ type: 'status', text: 'ok' }])
  })
})
