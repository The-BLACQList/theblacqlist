'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NavRail } from '@/components/nav/NavRail'
import { PageSwitcher, rememberPage } from '@/components/account/PageSwitcher'
import { signOutAction } from '@/lib/actions/auth/signOut'
import {
  SHELL_DEFAULT_OPEN,
  SHELL_NAV_PREF_KEY,
  buildShellGroups,
  pageIdFromPath,
  pickPageId,
} from '@/lib/account/shellNav'
import type { ShellData } from '@/lib/account/shellData'

function Wordmark({ label }: { label?: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-headline text-xl font-semibold text-white">
        BLACQ<span className="text-gold">List</span>
      </span>
      {label && (
        <span className="truncate font-subhead text-sm font-semibold text-ink-soft">{label}</span>
      )}
    </span>
  )
}

/** Members only: where their business tools would be (mockup A). */
function OwnBusinessCard() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/20 p-4">
      <p className="font-headline text-lg font-semibold text-white">Own a Business?</p>
      <p className="font-body text-sm leading-relaxed text-ink-soft">
        Claim it free. Your business tools show up right here in this menu.
      </p>
      <Link
        href="/claim"
        className="mt-1 inline-flex min-h-11 items-center justify-center self-start rounded-full bg-gold px-5 font-subhead text-[15px] font-semibold text-brand-black hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Claim My Business
      </Link>
      {/* Claiming only works for a business already on the site (ticket 050). */}
      <Link
        href="/add-business"
        className="inline-flex min-h-11 items-center self-start font-subhead text-sm text-ink-soft underline underline-offset-2 hover:text-white"
      >
        Not Listed Yet? Add It
      </Link>
    </div>
  )
}

function Footer({ displayName }: { displayName: string }) {
  const initial = displayName.charAt(0).toUpperCase() || 'B'
  return (
    <div className="flex items-center gap-3 px-2">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 font-subhead text-sm font-semibold text-white"
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1 truncate font-subhead text-[15px] text-white">
        {displayName}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-full px-3 font-subhead text-sm font-semibold text-ink-soft hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Sign Out
        </button>
      </form>
    </div>
  )
}

/**
 * The one signed-in menu (ticket 252), on every /account and /dashboard page.
 * Owners: page switcher, Your Business, Page Tools, More Page Tools, You,
 * Account. Members: You, Account and an "Own a Business?" card.
 */
export function SignedInShell({ data }: { data: ShellData }) {
  const pathname = usePathname()
  const pageId = pickPageId(pathname, data.pages, data.cookiePageId)

  // Opening a page's tool makes it the chosen page, so Home and the menu
  // follow the page you were last working on.
  const pathPageId = pageIdFromPath(pathname)
  useEffect(() => {
    if (pathPageId && pathPageId === pageId && pathPageId !== data.cookiePageId) {
      rememberPage(pathPageId)
    }
  }, [pathPageId, pageId, data.cookiePageId])

  const groups = buildShellGroups({
    isOwner: data.isOwner,
    isAdmin: data.isAdmin,
    pageId,
    counts: data.counts,
    flags: data.flags,
  })
  const onBusiness = pathname.startsWith('/dashboard')
  const context = data.isOwner && onBusiness ? 'My Business' : 'My Account'

  return (
    <NavRail
      navLabel="Account Navigation"
      testIdPrefix="account-nav"
      groups={groups}
      storageKey={SHELL_NAV_PREF_KEY}
      defaultOpen={SHELL_DEFAULT_OPEN}
      brand={<Wordmark />}
      barTitle={<Wordmark label={context} />}
      drawerTitle={`${context} Menu`}
      drawerDescription="Your business and account pages, grouped. Groups with something waiting show a count."
      top={
        data.isOwner && pageId && data.pages.length > 0 ? (
          <PageSwitcher pages={data.pages} selectedId={pageId} />
        ) : undefined
      }
      afterGroups={data.isOwner ? undefined : <OwnBusinessCard />}
      footer={<Footer displayName={data.displayName} />}
    />
  )
}
