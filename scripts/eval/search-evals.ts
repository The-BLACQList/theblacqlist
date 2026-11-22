/**
 * The search eval set, live run (ticket 256). Sends every question in
 * tests/fixtures/search-evals.ts to a deployment's /api/cue as the /search
 * strip does (`surface: 'search'`) and checks the rules that hold for any
 * catalogue:
 *
 *   * answered: words, plus cards or a link (never a dead end)
 *   * no remark on ownership (#299)
 *   * has cards: the pass bar is 90% of questions
 *
 * It reads only what the route streams back. Nothing is written anywhere but
 * the report below.
 *
 * Usage:
 *   npx tsx scripts/eval/search-evals.ts --deployment=https://<preview>.vercel.app
 *       Through `vercel curl`, which passes Preview protection.
 *   npx tsx scripts/eval/search-evals.ts --base=https://staging.example.com
 *       Plain fetch, for a deployment with no protection.
 *   [--delay-ms=8000]  Pause between questions. Cue allows 8 a minute per IP;
 *                      past that the route answers with the quick answer, and
 *                      the report shows mode "basic" with no AI.
 *   [--only=3]         Run the first N questions.
 *
 * Output: a line per question, a summary, and
 *         docs/blacqlist/ops/reports/search-evals-YYYYMMDD-HHMM.txt
 * Exits 1 when a question is unanswered or mentions ownership, or fewer than
 * 90% have cards.
 */
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { SEARCH_EVALS } from '../../tests/fixtures/search-evals'

const CARDS_BAR = 0.9
const OWNERSHIP = /black[- ]owned|black business|owned by|ownership|identity/i

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

const deployment = arg('deployment')
const base = arg('base')
const delayMs = Number(arg('delay-ms') ?? 8000)
const only = Number(arg('only') ?? SEARCH_EVALS.length)

if (!deployment === !base) {
  console.error('Pass exactly one of --deployment=<preview url> or --base=<url>.')
  process.exit(1)
}

interface Streamed {
  mode: string
  text: string
  cards: string[]
  links: string[]
  error: string | null
}

async function ask(query: string): Promise<string> {
  const body = JSON.stringify({ message: query, surface: 'search' })
  if (deployment) {
    return execFileSync(
      'vercel',
      ['curl', '/api/cue', '--deployment', deployment, '--', '-s', '-X', 'POST', '-H', 'content-type: application/json', '-d', body],
      { encoding: 'utf8', timeout: 90_000 }
    )
  }
  const res = await fetch(new URL('/api/cue', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  return res.text()
}

function read(ndjson: string): Streamed {
  const out: Streamed = { mode: 'none', text: '', cards: [], links: [], error: null }
  for (const line of ndjson.split('\n')) {
    if (!line.trim()) continue
    let event: Record<string, unknown>
    try {
      event = JSON.parse(line) as Record<string, unknown>
    } catch {
      out.error = 'not NDJSON'
      continue
    }
    if (event.type === 'cards') out.cards = (event.cards as Array<{ name: string }>).map((c) => c.name)
    if (event.type === 'actions') {
      out.links = (event.actions as Array<{ kind: string; label: string }>)
        .filter((a) => a.kind === 'link')
        .map((a) => a.label)
    }
    if (event.type === 'done') {
      out.text = String(event.text ?? '')
      out.mode = String(event.mode ?? 'ai')
    }
    if (event.type === 'fallback') {
      out.text = String(event.text ?? '')
      out.mode = 'fallback'
    }
  }
  return out
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lines: string[] = []
  const log = (s: string) => {
    console.log(s)
    lines.push(s)
  }
  log(`Search evals against ${deployment ?? base}, ${new Date().toISOString()}`)

  let answered = 0
  let withCards = 0
  let ownership = 0
  let ai = 0
  const evals = SEARCH_EVALS.slice(0, only)
  for (const [i, ev] of evals.entries()) {
    if (i > 0) await sleep(delayMs)
    let r: Streamed
    try {
      r = read(await ask(ev.query))
    } catch (err) {
      r = { mode: 'none', text: '', cards: [], links: [], error: err instanceof Error ? err.message.slice(0, 80) : 'failed' }
    }
    const ok = r.text.trim() !== '' && (r.cards.length > 0 || r.links.length > 0)
    const owns = OWNERSHIP.test(r.text)
    if (ok) answered++
    if (r.cards.length > 0) withCards++
    if (owns) ownership++
    if (r.mode === 'ai') ai++
    const flag = !ok ? 'UNANSWERED' : owns ? 'OWNERSHIP' : r.cards.length === 0 ? 'no cards' : 'ok'
    log(`\n${String(i + 1).padStart(2)}. ${ev.query}`)
    log(`    [${flag}] mode=${r.mode} cards=${r.cards.length}${r.error ? ` error=${r.error}` : ''}`)
    log(`    ${r.text.replace(/\s+/g, ' ').slice(0, 240)}`)
    if (r.cards.length > 0) log(`    cards: ${r.cards.join(' · ')}`)
    if (r.links.length > 0) log(`    links: ${r.links.join(' · ')}`)
  }

  const n = evals.length
  const cardsShare = n > 0 ? withCards / n : 0
  log('\n── Summary ──')
  log(`Answered: ${answered}/${n}`)
  log(`With cards: ${withCards}/${n} (${Math.round(cardsShare * 100)}%, bar ${CARDS_BAR * 100}%)`)
  log(`Ownership remarks: ${ownership}`)
  log(`AI answers: ${ai}/${n} (the rest were quick answers)`)
  const pass = answered === n && ownership === 0 && cardsShare >= CARDS_BAR
  log(pass ? 'PASS' : 'FAIL')

  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
  const file = join(root, 'docs/blacqlist/ops/reports', `search-evals-${stamp}.txt`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${lines.join('\n')}\n`)
  console.log(`\nReport: ${file}`)
  process.exit(pass ? 0 : 1)
}

void main()
