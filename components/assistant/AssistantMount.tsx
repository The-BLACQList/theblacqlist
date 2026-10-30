import { isFeatureEnabled } from '@/lib/env'
import { Assistant } from './Assistant'

// The site assistant's server-side gate (ticket 147). Mounted in the root
// layout, so it runs on every page: the flag check is all it costs when the
// assistant is off, and the client chunk is never referenced then. Which
// pages show it is decided on the client by lib/assistant/routes.ts, because
// the root layout does not know the path.
export function AssistantMount() {
  if (!isFeatureEnabled('aiAssistant')) return null
  return <Assistant />
}
