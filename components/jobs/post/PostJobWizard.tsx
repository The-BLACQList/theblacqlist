'use client'

import { useSyncExternalStore } from 'react'
import type { JobPriceLine } from '@/lib/listings/jobPriceLine'
import type { CategoryOption } from '@/app/add-business/page'
import { PostJobWizardInner } from './PostJobWizardInner'
import { DRAFT_KEY, parseSavedDraft } from './usePostJobDraft'
import type { HiringBusiness } from './types'
import type { PostingReadiness } from '@/lib/jobs/postingReadiness'

interface Props {
  businesses: HiringBusiness[]
  categories: CategoryOption[]
  priceLine: JobPriceLine
  canceled?: boolean
  readiness?: PostingReadiness | null
}

const noopSubscribe = () => () => {}
const readSaved = (): string | null => {
  try {
    return localStorage.getItem(DRAFT_KEY)
  } catch {
    return null
  }
}

/**
 * Waits for the browser, reads the saved draft once, then mounts the real form
 * with it. The server render shows a skeleton so there is no mismatch.
 */
export function PostJobWizard(props: Props) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  if (!hydrated) {
    return <div className="h-64 rounded-xl bg-white/60 animate-pulse" aria-hidden="true" />
  }
  return <PostJobWizardInner {...props} saved={parseSavedDraft(readSaved())} />
}
