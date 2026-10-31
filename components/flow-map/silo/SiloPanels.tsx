'use client'

import { forwardRef } from 'react'

import {
  CATEGORY_FAMILIES,
  LEVEL_COLORS,
  LEVEL_KEYS,
  NOT_TRACKED_TEXT,
  SILO_FLOORS,
  businessDisplayName,
  floorSpokenLabel,
  floorValueText,
  formatDollars,
  type SiloBusiness,
  type SiloFloor,
} from '@/lib/spend/silo-layout'
import { LEVEL_META } from '@/lib/listings/levels'
import { FloorIcon } from './floor-icons'

/**
 * The HUD panels around the Collective (tickets 167 and 171): gauge,
 * legend, ticker, context card and key map. Presentational only;
 * SiloExperience owns state.
 */

// ─── Gauge ───────────────────────────────────────────────────────────────────

interface GaugeProps {
  floors: readonly SiloFloor[]
  counts: readonly number[]
  currentFloor: number | null
  youFloors: ReadonlySet<number>
  onPick: (floor: number) => void
}

export function SiloGauge({ floors, counts, currentFloor, youFloors, onPick }: GaugeProps) {
  return (
    <nav className="gauge" aria-label="Floors">
      <ol>
        {floors.map((f) => {
          return (
            <li key={f.key}>
              <button
                type="button"
                className={`fl${youFloors.has(f.index) ? ' you' : ''}`}
                aria-current={currentFloor === f.index ? 'location' : undefined}
                aria-label={floorSpokenLabel(f, counts[f.index] ?? 0)}
                onClick={() => onPick(f.index)}
              >
                <span className="ic" aria-hidden="true">
                  <FloorIcon floor={f.index} />
                </span>
                <span className="nm" aria-hidden="true">
                  {f.short}
                  <span className="val">{floorValueText(f)}</span>
                </span>
                <span className="bars" aria-hidden="true">
                  <i style={{ width: `${Math.round(f.barShare * 100)}%` }} />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ─── Legend ──────────────────────────────────────────────────────────────────

export interface LegendItem {
  key: string
  label: string
  color: string
}

export function legendItems(colorBy: 'category' | 'level'): LegendItem[] {
  if (colorBy === 'level') {
    return [...LEVEL_KEYS].reverse().map((k) => ({
      key: k,
      label: LEVEL_META[k].label,
      color: LEVEL_COLORS[k],
    }))
  }
  return CATEGORY_FAMILIES.map((f) => ({ key: f.key, label: f.short, color: f.color }))
}

interface LegendProps {
  colorBy: 'category' | 'level'
  active: ReadonlySet<string>
  onToggle: (key: string) => void
  className?: string
}

export function SiloLegend({ colorBy, active, onToggle, className = 'legend' }: LegendProps) {
  const titleId = `silo-legend-title-${className}`
  return (
    <div className={className} role="group" aria-labelledby={titleId}>
      <p className="legend-title" id={titleId}>
        {colorBy === 'level' ? 'Show levels' : 'Show kinds'}
      </p>
      <div className={`legend-chips${active.size > 0 ? ' has-on' : ''}`}>
        {legendItems(colorBy).map((item) => (
          <button
            key={item.key}
            type="button"
            className="spot"
            aria-pressed={active.has(item.key)}
            onClick={() => onToggle(item.key)}
          >
            <span className="dot" style={{ background: item.color }} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Ticker ──────────────────────────────────────────────────────────────────

export interface SiloTickerItem {
  id: string
  /** "a food shop": the kind, never a name unless the business opted in. */
  label: string
  /** Day only, like "Oct 29". */
  when: string
}

export function SiloTicker({ items }: { items: readonly SiloTickerItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="ticker" aria-label="Latest receipts">
      <span className="live">Latest</span>
      <ul>
        {items.slice(0, 3).map((t) => (
          <li key={t.id}>
            A receipt at {t.label}, {t.when}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Context card ────────────────────────────────────────────────────────────

interface CardProps {
  selected: SiloBusiness | null
  focusFloor: SiloFloor | null
  floorCount: number
  total: number
  position: number
  /** Businesses with enough receipts behind them to show a total. */
  linkedCount: number
  /** A group in the key is switched on, so `total` is a filtered count. */
  filtered: boolean
  totalSpentCents: number
  onPrev: () => void
  onNext: () => void
}

export function SiloCard({
  selected,
  focusFloor,
  floorCount,
  total,
  position,
  linkedCount,
  filtered,
  totalSpentCents,
  onPrev,
  onNext,
}: CardProps) {
  let eyebrow = 'The Collective'
  let title = 'Where the money goes first'
  let body: React.ReactNode =
    total === 0
      ? filtered
        ? 'No businesses in these groups yet. Clear a group in the key to see more.'
        : 'No businesses on the map yet.'
      : linkedCount === 0
        ? `${total.toLocaleString('en-US')} ${total === 1 ? 'business' : 'businesses'} on the map. Lines appear once enough receipts are counted at a business.`
        : `${total.toLocaleString('en-US')} ${total === 1 ? 'business' : 'businesses'} on the map, ${linkedCount.toLocaleString('en-US')} with enough receipts to show what was spent. Pick a floor or a dot to look closer.`

  if (selected) {
    const fam = CATEGORY_FAMILIES[selected.familyIndex]
    const floor = SILO_FLOORS[selected.floorIndex]
    eyebrow = [fam?.name, floor?.short].filter(Boolean).join(', ')
    title = businessDisplayName(selected)
    body = (
      <>
        {selected.linked ? (
          <>
            {formatDollars(selected.amountCents)} spent here, from {selected.transactionCount}{' '}
            {selected.transactionCount === 1 ? 'receipt' : 'receipts'}.
          </>
        ) : (
          'Not enough receipts counted here yet to show a total.'
        )}
        {selected.isYou && ' You have a counted receipt here.'}
        {!selected.name && ' Its name stays hidden until the business chooses to show it.'}
        {selected.href && (
          <>
            {' '}
            <a href={selected.href}>Open the listing</a>
          </>
        )}
      </>
    )
  } else if (focusFloor) {
    eyebrow = 'Floor'
    title = focusFloor.short
    body = focusFloor.tracked
      ? `${formatDollars(totalSpentCents)} spent by shoppers with businesses on the list.`
      : `${floorCount} ${floorCount === 1 ? 'business' : 'businesses'} on this floor. Money they pass on: ${NOT_TRACKED_TEXT.toLowerCase()}.`
  }

  return (
    <aside className="ctx" aria-labelledby="silo-ctx-title">
      <p className="ctx-eyebrow">{eyebrow}</p>
      <h3 id="silo-ctx-title">
        {title}
        {selected?.isYou && <span className="you-pill">You</span>}
      </h3>
      <p>{body}</p>
      <div className="ctx-nav">
        <button
          type="button"
          onClick={onPrev}
          disabled={total === 0}
          aria-label="Previous business"
        >
          Prev
        </button>
        <span aria-hidden="true">{total === 0 ? '0 of 0' : `${position || '-'} of ${total}`}</span>
        <button type="button" onClick={onNext} disabled={total === 0} aria-label="Next business">
          Next
        </button>
      </div>
    </aside>
  )
}

// ─── Key map ─────────────────────────────────────────────────────────────────

interface KeyMapProps {
  shortcutsOn: boolean
  onShortcutsChange: (on: boolean) => void
  hasYou: boolean
}

export const SiloKeyMap = forwardRef<HTMLDivElement, KeyMapProps>(function SiloKeyMap(
  { shortcutsOn, onShortcutsChange, hasYou },
  ref
) {
  return (
    <div
      ref={ref}
      className="keymap"
      id="silo-keymap"
      role="region"
      aria-labelledby="silo-keymap-title"
    >
      <h3 id="silo-keymap-title">Keys</h3>
      <dl>
        <dt>
          <kbd>Drag</kbd>
        </dt>
        <dd>Turn the map</dd>
        {hasYou && (
          <>
            <dt>
              <kbd>Y</kbd>
            </dt>
            <dd>Find me</dd>
          </>
        )}
        <dt>
          <kbd>C</kbd>
        </dt>
        <dd>Color by</dd>
        <dt>
          <kbd>T</kbd>
        </dt>
        <dd>List or map</dd>
        <dt>
          <kbd>P</kbd>
        </dt>
        <dd>Pause motion</dd>
        <dt>
          <kbd>Esc</kbd>
        </dt>
        <dd>Back</dd>
      </dl>
      <ShortcutsToggle on={shortcutsOn} onChange={onShortcutsChange} />
    </div>
  )
})

export function ShortcutsToggle({
  on,
  onChange,
}: {
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="silo-check">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      Letter shortcuts on
    </label>
  )
}
