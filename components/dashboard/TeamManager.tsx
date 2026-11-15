'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  ArrowDown,
  ArrowUp,
  EyeOff,
  GripVertical,
  ImagePlus,
  Loader2,
  Pencil,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import {
  deleteTeamMemberAction,
  reorderTeamAction,
  saveTeamMemberAction,
  type TeamState,
} from '@/lib/actions/dashboard/team'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import { compressImage } from '@/components/dashboard/MediaGrid'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import {
  TEAM_BIO_MAX,
  TEAM_NAME_MAX,
  TEAM_ROLE_MAX,
  type OwnerTeamMember,
} from '@/lib/listings/team'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'

// Team members (ticket 107): add the people behind the page, mark one as the
// founder, put them in order (drag, or the arrow buttons for keyboards and
// touch), edit or remove them. Each change saves on its own and the list
// comes back from the server as saved.

interface Props {
  listingId: string
  initial: OwnerTeamMember[]
  /** Members the plan shows: 0 below Growth, null for no limit. */
  limit: number | null
  /** The plan the limit note offers (`teamUpgradeTarget`), or null for no link. */
  upgradeTo: UpgradeTarget
}

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

export function TeamManager({ listingId, initial, limit, upgradeTo }: Props) {
  const [members, setMembers] = useState(initial)
  // null: the form adds a new member. The form is keyed on this, so switching
  // members starts it fresh.
  const [editing, setEditing] = useState<OwnerTeamMember | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const locked = limit === 0
  const full = limit !== null && members.length >= limit

  function run(id: string, action: () => Promise<TeamState>, optimistic?: OwnerTeamMember[]) {
    setError(null)
    setBusyId(id)
    const before = members
    if (optimistic) setMembers(optimistic)
    startTransition(async () => {
      const result = await action()
      setBusyId(null)
      if ('error' in result) {
        if (optimistic) setMembers(before)
        setError(result.error)
        return
      }
      setMembers(result.members)
      if (editing && !result.members.some((m) => m.id === editing.id)) setEditing(null)
    })
  }

  function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= members.length) return
    const member = members[from]
    if (!member) return
    const next = moved(members, from, to)
    run(member.id, () => reorderTeamAction({ listingId, ids: next.map((m) => m.id) }), next)
  }

  function saved(next: OwnerTeamMember[]) {
    setMembers(next)
    setEditing(null)
    setFormKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-charcoal/10 bg-white">
        <div className="px-5 py-4 border-b border-charcoal/8 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-base text-brand-black">
              {editing ? 'Edit Team Member' : 'Add a Team Member'}
            </h2>
            <p className="font-body text-xs text-charcoal-soft mt-0.5">
              The people behind your page: a name, what they do and a line or two about them. Mark
              the founder or owner and they show first, with a bigger card.
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
          {locked && !editing ? (
            <PlanLimitNote upgradeTo={upgradeTo}>
              Team members are part of Growth. Upgrade to add your team to your page.
            </PlanLimitNote>
          ) : full && !editing ? (
            <PlanLimitNote upgradeTo={upgradeTo}>
              {`Your plan includes ${limit} team members. ${
                upgradeTo
                  ? `Remove one, or upgrade to ${upgradeTo} for more.`
                  : 'Remove one to add another.'
              }`}
            </PlanLimitNote>
          ) : (
            <MemberForm
              key={editing ? editing.id : `new-${formKey}`}
              listingId={listingId}
              member={editing}
              onSaved={saved}
            />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-charcoal/10 bg-white">
        <div className="px-5 py-4 border-b border-charcoal/8">
          <h2 className="font-headline text-base text-brand-black">Your Team</h2>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            {limit === null
              ? 'Your plan has no limit on team members. Drag to change the order.'
              : limit === 0
                ? 'Growth and Premium pages show a team.'
                : `Your plan shows up to ${limit} team members. Drag to change the order.`}
          </p>
        </div>
        {error && (
          <p role="alert" className="mx-5 mt-4 font-body text-sm text-red-700">
            {error}
          </p>
        )}
        {members.length === 0 ? (
          <p className="px-5 py-6 font-body text-sm text-charcoal-soft">No team members yet.</p>
        ) : (
          <ol className="divide-y divide-charcoal/8">
            {members.map((member, index) => {
              const hidden = limit !== null && index >= limit
              const busy = busyId === member.id
              const src = member.photo_path ? resolveMediaPath(member.photo_path) : null
              return (
                <li
                  key={member.id}
                  draggable={!isPending}
                  onDragStart={(e) => {
                    setDragId(member.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    if (dragId && dragId !== member.id) e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const from = members.findIndex((m) => m.id === dragId)
                    setDragId(null)
                    if (from >= 0) reorder(from, index)
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={`flex gap-3 px-5 py-4 ${dragId === member.id ? 'opacity-50' : ''}`}
                >
                  <GripVertical
                    className="size-4 mt-3 shrink-0 cursor-grab text-charcoal-faint"
                    aria-hidden="true"
                  />
                  {src ? (
                    <Image
                      src={src}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-charcoal/8 font-subhead text-sm font-semibold text-charcoal-soft"
                    >
                      {member.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-subhead text-sm font-semibold text-brand-black break-words">
                        {member.name}
                      </p>
                      {member.is_founder && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 px-2 py-0.5 font-subhead text-xs font-semibold text-amber">
                          <Star className="size-3" aria-hidden="true" />
                          Founder
                        </span>
                      )}
                      {hidden && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pale-lavender px-2 py-0.5 font-subhead text-xs font-semibold text-charcoal">
                          <EyeOff className="size-3" aria-hidden="true" />
                          Hidden: over your plan&rsquo;s limit
                        </span>
                      )}
                    </div>
                    {member.role && (
                      <p className="font-body text-xs text-charcoal-soft break-words">
                        {member.role}
                      </p>
                    )}
                    {member.bio && (
                      <p className="mt-0.5 font-body text-xs text-charcoal-faint line-clamp-2 break-words">
                        {member.bio}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <IconButton
                      label={`Move ${member.name} Up`}
                      disabled={isPending || index === 0}
                      onClick={() => reorder(index, index - 1)}
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`Move ${member.name} Down`}
                      disabled={isPending || index === members.length - 1}
                      onClick={() => reorder(index, index + 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`Edit ${member.name}`}
                      disabled={isPending}
                      onClick={() => {
                        setError(null)
                        setEditing(member)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      label={`Remove ${member.name}`}
                      disabled={isPending}
                      danger
                      onClick={() => {
                        if (!window.confirm(`Remove ${member.name} from your team?`)) return
                        run(member.id, () => deleteTeamMemberAction({ listingId, id: member.id }))
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
          </ol>
        )}
        {limit !== null && limit > 0 && members.length > limit && (
          <p className="px-5 pb-4 font-body text-xs text-charcoal-soft">
            Your page shows the first {limit}. Move someone up to show them. Nothing was deleted.
          </p>
        )}
        {limit === 0 && members.length > 0 && (
          <p className="px-5 pb-4 font-body text-xs text-charcoal-soft">
            Your team is saved but hidden until your page is on Growth. Nothing was deleted.
          </p>
        )}
      </section>
    </div>
  )
}

// ── The form ─────────────────────────────────────────────────────────────────

function MemberForm({
  listingId,
  member,
  onSaved,
}: {
  listingId: string
  member: OwnerTeamMember | null
  onSaved: (members: OwnerTeamMember[]) => void
}) {
  const [name, setName] = useState(member?.name ?? '')
  const [role, setRole] = useState(member?.role ?? '')
  const [bio, setBio] = useState(member?.bio ?? '')
  const [isFounder, setIsFounder] = useState(member?.is_founder ?? false)
  // undefined keeps the saved photo, null removes it, a string is a new upload.
  const [photoPath, setPhotoPath] = useState<string | null | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const shownPhoto =
    photoPath === undefined ? (member?.photo_path ?? null) : photoPath === null ? null : photoPath
  const shownSrc = shownPhoto ? resolveMediaPath(shownPhoto) : null

  async function upload(file: File) {
    setError(null)
    setUploading(true)
    try {
      const small = await compressImage(file, 800, 0.85)
      const fd = new FormData()
      fd.append('file', small)
      fd.append('bucket', 'listing-media')
      fd.append('entity_id', listingId)
      fd.append('media_role', 'team')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = (await res.json()) as { data?: { path?: string }; error?: string }
      if (!res.ok || !json.data?.path) {
        setError(json.error ?? 'Upload failed. Please try again.')
        return
      }
      setPhotoPath(json.data.path)
    } catch {
      setError('Upload failed. Please check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }

  const busy = isPending || uploading

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const result = await saveTeamMemberAction({
            listingId,
            id: member?.id,
            name,
            role,
            bio,
            isFounder,
            photoPath,
          })
          if ('error' in result) {
            setError(result.error)
            return
          }
          onSaved(result.members)
        })
      }}
    >
      <div className="flex items-center gap-4">
        {shownSrc ? (
          <Image
            src={shownSrc}
            alt=""
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-charcoal/8 text-charcoal-faint"
          >
            <ImagePlus className="size-5" />
          </span>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 font-subhead text-sm font-semibold text-brand-black underline underline-offset-4 decoration-amber-gold">
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-4" aria-hidden="true" />
            )}
            {shownPhoto ? 'Change Photo' : 'Add a Photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void upload(file)
              }}
            />
          </label>
          {shownPhoto && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPhotoPath(null)}
              className="font-subhead text-xs font-semibold text-charcoal-soft hover:text-red-700"
            >
              Remove Photo
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="team-name" className={LABEL}>
          Name
        </label>
        <input
          id="team-name"
          type="text"
          value={name}
          maxLength={TEAM_NAME_MAX}
          required
          onChange={(e) => setName(e.target.value)}
          placeholder="Maya Johnson"
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="team-role" className={LABEL}>
          Role (Optional)
        </label>
        <input
          id="team-role"
          type="text"
          value={role}
          maxLength={TEAM_ROLE_MAX}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Head Baker"
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="team-bio" className={LABEL}>
          Bio (Optional)
        </label>
        <textarea
          id="team-bio"
          value={bio}
          maxLength={TEAM_BIO_MAX}
          rows={3}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A line or two about them. For the founder, the first sentence becomes the quote on their card."
          className={INPUT}
        />
        <p
          className={`mt-1 text-right font-body text-xs ${
            TEAM_BIO_MAX - bio.length < 20 ? 'text-amber' : 'text-charcoal-faint'
          }`}
        >
          {bio.length}/{TEAM_BIO_MAX}
        </p>
      </div>

      <label className="flex items-start gap-2 font-body text-sm text-charcoal">
        <input
          type="checkbox"
          checked={isFounder}
          onChange={(e) => setIsFounder(e.target.checked)}
          className="mt-0.5 size-4 rounded border-charcoal/30 accent-amber-gold"
        />
        <span>
          This is the founder or owner. Their card shows first and larger. Only one person can be
          marked.
        </span>
      </label>

      {error && (
        <p role="alert" className="font-body text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-brand-black px-5 py-2.5 font-subhead text-sm font-bold text-white disabled:opacity-50"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {member ? 'Save Changes' : 'Add to Team'}
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
