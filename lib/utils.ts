import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * FNV-1a string hash → stable non-negative 32-bit int.
 *
 * Deterministic and dependency-free, so a value derived from it is identical on
 * the server and on the client — unlike Math.random, which would hydrate-mismatch.
 * Used to vary per-record visual detail (e.g. the ImageFallback node field) from
 * a record's id without storing anything.
 */
export function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
