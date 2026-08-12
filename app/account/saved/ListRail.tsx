'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createListAction } from '@/lib/actions/saved-lists/createList'
import { renameListAction } from '@/lib/actions/saved-lists/renameList'
import { deleteListAction } from '@/lib/actions/saved-lists/deleteList'
import { MAX_LIST_NAME_LENGTH } from '@/lib/saved-lists/name'

import { SubmitButton } from './ListPicker'

export interface RailList {
  id: string
  name: string
  count: number
}

interface ListRailProps {
  lists: RailList[]
  activeListId: string | null
  totalCount: number
}

/**
 * The list rail above the saved cards.
 *
 * Selection is URL-driven (`?list=<id>`) rather than component state, so a
 * filtered view is bookmarkable and survives a refresh — the filter-state rule
 * in `ux.md`. Rename and delete apply to the currently selected list only;
 * there is no per-row menu in the rail to hunt for.
 */
export function ListRail({ lists, activeListId, totalCount }: ListRailProps) {
  const activeList = lists.find((l) => l.id === activeListId) ?? null

  return (
    <div className="mb-6">
      <nav aria-label="Saved lists" className="flex flex-wrap items-center gap-2">
        <RailLink href="/account/saved" label="All saved" count={totalCount} active={!activeList} />
        {lists.map((list) => (
          <RailLink
            key={list.id}
            href={`/account/saved?list=${list.id}`}
            label={list.name}
            count={list.count}
            active={activeList?.id === list.id}
          />
        ))}
        <NewListButton />
      </nav>

      {activeList && (
        <div className="mt-3 flex items-center gap-2">
          <RenameListButton list={activeList} />
          <DeleteListButton list={activeList} />
        </div>
      )}
    </div>
  )
}

function RailLink({
  href,
  label,
  count,
  active,
}: {
  href: string
  label: string
  count: number
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full font-subhead text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold ${
        active
          ? 'bg-brand-black text-white'
          : 'bg-white border border-charcoal/15 text-charcoal hover:border-charcoal/40'
      }`}
    >
      <span className="truncate max-w-[12rem]">{label}</span>
      <span className={active ? 'text-white/60' : 'text-charcoal-faint'}>{count}</span>
    </Link>
  )
}

/** Shared open/close plumbing: close on success, mount the form fresh each open. */
function ActionDialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: React.ReactNode
  title: string
  description?: string
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <div className="p-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {open && children(() => setOpen(false))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NewListButton() {
  return (
    <ActionDialog
      title="New list"
      description="Group saved businesses however you like — lists are private to you."
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full border border-dashed border-charcoal/30 font-subhead text-sm text-charcoal hover:border-charcoal/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          <Plus className="size-4" aria-hidden="true" />
          New list
        </button>
      }
    >
      {(close) => <NameForm action={createListAction} fieldId="new-list" submitLabel="Create list" pendingLabel="Creating…" onDone={close} />}
    </ActionDialog>
  )
}

function RenameListButton({ list }: { list: RailList }) {
  return (
    <ActionDialog
      title="Rename list"
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-full font-subhead text-sm text-charcoal-soft hover:text-charcoal hover:bg-charcoal/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          <Pencil className="size-4" aria-hidden="true" />
          Rename
        </button>
      }
    >
      {(close) => (
        <NameForm
          action={renameListAction}
          fieldId={`rename-${list.id}`}
          listId={list.id}
          defaultValue={list.name}
          submitLabel="Save name"
          pendingLabel="Saving…"
          onDone={close}
        />
      )}
    </ActionDialog>
  )
}

function DeleteListButton({ list }: { list: RailList }) {
  return (
    <ActionDialog
      title={`Delete “${list.name}”?`}
      description="The list is removed. The businesses in it stay saved and remain under All saved."
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-full font-subhead text-sm text-charcoal-soft hover:text-red-700 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete
        </button>
      }
    >
      {(close) => <DeleteForm listId={list.id} onDone={close} />}
    </ActionDialog>
  )
}

type NameAction = typeof createListAction

function NameForm({
  action,
  fieldId,
  listId,
  defaultValue,
  submitLabel,
  pendingLabel,
  onDone,
}: {
  action: NameAction
  fieldId: string
  listId?: string
  defaultValue?: string
  submitLabel: string
  pendingLabel: string
  onDone: () => void
}) {
  const [state, formAction] = useActionState(action, null)

  useEffect(() => {
    if (state && 'success' in state) onDone()
  }, [state, onDone])

  const fieldError = state && 'error' in state ? state.fieldErrors?.name : undefined

  return (
    <form action={formAction} className="mt-5 space-y-2">
      {listId && <input type="hidden" name="list_id" value={listId} />}
      <label htmlFor={fieldId} className="block font-subhead text-sm font-semibold text-brand-black">
        List name
      </label>
      <input
        id={fieldId}
        name="name"
        type="text"
        autoComplete="off"
        defaultValue={defaultValue}
        maxLength={MAX_LIST_NAME_LENGTH}
        placeholder="Weekend spots"
        aria-invalid={Boolean(fieldError)}
        aria-describedby={fieldError ? `${fieldId}-error` : undefined}
        className="w-full h-11 rounded-lg border border-charcoal/30 bg-white font-body text-sm text-brand-black px-3 focus:outline-none focus:ring-2 focus:ring-amber-gold/40 focus:border-amber-gold"
      />
      {fieldError && (
        <p id={`${fieldId}-error`} role="alert" className="font-subhead text-xs text-red-600">
          {fieldError}
        </p>
      )}
      <div className="pt-2">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  )
}

function DeleteForm({ listId, onDone }: { listId: string; onDone: () => void }) {
  const [state, formAction] = useActionState(deleteListAction, null)

  useEffect(() => {
    if (state && 'success' in state) onDone()
  }, [state, onDone])

  return (
    <form action={formAction} className="mt-5 space-y-3">
      <input type="hidden" name="list_id" value={listId} />
      {state && 'error' in state && (
        <p role="alert" className="font-subhead text-xs text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton label="Delete list" pendingLabel="Deleting…" variant="destructive" />
    </form>
  )
}
