import type { ReactNode } from 'react'
import Link from 'next/link'
import { BrandMark } from '@/components/ui/brand-mark'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-deep-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo: node-Q mark + Jost wordmark */}
        <div className="mb-8 flex justify-center">
          <Link
            href="/"
            aria-label="The BLACQList — home"
            className="group flex flex-col items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
          >
            <BrandMark className="h-12 w-12 text-gold transition-colors group-hover:text-light-gold" />
            <span className="font-headline text-xl font-medium tracking-[0.14em] text-white">
              THE BLACQLIST
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">{children}</div>

        {/* Footer */}
        <p className="text-center text-xs font-subhead text-white/60 mt-6">
          &copy; {new Date().getFullYear()} The BLACQList. All rights reserved.
        </p>
      </div>
    </div>
  )
}
