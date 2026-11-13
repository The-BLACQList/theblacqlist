'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  deleteStockistAction,
  moveStockistAction,
  saveStockistAction,
  type StockistsState,
} from '@/lib/actions/dashboard/whereSold'
import {
  STOCKISTS_MAX,
  STOCKIST_AREAS_MAX,
  STORE_NAME_MAX,
  parseCity,
  parseZip,
  stockistAreaLabel,
  type RetailChain,
  type Stockist,
} from '@/lib/listings/whereSold'

// "Find us at" (owner-experience round 2, part D), on the edit page's "Where
// to find us" tab: the stores that carry the business's products. Pick a chain
// from the list or type any store name, then add the cities and zips where it
// carries them, or mark it nationwide. Each change saves on its own and the
// list comes back from the server as saved.

interface Props {
  listingId: string
  initial: Stockist[]
  chains: RetailChain[]
}

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'

export function WhereToFindSection({ listingId, initial, chains }: Props) {
  const [stockists, setStockists] = useState(initial)
  const [editing, setEditing] = useState<Stockist | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [rowError, setRowError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const full = stockists.length >= STOCKISTS_MAX

  function apply(result: StockistsState): boolean {
    if ('error' in result) return false
    setStockists(result.stockists)
    return true
  }

  function onSaved(result: StockistsState) {
    apply(result)
    setEditing(null)
    setFormKey((k) => k + 1)
  }

  function rowAction(id: string, run: () => Promise<StockistsState>) {
    setRowError(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await run()
      if (!apply(result) && 'error' in result) setRowError(result.error)
      if (editing?.id === id && 'success' in result && !result.stockists.some((s) => s.id === id)) {
        setEditing(null)
      }
      setBusyId(null)
    })
  }

  return (
    <section className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-base text-brand-black">
            {editing ? `Edit ${editing.name}` : 'Find us at'}
          </h2>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            Stores that carry your products. Your page lists them, and customers can search Discover
            by their zip.
          </p>
        </div>
        {editing && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex items-center gap-1 font-subhead text-xs font-semibold text-charcoal-soft hover:text-brand-black"
          >
            <X className="size-3.5" aria-hidden="true" />
            Cancel
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {full && !editing ? (
          <p className="font-body text-sm text-charcoal-soft">
            You’ve listed {STOCKISTS_MAX} stores, the most a page can show. Remove one to add
            another.
          </p>
        ) : (
          <StockistForm
            key={editing ? `edit-${editing.id}` : `new-${formKey}`}
            listingId={listingId}
            chains={chains}
            editing={editing}
            onSaved={onSaved}
          />
        )}
      </div>

      {stockists.length > 0 && (
        <div className="border-t border-charcoal/8">
          <p className="px-5 pt-4 font-subhead text-xs font-semibold text-charcoal-soft">
            Your stores ({stockists.length} of {STOCKISTS_MAX})
          </p>
          {rowError && (
            <p role="alert" className="mx-5 mt-2 font-body text-sm text-red-700">
              {rowError}
            </p>
          )}
          <ul className="divide-y divide-charcoal/8">
            {stockists.map((s, i) => (
              <li key={s.id} className="flex gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-subhead text-sm font-semibold text-brand-black break-words">
                    {s.name}
                  </p>
                  <p className="font-body text-xs text-charcoal-soft break-words">
                    {stockistAreaLabel(s)}
                  </p>
                </div>
                <div className="flex shrink-0 items-start gap-1">
                  <IconButton
                    label={`Move ${s.name} up`}
                    disabled={i === 0 || busyId !== null}
                    onClick={() =>
                      rowAction(s.id, () =>
                        moveStockistAction({ listingId, id: s.id, direction: 'up' })
                      )
                    }
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Move ${s.name} down`}
                    disabled={i === stockists.length - 1 || busyId !== null}
                    onClick={() =>
                      rowAction(s.id, () =>
                        moveStockistAction({ listingId, id: s.id, direction: 'down' })
                      )
                    }
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Edit ${s.name}`}
                    disabled={busyId !== null}
                    onClick={() => setEditing(s)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Remove ${s.name}`}
                    danger
                    disabled={busyId !== null}
                    onClick={() => {
                      if (!window.confirm(`Remove ${s.name} from your page?`)) return
                      rowAction(s.id, () => deleteStockistAction({ listingId, id: s.id }))
                    }}
                  >
                    {busyId === s.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="size-4" aria-hidden="true" />
                    )}
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** Splits what was typed or pasted into entries: new lines and semicolons, or commas between zips. */
function splitEntries(text: string): string[] {
  return text
    .split(/[\n;]+/)
    .flatMap((part) => (/^[\d\s,-]+$/.test(part) ? part.split(/[\s,]+/) : [part]))
    .map((p) => p.trim())
    .filter(Boolean)
}

function StockistForm({
  listingId,
  chains,
  editing,
  onSaved,
}: {
  listingId: string
  chains: RetailChain[]
  editing: Stockist | null
  onSaved: (result: StockistsState) => void
}) {
  const [store, setStore] = useState(editing?.name ?? '')
  const [nationwide, setNationwide] = useState(editing?.nationwide ?? false)
  const [areas, setAreas] = useState<string[]>(editing ? [...editing.cities, ...editing.zips] : [])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const listId = `chains-${listingId}`
  const areaId = `stockist-area-${listingId}`

  /** Adds what is in the box. Returns the list as it is now, for a save straight after. */
  function addDraft(): string[] | null {
    const entries = splitEntries(draft)
    if (entries.length === 0) return areas
    const next = [...areas]
    for (const entry of entries) {
      const value = parseZip(entry) ?? parseCity(entry)
      if (!value) {
        setError(`“${entry.slice(0, 40)}” isn’t a zip or a city. Use 30318 or Atlanta, GA.`)
        return null
      }
      if (!next.some((a) => a.toLowerCase() === value.toLowerCase())) next.push(value)
    }
    if (next.length > STOCKIST_AREAS_MAX) {
      setError(`Add up to ${STOCKIST_AREAS_MAX} cities and zips for one store.`)
      return null
    }
    setError(null)
    setAreas(next)
    setDraft('')
    return next
  }

  function save() {
    const list = addDraft()
    if (!list) return
    setError(null)
    startTransition(async () => {
      const result = await saveStockistAction({
        listingId,
        id: editing?.id,
        store,
        nationwide,
        areas: list,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      onSaved(result)
    })
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div>
        <label htmlFor={`stockist-store-${listingId}`} className={LABEL}>
          Store
        </label>
        <input
          id={`stockist-store-${listingId}`}
          type="text"
          list={listId}
          maxLength={STORE_NAME_MAX}
          autoComplete="off"
          placeholder="Whole Foods Market, or your local shop’s name"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          className={INPUT}
        />
        <datalist id={listId}>
          {chains.map((c) => (
            <option key={c.slug} value={c.name} />
          ))}
        </datalist>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={nationwide}
          onChange={(e) => setNationwide(e.target.checked)}
          className="mt-0.5 accent-brand-black"
        />
        <span className="font-subhead text-sm font-semibold text-brand-black">
          Sold at this store nationwide
        </span>
      </label>

      {!nationwide && (
        <div>
          <label htmlFor={areaId} className={LABEL}>
            Cities and zips where it’s sold
          </label>
          <div className="flex gap-2">
            <input
              id={areaId}
              type="text"
              autoComplete="off"
              placeholder="30318, or Atlanta, GA"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDraft()
                }
              }}
              className={INPUT}
            />
            <button
              type="button"
              onClick={() => addDraft()}
              className="inline-flex shrink-0 items-center gap-1 h-10 px-4 rounded-full border border-charcoal/20 font-subhead text-sm font-semibold text-brand-black hover:bg-charcoal/5"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add
            </button>
          </div>
          <p className="mt-1 font-body text-xs text-charcoal-faint">
            One at a time, or paste a list of zips.
          </p>
          {areas.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Cities and zips added">
              {areas.map((a) => (
                <li
                  key={a}
                  className="inline-flex items-center gap-1 rounded-full bg-charcoal/8 py-1 pl-3 pr-1 font-body text-xs text-brand-black"
                >
                  {a}
                  <button
                    type="button"
                    aria-label={`Remove ${a}`}
                    onClick={() => setAreas((prev) => prev.filter((x) => x !== a))}
                    className="inline-flex size-5 items-center justify-center rounded-full text-charcoal-soft hover:bg-charcoal/10 hover:text-brand-black"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="font-body text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending || !store.trim()}
        className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-brand-black text-white font-subhead text-sm font-bold hover:bg-charcoal disabled:opacity-60"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {editing ? 'Save store' : 'Add store'}
      </button>
    </form>
  )
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-8 items-center justify-center rounded-full text-charcoal-soft disabled:opacity-40 ${
        danger ? 'hover:bg-red-50 hover:text-red-700' : 'hover:bg-charcoal/5 hover:text-brand-black'
      }`}
    >
      {children}
    </button>
  )
}
