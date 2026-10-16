'use client'

import {
  createContext,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLeaveGuard } from './useLeaveGuard'

// One Save for the whole business profile (ticket 140). Each typed card keeps
// its own form and server action, but inside this provider the cards register
// here instead of showing their own Save button. The bar saves every card whose
// values changed since its last save, one after another, and the leave pop-up
// offers the same save before the owner goes. Outside the provider (event and
// job editors) the cards work on their own, exactly as before.

const SAVE_FAILED = "Couldn't save. Check your connection and try again."

// Writing-help ids ride along with a save but aren't the owner's edits, and
// they clear once saved, so they never count as a change.
const IGNORED_FIELDS = new Set(['ai_suggestion_id'])

function serialize(form: HTMLFormElement): string {
  const pairs: [string, string][] = []
  for (const [key, value] of new FormData(form)) {
    if (IGNORED_FIELDS.has(key)) continue
    pairs.push([key, typeof value === 'string' ? value : ''])
  }
  return JSON.stringify(pairs)
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

interface Entry {
  label: string
  anchorId: string
  getForm: () => HTMLFormElement | null
  save: (fd: FormData) => Promise<boolean>
  /** What the form held when it was last saved; null until first seen. */
  snapshot: string | null
}

/** Where to send the owner after a failed save: a card to fix. */
interface Failure {
  anchorId: string
  /** Set when the browser's own check failed, so it can point at the field. */
  invalidForm?: HTMLFormElement
}

type Result = { kind: 'ok' | 'error'; text: string } | null

interface SaveAllOptions {
  /** False while the leave pop-up is open; focus moves after it closes. */
  focus?: boolean
}

interface Api {
  live: boolean
  register: (id: string, entry: Omit<Entry, 'snapshot'>) => () => void
  refresh: () => void
  saveAll: (opts?: SaveAllOptions) => Promise<boolean>
  hasChanges: () => boolean
  /** Callback ref for the save bar, so focused fields can clear it. */
  setBar: (el: HTMLDivElement | null) => void
}

interface Status {
  dirtyCount: number
  saving: boolean
  result: Result
}

const ApiContext = createContext<Api | null>(null)
const StatusContext = createContext<Status>({ dirtyCount: 0, saving: false, result: null })

/** The page-wide save, or null outside a business profile editor. */
export function useProfileSave(): Api | null {
  return useContext(ApiContext)
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function goToFailure(f: Failure) {
  if (f.invalidForm) {
    // Focuses the first field that needs fixing and says why.
    f.invalidForm.reportValidity()
    return
  }
  const el = document.getElementById(f.anchorId)
  if (!el) return
  el.focus({ preventScroll: true })
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

interface ProviderProps {
  live: boolean
  rootRef: RefObject<HTMLElement | null>
  children: ReactNode
}

export function ProfileSaveProvider({ live, rootRef, children }: ProviderProps) {
  const router = useRouter()
  const entries = useRef(new Map<string, Entry>())
  const barRef = useRef<HTMLDivElement>(null)
  const setBar = useCallback((el: HTMLDivElement | null) => {
    barRef.current = el
  }, [])
  const liveRef = useRef(live)
  useEffect(() => {
    liveRef.current = live
  }, [live])

  const [dirtyIds, setDirtyIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<Result>(null)

  // Changed cards in page order, so the first failure is the highest one.
  const dirtyEntries = useCallback((): [string, Entry][] => {
    const out: [string, Entry, HTMLFormElement][] = []
    for (const [id, entry] of entries.current) {
      const form = entry.getForm()
      if (!form || !form.isConnected) continue
      const now = serialize(form)
      if (entry.snapshot === null) {
        entry.snapshot = now
        continue
      }
      if (now !== entry.snapshot) out.push([id, entry, form])
    }
    out.sort((a, b) =>
      a[2].compareDocumentPosition(b[2]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )
    return out.map(([id, entry]) => [id, entry])
  }, [])

  const frame = useRef(0)
  const refresh = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const ids = dirtyEntries().map(([id]) => id)
      setDirtyIds((prev) =>
        prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids
      )
    })
  }, [dirtyEntries])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const register = useCallback<Api['register']>(
    (id, entry) => {
      const form = entry.getForm()
      entries.current.set(id, { ...entry, snapshot: form ? serialize(form) : null })
      refresh()
      return () => {
        entries.current.delete(id)
        refresh()
      }
    },
    [refresh]
  )

  const running = useRef<Promise<boolean> | null>(null)
  const failure = useRef<Failure | null>(null)

  const saveAll = useCallback<Api['saveAll']>(
    ({ focus = true } = {}) => {
      if (running.current) return running.current
      const run = (async (): Promise<boolean> => {
        failure.current = null
        const dirty = dirtyEntries()
        if (dirty.length === 0) return true

        for (const [, entry] of dirty) {
          const form = entry.getForm()
          if (form && !form.checkValidity()) {
            failure.current = { anchorId: entry.anchorId, invalidForm: form }
            setResult({ kind: 'error', text: `Check ${entry.label} first.` })
            if (focus) goToFailure(failure.current)
            return false
          }
        }

        setSaving(true)
        setResult(null)
        const failed: Entry[] = []
        try {
          for (const [, entry] of dirty) {
            const form = entry.getForm()
            if (!form) continue
            // Read before the await, so typing during the save stays a change.
            const sent = serialize(form)
            const ok = await entry.save(new FormData(form))
            if (ok) entry.snapshot = sent
            else failed.push(entry)
          }
        } finally {
          setSaving(false)
        }

        const [firstFailed] = failed
        if (firstFailed) {
          const many = failed.length > 1
          setResult({
            kind: 'error',
            text: `Couldn't save ${joinLabels(failed.map((f) => f.label))}. See the ${many ? 'notes on those cards' : 'note on that card'}.`,
          })
          failure.current = { anchorId: firstFailed.anchorId }
          if (focus) goToFailure(failure.current)
          return false
        }
        setResult({
          kind: 'ok',
          text: liveRef.current ? 'Published. Your changes are on your page now.' : 'Saved.',
        })
        return true
      })()
      running.current = run
      void run.finally(() => {
        running.current = null
        refresh()
      })
      return run
    },
    [dirtyEntries, refresh]
  )

  const hasChanges = useCallback(() => dirtyEntries().length > 0, [dirtyEntries])

  // Typing in an uncontrolled field doesn't re-render anything, so listen.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.addEventListener('input', refresh)
    root.addEventListener('change', refresh)
    return () => {
      root.removeEventListener('input', refresh)
      root.removeEventListener('change', refresh)
    }
  }, [rootRef, refresh])

  // Keep a focused field from hiding behind the stuck bar.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onFocus = (e: FocusEvent) => {
      const bar = barRef.current
      const t = e.target
      if (!bar || !(t instanceof HTMLElement) || bar.contains(t)) return
      if (!(t.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING)) return
      const barTop = bar.getBoundingClientRect().top
      const box = t.getBoundingClientRect()
      if (box.bottom > barTop && box.top < window.innerHeight) {
        window.scrollBy({ top: box.bottom - barTop + 16 })
      }
    }
    root.addEventListener('focusin', onFocus)
    return () => root.removeEventListener('focusin', onFocus)
  }, [rootRef])

  const [leave, setLeave] = useState<{ href: string; cards: boolean } | null>(null)
  const [leaving, setLeaving] = useState(false)
  useLeaveGuard(rootRef, {
    cardsDirty: hasChanges,
    onBlock: (href) => setLeave({ href, cards: hasChanges() }),
  })

  async function saveAndLeave() {
    if (!leave) return
    setLeaving(true)
    const ok = await saveAll({ focus: false })
    setLeaving(false)
    const href = leave.href
    setLeave(null)
    if (ok) router.push(href)
  }

  const api = useMemo<Api>(
    () => ({ live, register, refresh, saveAll, hasChanges, setBar }),
    [live, register, refresh, saveAll, hasChanges, setBar]
  )
  const status = useMemo<Status>(
    () => ({ dirtyCount: dirtyIds.length, saving, result }),
    [dirtyIds.length, saving, result]
  )
  const saveWord = live ? 'Publish changes' : 'Save changes'

  return (
    <ApiContext.Provider value={api}>
      <StatusContext.Provider value={status}>
        {children}
        <Dialog
          open={leave !== null}
          onOpenChange={(open) => {
            if (!open && !leaving) setLeave(null)
          }}
        >
          <DialogContent
            showClose={false}
            className="p-6"
            onCloseAutoFocus={(e) => {
              const f = failure.current
              if (!f) return
              e.preventDefault()
              failure.current = null
              goToFailure(f)
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-lg">
                {leave?.cards ? 'Save your changes before you go?' : 'Leave this page?'}
              </DialogTitle>
              <DialogDescription>
                {leave?.cards
                  ? live
                    ? "Your changes aren't on your public page yet."
                    : "Your changes aren't saved yet."
                  : "You started adding something that isn't added yet. If you leave, it's lost."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
              {leave?.cards && (
                <button
                  type="button"
                  onClick={() => void saveAndLeave()}
                  disabled={leaving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-gold px-5 font-subhead text-sm font-bold text-brand-black transition-colors hover:bg-light-gold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {leaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {leaving ? 'Saving…' : saveWord}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const href = leave?.href
                  setLeave(null)
                  if (href) router.push(href)
                }}
                disabled={leaving}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-charcoal/20 bg-white px-5 font-subhead text-sm font-semibold text-brand-black transition-colors hover:border-charcoal/40 disabled:opacity-50"
              >
                Leave without saving
              </button>
              <button
                type="button"
                onClick={() => setLeave(null)}
                disabled={leaving}
                className="inline-flex h-11 items-center justify-center rounded-lg px-4 font-subhead text-sm font-semibold text-charcoal underline decoration-charcoal/30 underline-offset-4 hover:text-brand-black disabled:opacity-50 sm:mr-auto"
              >
                Keep editing
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </StatusContext.Provider>
    </ApiContext.Provider>
  )
}

/**
 * The sticky bar under the cards. It sits above the send or publish card in
 * the page flow, so once the owner scrolls that far it stops covering it.
 */
export function SaveBar() {
  const api = useContext(ApiContext)
  const { dirtyCount, saving, result } = useContext(StatusContext)
  if (!api) return null
  const { live, saveAll, setBar } = api

  const changed = dirtyCount === 1 ? '1 card changed' : `${dirtyCount} cards changed`
  let message: ReactNode = dirtyCount > 0 ? changed : 'No changes to save'
  if (saving) message = 'Saving…'
  else if (result?.kind === 'error') {
    message = (
      <span className="flex items-start gap-1.5 text-red-700">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {result.text}
      </span>
    )
  } else if (result?.kind === 'ok' && dirtyCount === 0) {
    message = (
      <span className="flex items-start gap-1.5 text-green-700">
        <CheckCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {result.text}
      </span>
    )
  }

  return (
    <div ref={setBar} className="sticky bottom-3 z-20">
      <div className="flex items-center gap-3 rounded-xl border border-charcoal/15 bg-white px-4 py-3 shadow-[0_6px_24px_rgba(0,0,0,0.12)]">
        <p role="status" className="min-w-0 flex-1 font-body text-sm text-charcoal">
          {message}
        </p>
        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={saving || dirtyCount === 0}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-gold px-5 font-subhead text-sm font-bold text-brand-black transition-colors hover:bg-light-gold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {live ? 'Publish changes' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

type SectionAction<S> = (prev: S | null, formData: FormData) => Promise<S | null>
type SectionState<S> = S | { error: string } | null

interface SectionSave<S> {
  state: SectionState<S>
  pending: boolean
  /** True inside the profile editor: hide the card's own Save and "Saved." note. */
  collective: boolean
  formProps: ComponentPropsWithRef<'form'> & { 'data-profile-save'?: string }
}

/**
 * Wires one card's form to the page-wide save. Without the provider it is a
 * plain useActionState form, so the card keeps its own button.
 */
export function useSectionSave<S extends object>({
  id,
  label,
  action,
}: {
  /** Also the id of the card's anchor on the page. */
  id: string
  /** How the bar names the card, e.g. "Contact". */
  label: string
  action: SectionAction<S>
}): SectionSave<S> {
  const api = useContext(ApiContext)
  const [actionState, formAction, pending] = useActionState(action, null)
  const [ownState, setOwnState] = useState<SectionState<S>>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const actionRef = useRef(action)
  const stateRef = useRef<SectionState<S>>(null)
  useEffect(() => {
    actionRef.current = action
  })

  useEffect(() => {
    if (!api) return
    return api.register(id, {
      label,
      anchorId: id,
      getForm: () => formRef.current,
      save: async (fd) => {
        let next: SectionState<S>
        try {
          next = await actionRef.current(stateRef.current as S | null, fd)
        } catch {
          next = { error: SAVE_FAILED }
        }
        stateRef.current = next
        setOwnState(next)
        return next !== null && !('error' in next)
      },
    })
  }, [api, id, label])

  // Controlled fields (Use this, hours, checkboxes) change without an input
  // event reaching the page, so check after every render too.
  useEffect(() => {
    api?.refresh()
  })

  if (!api) {
    return {
      state: actionState,
      pending,
      collective: false,
      formProps: { ref: formRef, action: formAction },
    }
  }
  return {
    state: ownState,
    pending: false,
    collective: true,
    formProps: {
      ref: formRef,
      onSubmit: (e) => {
        e.preventDefault()
        void api.saveAll()
      },
      'data-profile-save': '',
    },
  }
}

/** Keeps Enter-to-save working in a card whose own button is hidden. */
export function CollectiveSubmit() {
  return (
    <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only">
      Save
    </button>
  )
}
