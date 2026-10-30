'use client'

import { useEffect, useState } from 'react'
import { EMPTY_POST_JOB, type PostJobValues } from '@/lib/validations/postJob'

// Ticket 152: the draft survives a closed tab. Values, the step and the attempt id
// live in localStorage under one key and are cleared on success. The attempt id is
// the idempotency key: a retry after a dropped connection reuses the same listing.
// The saved copy is read once, outside React (see PostJobWizard), and passed in, so
// no effect has to push it into state.

export const DRAFT_KEY = 'draft-post-job'

export interface SavedDraft {
  values: PostJobValues
  step: number
  attemptId: string
}

/** Parse what localStorage holds. Null when absent, broken, or the wrong shape. */
export function parseSavedDraft(raw: string | null): SavedDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<SavedDraft> | null
    if (!d || typeof d !== 'object' || !d.values || typeof d.attemptId !== 'string' || !d.attemptId) return null
    return {
      values: { ...EMPTY_POST_JOB, ...d.values },
      step: Math.min(Math.max(Number(d.step) || 0, 0), 3),
      attemptId: d.attemptId,
    }
  } catch {
    return null
  }
}

export function usePostJobDraft(businessIds: string[], saved: SavedDraft | null) {
  const only = businessIds.length === 1 ? (businessIds[0] ?? '') : ''
  const [values, setValues] = useState<PostJobValues>(() => {
    if (!saved) return { ...EMPTY_POST_JOB, hiringListingId: only }
    // A saved business the user can no longer pick must not come back.
    const ok = saved.values.hiringListingId && businessIds.includes(saved.values.hiringListingId)
    return { ...saved.values, hiringListingId: ok ? saved.values.hiringListingId : only }
  })
  const [step, setStep] = useState(saved?.step ?? 0)
  const [attemptId] = useState(() => saved?.attemptId ?? crypto.randomUUID())

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ values, step, attemptId } satisfies SavedDraft))
    } catch {
      // Storage full or blocked: the form still works, it just will not be restored.
    }
  }, [values, step, attemptId])

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // ignore
    }
  }

  return { values, setValues, step, setStep, attemptId, clearDraft }
}
