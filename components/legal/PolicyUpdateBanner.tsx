import Link from 'next/link'
import { POLICY_UPDATE } from '@/lib/legal/policyUpdate'

interface PolicyUpdateBannerProps {
  /**
   * `coming`: on the live page, before the update takes effect.
   * `preview`: on the /upcoming page, which shows the new text early.
   */
  kind: 'coming' | 'preview'
  /** The document's full name, for example "Privacy Policy". */
  docName: string
  /** The other version of this page. */
  href: string
}

/** A short note at the top of a policy page while an update is on its way. */
export function PolicyUpdateBanner({ kind, docName, href }: PolicyUpdateBannerProps) {
  return (
    <div
      role="note"
      className="mt-6 max-w-2xl rounded-xl border border-amber/40 bg-white px-5 py-4 font-body text-sm text-charcoal"
    >
      {kind === 'coming' ? (
        <p>
          We&apos;re updating our {docName} on {POLICY_UPDATE.effectiveOnLabel}.{' '}
          <Link href={href} className="font-semibold text-brand-black underline underline-offset-2 hover:text-amber">
            See what&apos;s changing
          </Link>
        </p>
      ) : (
        <p>
          This is our updated {docName}. It takes effect on {POLICY_UPDATE.effectiveOnLabel}. Until
          then, the{' '}
          <Link href={href} className="font-semibold text-brand-black underline underline-offset-2 hover:text-amber">
            current version
          </Link>{' '}
          applies.
        </p>
      )}
    </div>
  )
}
