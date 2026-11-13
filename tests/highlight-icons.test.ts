import { describe, expect, it } from 'vitest'
import {
  HIGHLIGHT_ICONS,
  highlightIcon,
  isHighlightIcon,
} from '@/components/entity-page/highlightIcons'

describe('highlight icon allow-list', () => {
  it('is keyed by kebab-case names an editor can store', () => {
    for (const name of Object.keys(HIGHLIGHT_ICONS)) expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(Object.keys(HIGHLIGHT_ICONS).length).toBeGreaterThanOrEqual(20)
  })

  it('resolves known names and falls back to a spark for anything else', () => {
    expect(isHighlightIcon('coffee')).toBe(true)
    expect(isHighlightIcon('constructor')).toBe(false)
    expect(isHighlightIcon('__proto__')).toBe(false)
    expect(highlightIcon('coffee')).toBe(HIGHLIGHT_ICONS.coffee)
    expect(highlightIcon('not-an-icon')).toBe(HIGHLIGHT_ICONS.sparkles)
    expect(highlightIcon(null)).toBe(HIGHLIGHT_ICONS.sparkles)
    expect(highlightIcon(undefined)).toBe(HIGHLIGHT_ICONS.sparkles)
  })
})
