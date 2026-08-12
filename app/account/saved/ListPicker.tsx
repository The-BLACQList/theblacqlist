'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, ListPlus, Loader2, Plus } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { addToListAction } from '@/lib/actions/saved-lists/addToList'
import { removeFromListAction } from '@/lib/actions/saved-lists/removeFromList'
import { createListAction } from '@/lib/actions/saved-lists/createList'
import { MAX_LIST_NAME_LENGTH } from '@/lib/saved-lists/name'

export interface PickerList {
  id: string
  name: string
}

interface ListPickerProps {
  listingId: string
  listingName: string
  lists: PickerList[]
  /** IDs of the lists this listing is currently filed in. */
  memberOf: string[]
}

/**
 * The per-card list control `[Decision — founder, 2026-08-12]`.
 *
 * One button per saved business opens a dialog with a checkbox per list. The
 * same control both files and unfiles — checking calls `addToList`, unchecking
 * `removeFromList` — so there is no separate remove affordance to find.
 *
 * Radix `Dialog` is used rather than a hand-rolled popover: it brings the focus
 * trap, Escape-to-close and focus restore that a menu of interactive rows needs,
 * and `components/ui/` has no popover primitive.
 */
export function ListPicker({ listingId, listingName, lists, memberOf }: ListPickerProps) {
  const [open, setOpen] = useState(false)
  const memberSet = new Set(memberOf)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Add ${listingName} to a list`}
          className="inline-flex items-center justify-center size-11 rounded-full text-charcoal-faint hover:text-charcoal hover:bg-charcoal/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          <ListPlus className="size-4" aria-hidden="true" />
        </button>
      </DialogTrigger>

      <DialogContent>
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>Add to a list</DialogTitle>
            <DialogDescription>{listingName}</DialogDescription>
          </DialogHeader>

          {lists.length > 0 && (
            <ul className="mt-5 space-y-1" aria-label="Your lists">
              {lists.map((list) => {
                const isMember = memberSet.has(list.id)
                return (
                  // Keying on membership remounts the row when the action swaps,
                  // so `useActionState` never carries a result across the change.
                  <li key={`${list.id}-${isMember}`}>
                    <MembershipRow list={list} listingId={listingId} isMember={isMember} />
                  </li>
                )
              })}
            </ul>
          )}

          {/* Remounted on each open so a previous submission's state is gone, and
              again whenever the list count changes — a successful create adds a
              row above, and the remount is what collapses this back to the
              button without an effect reaching in to reset state. */}
          {open && (
            <NewListForm
              key={`${listingId}-${lists.length}`}
              listingId={listingId}
              hasLists={lists.length > 0}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MembershipRow({
  list,
  listingId,
  isMember,
}: {
  list: PickerList
  listingId: string
  isMember: boolean
}) {
  const [state, formAction] = useActionState(
    isMember ? removeFromListAction : addToListAction,
    null
  )

  return (
    <form action={formAction}>
      <input type="hidden" name="list_id" value={list.id} />
      <input type="hidden" name="listing_id" value={listingId} />
      <MembershipButton name={list.name} isMember={isMember} />
      {state && 'error' in state && (
        <p role="alert" className="px-3 pb-1 font-subhead text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}

function MembershipButton({ name, isMember }: { name: string; isMember: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      role="checkbox"
      aria-checked={isMember}
      disabled={pending}
      className="w-full min-h-[44px] flex items-center gap-3 px-3 rounded-lg text-left hover:bg-charcoal/5 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
    >
      <span
        aria-hidden="true"
        className={`inline-flex size-5 shrink-0 items-center justify-center rounded border ${
          isMember ? 'bg-brand-black border-brand-black text-white' : 'border-charcoal/30 bg-white'
        }`}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          isMember && <Check className="size-3.5" />
        )}
      </span>
      <span className="font-body text-sm text-brand-black truncate">{name}</span>
    </button>
  )
}

function NewListForm({ listingId, hasLists }: { listingId: string; hasLists: boolean }) {
  const [state, formAction] = useActionState(createListAction, null)

  // Open by default only when there is nothing to check off yet. Collapsing
  // after a successful create is handled by the remount in `ListPicker` — the
  // list count changes, the key changes, and this starts over collapsed.
  const [showField, setShowField] = useState(!hasLists)

  if (!showField) {
    return (
      <button
        type="button"
        onClick={() => setShowField(true)}
        className="mt-3 w-full min-h-[44px] flex items-center gap-3 px-3 rounded-lg text-left hover:bg-charcoal/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
      >
        <Plus className="size-4 text-charcoal-faint" aria-hidden="true" />
        <span className="font-body text-sm text-brand-black">New list</span>
      </button>
    )
  }

  const fieldError = state && 'error' in state ? state.fieldErrors?.name : undefined

  return (
    <form action={formAction} className="mt-4 pt-4 border-t border-charcoal/10 space-y-2">
      <input type="hidden" name="listing_id" value={listingId} />
      <label
        htmlFor={`new-list-${listingId}`}
        className="block font-subhead text-sm font-semibold text-brand-black"
      >
        New list
      </label>
      <div className="flex gap-2">
        <input
          id={`new-list-${listingId}`}
          name="name"
          type="text"
          autoComplete="off"
          maxLength={MAX_LIST_NAME_LENGTH}
          placeholder="Weekend spots"
          aria-invalid={Boolean(fieldError)}
          aria-describedby={fieldError ? `new-list-error-${listingId}` : undefined}
          className="flex-1 h-11 rounded-lg border border-charcoal/30 bg-white font-body text-sm text-brand-black px-3 focus:outline-none focus:ring-2 focus:ring-amber-gold/40 focus:border-amber-gold"
        />
        <SubmitButton label="Create" pendingLabel="Creating…" />
      </div>
      {fieldError && (
        <p
          id={`new-list-error-${listingId}`}
          role="alert"
          className="font-subhead text-xs text-red-600"
        >
          {fieldError}
        </p>
      )}
    </form>
  )
}

export function SubmitButton({
  label,
  pendingLabel,
  variant = 'primary',
}: {
  label: string
  pendingLabel: string
  variant?: 'primary' | 'destructive'
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-11 px-5 rounded-full font-body font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
        variant === 'destructive'
          ? 'bg-red-600 text-white hover:bg-red-700'
          : 'bg-brand-black text-white hover:bg-charcoal'
      }`}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : label}
    </button>
  )
}
