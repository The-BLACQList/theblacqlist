import { chromium } from '@playwright/test'
const base = process.argv[2]
const b = await chromium.launch()
const ctx = await b.newContext({ extraHTTPHeaders: { 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN ?? '' } })
const p = await ctx.newPage()
await p.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(4000)
const qs = [
  { message: 'lawyer in atlanta', surface: 'search' },
  { message: 'How do I switch to Black Owned bathroom products', surface: 'search' },
  { message: 'any good soul food spots in houston?', surface: 'chat' },
  { message: 'is there a black owned barber near decatur that does fades', surface: 'chat' },
]
for (const q of qs) {
  const r = await p.evaluate(async (q) => {
    const res = await fetch('/api/cue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(q) })
    return { status: res.status, body: await res.text() }
  }, q)
  const events = r.body.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return { type: 'raw' } } })
  const text = events.filter((e) => e.type === 'text').map((e) => e.text).join('')
  const status = events.filter((e) => e.type === 'status').map((e) => e.text)
  const last = events.at(-1)
  console.log(`\n## ${q.message} [${r.status}] ${[...new Set(events.map((e) => e.type))].join(',')}`)
  console.log('STATUS:', status.join(' | '))
  console.log('STREAMED:', JSON.stringify(text))
  console.log('LAST:', JSON.stringify(last).slice(0, 500))
}
await b.close()
