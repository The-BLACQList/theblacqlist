'use client'

import { Component, type ReactNode } from 'react'

import { FlowNodeTable } from '@/components/flow-map/FlowNodeTable'
import { businessDisplayName, type SiloBusiness } from '@/lib/spend/silo-layout'

/**
 * The Silo as a list (ticket 167). The fallback when the map can't draw
 * (no WebGL, low power, lost context, chunk failed) and the "Explore as a
 * list" view. Same numbers as the map, and the same naming rule: a business
 * that hasn't opted in shows as its kind, never its name.
 */

export interface SiloCityRow {
  entity_id: string
  name: string
  total_amount_cents: number
  transaction_count: number
}

interface Props {
  businesses: readonly SiloBusiness[]
  cities: readonly SiloCityRow[]
  /** Why the list is showing, in plain words. */
  note: string | null
  /** A way back to the map, when there is one. */
  action?: ReactNode
}

export function SiloList({ businesses, cities, note, action }: Props) {
  const businessRows = businesses.map((b) => ({
    entity_id: b.id,
    name: b.isYou ? `${businessDisplayName(b)} (you shopped here)` : businessDisplayName(b),
    href: b.href,
    total_amount_cents: b.amountCents,
    transaction_count: b.transactionCount,
  }))

  return (
    <div className="silo-stage-list" id="silo-list">
      <div className="silo-stage-list-inner">
        {(note || action) && (
          <div>
            {note && <p className="silo-note">{note}</p>}
            {action && <div style={{ marginTop: 10 }}>{action}</div>}
          </div>
        )}
        <FlowNodeTable
          nodes={businessRows}
          title="Businesses, by money spent"
          linkToEntity
          emptyText="No businesses have cleared the privacy floor yet."
        />
        {cities.length > 0 && (
          <FlowNodeTable nodes={[...cities]} title="Top cities" emptyText="No cities yet." />
        )}
      </div>
    </div>
  )
}

/** Catches a scene that throws while drawing. The parent shows the list. */
export class SceneBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
