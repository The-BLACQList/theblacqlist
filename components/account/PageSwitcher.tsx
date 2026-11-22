'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { PAGE_COOKIE, pageIdFromPath, pageInitials, type ShellPage } from '@/lib/account/shellNav'
import { getPlanMeta, type PlanSlug } from '@/lib/stripe/plans'
import { cn } from '@/lib/utils'

function planName(tier: string | null): string {
  try {
    return getPlanMeta((tier ?? 'free') as PlanSlug).name
  } catch {
    return 'Free'
  }
}

export function rememberPage(id: string) {
  document.cookie = `${PAGE_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`
}

/**
 * The owner's current page at the top of the menu (mockup A). Opening it lists
 * their other pages; picking one keeps you on the same tool for that page.
 */
export function PageSwitcher({ pages, selectedId }: { pages: ShellPage[]; selectedId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const selected = pages.find((p) => p.id === selectedId) ?? pages[0]

  // Close on Esc and on a click outside.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (!selected) return null

  function choose(id: string) {
    setOpen(false)
    rememberPage(id)
    const current = pageIdFromPath(pathname)
    if (current) {
      router.push(pathname.replace(`/dashboard/pages/${current}`, `/dashboard/pages/${id}`))
    } else {
      router.refresh()
    }
  }

  const others = pages.filter((p) => p.id !== selected.id)

  return (
    <div ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${selected.name}, ${planName(selected.tier)} Plan. Switch Business Page`}
        data-testid="page-switcher"
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-left text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold font-subhead text-sm font-bold text-brand-black"
        >
          {pageInitials(selected.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-subhead text-[15px] font-semibold">
            {selected.name}
          </span>
          <span className="block font-subhead text-sm text-ink-soft">
            {planName(selected.tier)} Plan
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4.5 shrink-0 transition-transform motion-reduce:transition-none',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          id={listId}
          className="mt-2 flex flex-col gap-0.5 rounded-xl bg-white p-2 text-brand-black shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
        >
          {others.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p.id)}
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left font-subhead text-[15px] font-medium hover:bg-pale-lavender focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            >
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-sm text-charcoal-soft">{planName(p.tier)}</span>
            </button>
          ))}
          <Link
            href="/dashboard/pages"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-lg px-3 font-subhead text-[15px] font-semibold text-brand-black hover:bg-pale-lavender focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            All My Pages
          </Link>
          <Link
            href="/add-business"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-lg px-3 font-subhead text-[15px] font-semibold text-amber hover:bg-pale-lavender focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            Add Another Page
          </Link>
        </div>
      )}
    </div>
  )
}
