import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Debt ⑰ — React 19 resets an uncontrolled `<form action={serverAction}>` once
 * the action resolves. Every uncontrolled field on such a form therefore throws
 * the user's typing away on exactly the occasion they most need it kept: a
 * failed validation. `frontend.md` and `ux.md` both say the opposite in as many
 * words ("Preserve user input on validation errors. Do not reset the form."),
 * and the rule was quietly false on ~30 components.
 *
 * Two of those surfaces are 🔴 and go live at the flip: sign-up (loses the name
 * and email when the password is rejected — the top of the funnel) and the
 * review form (loses up to 2000 characters of writing on any server-side
 * rejection). Both are now controlled. This file is the guard on that, and on
 * any field added to either form later.
 *
 * It reads source text rather than rendering: there is no @testing-library in
 * this repo, and the defect is a property of the JSX — whether a field is bound
 * to state at all — not of any one runtime interaction. A rendering test would
 * also have to reproduce React 19's post-action reset to fail, which is exactly
 * the behaviour under test.
 */

const SURFACES = [
  {
    label: 'sign-up (name + email must survive a rejected password)',
    file: 'app/(auth)/sign-up/page.tsx',
  },
  {
    label: 'review form (a 2000-character body must survive a rejection)',
    file: 'components/entity-page/ReviewForm.tsx',
  },
] as const

/** Element types a user cannot type into, or that React cannot control. */
const EXEMPT_TYPES = ['hidden', 'file']

interface Field {
  tag: 'input' | 'textarea'
  name: string
  type: string | null
  attrs: string
}

/**
 * Pull every <input> / <textarea> opening tag out of a TSX file with its
 * attribute text. Deliberately crude — these two files are hand-written JSX
 * with one element per tag, and a real parser would be a dependency bought for
 * a single assertion.
 */
function readFields(relPath: string): Field[] {
  const source = readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
  const fields: Field[] = []

  for (const match of source.matchAll(/<(input|textarea)\b([\s\S]*?)\/?>/g)) {
    const tag = match[1] as 'input' | 'textarea'
    const attrs = match[2] ?? ''
    const name = /\bname=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(attrs)
    const type = /\btype="([^"]*)"/.exec(attrs)
    fields.push({
      tag,
      // A template-literal name (the tour rail's per-step ids) keeps its raw
      // text; it only ever labels the field in a failure message.
      name: name?.[1] ?? name?.[2] ?? '(unnamed)',
      type: type?.[1] ?? null,
      attrs,
    })
  }

  return fields
}

describe('debt ⑰ — the two 🔴 forms preserve input across a server-action reset', () => {
  it.each(SURFACES)('$label', ({ file }) => {
    const fields = readFields(file)

    // Guards the regex itself: if a refactor renames the file or reshapes the
    // JSX past what this matcher understands, the suite must go red rather than
    // pass over zero fields.
    expect(fields.length).toBeGreaterThan(0)

    const typeable = fields.filter(
      (f) => f.type === null || !EXEMPT_TYPES.includes(f.type)
    )
    expect(typeable.length).toBeGreaterThan(0)

    for (const field of typeable) {
      // Radios and checkboxes are controlled through `checked`, everything else
      // through `value`. Either way there must also be an onChange, or the
      // field is bound but frozen.
      const bindsState =
        field.type === 'radio' || field.type === 'checkbox'
          ? /\bchecked=\{/.test(field.attrs)
          : /\bvalue=\{/.test(field.attrs)

      expect(
        bindsState,
        `${file}: <${field.tag} name="${field.name}"> is uncontrolled — React 19 will wipe it when the server action resolves`
      ).toBe(true)

      expect(
        /\bonChange=\{/.test(field.attrs),
        `${file}: <${field.tag} name="${field.name}"> binds state but has no onChange — it would be read-only`
      ).toBe(true)
    }
  })

  it('does not track the review body length in a second piece of state', () => {
    // `bodyLen` used to be its own useState. It survived the form reset while
    // the textarea beside it did not, so the counter went on reporting the
    // characters of a review the user could no longer see. Derive it from the
    // value or the two can disagree again.
    const source = readFileSync(
      path.resolve(process.cwd(), 'components/entity-page/ReviewForm.tsx'),
      'utf8'
    )
    expect(source).not.toMatch(/\bsetBodyLen\b/)
    expect(source).toMatch(/\{body\.length\}\/2000/)
  })
})
