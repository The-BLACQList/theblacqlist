// =============================================================================
// robots.txt, read the way RFC 9309 describes (ticket 127)
// =============================================================================
// The import reads one page an owner asked for, but it still honors robots.txt:
// if a site says no to automated readers, the owner is asked to type instead.
// Pure and synchronous so it is tested on strings, not on live sites.
//
// Rules: the group naming our product token wins over the `*` group. Within a
// group, the longest matching path rule wins, and Allow wins a tie. `*` matches
// any run of characters and a trailing `$` anchors the end. An empty Disallow
// allows everything.
// =============================================================================

/** The product token robots.txt groups are matched against. */
export const ROBOTS_TOKEN = 'theblacqlist'

interface Rule {
  allow: boolean
  pattern: string
}

interface Group {
  agents: string[]
  rules: Rule[]
}

function parseGroups(text: string): Group[] {
  const groups: Group[] = []
  let current: Group | null = null
  let lastWasAgent = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    if (key === 'user-agent') {
      // Consecutive user-agent lines share one group.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }

    lastWasAgent = false
    if (!current) continue
    if (key === 'allow' || key === 'disallow') {
      current.rules.push({ allow: key === 'allow', pattern: value })
    }
  }
  return groups
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const escaped = body
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`)
}

/**
 * True when robots.txt lets our reader fetch `path` (path plus query string).
 */
export function isAllowedByRobots(robotsTxt: string, path: string): boolean {
  const groups = parseGroups(robotsTxt)
  const ours = groups.filter((g) => g.agents.some((a) => a !== '*' && ROBOTS_TOKEN.startsWith(a)))
  const chosen = ours.length > 0 ? ours : groups.filter((g) => g.agents.includes('*'))
  const rules = chosen.flatMap((g) => g.rules)

  let best: Rule | null = null
  for (const rule of rules) {
    if (rule.pattern === '') continue // empty Disallow means allow all
    if (!patternToRegExp(rule.pattern).test(path)) continue
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule
    }
  }
  return best ? best.allow : true
}
