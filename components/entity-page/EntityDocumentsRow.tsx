import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import { SectionMark } from '@/components/entity-page/SectionMark'
import { cn } from '@/lib/utils'
import type { DocumentItem } from '@/types'

interface Props {
  documents: DocumentItem[]
  className?: string
}

/**
 * Menu, rate card, commission guide: the PDFs a business hands out (ticket
 * 194). A pill row on the heading line of Offerings, Services and
 * Capabilities. Download-only, never rendered inline.
 */
export function EntityDocumentsRow({ documents, className }: Props) {
  if (documents.length === 0) return null
  return (
    <ul
      data-testid="documents-row"
      aria-label="Downloads"
      className={cn('flex flex-wrap items-center gap-2 list-none p-0 m-0', className)}
    >
      {documents.map((doc) => (
        <li key={doc.id}>
          <a
            href={doc.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border-[1.5px] border-brand-black text-brand-black font-subhead text-xs font-bold hover:bg-brand-black hover:text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            <Download className="size-3.5 text-amber group-hover:text-gold" aria-hidden="true" />
            {doc.label}
            {doc.sizeLabel && (
              <span className="font-medium text-charcoal-soft group-hover:text-white/80">
                · {doc.sizeLabel}
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * The marked row for a heading's `actions` slot, or undefined when there is
 * nothing to download — so a page with no documents renders its heading
 * exactly as before.
 */
export function documentsActions(
  documents: DocumentItem[] | undefined,
  className?: string
): ReactNode | undefined {
  if (!documents || documents.length === 0) return undefined
  return (
    <SectionMark id="documents">
      <EntityDocumentsRow documents={documents} className={className} />
    </SectionMark>
  )
}
