'use client'

import { useActionState, useId } from 'react'

import { reviewCategoryRequestAction } from '@/lib/actions/admin/reviewCategoryRequest'

export interface CategoryOption {
  id: string
  name: string
  /** Top-level group id; null when the option is itself a group. */
  groupId: string | null
}

interface Props {
  requestId: string
  proposedName: string
  /** The category the page sits in now, preselected in "Move to". */
  currentCategoryId: string | null
  categories: CategoryOption[]
}

// The action row on /admin/category-requests. One form per decision, the same
// shape as ProblemReportActions. Every decision emails the owner.
export function CategoryRequestActions({
  requestId,
  proposedName,
  currentCategoryId,
  categories,
}: Props) {
  const [addState, addDispatch, addPending] = useActionState(reviewCategoryRequestAction, null)
  const [moveState, moveDispatch, movePending] = useActionState(reviewCategoryRequestAction, null)
  const [declineState, declineDispatch, declinePending] = useActionState(
    reviewCategoryRequestAction,
    null
  )
  const nameId = useId()
  const moveId = useId()

  const isPending = addPending || movePending || declinePending
  const error =
    (addState as { error?: string } | null)?.error ??
    (moveState as { error?: string } | null)?.error ??
    (declineState as { error?: string } | null)?.error

  // Groups first, each followed by its subcategories.
  const groups = categories.filter((c) => c.groupId === null)
  const byGroup = new Map<string, CategoryOption[]>()
  for (const c of categories) {
    if (c.groupId === null) continue
    const list = byGroup.get(c.groupId) ?? []
    list.push(c)
    byGroup.set(c.groupId, list)
  }

  const inputClass =
    'min-w-0 rounded-md border border-charcoal/15 bg-white px-2 py-1.5 font-body text-xs text-charcoal focus:border-amber-gold focus:outline-none focus:ring-1 focus:ring-amber-gold/40'

  return (
    <div className="flex w-full flex-col gap-3 sm:w-72">
      {error && (
        <p role="alert" className="font-body text-xs text-red-600">
          {error}
        </p>
      )}

      <form action={addDispatch} className="flex flex-col gap-1.5">
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="decision" value="add" />
        <label htmlFor={nameId} className="font-subhead text-xs font-semibold text-charcoal-soft">
          Add as a new category
        </label>
        <div className="flex items-center gap-2">
          <input
            id={nameId}
            name="name"
            type="text"
            defaultValue={proposedName}
            minLength={2}
            maxLength={60}
            required
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 font-subhead text-xs font-semibold text-green-700 hover:text-green-900 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </form>

      <form action={moveDispatch} className="flex flex-col gap-1.5">
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="decision" value="move" />
        <label htmlFor={moveId} className="font-subhead text-xs font-semibold text-charcoal-soft">
          Or move to one we have
        </label>
        <div className="flex items-center gap-2">
          <select
            id={moveId}
            name="category_id"
            defaultValue={currentCategoryId ?? ''}
            required
            className={`flex-1 ${inputClass}`}
          >
            <option value="" disabled>
              Pick a category
            </option>
            {groups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                <option value={g.id}>{g.name} (whole group)</option>
                {(byGroup.get(g.id) ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 font-subhead text-xs font-semibold text-amber hover:text-brand-black disabled:opacity-50"
          >
            Move
          </button>
        </div>
      </form>

      <form action={declineDispatch}>
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="decision" value="decline" />
        <button
          type="submit"
          disabled={isPending}
          className="font-subhead text-xs font-semibold text-charcoal-soft hover:text-charcoal disabled:opacity-50"
        >
          Decline and leave it where it is
        </button>
      </form>
    </div>
  )
}
