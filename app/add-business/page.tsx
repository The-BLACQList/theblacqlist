import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SubmitListingForm } from "@/components/listings/SubmitListingForm"

export const metadata = {
  title: "Add Your Business — The BLACQList",
  description:
    "Submit your Black-owned business, brand, or creative project for review on The BLACQList.",
}

export interface CategoryOption {
  id: string
  name: string
  slug: string
  parent_id: string | null
}

export default async function AddBusinessPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in?next=/add-business")

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .eq("is_active", true)
    .order("display_order")

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-16 px-4">
      <div className="max-w-[680px] mx-auto py-10">
        <div className="mb-8">
          <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-amber-gold mb-2">
            Get Listed
          </p>
          <h1 className="font-headline text-3xl md:text-4xl text-brand-black mb-3">
            Add your business
          </h1>
          <p className="font-subhead text-sm text-charcoal leading-relaxed max-w-lg">
            Submit your listing for review. Our team will verify your business
            before publishing it on The BLACQList. Free listings go live within
            1–3 business days.
          </p>
        </div>

        <SubmitListingForm categories={categories ?? []} />
      </div>
    </main>
  )
}
