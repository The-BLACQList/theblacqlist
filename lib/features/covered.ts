// Server-side read of which opening-soon features are still covered (ticket 122).
// Kept apart from opening-soon.ts so that file stays pure data that a client
// component could import; flags are server-only (lib/env.ts).

import { isFeatureEnabled } from '@/lib/env'
import { SOON_FEATURES, type SoonFeature } from '@/lib/features/opening-soon'

export function isCovered(feature: SoonFeature): boolean {
  return !isFeatureEnabled(SOON_FEATURES[feature].flag)
}
