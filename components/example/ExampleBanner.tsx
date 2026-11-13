import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EXAMPLE_BANNER_TEXT } from '@/lib/example/copy'
import {
  EXAMPLE_VARIANTS,
  EXAMPLE_VARIANT_LABEL,
  type ExampleVariant,
} from '@/lib/example/fixtures'
import { CC_BY_3_LABEL, CC_BY_3_URL, DEMO_VIDEO_CREDITS } from '@/lib/example/fixtures/shared'
import { EXAMPLE_PHOTO_CREDITS } from '@/lib/example/photoCredits'

interface Props {
  variant: ExampleVariant
}

interface CreditLine {
  key: string
  author: string
  source: string
  href: string
}

/**
 * One line per photographer, not per photo: the banner is a credit strip, the
 * per-file record is docs/blacqlist/design/example-image-licenses.md.
 */
function photoCreditLines(): CreditLine[] {
  const seen = new Map<string, CreditLine>()
  for (const credit of EXAMPLE_PHOTO_CREDITS) {
    // First-party artwork has no author or page; a stock entry missing either
    // is a manifest bug tests/example-fixtures.test.ts reports, not a credit.
    if (credit.license === 'First-party BLACQList artwork') continue
    if (!credit.author || !credit.pageUrl) continue
    const key = `${credit.source}:${credit.author}`
    if (seen.has(key)) continue
    seen.set(key, { key, author: credit.author, source: credit.source, href: credit.pageUrl })
  }
  return [...seen.values()].sort((a, b) => a.author.localeCompare(b.author))
}

/**
 * The strip above every sample page (ticket 184). Always rendered: it is what
 * keeps a page full of illustrative figures inside the no-fabrication rule,
 * so it is not dismissible. The switcher is the one set of links the
 * ExampleLinkGuard lets through by path; the credit links are let through by
 * the data attribute.
 */
export function ExampleBanner({ variant }: Props) {
  const photos = photoCreditLines()
  const videoAuthors = [...new Set(DEMO_VIDEO_CREDITS.map((v) => v.author))]

  return (
    <aside
      aria-label="Sample page notice"
      data-testid="example-banner"
      className="border-b border-gold/40 bg-ground text-off-white"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="font-subhead text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            Sample page
          </p>
          <p className="mt-1 text-sm leading-relaxed text-off-white/90 [text-wrap:pretty]">
            {EXAMPLE_BANNER_TEXT}
          </p>
          <details className="mt-1 text-xs text-ink-soft" data-example-allow-links="">
            <summary className="cursor-pointer select-none underline-offset-2 hover:underline">
              Photo and video credits
            </summary>
            <p className="mt-1 leading-relaxed">
              Photos:{' '}
              {photos.length === 0
                ? 'first-party artwork only.'
                : photos.map((line, i) => (
                    <span key={line.key}>
                      {i > 0 && ', '}
                      <a
                        href={line.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-off-white"
                      >
                        {line.author}
                      </a>{' '}
                      ({line.source})
                    </span>
                  ))}
              . Videos: {videoAuthors.join(', ')} open movies,{' '}
              <a
                href={CC_BY_3_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-off-white"
              >
                {CC_BY_3_LABEL}
              </a>
              . Logos are BLACQList artwork.
            </p>
          </details>
        </div>

        <nav aria-label="Sample page layouts" className="shrink-0">
          <ul className="flex flex-wrap gap-2">
            {EXAMPLE_VARIANTS.map((v) => {
              const current = v === variant
              return (
                <li key={v}>
                  <Link
                    href={`/example/${v}`}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'inline-flex h-9 items-center rounded-full border px-4 font-subhead text-sm transition-colors',
                      current
                        ? 'border-gold bg-gold text-ink'
                        : 'border-off-white/30 text-off-white hover:border-gold hover:text-gold'
                    )}
                  >
                    {EXAMPLE_VARIANT_LABEL[v]}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </aside>
  )
}
