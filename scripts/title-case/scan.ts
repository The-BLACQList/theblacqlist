// Ticket 205. Finds literal UI labels that are not in Title Case.
//
// It parses each source file with the TypeScript compiler, so it only looks at
// real JSX text and string literals, never at comments or identifiers:
//   - JSX text directly inside headings, buttons, nav links, tabs, menu items,
//     badges, form labels and the shared heading/CTA wrappers;
//   - string attributes such as <EmptyState title="…" actionLabel="…">;
//   - string properties such as { label: '…' }, { title: '…' }, { subject: '…' }.
// Anything interpolated (owner or database data) is never flagged, and nor is
// anything that reads as a sentence. Deliberate exceptions live in
// scripts/title-case-allowlist.json with a reason each.

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { toTitleCase, type TitleCaseOptions } from '../../lib/text/title-case'

export const ROOTS = ['app', 'components', 'lib', 'types']

/** Folders whose strings are owner-written sample data, prompts or non-UI. */
export const EXCLUDE_DIRS = [
  'lib/example', // test business 123 fixtures: owner-written sample text
  'lib/ai', // model prompts and tool schemas
  'lib/assistant', // assistant prompts
  'lib/supabase', // generated database types
  'lib/observability',
  'app/api', // JSON routes, no UI
]

const TEXT_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'button',
  'th',
  'legend',
  'label',
  'summary',
  'caption',
  'Button',
  'SectionHeading',
  'CardTitle',
  'DialogTitle',
  'SheetTitle',
  'AlertDialogTitle',
  'DrawerTitle',
  'TabsTrigger',
  'DropdownMenuItem',
  'DropdownMenuLabel',
  'SelectLabel',
  'Badge',
  'StatusBadge',
  'Label',
  'FormLabel',
  'Heading',
  'Subhead',
  'Eyebrow',
  // Email components (react-email)
  'Heading',
])

/** Tags that are often inline in prose. Flagged only when they stand alone. */
const LINK_TAGS = new Set(['Link', 'a', 'NextLink', 'ButtonLink'])

/** Attribute and property names that carry a visible label. */
const LABEL_KEYS = new Set([
  'title',
  'heading',
  'headline',
  'label',
  'cta',
  'ctaLabel',
  'ctaText',
  'buttonLabel',
  'buttonText',
  'actionLabel',
  'submitLabel',
  'primaryLabel',
  'secondaryLabel',
  'linkLabel',
  'linkText',
  'subject',
  'tabLabel',
  'sectionTitle',
  'pendingLabel',
  'confirmLabel',
  'cancelLabel',
  'emptyTitle',
  'eyebrow',
  'kicker',
])

/** Any other key that names a visible label: inputLabel, cardTitle, panelHeading… */
const LABEL_KEY_SUFFIX = /^(?!aria)[a-zA-Z]*(Label|Title|Heading|Cta)$/

function isLabelKey(name: string): boolean {
  return LABEL_KEYS.has(name) || LABEL_KEY_SUFFIX.test(name)
}

export interface Hit {
  file: string
  line: number
  start: number
  end: number
  opts: TitleCaseOptions
  found: string
  suggested: string
  kind: 'jsx' | 'attr' | 'prop'
}

export interface AllowEntry {
  file: string
  text: string
  reason: string
}

const MAX_WORDS = 10

/** Collapses whitespace so JSX text compares like the rendered string. */
export function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function looksLikeLabel(raw: string, requireLeadingCapital: boolean): boolean {
  const s = normalize(raw)
  if (!s || !/[a-z]/.test(s)) return false
  if (requireLeadingCapital && !/^[^A-Za-z]*[A-Z]/.test(s)) return false
  if (/[.;]$/.test(s) || /[.!?] [A-Za-z]/.test(s)) return false // a sentence
  if (/(…|\.\.\.)$/.test(s)) return false // a placeholder ("Select a reason…")
  if (/^I(['’]m|['’]ve|['’]d)?\s/.test(s)) return false // a first-person answer ("I run a business")
  if (/[_{}<>=]|https?:|\$\{|^\/|\b[a-z]+[A-Z][a-z]+\b/.test(s)) return false // code-ish
  if (s.split(' ').length > MAX_WORDS) return false
  if (/^[A-Z0-9 &'’\-—:!?]+$/.test(s)) return false // ALL CAPS text
  return true
}

function tagName(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  const t = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName
  return t.getText().split('.').pop() ?? ''
}

/** Checkbox, radio and switch labels read as options, so they stay as written. */
const CHOICE_TAGS = /^(input|Checkbox|Radio|RadioGroupItem|Switch|Toggle)$/

function containsChoice(el: ts.JsxElement): boolean {
  let found = false
  const look = (n: ts.Node) => {
    if (found) return
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxElement(n)) && CHOICE_TAGS.test(tagName(n))) {
      const attrs = ts.isJsxElement(n) ? n.openingElement.attributes : n.attributes
      const type = attrs.properties.find(
        (a) => ts.isJsxAttribute(a) && a.name.getText() === 'type'
      ) as ts.JsxAttribute | undefined
      const typeText = type?.initializer?.getText().replace(/['"{}]/g, '') ?? ''
      if (tagName(n) !== 'input' || /^(checkbox|radio)$/.test(typeText)) found = true
    }
    ts.forEachChild(n, look)
  }
  el.children.forEach(look)
  return found
}

/** Inline tags that carry on a label ("Find <em>your</em> people"). */
const INLINE_TAGS = /^(strong|em|b|i|u|s|span|a|Link|abbr|time|mark|code|sup|sub)$/

/**
 * True when the neighbouring piece starts a new line of text: a <br/>, an icon,
 * a badge or any block element. A {value} or an inline tag carries the label on,
 * so the words next to it are not the label's first or last word.
 */
function isBlockBreak(n: ts.Node | undefined): boolean {
  if (!n) return true
  if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) return !INLINE_TAGS.test(tagName(n))
  return false
}

function attrText(el: ts.JsxElement | ts.JsxSelfClosingElement, name: string): string {
  const attrs = ts.isJsxElement(el) ? el.openingElement.attributes : el.attributes
  const a = attrs.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText() === name) as
    | ts.JsxAttribute
    | undefined
  const init = a?.initializer
  if (!init) return ''
  if (ts.isStringLiteral(init)) return init.text
  if (ts.isJsxExpression(init) && init.expression) return init.expression.getText()
  return ''
}

/** The ids of every checkbox, radio and switch in the file. */
function choiceIds(sf: ts.SourceFile): Set<string> {
  const ids = new Set<string>()
  const look = (n: ts.Node) => {
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxElement(n)) && CHOICE_TAGS.test(tagName(n))) {
      const isChoice = tagName(n) !== 'input' || /^(checkbox|radio)$/.test(attrText(n, 'type'))
      const id = attrText(n, 'id')
      if (isChoice && id) ids.add(id)
    }
    ts.forEachChild(n, look)
  }
  look(sf)
  return ids
}

function hasProseSiblings(el: ts.JsxElement): boolean {
  const parent = el.parent
  if (!ts.isJsxElement(parent)) return false
  return parent.children.some((c) => ts.isJsxText(c) && /[A-Za-z]{2}/.test(c.text))
}

export function scanSource(file: string, source: string): Hit[] {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const hits: Hit[] = []
  const choices = choiceIds(sf)

  const push = (
    start: number,
    end: number,
    raw: string,
    kind: Hit['kind'],
    opts: TitleCaseOptions = {}
  ) => {
    const suggested = toTitleCase(raw, opts)
    if (suggested === raw) return
    hits.push({
      file,
      line: sf.getLineAndCharacterOfPosition(start).line + 1,
      start,
      end,
      opts,
      found: normalize(raw),
      suggested: normalize(suggested),
      kind,
    })
  }

  const checkString = (
    lit: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
    kind: Hit['kind']
  ) => {
    if (!looksLikeLabel(lit.text, true)) return
    // Rewrite the inside of the quotes only.
    const start = lit.getStart(sf) + 1
    const end = lit.getEnd() - 1
    const raw = source.slice(start, end)
    if (raw !== lit.text) return // escapes inside; leave it to a human
    push(start, end, raw, kind)
  }

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const name = tagName(node)
      const isLabel = /^(label|Label|FormLabel)$/.test(name)
      const isOption = isLabel && (containsChoice(node) || choices.has(attrText(node, 'htmlFor')))
      // Screen-reader-only text is heard, not seen, so its casing is left alone.
      const srOnly = /\bsr-only\b/.test(attrText(node, 'className'))
      const isText = TEXT_TAGS.has(name) && !isOption && !srOnly
      const isLink = LINK_TAGS.has(name) && !hasProseSiblings(node) && !srOnly
      if (isText || isLink) {
        // Pieces that render as words: text and inline values, not whitespace.
        const parts = node.children.filter((c) => !(ts.isJsxText(c) && !c.text.trim()))
        node.children.forEach((child) => {
          if (ts.isJsxText(child)) {
            if (!looksLikeLabel(child.text, false)) return
            const i = parts.indexOf(child)
            const start = child.getStart(sf)
            const end = child.getEnd()
            push(start, end, source.slice(start, end), 'jsx', {
              continuesBefore:
                i > 0 && !/^\s*[:—–|·]/.test(child.text) && !isBlockBreak(parts[i - 1]),
              continuesAfter: i < parts.length - 1 && !isBlockBreak(parts[i + 1]),
            })
          } else if (
            ts.isJsxExpression(child) &&
            child.expression &&
            (ts.isStringLiteral(child.expression) ||
              ts.isNoSubstitutionTemplateLiteral(child.expression))
          ) {
            checkString(child.expression, 'jsx')
          }
        })
      }
    }

    if (
      ts.isJsxAttribute(node) &&
      isLabelKey(node.name.getText()) &&
      node.initializer &&
      !CHOICE_TAGS.test(tagName(node.parent.parent as ts.JsxSelfClosingElement))
    ) {
      const init = node.initializer
      if (ts.isStringLiteral(init)) checkString(init, 'attr')
      else if (
        ts.isJsxExpression(init) &&
        init.expression &&
        (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))
      ) {
        checkString(init.expression, 'attr')
      }
    }

    if (ts.isPropertyAssignment(node) && isLabelKey(node.name.getText().replace(/['"]/g, ''))) {
      const init = node.initializer
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init))
        checkString(init, 'prop')
    }

    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      walk(p, out)
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec|d)\.tsx?$/.test(entry.name)) {
      out.push(p)
    }
  }
}

export function listFiles(repoRoot: string): string[] {
  const files: string[] = []
  for (const r of ROOTS) {
    const abs = path.join(repoRoot, r)
    if (fs.existsSync(abs)) walk(abs, files)
  }
  return files
    .map((f) => path.relative(repoRoot, f).split(path.sep).join('/'))
    .filter((f) => !EXCLUDE_DIRS.some((d) => f === d || f.startsWith(d + '/')))
    .sort()
}

export function loadAllowlist(repoRoot: string): AllowEntry[] {
  const p = path.join(repoRoot, 'scripts/title-case-allowlist.json')
  if (!fs.existsSync(p)) return []
  return JSON.parse(fs.readFileSync(p, 'utf8')) as AllowEntry[]
}

export function scanRepo(repoRoot: string): Hit[] {
  const allow = loadAllowlist(repoRoot)
  const allowed = new Set(allow.map((a) => `${a.file}\u0000${normalize(a.text)}`))
  const hits: Hit[] = []
  for (const file of listFiles(repoRoot)) {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8')
    for (const h of scanSource(file, source)) {
      if (!allowed.has(`${h.file}\u0000${h.found}`)) hits.push(h)
    }
  }
  return hits
}
