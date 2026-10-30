import { askAssistant } from '@/lib/actions/ai/assistant'
import { ASSISTANT_PAGE_MAX, type AssistantResponse } from '@/lib/ai/assistant-limits'
import { fallbackHref } from '@/lib/ai/guide-limits'
import { getNearPoint, wantsNearMe, type NearPoint } from './near'
import { getAssistantState, historyFor, lastWasNear, previousFor, type AssistantTurn } from './store'

/** The page the visitor is on, as a path with its query. Only this is sent. */
function currentPage(): string {
  return (window.location.pathname + window.location.search).slice(0, ASSISTANT_PAGE_MAX)
}

interface AskCueOptions {
  /** The turns to follow on from. Defaults to this tab's chat. */
  turns?: readonly AssistantTurn[]
  /** A position the caller already has, such as the Near me chip. */
  near?: NearPoint | null
}

/**
 * The visitor's next ask, with what makes a follow-up make sense: the last few
 * asks, the last answer's needs, the page they're on, and their location when
 * they asked for Near me now or the last answer used it.
 */
export async function askCue(words: string, options: AskCueOptions = {}): Promise<AssistantResponse> {
  const turns = options.turns ?? getAssistantState().turns
  const near =
    options.near ?? (wantsNearMe(words) || lastWasNear(turns) ? await getNearPoint() : null)
  try {
    return await askAssistant({
      message: words,
      history: historyFor(turns),
      previous: previousFor(turns),
      page: currentPage(),
      near,
    })
  } catch {
    return { kind: 'fallback', href: fallbackHref(words), reason: 'error' }
  }
}
