'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { copyToClipboard } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

interface Props {
  email: string
  /** The element holding the visible email, selected when the clipboard is refused. */
  selectTargetId?: string
  className?: string
}

function selectText(id: string | undefined) {
  const el = id ? document.getElementById(id) : null
  if (!el) return
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/**
 * Copies the apply email. If the browser refuses, the visible email is selected
 * so a long-press or Cmd+C finishes the job. "Copied" is announced and the label
 * returns after 2 seconds.
 */
export function CopyEmailButton({ email, selectTargetId, className }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  async function onClick() {
    const result = await copyToClipboard(email)
    if (result === 'failed') selectText(selectTargetId)
    setState(result === 'copied' ? 'copied' : 'selected')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2000)
  }

  const label = state === 'copied' ? 'Copied' : state === 'selected' ? 'Selected, press copy' : 'Copy email'

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-amber-gold text-brand-black font-subhead text-sm font-bold hover:bg-amber-gold/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-black transition-colors',
          className
        )}
      >
        {state === 'copied' ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === 'copied' ? 'Email copied' : state === 'selected' ? 'Email selected. Copy it now.' : ''}
      </span>
    </>
  )
}
