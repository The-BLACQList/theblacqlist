import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  creatorSubcategories,
  withoutCreatorCategories,
} from '@/lib/listings/creatorCategories'
import { quickStartMode } from '@/lib/listings/quickStart'
import { QuickStart } from './_components/quick-start/QuickStart'

interface PageProps {
  searchParams: Promise<{ as?: string | string[] }>
}

// `?as=creator` (ticket 132) runs the same quick start worded for a person.
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { as } = await searchParams
  if (quickStartMode(as) === 'creator') {
    return {
      title: 'Add Your Creator Page | The BLACQList',
      description:
        'List yourself as a creator on The BLACQList. Black creators and allies who support them are welcome. Every page is clearly labeled.',
    }
  }
  return {
    title: 'Add Your Business | The BLACQList',
    description:
      'List your business on The BLACQList. Black-owned businesses and allies who support them are welcome. Every listing is clearly labeled.',
  }
}

export interface CategoryOption {
  id: string
  name: string
  slug: string
  parent_id: string | null
}

export default async function AddBusinessPage({ searchParams }: PageProps) {
  const { as } = await searchParams
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

  const [{ data: categories }, { data: cityRows }] = await Promise.all([
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
            creator
              ? creatorSubcategories(categories ?? [])
              : withoutCreatorCategories(categories ?? [])
          }
          cities={cities}
          email={user.email ?? ''}
          mode={mode}
        />
      </div>
    </main>
  )
}
