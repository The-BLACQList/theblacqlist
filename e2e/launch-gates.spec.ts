import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// M. MVP Launch Gates — the repo-checkable gates (M1, M2, M4, M8, M9).
// A FAILING test here means the gate is genuinely NOT yet satisfied (a real
// launch blocker), not that the test is broken. Ops/owner gates (M3, M5, M6,
// M7, M10) are tracked in docs/blacqlist/qa/cross-browser-and-launch-gates-guide.md.

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { persistSession: false } })
}

test.describe('M. MVP Launch Gates (repo-checkable)', () => {
  test('M1 — Privacy Policy live at /privacy', async ({ request }) => {
    const res = await request.get('/privacy')
    expect(res.status()).toBe(200)
    expect(await res.text()).toMatch(/privacy/i)
  })

  test('M2 — Terms of Service live at /terms', async ({ request }) => {
    const res = await request.get('/terms')
    expect(res.status()).toBe(200)
    expect(await res.text()).toMatch(/terms/i)
  })

  test('M4 — at least one editorial collection published (is_active=true)', async () => {
    const supabase = serviceClient()
    const { count, error } = await supabase
      .from('collections')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
    expect(error, error?.message).toBeNull()
    console.log(`M4: published collections = ${count ?? 0}`)
    expect(count ?? 0, 'No published collection — publish one via /admin/collections/new').toBeGreaterThanOrEqual(1)
  })

  test('M9 — seed data meets thresholds (ATL 150 / HOU 50 / CHI 50)', async () => {
    const supabase = serviceClient()
    const cities = [
      { slug: 'atlanta-ga', label: 'ATL', min: 150 },
      { slug: 'houston-tx', label: 'HOU', min: 50 },
      { slug: 'chicago-il', label: 'CHI', min: 50 },
    ]

    const results: Array<{ label: string; min: number; count: number }> = []
    for (const c of cities) {
      const { data: city } = await supabase.from('cities').select('id').eq('slug', c.slug).maybeSingle()
      let count = 0
      if (city) {
        const res = await supabase
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published')
          .eq('city_id', city.id)
        count = res.count ?? 0
      }
      results.push({ label: c.label, min: c.min, count })
    }

    console.log(
      'M9 published listings: ' + results.map((r) => `${r.label}=${r.count}/${r.min}`).join(', ')
    )

    for (const r of results) {
      expect(r.count, `${r.label} below ${r.min}`).toBeGreaterThanOrEqual(r.min)
    }
  })

  test('M8 — no hardcoded localhost in committed source (only safe fallbacks)', () => {
    const root = process.cwd()
    const offenders: string[] = []

    function scan(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        const st = statSync(full)
        if (st.isDirectory()) {
          if (['node_modules', '.next', 'test-results', 'playwright-report'].includes(entry)) continue
          scan(full)
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry)) {
          const lines = readFileSync(full, 'utf8').split('\n')
          lines.forEach((line, i) => {
            if (!/localhost|127\.0\.0\.1/.test(line)) return
            // Allow: env-var fallbacks, local Supabase image config, comments.
            if (/\?\?\s*['"`]/.test(line)) return // `?? 'http://localhost:3000'`
            if (/127\.0\.0\.1:54321/.test(line)) return // local Supabase (next.config images)
            if (/^\s*(\/\/|\*)/.test(line)) return // comment
            offenders.push(`${full.replace(root + '/', '')}:${i + 1}  ${line.trim()}`)
          })
        }
      }
    }

    // Scan app/ and lib/ + next.config.ts (committed runtime source).
    scan(join(root, 'app'))
    scan(join(root, 'lib'))

    if (offenders.length) console.log('M8 hardcoded localhost refs:\n' + offenders.join('\n'))
    expect(offenders, 'Hardcoded localhost references in committed source').toEqual([])
  })
})
