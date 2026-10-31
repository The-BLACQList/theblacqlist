/**
 * Cue's per-message bounds (ticket 169). Kept apart from agent.ts so the spend
 * ceiling (lib/ai/spend.ts) can price them without importing the SDK.
 */

/** Model calls one visitor message may make. */
export const CUE_MAX_CALLS = 4
/** Tools one model call may run. */
export const CUE_MAX_TOOLS_PER_CALL = 4
/** Output tokens one model call may write. */
export const CUE_MAX_TOKENS = 700
/** Characters of system prompt, tools and messages allowed into one call. */
export const CUE_INPUT_CHAR_CAP = 32_000
