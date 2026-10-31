'use client'

import { useEffect, useRef } from 'react'
import { DRAFT_KEY } from '@/components/jobs/post/usePostJobDraft'

interface Props {
  children: React.ReactNode
  /** Clear the saved wizard draft: the poster has landed, so it is no longer needed. */
  clearDraft?: boolean
}

/** The page's one H1. Takes focus on load; optionally clears the wizard draft. */
export function PostedHeading({ children, clearDraft = false }: Props) {
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  useEffect(() => {
    if (!clearDraft) return
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // Storage blocked: nothing to clear.
    }
  }, [clearDraft])

  return (
    <h1 ref={ref} tabIndex={-1} className="font-headline text-3xl text-brand-black focus:outline-none">
      {children}
    </h1>
  )
}
