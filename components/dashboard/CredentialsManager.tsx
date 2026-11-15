'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  deleteCredentialAction,
  reorderCredentialsAction,
  saveCredentialAction,
  type CredentialsState,
} from '@/lib/actions/dashboard/credentials'
import {
  CREDENTIAL_ISSUER_MAX,
  CREDENTIAL_KINDS,
  CREDENTIAL_KIND_LABEL,
  CREDENTIAL_TITLE_MAX,
  CREDENTIALS_SAVED_MAX,
  type CredentialKind,
  type OwnerCredential,
} from '@/lib/listings/credentials'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'

// Credentials, awards and press (ticket 192), the owner's side: the list in
// the page's order, with Edit, Move Up/Down and Remove, and one form for
// adding or editing an item.

interface Props {
  listingId: string
  initial: OwnerCredential[]
  /** The plan lets this page add items (Starter and up). */
  canAdd: boolean
  upgradeTo: UpgradeTarget
}

interface Draft {
  id: string | null
  kind: CredentialKind
  title: string
  issuer: string
  year: string
  url: string
}

const EMPTY: Draft = { id: null, kind: 'license', title: '', issuer: '', year: '', url: '' }

const INPUT =
  'w-full h-10 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'
const ICON_BUTTON =
  'inline-flex items-center justify-center size-8 rounded-full border border-charcoal/15 bg-white text-charcoal disabled:opacity-40'

function toDraft(c: OwnerCredential): Draft {
  return {
    id: c.id,
    kind: c.kind,
    title: c.title,
    issuer: c.issuer ?? '',
    year: c.year ? String(c.year) : '',
    url: c.url ?? '',
  }
}

export function CredentialsManager({ listingId, initial, canAdd, upgradeTo }: Props) {
  const [items, setItems] = useState(initial)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<CredentialsState>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if ('error' in result) {
        setError(result.error)
        return
      }
      setItems(result.items)
      after?.()
    })
  }

  function move(index: number, by: -1 | 1) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(index + by, 0, item)
    run(() => reorderCredentialsAction({ listingId, ids: next.map((c) => c.id) }))
  }

  const full = items.length >= CREDENTIALS_SAVED_MAX
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  return (
    <div className="space-y-6">
      {!canAdd && (
        <PlanLimitNote upgradeTo={upgradeTo}>
          Credentials and press come with Starter. Anything saved here stays, and shows again when
          your page is on Starter or higher.
        </PlanLimitNote>
      )}

      <section className="rounded-2xl border border-charcoal/10 bg-white p-5">
        {items.length === 0 ? (
          <p className="font-body text-sm text-charcoal">
            Nothing yet. Add a license, certification, award or press mention.
          </p>
        ) : (
          <ol className="divide-y divide-charcoal/10">
            {items.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-subhead text-sm font-semibold text-brand-black">{c.title}</p>
                  <p className="font-body text-xs text-charcoal-soft">
                    {[CREDENTIAL_KIND_LABEL[c.kind], c.issuer, c.year].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  disabled={isPending || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Move ${c.title} up`}
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  disabled={isPending || i === items.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move ${c.title} down`}
                >
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  disabled={isPending}
                  onClick={() => {
                    setError(null)
                    setDraft(toDraft(c))
                  }}
                  aria-label={`Edit ${c.title}`}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  disabled={isPending}
                  onClick={() =>
                    run(
                      () => deleteCredentialAction({ listingId, id: c.id }),
                      () => setDraft((d) => (d?.id === c.id ? null : d))
                    )
                  }
                  aria-label={`Remove ${c.title}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}

        {!draft && canAdd && !full && (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setDraft(EMPTY)
            }}
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black text-white font-subhead text-sm font-bold"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add an Item
          </button>
        )}
        {!draft && canAdd && full && (
          <p className="mt-4 font-body text-sm text-charcoal-soft">
            You have {CREDENTIALS_SAVED_MAX} items saved. Remove one to add another.
          </p>
        )}

        {draft && (
          <form
            className="mt-5 border-t border-charcoal/10 pt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault()
              const d = draft
              run(
                () =>
                  saveCredentialAction({
                    listingId,
                    ...(d.id ? { id: d.id } : {}),
                    kind: d.kind,
                    title: d.title,
                    issuer: d.issuer,
                    year: d.year,
                    url: d.url,
                  }),
                () => setDraft(null)
              )
            }}
          >
            <div>
              <label htmlFor="cred-kind" className={LABEL}>
                Kind
              </label>
              <select
                id="cred-kind"
                className={INPUT}
                value={draft.kind}
                onChange={(e) => set({ kind: e.target.value as CredentialKind })}
              >
                {CREDENTIAL_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {CREDENTIAL_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cred-year" className={LABEL}>
                Year (Optional)
              </label>
              <input
                id="cred-year"
                className={INPUT}
                inputMode="numeric"
                maxLength={4}
                placeholder="2024"
                value={draft.year}
                onChange={(e) => set({ year: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cred-title" className={LABEL}>
                Title
              </label>
              <input
                id="cred-title"
                className={INPUT}
                required
                maxLength={CREDENTIAL_TITLE_MAX}
                placeholder={
                  draft.kind === 'press' ? 'The headline or article name' : 'Licensed Master Barber'
                }
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cred-issuer" className={LABEL}>
                {draft.kind === 'press' ? 'Publication (Optional)' : 'Issued by (Optional)'}
              </label>
              <input
                id="cred-issuer"
                className={INPUT}
                maxLength={CREDENTIAL_ISSUER_MAX}
                value={draft.issuer}
                onChange={(e) => set({ issuer: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cred-url" className={LABEL}>
                Link (Optional)
              </label>
              <input
                id="cred-url"
                className={INPUT}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={draft.url}
                onChange={(e) => set({ url: e.target.value })}
              />
              <p className="mt-1 font-body text-xs text-charcoal-soft">
                Opens in a new tab. Text links only: no publication logos.
              </p>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black text-white font-subhead text-sm font-bold disabled:opacity-50"
              >
                {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {draft.id ? 'Save Changes' : 'Add Item'}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setError(null)
                  setDraft(null)
                }}
                className="inline-flex items-center h-9 px-4 rounded-full border border-charcoal/20 bg-white text-charcoal font-subhead text-sm font-bold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 font-body text-sm text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
