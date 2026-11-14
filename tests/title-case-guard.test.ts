import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { loadAllowlist, normalize, scanRepo, scanSource } from '@/scripts/title-case/scan'

// Ticket 205. Guard: every heading, button, nav link, tab, badge and form
// label in app/, components/ and lib/ is in Title Case
// (docs/blacqlist/design/title-case.md). A new sentence-case label fails here.
// Fix it with `npx tsx scripts/check-title-case.ts --fix <path>`, or, when the
// label really is a sentence, add it to scripts/title-case-allowlist.json with
// a reason.

const root = path.resolve(__dirname, '..')

describe('title case guard', () => {
  it('finds no UI label outside Title Case', () => {
    const hits = scanRepo(root).map((h) => `${h.file}:${h.line} "${h.found}" → "${h.suggested}"`)
    expect(hits).toEqual([])
  })

  it('keeps every allowlist entry live and explained', () => {
    const stale = loadAllowlist(root).filter((entry) => {
      if (!entry.reason.trim()) return true
      const abs = path.join(root, entry.file)
      if (!fs.existsSync(abs)) return true
      const found = scanSource(entry.file, fs.readFileSync(abs, 'utf8'))
      return !found.some((h) => h.found === normalize(entry.text))
    })
    expect(stale).toEqual([])
  })
})

describe('title case scanner', () => {
  const scan = (src: string) => scanSource('components/x.tsx', src).map((h) => h.found)

  it('flags sentence-case headings, buttons and labels', () => {
    expect(scan('const A = () => <h2>Saved businesses</h2>')).toEqual(['Saved businesses'])
    expect(scan('const A = () => <Button>Add a listing</Button>')).toEqual(['Add a listing'])
    expect(scan('const A = () => <Button>{busy ? "Saving…" : "Save changes"}</Button>')).toEqual([
      'Save changes',
    ])
    expect(scan('const nav = [{ label: "Claim a business", href: "/claim" }]')).toEqual([
      'Claim a business',
    ])
    expect(scan('function F({ submitLabel = "Join the waitlist" }) { return null }')).toEqual([
      'Join the waitlist',
    ])
  })

  it('leaves placeholders, sentences and Title Case alone', () => {
    expect(scan('const A = () => <input placeholder="Search by name" />')).toEqual([])
    expect(scan('const A = () => <h2>Your claim for this business is approved.</h2>')).toEqual([])
    expect(scan('const A = () => <h2>Add a Listing</h2>')).toEqual([])
  })
})
