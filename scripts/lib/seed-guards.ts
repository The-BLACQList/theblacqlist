/**
 * Target guard and flag parsing for the demo seed scripts (ticket 187).
 *
 * The seed scripts write obviously-fake data: "Demo — …" names, example.com
 * links, sample photos and, with --with-reviews, made-up reviews. None of it
 * may ever reach production (docs/blacqlist/data/seed-data-plan.md §10). The
 * database is chosen only by the exported SUPABASE_URL, so this guard decides
 * from that URL alone:
 *
 *   - production is refused outright, and no flag overrides it;
 *   - a local host (localhost, 127.0.0.1, *.local) runs without ceremony;
 *   - any other host must be the staging project AND the run must say --yes.
 *
 * checkSeedTarget() is pure so it can be tested; assertTargetConfirmed() is
 * the wrapper the scripts call, which prints the ref and exits on a refusal.
 */

/** The production Supabase project. Never a seed target. */
export const PRODUCTION_REF = 'ytlrnczevdnsfdzjbeqg'

/** The staging Supabase project: the only remote target a seed may write to. */
export const STAGING_REF = 'fmbohsloskqbmlwbzpjm'

export interface SeedTarget {
  host: string
  /** The Supabase project ref, or the bare host when it isn't a supabase.co URL. */
  ref: string
  isLocal: boolean
}

export type TargetCheck =
  | { ok: true; target: SeedTarget }
  | { ok: false; target: SeedTarget | null; reason: string }

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
}

/** Reads the host and project ref from a Supabase URL. Null when it isn't a URL. */
export function describeTarget(url: string): SeedTarget | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  if (!host) return null
  const isLocal = isLocalHost(host)
  const parts = host.split('.')
  // Only "<ref>.supabase.co" names a project. Anything else, including a
  // longer host that merely contains ".supabase.co", keeps the whole host as
  // its "ref", so it can never equal the staging ref.
  const ref = parts.length === 3 && host.endsWith('.supabase.co') ? (parts[0] ?? host) : host
  return { host, ref, isLocal }
}

/** Decides whether a seed may write to `url`. Pure: no printing, no exiting. */
export function checkSeedTarget(url: string, argv: readonly string[]): TargetCheck {
  const target = describeTarget(url)
  if (!target) {
    return { ok: false, target: null, reason: `SUPABASE_URL is not a valid URL.` }
  }
  if (target.ref === PRODUCTION_REF || target.host.includes(PRODUCTION_REF)) {
    return {
      ok: false,
      target,
      reason:
        `Refusing to seed the PRODUCTION project "${PRODUCTION_REF}".\n` +
        `Demo data never goes to production, and there is no flag that allows it.\n` +
        `If you meant staging, export SUPABASE_URL with the staging ref and run again.`,
    }
  }
  if (target.isLocal) return { ok: true, target }
  if (target.ref !== STAGING_REF) {
    return {
      ok: false,
      target,
      reason:
        `Refusing to seed "${target.ref}": the only remote target allowed is staging ` +
        `("${STAGING_REF}").`,
    }
  }
  if (!hasFlag(argv, '--yes')) {
    return {
      ok: false,
      target,
      reason:
        `Refusing to seed staging "${target.ref}" without confirmation.\n` +
        `Check the ref above, confirm the run with the founder, then re-run with --yes.`,
    }
  }
  return { ok: true, target }
}

/**
 * Prints the target and stops the process unless checkSeedTarget allows it.
 * Every seed script calls this before it creates a client.
 */
export function assertTargetConfirmed(
  url: string,
  argv: readonly string[] = process.argv
): SeedTarget {
  const result = checkSeedTarget(url, argv)
  if (result.target) {
    const { isLocal, ref, host } = result.target
    console.log(`Target: ${isLocal ? 'LOCAL' : 'REMOTE'}, project ref "${ref}" (${host})`)
  }
  if (!result.ok) {
    console.error(`\n${result.reason}`)
    process.exit(1)
  }
  return result.target
}

// ── Flags ────────────────────────────────────────────────────────────────────
// Hand-parsed off process.argv, matching the other scripts in this folder. No
// yargs: one dependency-free convention across every script.

/** True when `name` (for example "--purge") was passed. */
export function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(name)
}

/** The trimmed value of `--name=value`, or '' when it wasn't passed. */
export function flagValue(argv: readonly string[], name: string): string {
  const prefix = `${name}=`
  const arg = argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : ''
}
