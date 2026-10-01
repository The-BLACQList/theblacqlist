import type { Metadata } from 'next'
import Link from 'next/link'

import { NodeConstellation } from '@/components/brand/NodeConstellation'
import { Button } from '@/components/ui/button'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'

export const metadata: Metadata = {
  title: 'Page not found',
}

/**
 * Every unmatched URL and every notFound() call lands here, inside the root
 * layout, so the public header and footer stay. The network behind it is the
 * loader's, held still and faint.
 */
export default function NotFound() {
  return (
    <section className="relative isolate grid min-h-[70vh] place-items-center overflow-hidden bg-ground px-4 py-16">
      <NodeConstellation
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 opacity-25"
        style={{ width: 'min(140vw, 760px)' }}
      />
      <div className="flex max-w-md flex-col items-center text-center">
        <GoldBrandMark className="h-16 w-16" />
        <p className="mt-6 font-subhead text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          404
        </p>
        <h1 className="mt-3 text-3xl font-light text-off-white md:text-4xl [text-wrap:balance]">
          This page isn&rsquo;t on the list.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft [text-wrap:pretty]">
          The link may be old, or the page may have moved. Head home, or find someone new to
          support.
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            asChild
            variant="brandGold"
            size="lg"
            className="focus-visible:ring-amber-gold focus-visible:ring-offset-ground"
          >
            <Link href="/">Go home</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-gold/60 bg-transparent text-off-white hover:bg-white/10 hover:text-off-white focus-visible:ring-amber-gold focus-visible:ring-offset-ground"
          >
            <Link href="/discover">Discover</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
