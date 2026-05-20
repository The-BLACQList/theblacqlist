import type { ReactNode } from "react"
import Link from "next/link"

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-deep-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="font-headline text-2xl text-amber-gold hover:text-light-gold transition-colors"
          >
            The BLACQList
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">{children}</div>

        {/* Footer */}
        <p className="text-center text-xs font-subhead text-white/40 mt-6">
          &copy; {new Date().getFullYear()} The BLACQList. All rights reserved.
        </p>
      </div>
    </div>
  )
}
