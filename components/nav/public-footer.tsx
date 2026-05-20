import Link from 'next/link'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Container } from '@/components/layout/container'

// ─── Inline SVG icons for social platforms not in this lucide-react version ──

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('h-5 w-5', className)}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.21 8.21 0 0 0 4.79 1.53V6.77a4.85 4.85 0 0 1-1.02-.08z" />
    </svg>
  )
}

// ─── Footer column data ───────────────────────────────────────────────────────

interface FooterLink {
  label: string
  href: string
  active: boolean
}

interface FooterColumn {
  heading: string
  links: FooterLink[]
}

const columns: FooterColumn[] = [
  {
    heading: 'Platform',
    links: [
      { label: 'Discover', href: '/discover', active: true },
      { label: 'Search', href: '/search', active: true },
      { label: 'Collections', href: '/collections', active: true },
      { label: 'Events', href: '/events', active: false },
      { label: 'Jobs', href: '/jobs', active: false },
      { label: 'Marketplace', href: '/marketplace', active: false },
      { label: 'BLACQLight', href: '/blacqlight', active: true },
    ],
  },
  {
    heading: 'For Businesses',
    links: [
      { label: 'For Business', href: '/for-business', active: true },
      { label: 'Claim Your Page', href: '/claim', active: true },
      { label: 'Add Your Business', href: '/add-business', active: true },
      { label: 'Pricing', href: '/pricing', active: false },
      { label: 'For Vendors', href: '/for-vendors', active: false },
      { label: 'For Sponsors', href: '/for-sponsors', active: false },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about', active: true },
      { label: 'Contact', href: '/contact', active: true },
      { label: 'Careers', href: '/careers', active: false },
      { label: 'Press', href: '/press', active: false },
    ],
  },
  {
    heading: 'Community',
    links: [
      { label: 'The BLACQLight', href: '/blacqlight', active: true },
      { label: 'City Guides', href: '/guides', active: true },
      { label: 'Community Impact', href: '/impact', active: false },
    ],
  },
]

// ─── PublicFooter ─────────────────────────────────────────────────────────────

export function PublicFooter() {
  return (
    <footer className="bg-black text-white">
      <Container className="py-12 md:py-16">
        {/* ── Top section: tagline + social ──────────────────────────────── */}
        <div>
          <p className="font-headline text-3xl md:text-4xl text-cream mb-4">Find &amp; Be Found.</p>

          <div className="flex items-center gap-4">
            <Link
              href="https://instagram.com/theblacqlist"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="The BLACQList on Instagram"
              className="text-charcoal hover:text-white transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <InstagramIcon />
            </Link>

            <Link
              href="https://x.com/theblacqlist"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="The BLACQList on X (Twitter)"
              className="text-charcoal hover:text-white transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Link>

            <Link
              href="https://linkedin.com/company/theblacqlist"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="The BLACQList on LinkedIn"
              className="text-charcoal hover:text-white transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <LinkedInIcon />
            </Link>

            <Link
              href="https://tiktok.com/@theblacqlist"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="The BLACQList on TikTok"
              className="text-charcoal hover:text-white transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <TikTokIcon />
            </Link>
          </div>
        </div>

        {/* ── Separator ─────────────────────────────────────────────────── */}
        <div className="bg-charcoal/30 h-px my-8" aria-hidden="true" />

        {/* ── Column grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="text-amber-gold text-xs uppercase tracking-wider font-subhead font-bold mb-3">
                {col.heading}
              </h3>
              <ul className="flex flex-col gap-2">
                {col.links.map((link) =>
                  link.active ? (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-gray-400 hover:text-white text-sm font-subhead transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={link.label}>
                      {/* Not interactive — sr-only suffix is more reliable than aria-label on a span */}
                      <span className="text-charcoal text-sm font-subhead pointer-events-none cursor-not-allowed">
                        {link.label}
                        <span className="sr-only"> (coming soon)</span>
                      </span>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Separator ─────────────────────────────────────────────────── */}
        <div className="bg-charcoal/30 h-px mt-10 mb-6" aria-hidden="true" />

        {/* ── Legal row ─────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-charcoal text-xs font-subhead">&copy; 2026 The BLACQList</p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/privacy"
              className="text-charcoal hover:text-white text-xs font-subhead transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-charcoal hover:text-white text-xs font-subhead transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Terms of Service
            </Link>
            <Link
              href="/cookies"
              className="text-charcoal hover:text-white text-xs font-subhead transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Cookie Policy
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  )
}
