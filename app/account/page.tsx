import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Settings,
  Bookmark,
  ChevronRight,
  FileCheck,
  Receipt,
  TrendingUp,
  History,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account')

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? user.email?.split('@')[0] ?? 'there'

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-12 px-4">
      <div className="max-w-[640px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-headline text-3xl text-brand-black">Welcome, {displayName}</h1>
          <p className="font-subhead text-sm text-charcoal mt-1">{user.email}</p>
        </div>

        {/* Quick links */}
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard/pages"
            className="flex items-center gap-4 bg-white rounded-xl border border-charcoal/10 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
              <LayoutDashboard className="size-5 text-amber-gold" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-subhead text-sm font-semibold text-brand-black">My listings</p>
              <p className="font-subhead text-xs text-charcoal/60">
                Manage your drafts and published pages
              </p>
            </div>
            <ChevronRight className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/account/activity"
            className="flex items-center gap-4 bg-white rounded-xl border border-charcoal/10 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
              <History className="size-5 text-amber-gold" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-subhead text-sm font-semibold text-brand-black">Recently viewed</p>
              <p className="font-subhead text-xs text-charcoal/60">
                Businesses you&apos;ve visited
              </p>
            </div>
            <ChevronRight className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/account/recommended"
            className="flex items-center gap-4 bg-white rounded-xl border border-charcoal/10 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
              <Sparkles className="size-5 text-amber-gold" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-subhead text-sm font-semibold text-brand-black">
                Recommended for you
              </p>
              <p className="font-subhead text-xs text-charcoal/60">
                Based on your saved businesses
              </p>
            </div>
            <ChevronRight className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/account/saved"
            className="flex items-center gap-4 bg-white rounded-xl border border-charcoal/10 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
              <Bookmark className="size-5 text-amber-gold" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-subhead text-sm font-semibold text-brand-black">
                Saved businesses
              </p>
              <p className="font-subhead text-xs text-charcoal/60">Businesses you&apos;ve saved</p>
            </div>
            <ChevronRight className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/account/claims"
            className="flex items-center gap-4 bg-white rounded-xl border border-charcoal/10 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
              <FileCheck className="size-5 text-amber-gold" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-subhead text-sm font-semibold text-brand-black">My claims</p>
              <p className="font-subhead text-xs text-charcoal/60">
                Listing claims you&apos;ve submitted
              </p>
            </div>
            <ChevronRight className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/account/receipts"
            className="flex items-center gap-4 bg-white rounded-xl border border-charcoal/10 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
              <Receipt className="size-5 text-amber-gold" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-subhead text-sm font-semibold text-brand-black">My receipts</p>
              <p className="font-subhead text-xs text-charcoal/60">
                Track your spending at Black-owned businesses
              </p>
            </div>
            <ChevronRight className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/account/community-spend"
            className="flex items-center gap-4 bg-white rounded-xl border border-charcoal/10 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
              <TrendingUp className="size-5 text-amber-gold" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-subhead text-sm font-semibold text-brand-black">Community spend</p>
              <p className="font-subhead text-xs text-charcoal/60">
                See the community&apos;s collective impact
              </p>
            </div>
            <ChevronRight className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/account/settings"
            className="flex items-center gap-4 bg-white rounded-xl border border-charcoal/10 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
              <Settings className="size-5 text-charcoal" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-subhead text-sm font-semibold text-brand-black">
                Account settings
              </p>
              <p className="font-subhead text-xs text-charcoal/60">
                Display name, bio, and preferences
              </p>
            </div>
            <ChevronRight className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
          </Link>
        </div>

      </div>
    </main>
  )
}
