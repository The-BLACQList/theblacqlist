// Ticket 205. Lists UI labels that are not in Title Case.
//
//   npx tsx scripts/check-title-case.ts            report, exit 1 on hits
//   npx tsx scripts/check-title-case.ts --fix      rewrite them in place
//   npx tsx scripts/check-title-case.ts --fix app/admin components/admin
//                                                  rewrite only under these paths
//
// The rule is docs/blacqlist/design/title-case.md. Review every --fix diff: the
// scanner is careful, but a label that is really a sentence belongs in
// scripts/title-case-allowlist.json with a reason, not in Title Case.

import fs from 'node:fs'
import path from 'node:path'
import { scanRepo, type Hit } from './title-case/scan'
import { toTitleCase } from '../lib/text/title-case'

const root = path.resolve(__dirname, '..')
const args = process.argv.slice(2)
const fix = args.includes('--fix')
const only = args.filter((a) => !a.startsWith('--')).map((a) => a.replace(/\/$/, ''))

const hits = scanRepo(root).filter(
  (h) => only.length === 0 || only.some((p) => h.file === p || h.file.startsWith(p + '/'))
)

if (fix) {
  const byFile = new Map<string, Hit[]>()
  for (const h of hits) byFile.set(h.file, [...(byFile.get(h.file) ?? []), h])
  for (const [file, list] of byFile) {
    const abs = path.join(root, file)
    let src = fs.readFileSync(abs, 'utf8')
    // Apply from the end so earlier offsets stay valid.
    for (const h of [...list].sort((a, b) => b.start - a.start)) {
      const raw = src.slice(h.start, h.end)
      src = src.slice(0, h.start) + toTitleCase(raw, h.opts) + src.slice(h.end)
    }
    fs.writeFileSync(abs, src)
  }
  console.log(`Rewrote ${hits.length} labels in ${byFile.size} files.`)
} else {
  for (const h of hits)
    console.log(`${h.file}:${h.line}  [${h.kind}] "${h.found}" → "${h.suggested}"`)
  console.log(`\n${hits.length} labels not in Title Case.`)
  process.exitCode = hits.length ? 1 : 0
}
