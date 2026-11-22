/**
 * Cue's per-message bounds (ticket 169; raised in ticket 256 so a search that
 * finds nothing can try again and still show close matches). Kept apart from agent.ts so the spend
 * ceiling (lib/ai/spend.ts) can price them without importing the SDK.
 */

/** Model calls one visitor message may make. */
export const CUE_MAX_CALLS = 5
/** Tools one model call may run. */
export const CUE_MAX_TOOLS_PER_CALL = 6
/** Output tokens one model call may write. */
export const CUE_MAX_TOKENS = 800
/** Characters of system prompt, tools and messages allowed into one call. */
export const CUE_INPUT_CHAR_CAP = 32_000
