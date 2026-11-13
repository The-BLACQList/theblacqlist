import type { TeamMember } from '@/types'

/** Founders first, everyone else in the order given (a stable partition). */
export function founderFirst(team: readonly TeamMember[]): TeamMember[] {
  return [...team.filter((m) => m.isFounder), ...team.filter((m) => !m.isFounder)]
}

const MAX_QUOTE_CHARS = 140

/**
 * The founder card's pull quote is the bio's first sentence, when it is short
 * enough to read as one line; the rest of the bio follows as the paragraph.
 * A bio with one sentence is all quote; a long first sentence is all paragraph.
 */
export function splitFounderBio(bio: string | null): { quote: string | null; rest: string | null } {
  const text = bio?.trim() ?? ''
  if (!text) return { quote: null, rest: null }
  const [first = '', ...others] = text.split(/(?<=[.!?])\s+/)
  if (first.length > MAX_QUOTE_CHARS) return { quote: null, rest: text }
  const rest = others.join(' ').trim()
  return { quote: first.replace(/[.]$/, ''), rest: rest || null }
}
