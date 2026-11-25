'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

import { markSiteTourSeenAction } from '@/lib/actions/site-tour/seen'
import { SITE_TOUR_START } from '@/lib/site-tour/signals'
import {
  decideOpening,
  earliest,
  readMemory,
  readRun,
  startFor,
  writeMemory,
  type SiteTourRun,
  type SiteTourStart,
} from '@/lib/site-tour/state'
import { countsAsVisit, isSiteTourHiddenPath } from '@/lib/site-tour/routes'
import type { SiteTourContext } from '@/lib/site-tour/steps'

// The tour itself loads only once something opens it, so it costs a page
// nothing until then.
const SiteTour = dynamic(() => import('./SiteTour'), { ssr: false })

export type SiteTourOpen =
  | { kind: 'welcome'; start: SiteTourStart }
  | { kind: 'prompt' }
  | { kind: 'resume'; run: SiteTourRun }

interface Props {
  signedIn: boolean
  accountSeenAt: string | null
  context: SiteTourContext
}

const STARTS: readonly SiteTourStart[] = ['home', 'for_business', 'prompt', 'menu', 'footer']

/** Run once the page has loaded and gone quiet. */
function whenIdle(run: () => void): () => void {
  let timer = 0
  let idle = 0
  const go = () => {
    if (typeof window.requestIdleCallback === 'function') {
      idle = window.requestIdleCallback(run, { timeout: 2000 })
    } else {
      timer = window.setTimeout(run, 300)
    }
  }
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
  return () => {
    window.removeEventListener('load', go)
    window.clearTimeout(timer)
    if (idle) window.cancelIdleCallback?.(idle)
  }
}

export function SiteTourLauncher({ signedIn, accountSeenAt, context }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState<(SiteTourOpen & { id: number }) | null>(null)
  const nextId = useRef(1)
  const running = open !== null

  // Keep the two dates together: the account keeps the earliest, and a device
  // that has never seen the tour learns it from the account.
  useEffect(() => {
    if (!signedIn) return
    const mine = readMemory()?.seenAt
    if (accountSeenAt && earliest(mine, accountSeenAt) !== mine) writeMemory({ seenAt: accountSeenAt })
    else if (mine && mine !== accountSeenAt) void markSiteTourSeenAction(mine)
  }, [signedIn, accountSeenAt])

  useEffect(() => {
    if (running) return
    if (isSiteTourHiddenPath(pathname)) {
      if (countsAsVisit(pathname)) {
        const memory = readMemory()
        if (memory && !memory.firstPath) writeMemory({ firstPath: pathname })
      }
      return
    }
    const launch = (next: SiteTourOpen) => setOpen({ ...next, id: nextId.current++ })
    return whenIdle(() => {
      // A link from a page the tour can't show on: /?tour=menu.
      const asked = new URLSearchParams(window.location.search).get('tour')
      if (asked && (STARTS as readonly string[]).includes(asked)) {
        const url = new URL(window.location.href)
        url.searchParams.delete('tour')
        window.history.replaceState(window.history.state, '', url)
        launch({ kind: 'welcome', start: asked as SiteTourStart })
        return
      }
      const run = readRun()
      if (run) {
        launch({ kind: 'resume', run })
        return
      }
      const memory = readMemory()
      const opening = decideOpening({ memory, accountSeenAt, pathname })
      if (memory && !memory.firstPath) writeMemory({ firstPath: pathname })
      if (opening === 'welcome') launch({ kind: 'welcome', start: startFor(pathname) ?? 'home' })
      if (opening === 'prompt') launch({ kind: 'prompt' })
    })
  }, [pathname, running, accountSeenAt])

  useEffect(() => {
    const onStart = (event: Event) => {
      const start = (event as CustomEvent<{ start: SiteTourStart }>).detail?.start ?? 'menu'
      setOpen({ kind: 'welcome', start, id: nextId.current++ })
    }
    window.addEventListener(SITE_TOUR_START, onStart)
    return () => window.removeEventListener(SITE_TOUR_START, onStart)
  }, [])

  if (!open) return null
  return (
    <SiteTour
      key={open.id}
      open={open}
      signedIn={signedIn}
      context={context}
      onClose={() => setOpen(null)}
    />
  )
}
