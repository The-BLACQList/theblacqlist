import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminRole } from '@/lib/admin/guard'
import { isFeatureEnabled } from '@/lib/env'
import {
  creatorSubcategories,
  withoutCreatorCategories,
} from '@/lib/listings/creatorCategories'
import { quickStartMode } from '@/lib/listings/quickStart'
import { QuickStart } from './_components/quick-start/QuickStart'
import { loadCategoryLevels } from '@/lib/listings/levelRows'

interface PageProps {
  /** `name` is the admin prefill from /admin/receipts/unlisted (ticket 168). */
  searchParams: Promise<{ as?: string | string[]; name?: string | string[] }>
}

// `?as=creator` (ticket 132) runs the same quick start worded for a person.
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { as } = await searchParams
  if (quickStartMode(as) === 'creator') {
    return {
      title: 'Add Your Creator Page | The BLACQList',
      description:
        'List yourself as a creator on The BLACQList, the home for Black-owned businesses and Black creators. Adding your page is free.',
    }
  }
  return {
    title: 'Add Your Business | The BLACQList',
    description:
      'List your business on The BLACQList, the home for Black-owned businesses. Adding your page is free.',
  }
}

export interface CategoryOption {
  id: string
  name: string
  slug: string
  parent_id: string | null
}

export default async function AddBusinessPage({ searchParams }: PageProps) {
  const { as, name } = await searchParams
  const mode = quickStartMode(as)
  const creator = mode === 'creator'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user)
    redirect(
      creator
        ? `/sign-in?next=${encodeURIComponent('/add-business?as=creator')}`
        : '/sign-in?next=/add-business'
    )

  const [{ data: categoryRows }, { data: cityRows }] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, slug, parent_id')
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('cities')
      .select('id, name, states!cities_state_id_fkey(code)')
      .eq('is_active', true)
      .order('name'),
  ])

  // Level rules drive "What's your main role?". Read apart so a database
  // without the level columns still lists every category (the step is then
  // skipped, since a category with no rules reads as local only).
  const levelMap = await loadCategoryLevels(
    supabase,
    (categoryRows ?? []).map((c) => c.id)
  )
  const categories = (categoryRows ?? []).map((c) => {
    const levels = levelMap?.get(c.id)
    return levels ? { ...c, ...levels } : c
  })

  // "Add as a listing" on /admin/receipts/unlisted (ticket 168) fills the name.
  // Admins only, so a shared link can't put words in an owner's form.
  const nameParam = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 200) : ''
  const prefillName = nameParam && (await getAdminRole(user.id)) ? nameParam : undefined

  const cities = (cityRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    stateCode: (c.states as unknown as { code: string } | null)?.code ?? null,
  }))

  return (
    <main className="min-h-screen bg-pale-lavender px-4 pt-16 pb-16">
      <div className="mx-auto max-w-[1100px] py-10">
        <div className="mb-8 max-w-[640px]">
          <p className="mb-2 font-subhead text-xs font-semibold uppercase tracking-widest text-amber">
            Get Listed
          </p>
          <h1 className="mb-3 font-headline text-3xl text-brand-black md:text-4xl">
            {creator ? 'Add your creator page' : 'Add your business'}
          </h1>
          <p className="font-subhead text-base leading-relaxed text-charcoal">
            {creator
              ? 'A few quick questions and your page starts taking shape. Then add your niche, platforms and photos, and send it to our team for review.'
              : 'A few quick questions and your page starts taking shape. Then add photos, hours and more, and send it to our team for review.'}
          </p>
        </div>

        <QuickStart
          categories={
            creator ? creatorSubcategories(categories) : withoutCreatorCategories(categories)
          }
          cities={cities}
          email={user.email ?? ''}
          siteImport={!creator && isFeatureEnabled('siteImport')}
          aiOnboarding={isFeatureEnabled('aiOnboarding')}
          mode={mode}
          prefillName={prefillName}
        />
      </div>
    </main>
  )
}
