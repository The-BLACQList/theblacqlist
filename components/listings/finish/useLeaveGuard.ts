'use client'

import { useEffect, useRef, type RefObject } from 'react'

const LEAVE_MESSAGE = "You have changes that aren't saved. Leave this page anyway?"

/**
 * Warns before an owner leaves the finish view with edits they haven't saved
 * (ticket 129). Each section is its own form, so a form counts as dirty from
 * its first input until it submits. Covers reload, close and in-app links;
 * the browser back button can't be stopped from a page.
 */
export function useLeaveGuard(
  rootRef: RefObject<HTMLElement | null>,
  hasUnsavedDraft: boolean
): void {
  const draftRef = useRef(hasUnsavedDraft)
  useEffect(() => {
    draftRef.current = hasUnsavedDraft
  }, [hasUnsavedDraft])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const dirtyForms = new Set<HTMLFormElement>()

    const isDirty = () => {
      for (const form of dirtyForms) {
        if (form.isConnected) return true
        dirtyForms.delete(form)
      }
      return draftRef.current
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
      if (t.form) dirtyForms.add(t.form)
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
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    root.addEventListener('input', mark)
    root.addEventListener('change', mark)
    root.addEventListener('submit', clear)
    window.addEventListener('beforeunload', onBeforeUnload)
    // Capture on document runs before Next's Link handler, so a cancel stops it.
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
