'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buildCategoryTree, type TreeCategory } from '@/lib/categories/tree'

interface CategoryTreeProps {
  categories: readonly TreeCategory[]
  /** Per-slug counts, parent including children. Undefined shows every category. */
  counts?: Record<string, number>
  activeSlug: string
  /** Pass '' to clear. */
  onSelect: (slug: string) => void
}

const rowClass = 'flex-1 flex items-center gap-2 text-left px-3 py-1.5 rounded-lg text-sm font-subhead transition-colors'
const activeClass = 'bg-brand-black text-white font-semibold'
const idleClass = 'text-charcoal hover:bg-pale-lavender hover:text-brand-black'

function Count({ n, active }: { n: number | null; active: boolean }) {
  if (n === null) return null
  return (
    <span
      className={cn('ml-auto text-[11px] tabular-nums', active ? 'text-white/80' : 'text-charcoal-soft')}
      aria-hidden="true"
    >
      {n}
    </span>
  )
}

/**
 * Parent categories A to Z. Picking a parent filters to it and everything under
 * it; the chevron beside a parent opens its subcategories.
 */
export function CategoryTree({ categories, counts, activeSlug, onSelect }: CategoryTreeProps) {
  const tree = buildCategoryTree(categories, counts, activeSlug)

  const [open, setOpen] = useState<Set<string>>(
    () => new Set(tree.filter((b) => b.expanded).map((b) => b.category.id))
  )
  // Picking a subcategory from outside the tree (a chip, a shared link) opens its parent.
  const [lastActive, setLastActive] = useState(activeSlug)
  if (activeSlug !== lastActive) {
    setLastActive(activeSlug)
    const home = tree.find((b) => b.expanded)
    if (home && !open.has(home.category.id)) setOpen(new Set(open).add(home.category.id))
  }

  function toggle(id: string) {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
  }

  if (tree.length === 0) {
    return <p className="px-3 text-sm font-subhead text-charcoal-soft">No categories match these filters.</p>
  }

  return (
    <ul className="flex flex-col gap-1" role="list" aria-label="Filter by category">
      {tree.map((branch) => {
        const { category, children } = branch
        const isOpen = open.has(category.id)
        const listId = `cat-children-${category.id}`
        return (
          <li key={category.id}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={branch.active}
                onClick={() => onSelect(branch.active ? '' : category.slug)}
                className={cn(rowClass, branch.active ? activeClass : idleClass)}
              >
                {category.name}
                <Count n={branch.count} active={branch.active} />
              </button>
              {children.length > 0 && (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={listId}
                  aria-label={`${isOpen ? 'Hide' : 'Show'} ${category.name} subcategories`}
                  onClick={() => toggle(category.id)}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-charcoal hover:bg-pale-lavender hover:text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black/40"
                >
                  <ChevronRight
                    className={cn('size-4 transition-transform motion-reduce:transition-none', isOpen && 'rotate-90')}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>
            {children.length > 0 && isOpen && (
              <ul id={listId} role="list" className="mt-1 ml-3 flex flex-col gap-1 border-l border-charcoal/10 pl-2">
                {children.map((child) => (
                  <li key={child.category.id} className="flex">
                    <button
                      type="button"
                      aria-pressed={child.active}
                      onClick={() => onSelect(child.active ? '' : child.category.slug)}
                      className={cn(rowClass, child.active ? activeClass : idleClass)}
                    >
                      {child.category.name}
                      <Count n={child.count} active={child.active} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
