'use client'

import { forwardRef } from 'react'

import {
  CATEGORY_FAMILIES,
  LEVEL_COLORS,
  LEVEL_KEYS,
  FALLBACK_FAMILY_INDEX,
  GOLD,
  NOT_TRACKED_TEXT,
  SILO_FLOORS,
  businessDisplayName,
  floorSpokenLabel,
  floorValueText,
  formatDollars,
  type ColorBy,
  type SiloBusiness,
  type SiloFloor,
  type SiloGap,
} from '@/lib/spend/silo-layout'
import { LEVEL_META } from '@/lib/listings/levels'
import { FloorIcon } from './floor-icons'

/**
 * The HUD panels around the Collective (tickets 167 and 171): gauge,
 * legend, ticker, context card and key map. Presentational only;
 * SiloExperience owns state.
 */

// ─── Icons (round 17) ────────────────────────────────────────────────────────

const IC_X = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M5 5l14 14M19 5L5 19" />
  </svg>
)

const IC_GAP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2.5" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
)

const COLOR_ICONS: Record<ColorBy, React.ReactNode> = {
  category: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="8" r="3.4" fill="#86C95A" />
      <circle cx="16" cy="8" r="3.4" fill="#C08BFF" />
      <circle cx="8" cy="16" r="3.4" fill="#F08A4B" />
      <circle cx="16" cy="16" r="3.4" fill="#43C9B8" />
    </svg>
  ),
  level: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 5.5h16M6 10h12M8 14.5h8M10 19h4" />
    </svg>
  ),
  gold: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 6.8v10.4M14.6 9.4c-.5-.9-1.5-1.3-2.6-1.3-1.4 0-2.4.8-2.4 1.8 0 2.6 5.2 1.5 5.2 4.1 0 1-1 1.8-2.6 1.8-1.2 0-2.2-.5-2.7-1.4" />
    </svg>
  ),
}

const COLOR_LABELS: Record<ColorBy, string> = {
  category: 'Color by kind of business',
  level: 'Color by level',
  gold: 'Color all gold',
}

// ─── Gauge ───────────────────────────────────────────────────────────────────

interface GaugeProps {
  floors: readonly SiloFloor[]
  counts: readonly number[]
  /** Gaps per floor (round 17's pink squares). */
  gaps: readonly number[]
  currentFloor: number | null
  youFloors: ReadonlySet<number>
  onPick: (floor: number) => void
}

export function SiloGauge({ floors, counts, gaps, currentFloor, youFloors, onPick }: GaugeProps) {
  return (
    <nav className="gauge" aria-label="Floors">
      <ol>
        {floors.map((f) => {
          const g = gaps[f.index] ?? 0
          const gapText = g > 0 ? `, ${g} ${g === 1 ? 'gap' : 'gaps'}` : ''
          return (
            <li key={f.key}>
              <button
                type="button"
                className={`fl${youFloors.has(f.index) ? ' you' : ''}`}
                aria-current={currentFloor === f.index ? 'location' : undefined}
                aria-label={`${floorSpokenLabel(f, counts[f.index] ?? 0)}${gapText}`}
                onClick={() => onPick(f.index)}
              >
                <span className="ic" aria-hidden="true">
                  <FloorIcon floor={f.index} />
                  {g > 0 && <span className="gp">{g}</span>}
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

/** Gold paints every dot the same, so its key still filters by kind. */
export function legendItems(colorBy: ColorBy): LegendItem[] {
  if (colorBy === 'level') {
    return [...LEVEL_KEYS].reverse().map((k) => ({
      key: k,
      label: LEVEL_META[k].label,
      color: LEVEL_COLORS[k],
    }))
  }
  return CATEGORY_FAMILIES.map((f) => ({
    key: f.key,
    label: f.short,
    color: colorBy === 'gold' ? GOLD : f.color,
  }))
}

interface LegendProps {
  colorBy: ColorBy
  active: ReadonlySet<string>
  onToggle: (key: string) => void
  onColorBy: (value: ColorBy) => void
  /** Any gap on the map: show the pink Gap key. */
  hasGaps: boolean
  className?: string
}

export function SiloLegend({
  colorBy,
  active,
  onToggle,
  onColorBy,
  hasGaps,
  className = 'legend',
}: LegendProps) {
  const titleId = `silo-legend-title-${className}`
  return (
    <div className={className} role="group" aria-labelledby={titleId}>
      <div className="lg-row">
        <p className="legend-title" id={titleId}>
          {colorBy === 'level' ? 'Show levels' : 'Show kinds'}
        </p>
        <div className="seg cbseg" role="group" aria-label="Color dots by">
          {(['category', 'level', 'gold'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className="cb"
              aria-pressed={colorBy === v}
              aria-label={COLOR_LABELS[v]}
              title={COLOR_LABELS[v]}
              onClick={() => onColorBy(v)}
            >
              {COLOR_ICONS[v]}
            </button>
          ))}
        </div>
      </div>
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
        {hasGaps && (
          <span className="spot gap-key">
            <span className="gpk" aria-hidden="true" />
            Gap
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Ticker ──────────────────────────────────────────────────────────────────

export interface SiloTickerItem {
  id: string
  /** The business's public name (ticket 171b). */
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
  selectedGap: SiloGap | null
  focusFloor: SiloFloor | null
  floorCount: number
  /** The reader's own business, for the resting card. */
  you: SiloBusiness | null
  totalSpentCents: number
  onClear: () => void
}

/**
 * Round 17's card: what you picked, or a short note when nothing is picked.
 * No counts to step through (founder, 2026-10-31, ticket 171b).
 */
export function SiloCard({
  selected,
  selectedGap,
  focusFloor,
  floorCount,
  you,
  totalSpentCents,
  onClear,
}: CardProps) {
  const close = (
    <button
      type="button"
      className="card-x"
      aria-label="Clear selection"
      title="Clear (Esc)"
      onClick={onClear}
    >
      {IC_X}
    </button>
  )

  if (selected) {
    const fam = CATEGORY_FAMILIES[selected.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!
    const floor = SILO_FLOORS[selected.floorIndex]
    return (
      <aside className="ctx" aria-labelledby="silo-ctx-title">
        <div className="sel-head">
          <span className="ic" style={{ borderColor: fam.color }} aria-hidden="true">
            <span className="sel-dot" style={{ background: fam.color }} />
          </span>
          <div className="sel-txt">
            <b id="silo-ctx-title">
              {businessDisplayName(selected)}
              {selected.isYou && <span className="you-pill">You</span>}
            </b>
            <small>
              {fam.name} · {floor?.short}
            </small>
          </div>
          {close}
        </div>
        <p>
          {selected.linked
            ? `${formatDollars(selected.amountCents)} spent here, from ${selected.transactionCount} ${
                selected.transactionCount === 1 ? 'receipt' : 'receipts'
              }.`
            : 'Not enough receipts counted here yet to show a total.'}
          {selected.isYou && ' You have a counted receipt here.'}
        </p>
        {selected.href && (
          <p>
            <a href={selected.href}>Open the listing</a>
          </p>
        )}
      </aside>
    )
  }

  if (selectedGap) {
    const fam =
      CATEGORY_FAMILIES[selectedGap.familyIndex] ?? CATEGORY_FAMILIES[FALLBACK_FAMILY_INDEX]!
    const floor = SILO_FLOORS[selectedGap.floorIndex]
    return (
      <aside className="ctx" aria-labelledby="silo-ctx-title">
        <div className="sel-head">
          <span className="ic gap" aria-hidden="true">
            {IC_GAP}
          </span>
          <div className="sel-txt">
            <b id="silo-ctx-title">
              No {fam.noun} {floor?.short.toLowerCase()} yet
            </b>
            <small>
              {fam.name} · {floor?.short} floor
            </small>
          </div>
          {close}
        </div>
        <p>None on the list yet. A gap to fill.</p>
      </aside>
    )
  }

  if (focusFloor) {
    return (
      <aside className="ctx" aria-labelledby="silo-ctx-title">
        <div className="sel-head">
          <span className="ic" aria-hidden="true">
            <FloorIcon floor={focusFloor.index} />
          </span>
          <div className="sel-txt">
            <b id="silo-ctx-title">{focusFloor.short}</b>
            <small>Floor</small>
          </div>
          {close}
        </div>
        <p>
          {focusFloor.tracked
            ? `${formatDollars(totalSpentCents)} spent by shoppers with businesses on the list.`
            : `${floorCount} ${floorCount === 1 ? 'business' : 'businesses'} on this floor. Money they pass on: ${NOT_TRACKED_TEXT.toLowerCase()}.`}
        </p>
      </aside>
    )
  }

  if (you) {
    return (
      <aside className="ctx" aria-labelledby="silo-ctx-title">
        <p className="ctx-eyebrow">You</p>
        <h3 id="silo-ctx-title">Your receipts are in here</h3>
        <p>Find me shows the businesses where you have a counted receipt.</p>
      </aside>
    )
  }

  return (
    <aside className="ctx" aria-labelledby="silo-ctx-title">
      <p className="ctx-eyebrow">The Collective</p>
      <h3 id="silo-ctx-title">Where the money goes first</h3>
      <p>Pick a floor or a dot to look closer. Pink squares are gaps to fill.</p>
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
        <dd>Pause live activity</dd>
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
