'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

/**
 * The More sheet (ticket 167, a11y fix 1). A real modal: focus moves in,
 * Tab stays inside, everything else on the page is inert while it's open,
 * and Esc or Close returns focus to the More button.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Marks every sibling on the way up to <body> inert. Returns the undo. */
function makeRestInert(node: HTMLElement): () => void {
  const changed: HTMLElement[] = []
  let el: HTMLElement | null = node
  while (el && el !== document.body) {
    const parent: HTMLElement | null = el.parentElement
    if (!parent) break
    for (const sib of Array.from(parent.children)) {
      if (sib === el || !(sib instanceof HTMLElement) || sib.inert) continue
      sib.inert = true
      changed.push(sib)
    }
    el = parent
  }
  return () => changed.forEach((s) => (s.inert = false))
}

interface Props {
  open: boolean
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
  children: ReactNode
}

export function SiloMore({ open, onClose, returnFocusRef, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const root = rootRef.current
    const panel = panelRef.current
    if (!root || !panel) return
    const undoInert = makeRestInert(root)
    const first = panel.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel).focus()
    const returnTo = returnFocusRef.current
    return () => {
      undoInert()
      returnTo?.focus()
    }
  }, [open, returnFocusRef])

  if (!open) return null

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (n) => n.offsetParent !== null
    )
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={rootRef}
      className="more"
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="more-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="silo-more-title"
        tabIndex={-1}
      >
        <div className="more-head">
          <h3 id="silo-more-title">More</h3>
          <button type="button" className="more-close" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
