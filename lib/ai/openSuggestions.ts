/**
 * Open suggestions from earlier visits, shown under their fields when Edit
 * content loads (ticket 138). An owner who asked for a draft, left, and came
 * back finds it where they left it instead of losing it.
 *
 * Only the newest pending or approved suggestion per field from the last 7
 * days. Older ones, used ones and ones the owner turned down stay out of the
 * way. Reads with the owner's own client: RLS lets owners read their listing's
 * suggestions, and the listing filter keeps it to this page.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { HelpAgent, InitialSuggestions } from './writingHelp'

const HELP_AGENTS: readonly HelpAgent[] = [
  'listing_description',
  'seo_coach_title',
  'seo_coach_description',
  'social_caption_instagram',
]

const WINDOW_DAYS = 7

interface Row {
  id: string
  agent_type: string
  suggestion_text: string
  metadata: unknown
}

function isHelpAgent(value: string): value is HelpAgent {
  return (HELP_AGENTS as readonly string[]).includes(value)
}

function isSample(metadata: unknown): boolean {
  return (
    metadata !== null &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).provider === 'mock'
  )
}

/** Keeps the first (newest) row per field. Pure, for tests. */
export function pickOpenSuggestions(rows: readonly Row[]): InitialSuggestions {
  const picked: InitialSuggestions = {}
  for (const row of rows) {
    if (!isHelpAgent(row.agent_type) || picked[row.agent_type]) continue
    if (!row.suggestion_text?.trim()) continue
    picked[row.agent_type] = {
      id: row.id,
      text: row.suggestion_text,
      sample: isSample(row.metadata),
    }
  }
  return picked
}

export async function loadOpenSuggestions(
  supabase: SupabaseClient,
  listingId: string
): Promise<InitialSuggestions> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('ai_suggestions')
    .select('id, agent_type, suggestion_text, metadata')
    .eq('listing_id', listingId)
    .in('status', ['pending', 'approved'])
    .in('agent_type', [...HELP_AGENTS])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20)

  // Nothing to show is a fine answer here: the fields still work and the owner
  // can ask again.
  if (error || !data) return {}
  return pickOpenSuggestions(data as Row[])
}
