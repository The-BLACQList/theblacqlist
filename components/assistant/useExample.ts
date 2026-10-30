'use client'

import { useSyncExternalStore } from 'react'

import { EXAMPLE_ASKS, pickExample, pickExamples } from '@/lib/assistant/examples'

/*
 * Cue's example asks (ticket 148): picked once per page load in the browser.
 * The server, and the first render while the page hydrates, use the first
 * ones, so the HTML always matches.
 */

const SERVER_ONE: string = EXAMPLE_ASKS[0]
const SERVER_THREE: readonly string[] = EXAMPLE_ASKS.slice(0, 3)

let one: string | null = null
let three: readonly string[] | null = null

// The pick never changes after load, so there is nothing to subscribe to.
function subscribe(): () => void {
  return () => {}
}

/** One example, for placeholder text. */
export function useExample(): string {
  return useSyncExternalStore(
    subscribe,
    () => (one ??= pickExample()),
    () => SERVER_ONE
  )
}

/** Three different examples, for the empty Cue panel. */
export function useExamples(): readonly string[] {
  return useSyncExternalStore(
    subscribe,
    () => (three ??= pickExamples(3)),
    () => SERVER_THREE
  )
}
