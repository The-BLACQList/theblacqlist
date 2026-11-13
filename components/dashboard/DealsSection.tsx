'use client'

import { useState, useTransition } from 'react'
import { EyeOff, Loader2, Pencil, Square, Trash2, X } from 'lucide-react'
import {
  deleteDealAction,
  endDealAction,
  saveDealAction,
  type DealsState,
} from '@/lib/actions/dashboard/deals'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import {
  DEALS_ON_MAX,
  DEAL_CODE_MAX,
  DEAL_DESCRIPTION_MAX,
  DEAL_TERMS_MAX,
  DEAL_TITLE_MAX,
  dealEndsLabel,
  dealIsOn,
  dealState,
  dealsAllowed,
  shownDeals,
  type DealState,
  type OwnerDeal,
} from '@/lib/listings/deals'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'

// Coupons and deals (owner-experience round 2, part G), on the edit page's
// Services tab. Premium pages add deals; every other plan sees the upgrade
// note, and can still end or delete deals saved while on Premium. Each change
// saves on its own and the list comes back from the server as saved.

interface Props {
  listingId: string
  initial: OwnerDeal[]
  tier: string | null
  /** 'Premium' while it can be bought and the page is below it, else null. */
  upgradeTo: UpgradeTarget
  /** When the page was read, so the first render matches the server's. */
  initialNow: string
}

const STATE_BADGES: Record<DealState, { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-success/10 text-success' },
  scheduled: { label: 'Scheduled', className: 'bg-amber/10 text-amber' },
  draft: { label: 'Draft', className: 'bg-charcoal/8 text-charcoal' },
  ended: { label: 'Ended', className: 'bg-charcoal/8 text-charcoal-soft' },
}

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'

/** An ISO time as a datetime-local value, in the owner's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function DealsSection({ listingId, initial, tier, upgradeTo, initialNow }: Props) {
  const [deals, setDeals] = useState(initial)
  const [now, setNow] = useState(() => new Date(initialNow))
  const [editing, setEditing] = useState<OwnerDeal | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const allowed = dealsAllowed(tier)
  const on = deals.filter((d) => dealIsOn(d, now)).length
  const hiddenIds = new Set(shownDeals(deals, tier, now).hidden.map((d) => d.id))
  const full = on >= DEALS_ON_MAX && !(editing && dealIsOn(editing, now))

  function run(id: string, action: () => Promise<DealsState>) {
    setError(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await action()
      setBusyId(null)
      setNow(new Date())
      if ('error' in result) {
        setError(result.error)
        return
      }
      setDeals(result.deals)
      if (editing && !result.deals.some((d) => d.id === editing.id)) setEditing(null)
    })
  }

  function saved(next: OwnerDeal[]) {
    setDeals(next)
    setNow(new Date())
    setEditing(null)
    setFormKey((k) => k + 1)
  }

  return (
    <section className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-base text-brand-black">
            {editing ? 'Edit deal' : 'Deals'}
          </h2>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            Coupons and offers in a Deals section on your page, with a code customers can copy. You
            honour the code yourself, at the counter or at your own checkout.
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

      <div className="px-5 py-4 space-y-4">
        {!allowed ? (
          <PlanLimitNote upgradeTo={upgradeTo}>
            Coupons and deals are part of Premium. Upgrade to put deals on your page.
          </PlanLimitNote>
        ) : (
          <>
            {full && (
              <PlanLimitNote upgradeTo={null}>
                {`You can have up to ${DEALS_ON_MAX} deals on at a time. End one to add another. You can still save a draft.`}
              </PlanLimitNote>
            )}
            <DealForm
              key={editing ? editing.id : `new-${formKey}`}
              listingId={listingId}
              deal={editing}
              now={now}
              onSaved={saved}
            />
          </>
        )}
      </div>

      {deals.length > 0 && (
        <div className="border-t border-charcoal/8">
          <p className="px-5 pt-4 font-subhead text-xs font-semibold text-charcoal-soft">
            Your deals{allowed ? ` · ${on} of ${DEALS_ON_MAX} on` : ''}
          </p>
          {error && (
            <p role="alert" className="mx-5 mt-2 font-body text-sm text-red-700">
              {error}
            </p>
          )}
          <ul className="divide-y divide-charcoal/8">
            {deals.map((deal) => {
              const state = dealState(deal, now)
              const badge = STATE_BADGES[state]
              const busy = busyId === deal.id
              return (
                <li key={deal.id} className="flex gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-subhead text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      {hiddenIds.has(deal.id) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pale-lavender px-2 py-0.5 font-subhead text-xs font-semibold text-charcoal">
                          <EyeOff className="size-3" aria-hidden="true" />
                          {allowed ? 'Hidden: over the limit' : 'Hidden: Premium only'}
                        </span>
                      )}
                      {/* Times are in the owner's time zone, which the server doesn't know. */}
                      <span
                        suppressHydrationWarning
                        className="font-body text-xs text-charcoal-soft"
                      >
                        {state === 'scheduled'
                          ? `Starts ${formatWhen(deal.starts_at)}`
                          : state === 'live'
                            ? (dealEndsLabel(deal.ends_at, now) ?? 'No end date')
                            : state === 'draft'
                              ? 'Not on your page'
                              : deal.status === 'ended'
                                ? 'Ended early'
                                : deal.ends_at
                                  ? `Ended ${formatWhen(deal.ends_at)}`
                                  : 'Ended'}
                      </span>
                    </div>
                    <p className="mt-1 font-subhead text-sm font-semibold text-brand-black break-words">
                      {deal.title}
                    </p>
                    {deal.code && (
                      <p className="font-mono text-xs text-charcoal break-all">Code: {deal.code}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {allowed && (
                      <IconButton
                        label={`Edit “${deal.title}”`}
                        disabled={isPending}
                        onClick={() => {
                          setError(null)
                          setEditing(deal)
                          document
                            .getElementById('deals')
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </IconButton>
                    )}
                    {(state === 'live' || state === 'scheduled') && (
                      <IconButton
                        label={`End “${deal.title}” now`}
                        disabled={isPending}
                        onClick={() =>
                          run(deal.id, () => endDealAction({ listingId, id: deal.id }))
                        }
                      >
                        <Square className="size-4" aria-hidden="true" />
                      </IconButton>
                    )}
                    <IconButton
                      label={`Delete “${deal.title}”`}
                      disabled={isPending}
                      danger
                      onClick={() => {
                        if (!window.confirm('Delete this deal? This can’t be undone.')) return
                        run(deal.id, () => deleteDealAction({ listingId, id: deal.id }))
                      }}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-4" aria-hidden="true" />
                      )}
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

// ── The form ─────────────────────────────────────────────────────────────────

function DealForm({
  listingId,
  deal,
  now,
  onSaved,
}: {
  listingId: string
  deal: OwnerDeal | null
  now: Date
  onSaved: (deals: OwnerDeal[]) => void
}) {
  const [title, setTitle] = useState(deal?.title ?? '')
  const [description, setDescription] = useState(deal?.description ?? '')
  const [code, setCode] = useState(deal?.code ?? '')
  const [terms, setTerms] = useState(deal?.terms ?? '')
  // A deal that has started keeps its start unless the owner changes it.
  const started = deal !== null && dealState(deal, now) === 'live'
  const [startLocal, setStartLocal] = useState(deal && !started ? toLocalInput(deal.starts_at) : '')
  const [endLocal, setEndLocal] = useState(toLocalInput(deal?.ends_at ?? null))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(publish: boolean) {
    setError(null)
    const startIso = startLocal
      ? new Date(startLocal).toISOString()
      : started && deal
        ? deal.starts_at
        : ''
    const endIso = endLocal ? new Date(endLocal).toISOString() : ''
    startTransition(async () => {
      const result = await saveDealAction({
        listingId,
        id: deal?.id,
        title,
        description,
        code,
        terms,
        startsAt: startIso,
        endsAt: endIso,
        publish,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      onSaved(result.deals)
    })
  }

  const isOn = deal !== null && dealIsOn(deal, now)

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit(true)
      }}
    >
      <div>
        <label htmlFor="deal-title" className={LABEL}>
          Deal
        </label>
        <input
          id="deal-title"
          type="text"
          value={title}
          maxLength={DEAL_TITLE_MAX}
          required
          onChange={(e) => setTitle(e.target.value)}
          placeholder="15% off your first order"
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="deal-description" className={LABEL}>
          More about it <span className="font-normal text-charcoal-faint">(optional)</span>
        </label>
        <input
          id="deal-description"
          type="text"
          value={description}
          maxLength={DEAL_DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="On any custom cake or dozen cupcakes."
          className={INPUT}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="deal-code" className={LABEL}>
            Code <span className="font-normal text-charcoal-faint">(optional)</span>
          </label>
          <input
            id="deal-code"
            type="text"
            value={code}
            maxLength={DEAL_CODE_MAX}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.replace(/\s+/g, ''))}
            placeholder="WELCOME15"
            className={`${INPUT} font-mono`}
          />
          <p className="mt-1 font-body text-xs text-charcoal-faint">
            Letters, numbers, dashes. Leave blank for an offer with no code.
          </p>
        </div>
        <div className="min-w-[12rem] flex-[2]">
          <label htmlFor="deal-terms" className={LABEL}>
            Terms <span className="font-normal text-charcoal-faint">(optional)</span>
          </label>
          <input
            id="deal-terms"
            type="text"
            value={terms}
            maxLength={DEAL_TERMS_MAX}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="One per customer. Not valid with other offers."
            className={INPUT}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[11rem] flex-1">
          <label htmlFor="deal-start" className={LABEL}>
            Starts
          </label>
          <input
            id="deal-start"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className={INPUT}
          />
          <p className="mt-1 font-body text-xs text-charcoal-faint">
            {startLocal
              ? 'It goes up then by itself.'
              : started
                ? 'Already running.'
                : 'Leave blank to start now.'}
          </p>
        </div>
        <div className="min-w-[11rem] flex-1">
          <label htmlFor="deal-end" className={LABEL}>
            Ends <span className="font-normal text-charcoal-faint">(optional)</span>
          </label>
          <input
            id="deal-end"
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            className={INPUT}
          />
          <p className="mt-1 font-body text-xs text-charcoal-faint">
            Leave blank to run until you end it.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="font-body text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-brand-black text-white font-subhead text-sm font-bold hover:bg-charcoal disabled:opacity-60"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isOn ? 'Save changes' : startLocal ? 'Schedule deal' : 'Add to my page'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit(false)}
          className="h-10 px-4 rounded-full border border-charcoal/20 font-subhead text-sm font-semibold text-brand-black hover:bg-charcoal/5 disabled:opacity-60"
        >
          {isOn ? 'Take down and keep as draft' : 'Save draft'}
        </button>
      </div>
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
