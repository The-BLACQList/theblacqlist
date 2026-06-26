'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

import type { CollectionActionState } from '@/lib/actions/editorial/collections'
import type { ArticleActionState } from '@/lib/actions/editorial/articles'
import type { GuideActionState } from '@/lib/actions/editorial/guides'

// ─── Shared field styles ──────────────────────────────────────────────────────

const inputCls =
  'w-full h-11 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/60'

const textareaCls =
  'w-full px-3 py-2.5 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/60 resize-y'

function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block font-subhead text-sm font-semibold text-brand-black mb-1"
      >
        {children}
      </label>
      {hint && <p className="font-body text-xs text-charcoal-soft mb-1.5">{hint}</p>}
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      {children}
    </div>
  )
}

// ─── Collection form ──────────────────────────────────────────────────────────

type CollectionFormAction = (
  prev: CollectionActionState,
  formData: FormData
) => Promise<CollectionActionState>

interface CollectionFormProps {
  action: CollectionFormAction
  defaultValues?: {
    id?: string
    title?: string
    slug?: string
    subtitle?: string | null
    description?: string | null
    body?: string | null
    cover_image_path?: string | null
    is_active?: boolean
  }
  redirectOnSuccess?: string
}

export function CollectionAdminForm({
  action,
  defaultValues,
  redirectOnSuccess,
}: CollectionFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)
  const router = useRouter()

  useEffect(() => {
    if (state && 'success' in state && redirectOnSuccess) {
      router.push(redirectOnSuccess)
    }
  }, [state, redirectOnSuccess, router])

  return (
    <form action={formAction} className="space-y-5">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}

      {state && 'error' in state && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <Field id="title" label="Title *">
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={defaultValues?.title ?? ''}
          placeholder="e.g. Best Brunch Spots in Atlanta"
          className={inputCls}
        />
      </Field>

      <Field
        id="slug"
        label="Slug"
        hint="Auto-generated from title if left blank. Use only lowercase letters, numbers, and hyphens."
      >
        <input
          id="slug"
          name="slug"
          type="text"
          maxLength={200}
          defaultValue={defaultValues?.slug ?? ''}
          placeholder="best-brunch-spots-atlanta"
          className={inputCls}
        />
      </Field>

      <Field id="subtitle" label="Subtitle" hint="A short deck shown under the title in the hero.">
        <input
          id="subtitle"
          name="subtitle"
          type="text"
          maxLength={300}
          defaultValue={defaultValues?.subtitle ?? ''}
          placeholder="Ten spots that define how Atlanta eats"
          className={inputCls}
        />
      </Field>

      <Field
        id="description"
        label="Description"
        hint="Used for SEO and link previews. Keep it short."
      >
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={defaultValues?.description ?? ''}
          placeholder="A short description of this collection…"
          className={textareaCls}
        />
      </Field>

      <Field
        id="body"
        label="Intro narrative"
        hint="The story that opens the collection. Use ## for headings, ### for sub-headings, > for block quotes. Double line breaks create new paragraphs."
      >
        <textarea
          id="body"
          name="body"
          rows={10}
          defaultValue={defaultValues?.body ?? ''}
          placeholder="Set the scene for this collection…"
          className={textareaCls}
        />
      </Field>

      <Field
        id="cover_image_path"
        label="Cover image"
        hint="Optional. A full image URL or Supabase Storage path for the hero banner."
      >
        <input
          id="cover_image_path"
          name="cover_image_path"
          type="text"
          defaultValue={defaultValues?.cover_image_path ?? ''}
          placeholder="https://… or storage/path.jpg"
          className={inputCls}
        />
      </Field>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={defaultValues?.is_active ?? true}
          className="rounded border-charcoal/30 accent-amber-gold"
        />
        <span className="font-body text-sm text-brand-black">
          Active (visible on the public collections page)
        </span>
      </label>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 h-10 px-6 rounded-full bg-amber-gold hover:bg-light-gold disabled:opacity-60 disabled:cursor-not-allowed text-brand-black font-subhead font-bold text-sm transition-colors"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isPending ? 'Saving…' : 'Save collection'}
        </button>
      </div>
    </form>
  )
}

// ─── Article / BLACQLight form ─────────────────────────────────────────────────

type ArticleFormAction = (
  prev: ArticleActionState,
  formData: FormData
) => Promise<ArticleActionState>

interface ArticleFormProps {
  action: ArticleFormAction
  defaultValues?: {
    id?: string
    title?: string
    slug?: string
    subtitle?: string | null
    body?: string | null
    author_name?: string
    meta_description?: string | null
    tags?: string[] | null
    status?: string
  }
  redirectOnSuccess?: string
}

export function ArticleAdminForm({ action, defaultValues, redirectOnSuccess }: ArticleFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)
  const router = useRouter()

  useEffect(() => {
    if (state && 'success' in state && redirectOnSuccess) {
      router.push(redirectOnSuccess)
    }
  }, [state, redirectOnSuccess, router])

  const isPublished = defaultValues?.status === 'published'

  return (
    <form action={formAction} className="space-y-5">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}

      {state && 'error' in state && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <Field id="title" label="Title *">
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={defaultValues?.title ?? ''}
          placeholder="Article headline"
          className={inputCls}
        />
      </Field>

      <Field id="slug" label="Slug" hint="Auto-generated from title if left blank.">
        <input
          id="slug"
          name="slug"
          type="text"
          maxLength={200}
          defaultValue={defaultValues?.slug ?? ''}
          placeholder="article-slug"
          className={inputCls}
        />
      </Field>

      <Field id="subtitle" label="Subtitle">
        <input
          id="subtitle"
          name="subtitle"
          type="text"
          maxLength={300}
          defaultValue={defaultValues?.subtitle ?? ''}
          placeholder="A short deck / subheadline"
          className={inputCls}
        />
      </Field>

      <Field id="author_name" label="Author">
        <input
          id="author_name"
          name="author_name"
          type="text"
          maxLength={100}
          defaultValue={defaultValues?.author_name ?? 'The BLACQList Team'}
          className={inputCls}
        />
      </Field>

      <Field
        id="body"
        label="Body"
        hint="Use ## for headings, ### for sub-headings, > for block quotes. Double line breaks create new paragraphs."
      >
        <textarea
          id="body"
          name="body"
          rows={16}
          defaultValue={defaultValues?.body ?? ''}
          placeholder="Write your article here…"
          className={textareaCls}
        />
      </Field>

      <Field id="tags" label="Tags" hint="Comma-separated, e.g. Atlanta, Food, Culture">
        <input
          id="tags"
          name="tags"
          type="text"
          defaultValue={defaultValues?.tags?.join(', ') ?? ''}
          placeholder="Atlanta, Food, Culture"
          className={inputCls}
        />
      </Field>

      <Field
        id="meta_description"
        label="Meta description"
        hint="Used for SEO. Keep under 160 characters."
      >
        <textarea
          id="meta_description"
          name="meta_description"
          rows={2}
          maxLength={160}
          defaultValue={defaultValues?.meta_description ?? ''}
          className={textareaCls}
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <button
          type="submit"
          name="action"
          value="save"
          disabled={isPending}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-charcoal/10 hover:bg-charcoal/20 disabled:opacity-60 disabled:cursor-not-allowed text-brand-black font-subhead font-bold text-sm transition-colors"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Save draft
        </button>
        {isPublished ? (
          <button
            type="submit"
            name="action"
            value="unpublish"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full border border-charcoal/20 text-brand-black font-subhead font-bold text-sm hover:bg-charcoal/5 disabled:opacity-60 transition-colors"
          >
            Unpublish
          </button>
        ) : (
          <button
            type="submit"
            name="action"
            value="publish"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-amber-gold hover:bg-light-gold disabled:opacity-60 disabled:cursor-not-allowed text-brand-black font-subhead font-bold text-sm transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Publish
          </button>
        )}
      </div>
    </form>
  )
}

// ─── Guide form ───────────────────────────────────────────────────────────────

type GuideFormAction = (prev: GuideActionState, formData: FormData) => Promise<GuideActionState>

interface GuideFormProps {
  action: GuideFormAction
  defaultValues?: {
    id?: string
    title?: string
    slug?: string
    subtitle?: string | null
    description?: string | null
    city?: string | null
    meta_description?: string | null
    status?: string
  }
  redirectOnSuccess?: string
}

export function GuideAdminForm({ action, defaultValues, redirectOnSuccess }: GuideFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)
  const router = useRouter()

  useEffect(() => {
    if (state && 'success' in state && redirectOnSuccess) {
      router.push(redirectOnSuccess)
    }
  }, [state, redirectOnSuccess, router])

  const isPublished = defaultValues?.status === 'published'

  return (
    <form action={formAction} className="space-y-5">
      {defaultValues?.id && <input type="hidden" name="id" value={defaultValues.id} />}

      {state && 'error' in state && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <Field id="title" label="Title *">
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={defaultValues?.title ?? ''}
          placeholder="e.g. Atlanta City Guide"
          className={inputCls}
        />
      </Field>

      <Field id="slug" label="Slug" hint="Auto-generated from title if left blank.">
        <input
          id="slug"
          name="slug"
          type="text"
          maxLength={200}
          defaultValue={defaultValues?.slug ?? ''}
          placeholder="atlanta-city-guide"
          className={inputCls}
        />
      </Field>

      <Field id="subtitle" label="Subtitle">
        <input
          id="subtitle"
          name="subtitle"
          type="text"
          maxLength={300}
          defaultValue={defaultValues?.subtitle ?? ''}
          placeholder="Your insider guide to Black-owned Atlanta"
          className={inputCls}
        />
      </Field>

      <Field id="city" label="City">
        <input
          id="city"
          name="city"
          type="text"
          maxLength={100}
          defaultValue={defaultValues?.city ?? ''}
          placeholder="Atlanta"
          className={inputCls}
        />
      </Field>

      <Field id="description" label="Description">
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaultValues?.description ?? ''}
          placeholder="Introductory description for this guide…"
          className={textareaCls}
        />
      </Field>

      <Field
        id="meta_description"
        label="Meta description"
        hint="Used for SEO. Keep under 160 characters."
      >
        <textarea
          id="meta_description"
          name="meta_description"
          rows={2}
          maxLength={160}
          defaultValue={defaultValues?.meta_description ?? ''}
          className={textareaCls}
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <button
          type="submit"
          name="action"
          value="save"
          disabled={isPending}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-charcoal/10 hover:bg-charcoal/20 disabled:opacity-60 disabled:cursor-not-allowed text-brand-black font-subhead font-bold text-sm transition-colors"
        >
          Save draft
        </button>
        {isPublished ? (
          <button
            type="submit"
            name="action"
            value="unpublish"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full border border-charcoal/20 text-brand-black font-subhead font-bold text-sm hover:bg-charcoal/5 disabled:opacity-60 transition-colors"
          >
            Unpublish
          </button>
        ) : (
          <button
            type="submit"
            name="action"
            value="publish"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-amber-gold hover:bg-light-gold disabled:opacity-60 disabled:cursor-not-allowed text-brand-black font-subhead font-bold text-sm transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Publish
          </button>
        )}
      </div>
    </form>
  )
}
