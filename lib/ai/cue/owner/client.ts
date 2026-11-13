/**
 * The browser side of /api/cue/owner (ticket 203): sends one message and reads
 * the streamed events. Everything that comes back is checked again here; a
 * link must be a dashboard path, so a bad event can't send the owner off-site.
 */

import { z } from 'zod'

import { createCueParser } from '@/lib/ai/cue/stream'

import type { OwnerCueAskInput } from './ask'
import {
  OWNER_CUE_EVENT_TYPES,
  OWNER_DRAFT_KIND_IDS,
  type OwnerCueEvent,
  type OwnerDraft,
  type OwnerLink,
} from './events'

const draftSchema = z.strictObject({
  suggestionId: z.string().uuid(),
  kind: z.enum(OWNER_DRAFT_KIND_IDS as [string, ...string[]]),
  listingId: z.string().uuid(),
  pageName: z.string().max(200),
  text: z.string().max(4000),
  sample: z.boolean(),
})

const linksSchema = z
  .array(
    z.strictObject({
      label: z.string().min(1).max(200),
      href: z.string().regex(/^\/dashboard(\/[A-Za-z0-9_\-/]*)?(#[a-z-]+)?$/),
    })
  )
  .max(5)

export type OwnerCueReply =
  | { kind: 'reply'; text: string; drafts: OwnerDraft[]; links: OwnerLink[]; stopped?: boolean }
  | { kind: 'fallback'; reason: 'limited' | 'error' | 'auth' }

export interface OwnerCueProgress {
  status?: string
  text?: string
}

export async function streamOwnerCue(
  body: OwnerCueAskInput,
  options: { signal?: AbortSignal; onProgress?: (p: OwnerCueProgress) => void } = {}
): Promise<OwnerCueReply | null> {
  const failed: OwnerCueReply = { kind: 'fallback', reason: 'error' }
  const got = {
    text: '',
    finalText: null as string | null,
    drafts: [] as OwnerDraft[],
    links: [] as OwnerLink[],
    fallback: null as OwnerCueReply | null,
  }

  const handle = (event: OwnerCueEvent): void => {
    switch (event.type) {
      case 'status':
        if (typeof event.text === 'string') options.onProgress?.({ status: event.text })
        break
      case 'text':
        if (typeof event.text === 'string') {
          got.text += event.text
          options.onProgress?.({ text: got.text })
        }
        break
      case 'draft': {
        const parsed = draftSchema.safeParse(event.draft)
        if (parsed.success) got.drafts.push(parsed.data as OwnerDraft)
        break
      }
      case 'links': {
        const parsed = linksSchema.safeParse(event.links)
        if (parsed.success) got.links = parsed.data
        break
      }
      case 'done':
        got.finalText = typeof event.text === 'string' ? event.text : got.text
        break
      case 'fallback':
        got.fallback = {
          kind: 'fallback',
          reason: event.reason === 'limited' || event.reason === 'auth' ? event.reason : 'error',
        }
        break
    }
  }

  try {
    const res = await fetch('/api/cue/owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal,
    })
    if (!res.ok || !res.body) return failed
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const parser = createCueParser<OwnerCueEvent>(OWNER_CUE_EVENT_TYPES)
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of parser.push(decoder.decode(value, { stream: true }))) handle(event)
    }
    for (const event of parser.push(decoder.decode())) handle(event)
    for (const event of parser.end()) handle(event)
  } catch {
    if (options.signal?.aborted) {
      return got.text.trim()
        ? { kind: 'reply', text: got.text, drafts: [], links: [], stopped: true }
        : null
    }
    return failed
  }

  if (got.fallback) return got.fallback
  if (got.finalText === null) return failed
  return { kind: 'reply', text: got.finalText, drafts: got.drafts, links: got.links }
}
