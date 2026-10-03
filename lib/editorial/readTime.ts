// Read time for a BLACQLight story, computed from the body: words ÷ 230,
// rounded up, never less than a minute.

export const WORDS_PER_MINUTE = 230

export function readMinutes(body: string | null | undefined): number {
  const words = (body ?? '').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}
