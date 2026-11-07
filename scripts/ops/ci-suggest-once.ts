// One-off CI copy of scripts/ops/suggest-subcategories.ts (ticket 170) on a branch that is never
// merged. Same CSV, read through supabase-js with the staging anon key from CI secrets.
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { suggestSubcategory, type SubcategorySuggestion } from '../../lib/listings/subcategorySuggest'
import type { AssistCategory } from '../../lib/search/assist'

const STAGING = 'fmbohsloskqbmlwbzpjm'
const OUT_DIR = process.argv[2]

async function main() {
  if (!OUT_DIR) throw new Error('out dir arg required')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = new URL(url).hostname.split('.')[0]
  console.log(`Target ref: ${ref}`)
  if (ref !== STAGING) throw new Error('not staging, aborting')
  console.log('Mode: READ-ONLY (anon key, selects only)\n')

  const db = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', { auth: { persistSession: false } })

  const cats = await db.from('categories').select('id, name, slug, parent_id').order('name')
  if (cats.error) throw new Error(`categories ${cats.error.code}`)
  const categories: AssistCategory[] = cats.data.map((c) => ({ id: c.id, name: c.name, slug: c.slug, parentId: c.parent_id }))
  const byId = new Map(categories.map((c) => [c.id, c]))
  const groups = categories.filter((c) => c.parentId === null && categories.some((k) => k.parentId === c.id)).map((c) => c.id)

  type L = { id: string; name: string; tagline: string | null; category_id: string; subcategory_ids: string[] | null }
  const listings: L[] = []
  for (let from = 0; ; from += 1000) {
    const page = await db
      .from('listings')
      .select('id, name, tagline, category_id, subcategory_ids')
      .eq('status', 'published')
      .is('deleted_at', null)
      .in('category_id', groups)
      .order('name')
      .range(from, from + 999)
    if (page.error) throw new Error(`listings ${page.error.code}`)
    listings.push(...(page.data as L[]))
    if (page.data.length < 1000) break
  }

  const desc = new Map<string, string | null>()
  for (let i = 0; i < listings.length; i += 200) {
    const ids = listings.slice(i, i + 200).map((l) => l.id)
    const d = await db.from('listing_details_business').select('listing_id, description').in('listing_id', ids)
    if (d.error) throw new Error(`details ${d.error.code}`)
    for (const r of d.data) desc.set(r.listing_id, r.description)
  }
  console.log(`listings read: ${listings.length}, detail rows read: ${desc.size}`)

  const ORDER: Record<SubcategorySuggestion['confidence'], number> = { several: 0, one: 1, tie: 2, none: 3 }
  const results = listings
    .map((l) => ({
      l,
      s: suggestSubcategory({ name: l.name, tagline: l.tagline, description: desc.get(l.id) ?? null }, l.category_id, categories),
    }))
    .sort((a, b) => ORDER[a.s.confidence] - ORDER[b.s.confidence] || a.l.name.localeCompare(b.l.name))

  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = 'listing_id,name,current_category,current_category_id,suggested_subcategory,suggested_category_id,matched_words,confidence,note,DECISION'
  const body = results.map(({ l, s }) => {
    const notes: string[] = []
    if (s.confidence === 'tie') notes.push(`tied: ${s.tied.map((c) => `${c.name} (${c.id})`).join('; ')}`)
    if ((l.subcategory_ids?.length ?? 0) > 0) notes.push('already has subcategory_ids')
    return [l.id, l.name, byId.get(l.category_id)?.name ?? '', l.category_id, s.suggested?.name ?? '', s.suggested?.id ?? '', s.matched.join('; '), s.confidence, notes.join(' | '), '']
      .map(cell)
      .join(',')
  })

  const out = join(OUT_DIR, `subcategory-suggest-${new Date().toISOString().slice(0, 10)}.csv`)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(out, [header, ...body].join('\n') + '\n', 'utf8')

  const n = (c: SubcategorySuggestion['confidence']) => results.filter((r) => r.s.confidence === c).length
  console.log(`Published listings filed only under a group: ${results.length}`)
  console.log(`  several: ${n('several')}  one: ${n('one')}  tie: ${n('tie')}  none: ${n('none')}`)
  console.log(`  already have subcategory_ids: ${listings.filter((l) => (l.subcategory_ids?.length ?? 0) > 0).length}`)
  console.log(`Wrote: ${out}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'failed')
  process.exit(1)
})
