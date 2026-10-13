// The tester cap and tester numbers. No server imports, so the admin form and
// the Tester Tour panel can use them in the browser.

/**
 * Live testers in total, across every link and the admin invite (founder,
 * 2026-10-13). The database holds the real limit: the trigger in
 * 20261014000000_shared_tester_link.sql. Change both together.
 */
export const TESTER_CAP = 15

/** "Tester 07": two digits, so the first fifteen line up. */
export function formatTesterNumber(n: number): string {
  return `Tester ${String(n).padStart(2, '0')}`
}

/** The cap trigger's refusal (P0001 'tester_cap_full'), from any enroll path. */
export function isTesterCapFull(error: { code?: string; message?: string } | null): boolean {
  return error?.code === 'P0001' && (error.message ?? '').includes('tester_cap_full')
}
