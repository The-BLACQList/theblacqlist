import type { ReactNode } from 'react'
import { SignedInShell } from '@/components/account/SignedInShell'
import type { ShellData } from '@/lib/account/shellData'

/**
 * The page frame for everything signed in (ticket 252): the black menu on the
 * left from lg, a Menu bar on top below lg, and the page on a light ground.
 * /account and /dashboard both render it, so moving between them never swaps
 * the menu.
 */
export function SignedInFrame({ data, children }: { data: ShellData; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-pale-lavender lg:flex">
      <SignedInShell data={data} />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 md:px-8 lg:py-8">
          {children}
        </div>
      </div>
    </div>
  )
}
