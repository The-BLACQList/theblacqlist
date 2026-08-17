import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Plus, Users } from 'lucide-react'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  PERSONAL_SPEND_MONTHS,
  buildCategoryBreakdown,
  buildMonthSeries,
  buildTotals,
  formatDollars,
  formatDollarsExact,
  type PersonalReceipt,
} from '@/lib/spend/personal-spend'

export const metadata: Metadata = { title: 'My Spending' }

/**
 * The user's own verified spend, by month and by category (ledger 4.1c).
 *
 * ── This is the private counterpart to /account/community-spend ─────────────
 * That page answers "where does the community's money go" and is deliberately
 * blunted: businesses and cities below AGGREGATE_MIN_TRANSACTIONS are withheld
 * because naming a business next to a dollar figure when only one or two people
 * shopped there can identify the shopper. **None of that applies on this page.**
 * Every row here belongs to the signed-in user, so the reader is the subject —
 * applying the threshold would hide someone's own money from them. The privacy
 * obligation on this surface is the other one: these rows must never reach
 * anyone else, which is what `.eq('user_id', user.id)` below enforces.
 *
 * ── Why the service client ─────────────────────────────────────────────────
 * Same reason as every other spend surface: reads go through the service client
 * with an explicit owner filter rather than leaning on RLS, so the permissive
 * `USING (true)` grants on the aggregate tables stay removable. `receipt_uploads`
 * does have a real owner policy (`receipt_uploads_owner_select`), so the filter
 * here is belt-and-braces — but it is the *only* thing standing between one
 * user and another's receipts on this code path. Do not drop it.
 *
 * ── aggregate_opt_out is not consulted ─────────────────────────────────────
 * That flag excludes a receipt from the *community* aggregate. It was never a
 * request to be hidden from oneself, and the footnote below says so plainly so
 * the number never looks like a bug to someone who opted out.
 */
export default async function MySpendingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/account/spending')

  const serviceClient = createServiceClient()

  const { data: receiptRows } = await serviceClient
    .from('receipt_uploads')
    .select('amount_cents, purchase_date, status, listing_id')
    .eq('user_id', user.id)
    .order('purchase_date', { ascending: false })

  const receipts: PersonalReceipt[] = receiptRows ?? []
  const totals = buildTotals(receipts)

  // The trend window ends on the current month, so an empty current month still
  // renders as a zero bar rather than the series quietly ending in the past.
  const now = new Date()
  const endMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const months = buildMonthSeries(receipts, endMonthKey)

  // Category names in two hops, mirroring /account/community-spend: listings ->
  // category_id, then categories -> name. `listings` carries several foreign
  // keys, so a nested embed would need a disambiguating hint; two small `.in()`
  // reads are clearer and are what the community page already proved out.
  const approvedListingIds = Array.from(
    new Set(
      receipts.filter((r) => r.status === 'approved' && r.listing_id).map((r) => r.listing_id!)
    )
  )

  const categoryIdByListingId = new Map<string, string | null>()
  const categoryNameById = new Map<string, string>()

  if (approvedListingIds.length > 0) {
    const { data: listingRows } = await serviceClient
      .from('listings')
      .select('id, category_id')
      .in('id', approvedListingIds)

    for (const row of listingRows ?? []) {
      categoryIdByListingId.set(row.id, (row.category_id as string | null) ?? null)
    }

    const categoryIds = Array.from(
      new Set(Array.from(categoryIdByListingId.values()).filter((id): id is string => !!id))
    )

    if (categoryIds.length > 0) {
      const { data: categoryRows } = await serviceClient
        .from('categories')
        .select('id, name')
        .in('id', categoryIds)

      for (const row of categoryRows ?? []) {
        categoryNameById.set(row.id, row.name as string)
      }
    }
  }

  const categories = buildCategoryBreakdown(receipts, categoryIdByListingId, categoryNameById)

  const maxMonthAmount = Math.max(...months.map((m) => m.amountCents), 0)
  const monthsWithSpend = months.filter((m) => m.amountCents > 0)
  const busiestMonth = monthsWithSpend.reduce<(typeof months)[number] | null>(
    (best, m) => (best === null || m.amountCents > best.amountCents ? m : best),
    null
  )
  const windowTotal = months.reduce((sum, m) => sum + m.amountCents, 0)
  const averagePerActiveMonth =
    monthsWithSpend.length > 0 ? Math.round(windowTotal / monthsWithSpend.length) : 0

  return (
    <main>
      <div className="max-w-[720px] mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-headline text-2xl text-brand-black">My spending</h1>
            <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
              Where your verified support has gone
            </p>
          </div>
          <Link
            href="/account/receipts/new"
            className="inline-flex items-center gap-2 min-h-11 h-11 px-4 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors shrink-0"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add receipt
          </Link>
        </div>

        {totals.approvedReceiptCount === 0 ? (
          /* Two distinct empty states, because they need two different actions:
             nothing submitted at all vs. submitted but not yet reviewed. Telling
             someone with three pending receipts to "add a receipt" reads as if
             theirs vanished. */
          <div className="rounded-xl bg-white border border-charcoal/10 px-6 py-12 text-center">
            {totals.pendingReceiptCount > 0 ? (
              <>
                <p className="font-subhead text-sm font-semibold text-brand-black">
                  Nothing verified yet
                </p>
                <p className="font-body text-xs text-charcoal-soft mt-1 mb-4 max-w-[38ch] mx-auto">
                  You have {totals.pendingReceiptCount}{' '}
                  {totals.pendingReceiptCount === 1 ? 'receipt' : 'receipts'} awaiting review. Your
                  breakdown appears here once our team approves{' '}
                  {totals.pendingReceiptCount === 1 ? 'it' : 'them'} — usually within 1–3 business
                  days.
                </p>
                <Link
                  href="/account/receipts"
                  className="inline-flex items-center min-h-11 h-11 px-5 rounded-full border border-charcoal/20 hover:bg-pale-lavender text-brand-black font-subhead font-bold text-sm transition-colors"
                >
                  View my receipts
                </Link>
              </>
            ) : (
              <>
                <p className="font-subhead text-sm font-semibold text-brand-black">
                  No spending tracked yet
                </p>
                <p className="font-body text-xs text-charcoal-soft mt-1 mb-4 max-w-[38ch] mx-auto">
                  Submit a receipt from a Black-owned business and it shows up here — by month and
                  by category — once it&rsquo;s verified.
                </p>
                <Link
                  href="/account/receipts/new"
                  className="inline-flex items-center gap-2 min-h-11 h-11 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Submit your first receipt
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white border border-charcoal/10 p-5 sm:col-span-1">
                <p className="font-subhead text-[11px] text-charcoal-soft font-semibold uppercase tracking-wide">
                  Verified spend
                </p>
                <p className="font-headline text-3xl text-brand-black mt-1">
                  {formatDollars(totals.approvedAmountCents)}
                </p>
                <p className="font-body text-xs text-charcoal-soft mt-0.5">
                  {totals.approvedReceiptCount}{' '}
                  {totals.approvedReceiptCount === 1 ? 'receipt' : 'receipts'}
                </p>
              </div>
              <div className="rounded-xl bg-white border border-charcoal/10 p-5">
                <p className="font-subhead text-[11px] text-charcoal-soft font-semibold uppercase tracking-wide">
                  Businesses supported
                </p>
                <p className="font-headline text-3xl text-brand-black mt-1">
                  {totals.businessCount}
                </p>
                <p className="font-body text-xs text-charcoal-soft mt-0.5">
                  Matched to a BLACQList listing
                </p>
              </div>
              <div className="rounded-xl bg-white border border-charcoal/10 p-5">
                <p className="font-subhead text-[11px] text-charcoal-soft font-semibold uppercase tracking-wide">
                  Average month
                </p>
                <p className="font-headline text-3xl text-brand-black mt-1">
                  {averagePerActiveMonth > 0 ? formatDollars(averagePerActiveMonth) : '—'}
                </p>
                <p className="font-body text-xs text-charcoal-soft mt-0.5">
                  {monthsWithSpend.length > 0
                    ? `Across ${monthsWithSpend.length} ${monthsWithSpend.length === 1 ? 'month' : 'months'} with spend`
                    : 'No spend in the last 12 months'}
                </p>
              </div>
            </div>

            {totals.pendingReceiptCount > 0 && (
              <p
                role="status"
                className="rounded-xl bg-pale-lavender border border-charcoal/10 px-4 py-3 font-body text-xs text-charcoal"
              >
                {totals.pendingReceiptCount}{' '}
                {totals.pendingReceiptCount === 1 ? 'receipt is' : 'receipts are'} still awaiting
                review and {totals.pendingReceiptCount === 1 ? 'is' : 'are'} not counted above.{' '}
                <Link href="/account/receipts" className="font-semibold underline">
                  View receipts
                </Link>
              </p>
            )}

            {/* By month — plain divs, no chart library. The numbers are in the
                table semantics, so the bars are presentation only and the whole
                thing reads correctly with the bars ignored entirely. */}
            <section className="rounded-xl bg-white border border-charcoal/10 p-5">
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2 className="font-headline text-base text-brand-black">By month</h2>
                <p className="font-subhead text-[11px] text-charcoal-faint">
                  Last {PERSONAL_SPEND_MONTHS} months
                </p>
              </div>

              {maxMonthAmount === 0 ? (
                <p className="font-body text-xs text-charcoal-soft">
                  Your verified receipts are all older than {PERSONAL_SPEND_MONTHS} months, so
                  there&rsquo;s nothing to chart in this window. The totals above still include
                  them.
                </p>
              ) : (
                <>
                  <table className="w-full">
                    <caption className="sr-only">
                      Verified spend by month for the last {PERSONAL_SPEND_MONTHS} months
                    </caption>
                    <thead className="sr-only">
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((month) => (
                        <tr key={month.key}>
                          <th
                            scope="row"
                            className="text-left font-subhead text-xs font-semibold text-charcoal whitespace-nowrap py-1.5 pr-3 align-middle w-[1%]"
                          >
                            {month.label}
                          </th>
                          <td className="py-1.5 align-middle">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 rounded-full bg-amber-gold min-w-[2px]"
                                style={{
                                  width: `${Math.max((month.amountCents / maxMonthAmount) * 100, month.amountCents > 0 ? 2 : 0)}%`,
                                }}
                                aria-hidden="true"
                              />
                              <span
                                className={
                                  month.amountCents > 0
                                    ? 'font-subhead text-xs text-brand-black whitespace-nowrap'
                                    : 'font-subhead text-xs text-charcoal-faint whitespace-nowrap'
                                }
                              >
                                {month.amountCents > 0
                                  ? formatDollarsExact(month.amountCents)
                                  : '—'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {busiestMonth && (
                    <p className="font-body text-xs text-charcoal-soft mt-3 pt-3 border-t border-charcoal/5">
                      Your biggest month was {busiestMonth.label} at{' '}
                      {formatDollarsExact(busiestMonth.amountCents)}.
                    </p>
                  )}
                </>
              )}
            </section>

            {/* By category */}
            <section className="rounded-xl bg-white border border-charcoal/10 p-5">
              <h2 className="font-headline text-base text-brand-black mb-4">By category</h2>
              <ul className="flex flex-col gap-3">
                {categories.map((category) => {
                  const share =
                    totals.approvedAmountCents > 0
                      ? Math.round((category.amountCents / totals.approvedAmountCents) * 100)
                      : 0
                  return (
                    <li key={category.key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-subhead text-sm font-semibold text-brand-black">
                          {category.name}
                        </p>
                        <p className="font-subhead text-sm text-brand-black whitespace-nowrap">
                          {formatDollarsExact(category.amountCents)}
                          <span className="text-charcoal-faint font-normal"> · {share}%</span>
                        </p>
                      </div>
                      <div
                        className="mt-1 h-1.5 rounded-full bg-charcoal/5 overflow-hidden"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full bg-amber"
                          style={{ width: `${Math.max(share, 1)}%` }}
                        />
                      </div>
                      <p className="font-body text-[11px] text-charcoal-faint mt-0.5">
                        {category.receiptCount}{' '}
                        {category.receiptCount === 1 ? 'receipt' : 'receipts'}
                      </p>
                    </li>
                  )
                })}
              </ul>
              <p className="font-body text-xs text-charcoal-soft mt-4 pt-3 border-t border-charcoal/5">
                Receipts you entered by business name, without picking a BLACQList listing, are
                grouped under &ldquo;Not matched to a business.&rdquo; They still count toward your
                total.
              </p>
            </section>

            <Link
              href="/account/community-spend"
              className="flex items-center gap-3 rounded-xl bg-white border border-charcoal/10 p-4 hover:border-amber/40 transition-colors"
            >
              <Users className="size-5 text-amber shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-subhead text-sm font-semibold text-brand-black">
                  See the community total
                </span>
                <span className="block font-body text-xs text-charcoal-soft">
                  How BLACQList spending adds up across everyone
                </span>
              </span>
            </Link>
          </>
        )}

        <p className="font-body text-xs text-charcoal-faint text-center">
          This page is private to you. Figures cover approved receipts only, and include receipts
          you excluded from the community aggregate.
        </p>
      </div>
    </main>
  )
}
