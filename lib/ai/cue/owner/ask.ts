/**
 * What the dashboard panel sends to /api/cue/owner (ticket 203).
 *
 * Shared by the route and the browser, so no server imports. The route checks
 * every field again; a page id here is only a hint, and every tool checks the
 * caller owns the page before reading it.
 */

import { z } from 'zod'

import { CUE_HISTORY_TURNS, CUE_TURN_MAX_CHARS } from '@/lib/ai/cue/ask'

/** Longest owner message. Owners ask longer how-to questions than visitors. */
export const OWNER_CUE_MESSAGE_MAX = 300

const turnSchema = z.strictObject({
  role: z.enum(['user', 'assistant']),
  text: z.string().max(CUE_TURN_MAX_CHARS),
})

export const ownerCueAskSchema = z
  .strictObject({
    message: z.string().trim().min(1).max(OWNER_CUE_MESSAGE_MAX),
    history: z
      .array(turnSchema)
      .max(CUE_HISTORY_TURNS * 2)
      .optional(),
    listingId: z.string().uuid().nullable().optional(),
  })
  .transform(({ message, history, listingId }) => ({
    message,
    history: history ?? [],
    listingId: listingId ?? null,
  }))

export type OwnerCueAskInput = z.input<typeof ownerCueAskSchema>
export type OwnerCueAsk = z.output<typeof ownerCueAskSchema>
