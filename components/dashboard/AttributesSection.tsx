'use client'

import { useActionState, useState } from 'react'
import { useSaveLabel } from './SaveLabel'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

import type { FacetGroupData } from '@/lib/listings/facets'
import { updateListingAttributesAction } from '@/lib/actions/dashboard/updateListingAttributes'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import { CREATOR_GROUP_CAPS, isCreatorGroup } from '@/lib/listings/creatorAttributes'

interface Props {
  listingId: string
  /** Attribute groups applicable to this listing's entity type. */
  groups: FacetGroupData[]
  /** Currently-selected attribute value ids. */
  selectedValueIds: string[]
  /** Plan limit on selected details, or null for no limit (ticket 119). */
  limit: number | null
  showUpgrade: boolean
  /** The page's type. Creator pages get the creator groups, outside the plan limit. */
  entityType?: string | null
}

const OPTION_CLASS =
  'flex items-center gap-2 text-sm font-subhead text-charcoal cursor-pointer select-none has-[:disabled]:cursor-not-allowed has-[:disabled]:text-charcoal-faint'

export function AttributesSection({
  listingId,
  groups,
  selectedValueIds,
  limit,
  showUpgrade,
  entityType,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateListingAttributesAction, null)
  const saveLabel = useSaveLabel()
  const [selected, setSelected] = useState(() => new Set(selectedValueIds))

  if (groups.length === 0) return null

  const creator = entityType === 'creator'
  // Creator groups first on creator pages, and only on creator pages.
  const shown = creator
    ? [...groups.filter((g) => isCreatorGroup(g.slug)), ...groups.filter((g) => !isCreatorGroup(g.slug))]
    : groups.filter((g) => !isCreatorGroup(g.slug))
  const creatorValueIds = new Set(
    groups.filter((g) => isCreatorGroup(g.slug)).flatMap((g) => g.values.map((v) => v.id))
  )
  const planCount = (ids: Iterable<string>) =>
    Array.from(ids).filter((id) => !creatorValueIds.has(id)).length

  // Same rule as checkAttributeCount: a listing that already had more than the
  // limit keeps them, and can swap one for another, but cannot add more.
  // Creator groups don't count toward it (ticket 132).
  const counted = planCount(selected)
  const ceiling = limit === null ? null : Math.max(limit, planCount(selectedValueIds))
  const full = ceiling !== null && counted >= ceiling

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /** One choice in a single-choice group: clear the group, then set it. */
  function choose(groupValueIds: string[], id: string | null) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const v of groupValueIds) next.delete(v)
      if (id) next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">
          {creator ? 'Creator details' : <>Attributes &amp; amenities</>}
        </h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          {creator
            ? "Help fans and brands find you. These power the filters on Discover. Niche, platforms and audience size don't count toward your plan."
            : 'Help shoppers find you. These power the filters on Discover.'}
          {limit !== null &&
            (creator ? ` ${counted} of ${limit} other details chosen.` : ` ${counted} of ${limit} chosen.`)}
        </p>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-5">
        <input type="hidden" name="listing_id" value={listingId} />
        {/* The visible inputs only drive state; these are what is sent. */}
        {Array.from(selected).map((id) => (
          <input key={id} type="hidden" name="attr" value={id} />
        ))}

        {full && (
          <PlanLimitNote showUpgrade={showUpgrade}>
            {`Your plan includes up to ${limit} details customers filter by. Uncheck one to pick another${showUpgrade ? ', or upgrade for more' : ''}.`}
          </PlanLimitNote>
        )}

        {shown.map((group) => {
          const isCreatorDetail = isCreatorGroup(group.slug)
          const cap = isCreatorDetail ? CREATOR_GROUP_CAPS[group.slug] : undefined
          const groupIds = group.values.map((v) => v.id)
          const pickedHere = groupIds.filter((id) => selected.has(id)).length
          const capHit = cap !== undefined && cap > 1 && pickedHere >= cap
          const hintId = `attr-hint-${group.id}`

          if (cap === 1) {
            const current = groupIds.find((id) => selected.has(id)) ?? ''
            return (
              <fieldset key={group.id}>
                <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
                  {group.name}
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {group.values.map((value) => (
                    <label key={value.id} className={OPTION_CLASS}>
                      <input
                        type="radio"
                        name={`attr-group-${group.id}`}
                        value={value.id}
                        checked={current === value.id}
                        onChange={() => choose(groupIds, value.id)}
                        className="border-charcoal/30 text-brand-black focus:ring-amber-gold/40"
                      />
                      {value.name}
                    </label>
                  ))}
                  <label className={OPTION_CLASS}>
                    <input
                      type="radio"
                      name={`attr-group-${group.id}`}
                      value=""
                      checked={current === ''}
                      onChange={() => choose(groupIds, null)}
                      className="border-charcoal/30 text-brand-black focus:ring-amber-gold/40"
                    />
                    Don&apos;t show
                  </label>
                </div>
              </fieldset>
            )
          }

          return (
            <fieldset key={group.id} aria-describedby={cap ? hintId : undefined}>
              <legend className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
                {group.name}
              </legend>
              {cap && (
                <p id={hintId} className="font-body text-xs text-charcoal-soft -mt-1 mb-2">
                  Pick up to {cap}. {pickedHere} of {cap} chosen.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {group.values.map((value) => {
                  const on = selected.has(value.id)
                  const blocked = isCreatorDetail ? capHit : full
                  return (
                    <label key={value.id} className={OPTION_CLASS}>
                      <input
                        type="checkbox"
                        value={value.id}
                        checked={on}
                        disabled={blocked && !on}
                        onChange={(e) => toggle(value.id, e.target.checked)}
                        className="rounded border-charcoal/30 text-brand-black focus:ring-amber-gold/40"
                      />
                      {value.name}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )
        })}

        {state && 'error' in state && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {state && 'success' in state && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">Saved.</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? 'Saving…' : saveLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
