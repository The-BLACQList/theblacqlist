import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/guard'
import { getPendingCounts, toSidebarCounts } from '@/lib/admin/pendingCounts'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export const metadata: Metadata = {
  title: {
    template: '%s | BLACQList Admin',
    default: 'Admin | BLACQList',
  },
  robots: { index: false, follow: false },
}

interface Props {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: Props) {
  // Redirects to /sign-in if unauthenticated, to / if not admin/super_admin
  const { role } = await requireAdmin()
  // Queue depth rides the layout so every admin page, not only the overview,
  // shows what is waiting. Six head-only counts; the actions that change
  // them call revalidatePath('/admin', 'layout') so the pills follow.
  const pending = await getPendingCounts()

  return (
    // Phones: the sidebar renders a sticky top bar + drawer and the page flows
    // below it. md and up: rail on the left, page beside it.
    <div className="min-h-screen bg-[#f5f5f7] md:flex">
      <AdminSidebar role={role} counts={toSidebarCounts(pending)} />
      {/* Wide admin tables scroll inside this column, not the whole page. */}
      <div className="min-w-0 flex-1 overflow-x-auto">
        <main className="max-w-[1200px] p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
