'use client'

import { useSyncExternalStore } from 'react'

/**
 * What this device can do for the Silo (ticket 167).
 *
 * - `pending`: not checked yet (server render and the first client paint).
 * - `ok`: WebGL works and the device isn't flagged as low power.
 * - `no-webgl`: no WebGL at all. The list is the only view.
 * - `low-power`: WebGL works, but the device is small or asked to save data.
 *   The list shows first and the reader can choose the map anyway.
 */
export type SiloSupport = 'pending' | 'ok' | 'no-webgl' | 'low-power'

interface NavigatorHints {
  hardwareConcurrency?: number
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

export function detectSiloSupport(): Exclude<SiloSupport, 'pending'> {
  let hasWebGL = false
  try {
    const canvas = document.createElement('canvas')
    hasWebGL = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    hasWebGL = false
  }
  if (!hasWebGL) return 'no-webgl'

  const nav = navigator as Navigator & NavigatorHints
  const fewCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2
  const littleMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2
  const saveData = nav.connection?.saveData === true
  return fewCores || littleMemory || saveData ? 'low-power' : 'ok'
}

// Checked once per page load: probing WebGL makes a throwaway context.
let detected: SiloSupport | null = null
const noSubscribe = () => () => {}

/** `pending` on the server and during hydration, then the real answer. */
export function useSiloSupport(): SiloSupport {
  return useSyncExternalStore(
    noSubscribe,
    () => (detected ??= detectSiloSupport()),
    () => 'pending'
  )
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeReduced(onChange: () => void): () => void {
  const mql = window.matchMedia(REDUCED_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** True when the reader asked the OS for less motion. False on the server. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  )
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

/** False while the tab is hidden, so the scene stops drawing. */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true
  )
}

/** localStorage key for the letter shortcuts toggle (WCAG 2.1.4). */
export const SHORTCUTS_STORAGE_KEY = 'silo-shortcuts'

export function readShortcutsOn(): boolean {
  try {
    return window.localStorage.getItem(SHORTCUTS_STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeShortcutsOn(on: boolean): void {
  try {
    window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Private windows can throw. The toggle still works for this visit.
  }
}
