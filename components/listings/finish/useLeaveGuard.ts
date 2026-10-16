'use client'

import { useEffect, useRef, type RefObject } from 'react'

interface LeaveGuardOptions {
  /** True when any card that joins the page-wide Save has changes. */
  cardsDirty: () => boolean
  /** An in-app link was stopped; show the leave pop-up for this href. */
  onBlock: (href: string) => void
}

/**
 * Stops an owner from leaving the finish view with edits they haven't saved
 * (tickets 129 and 140). Cards on the page-wide Save report through
 * cardsDirty. The instant list forms (services, links, FAQs) count as dirty
 * from their first input until they submit, so a half-typed item isn't lost.
 * In-app links open our pop-up; reload and close get the browser's own box,
 * and the back button can't be stopped from a page.
 */
export function useLeaveGuard(
  rootRef: RefObject<HTMLElement | null>,
  options: LeaveGuardOptions
): void {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const dirtyForms = new Set<HTMLFormElement>()

    const isDirty = () => {
      if (optionsRef.current.cardsDirty()) return true
      for (const form of dirtyForms) {
        if (form.isConnected) return true
        dirtyForms.delete(form)
      }
      return false
    }

    const mark = (e: Event) => {
      const t = e.target
      if (
        !(t instanceof HTMLInputElement) &&
        !(t instanceof HTMLTextAreaElement) &&
        !(t instanceof HTMLSelectElement)
      )
        return
      // Photos upload on pick, so a file input never holds unsaved work.
      if (t instanceof HTMLInputElement && t.type === 'file') return
      // Cards on the page-wide Save compare against their last save instead.
      if (!t.form || t.form.hasAttribute('data-profile-save')) return
      dirtyForms.add(t.form)
    }
    const clear = (e: Event) => {
      if (e.target instanceof HTMLFormElement) dirtyForms.delete(e.target)
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return
      e.preventDefault()
      e.returnValue = ''
    }

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return
      const link = (e.target as Element | null)?.closest?.('a[href]')
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      )
        return
      const to = new URL(link.href, window.location.href)
      if (to.origin !== window.location.origin) return
      // A jump to a section on this same page loses nothing.
      if (to.pathname === window.location.pathname && to.search === window.location.search) return
      if (!isDirty()) return
      e.preventDefault()
      e.stopPropagation()
      optionsRef.current.onBlock(to.pathname + to.search + to.hash)
    }

    root.addEventListener('input', mark)
    root.addEventListener('change', mark)
    root.addEventListener('submit', clear)
    window.addEventListener('beforeunload', onBeforeUnload)
    // Capture on document runs before Next's Link handler, so stopping it here
    // keeps the router from navigating.
    document.addEventListener('click', onClick, true)
    return () => {
      root.removeEventListener('input', mark)
      root.removeEventListener('change', mark)
      root.removeEventListener('submit', clear)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [rootRef])
}
