'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * On a live page every section save goes straight to the public page, so the
 * finish view says so on the button (ticket 129). Sections used outside the
 * finish view (event and job editors) have no provider and keep their label.
 */
const LiveContext = createContext(false)

export function SaveLabelProvider({ live, children }: { live: boolean; children: ReactNode }) {
  return <LiveContext.Provider value={live}>{children}</LiveContext.Provider>
}

export function useSaveLabel(base: string = 'Save'): string {
  return useContext(LiveContext) ? 'Save and publish' : base
}
