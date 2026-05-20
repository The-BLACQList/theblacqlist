import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import {
  updateGuideAction,
  createGuideSectionAction,
  deleteGuideSectionAction,
} from '@/lib/actions/editorial/guides'
import { GuideAdminForm } from '@/components/editorial/AdminEditorialForm'

export const metadata: Metadata = { title: 'Edit Guide' }

interface Props {
  params: Promise<{ id: string }>
}

const inputCls =
  'w-full h-11 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/60'
const textareaCls =
  'w-full px-3 py-2.5 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/60 resize-y'

export default async function EditGuidePage({ params }: Props) {
  await requireAdmin()
  const { id } = await params
  const serviceClient = createServiceClient()

  const { data: guide } = await serviceClient
    .from('guides')
    .select('id, title, slug, subtitle, description, city, meta_description, status')
    .eq('id', id)
    .single()

  if (!guide) notFound()

  const { data: sections } = await serviceClient
    .from('guide_sections')
    .select('id, heading, body, display_order')
    .eq('guide_id', id)
    .order('display_order', { ascending: true })

  const sectionList = sections ?? []
  const nextOrder =
    sectionList.length > 0 ? Math.max(...sectionList.map((s) => s.display_order)) + 1 : 0

  return (
    <div className="max-w-[800px] space-y-8">
      <div>
        <Link
          href="/admin/guides"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Guides
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Edit guide</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">{guide.title}</p>
      </div>

      {/* Guide details */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-headline text-base text-brand-black mb-4">Details</h2>
        <GuideAdminForm
          action={updateGuideAction}
          defaultValues={guide}
          redirectOnSuccess="/admin/guides"
        />
      </div>

      {/* Sections */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-6 space-y-5">
        <div>
          <h2 className="font-headline text-base text-brand-black">Sections</h2>
          <p className="font-subhead text-xs text-charcoal/50 mt-0.5">
            {sectionList.length} {sectionList.length === 1 ? 'section' : 'sections'}
          </p>
        </div>

        {sectionList.length > 0 && (
          <div className="space-y-3">
            {sectionList.map((section, i) => (
              <div
                key={section.id}
                className="rounded-lg border border-charcoal/10 bg-[#f9f9fb] p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-subhead text-xs text-charcoal/40 font-semibold">
                    Section {i + 1}
                  </span>
                  <form
                    action={
                      deleteGuideSectionAction.bind(null, null) as unknown as (
                        formData: FormData
                      ) => Promise<void>
                    }
                  >
                    <input type="hidden" name="id" value={section.id} />
                    <button
                      type="submit"
                      aria-label="Delete section"
                      className="flex items-center justify-center size-7 rounded text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </form>
                </div>
                <p className="font-subhead text-sm font-semibold text-brand-black">
                  {section.heading}
                </p>
                {section.body && (
                  <p className="font-body text-xs text-charcoal/50 mt-1 line-clamp-2 leading-relaxed">
                    {section.body.substring(0, 120)}…
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add section */}
        <form
          action={
            createGuideSectionAction.bind(null, null) as unknown as (
              formData: FormData
            ) => Promise<void>
          }
          className="space-y-3 pt-2 border-t border-charcoal/10"
        >
          <p className="font-subhead text-xs font-semibold text-brand-black pt-1">Add section</p>
          <input type="hidden" name="guide_id" value={id} />
          <input type="hidden" name="display_order" value={nextOrder} />
          <div className="space-y-1">
            <label
              htmlFor="heading"
              className="block font-subhead text-sm font-semibold text-brand-black"
            >
              Heading *
            </label>
            <input
              id="heading"
              name="heading"
              type="text"
              required
              maxLength={200}
              placeholder="e.g. Best Brunch Spots"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="body"
              className="block font-subhead text-sm font-semibold text-brand-black"
            >
              Body
            </label>
            <textarea
              id="body"
              name="body"
              rows={5}
              placeholder="Section content…"
              className={textareaCls}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
            >
              Add section
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
