// =============================================================================
// The home hero with and without the visitor guide (ticket 146)
// =============================================================================
// Flag off must be exactly the old hero: headline, tagline, search bar, chips.
// Flag on: headline, then the guide, which is the only bar and holds the chips.
// The client pieces are stubbed with markers so the server markup is checked
// without a browser.
// =============================================================================

import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({
  default: (props: { priority?: boolean; alt: string; src: string }) =>
    createElement('img', { 'data-priority': props.priority ? 'yes' : 'no', alt: props.alt, src: props.src }),
}))
vi.mock('@/components/discovery/SearchBar', () => ({
  SearchBar: () => createElement('div', { 'data-marker': 'search-bar' }),
}))
vi.mock('@/components/home/HeroQuickFilters', () => ({
  HeroQuickFilters: () => createElement('div', { 'data-marker': 'chips' }),
}))
vi.mock('@/components/home/AiGuide', () => ({
  AiGuide: () => createElement('div', { 'data-marker': 'ai-guide' }),
}))

import { HomeHero } from '@/components/home/HomeHero'

function order(html: string, needles: string[]): number[] {
  return needles.map((n) => html.indexOf(n))
}

describe('HomeHero', () => {
  it('with the flag off keeps the old structure and has no guide', () => {
    const html = renderToStaticMarkup(createElement(HomeHero))
    const positions = order(html, ['Find &amp; Be Found.', 'One living index.', 'data-marker="search-bar"', 'data-marker="chips"'])
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(html).not.toContain('ai-guide')
    expect(html).not.toContain('Or search by name')
    expect(renderToStaticMarkup(createElement(HomeHero, { aiGuide: false }))).toBe(html)
  })

  it('with the flag on has one bar: the guide, with no separate name search', () => {
    const html = renderToStaticMarkup(createElement(HomeHero, { aiGuide: true }))
    const positions = order(html, ['Find &amp; Be Found.', 'data-marker="ai-guide"'])
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(html).not.toContain('search-bar')
    expect(html).not.toContain('Or search by name')
    // The chips live inside the guide now (stubbed here), not under the hero.
    expect(html).not.toContain('data-marker="chips"')
  })

  it('keeps the hero photo as the only preloaded image either way', () => {
    for (const aiGuide of [false, true]) {
      const html = renderToStaticMarkup(createElement(HomeHero, { aiGuide }))
      expect(html.match(/data-priority="yes"/g)).toHaveLength(1)
      expect(html).not.toContain('data-priority="no"')
    }
  })
})
