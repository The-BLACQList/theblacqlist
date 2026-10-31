/**
 * What the chat panel sends to /api/cue (ticket 169).
 *
 * Shared by the route and the browser, so no server imports. The route checks
 * every field again; nothing here is trusted because the client sent it.
 */

import { z } from 'zod'

import { ASSISTANT_PAGE_MAX } from '@/lib/ai/assistant-limits'
import { roundCoord } from '@/lib/listings/location-params'

/** Longest visitor message, as today. */
export const CUE_MESSAGE_MAX = 200
/** Turns of history sent back, newest kept. */
export const CUE_HISTORY_TURNS = 6
/** Characters of history sent back, all turns together. */
export const CUE_HISTORY_MAX_CHARS = 4000
/** Longest single turn the route accepts. Cue's replies are cut to 1200. */
export const CUE_TURN_MAX_CHARS = 1200
/** Cards from the last reply that a follow-up can point at. */
export const CUE_PRIOR_CARDS_MAX = 6

const turnSchema = z.strictObject({
  role: z.enum(['user', 'assistant']),
  text: z.string().max(CUE_TURN_MAX_CHARS),
})

const cardSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().max(200),
})

const nearSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/**
 * One visitor message. Up to twelve turns are accepted; the prompt builder
 * keeps the last six within 4000 characters. Near me is rounded here, on the
 * server, to about 110 m.
 */
export const cueAskSchema = z
  .strictObject({
    message: z.string().trim().min(1).max(CUE_MESSAGE_MAX),
    history: z.array(turnSchema).max(CUE_HISTORY_TURNS * 2).optional(),
    near: nearSchema.nullable().optional(),
    page: z.string().max(ASSISTANT_PAGE_MAX).nullable().optional(),
    cards: z.array(cardSchema).max(CUE_PRIOR_CARDS_MAX).optional(),
  })
  .transform(({ message, history, near, page, cards }) => ({
    message,
    history: history ?? [],
    near: near ? { lat: roundCoord(near.lat), lng: roundCoord(near.lng) } : null,
    page: page ?? null,
    cards: cards ?? [],
  }))

export type CueAskInput = z.input<typeof cueAskSchema>
export type CueAsk = z.output<typeof cueAskSchema>
