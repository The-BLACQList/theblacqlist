import type { Metadata } from "next"
import { requireAdmin } from "@/lib/admin/guard"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

export const metadata: Metadata = {
  title: {
    template: "%s | BLACQList Admin",
    default: "Admin | BLACQList",
  },
  robots: { index: false, follow: false },
}

interface Props {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: Props) {
  // Redirects to /sign-in if unauthenticated, to / if not admin/super_admin
  const { role } = await requireAdmin()

  return (
    <div className="min-h-screen flex bg-[#f5f5f7]">
      <AdminSidebar role={role} />
      <div className="flex-1 min-w-0 overflow-auto">
        <main className="p-6 md:p-8 max-w-[1200px]">
          {children}
        </main>
      </div>
    </div>
  )
}
